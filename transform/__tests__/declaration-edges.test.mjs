import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-declarations-"));
const failures = [];
let checks = 0;
const expected = {
  "runtime-json": '{"before":1,"item":7,"after":2}',
  "block-json": '{"before":1,"item":7,"after":2}',
  "callback-inherited": "7:9",
  "default-reexport": '{"value":7,"tail":9}',
  default: '{"value":7,"tail":9}|5',
  "default-codec": "7",
  callback: "{}",
  "callback-init": "7:9",
  "local-alias": '{"value":9}',
  "omitted-lazy": '{"tail":3}|2:9',
  "local-json": "7",
  "namespace-json": "7",
};
function decode(g, p) {
  return Buffer.from(
    g.memory.buffer,
    p,
    new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
  ).toString("utf16le");
}
try {
  for (const mode of process.env.PROBE_QUICK
    ? ["SWAR"]
    : ["NAIVE", "SWAR", "SIMD"])
    for (const strict of process.env.PROBE_QUICK ? [false] : [false, true])
      for (const fast of process.env.PROBE_QUICK ? [true] : [false, true])
        for (const [name, wanted] of Object.entries(expected)) {
          const label = `${name}/${mode}/strict=${strict}/fast=${fast}`;
          try {
            const file = path.join(dir, `${name}.wasm`);
            const result = spawnSync(
              process.execPath,
              [
                path.join(root, "node_modules/assemblyscript/bin/asc.js"),
                `assembly/__tests__/declaration-edges/${name}.fixture.ts`,
                "--transform",
                "./transform",
                "-O3",
                "--exportRuntime",
                "-o",
                file,
                ...(mode === "SIMD" ? ["--enable", "simd"] : []),
              ],
              {
                cwd: root,
                env: {
                  ...process.env,
                  JSON_MODE: mode,
                  JSON_STRICT: String(strict),
                  JSON_USE_FAST_PATH: fast ? "1" : "0",
                  JSON_AS_LIBRARY_SOURCE: "assembly/index",
                },
                encoding: "utf8",
              },
            );
            assert.equal(result.status, 0, result.stderr || result.stdout);
            assert.doesNotMatch(
              result.stderr + result.stdout,
              /(?:WARNING|PEDANTIC) AS\d+:/,
              label + "/diagnostics",
            );
            let g;
            g = new WebAssembly.Instance(
              new WebAssembly.Module(fs.readFileSync(file)),
              {
                env: {
                  abort(m, f, l, c) {
                    throw Error(decode(g, m) + ` (${decode(g, f)}:${l}:${c})`);
                  },
                },
              },
            ).exports;
            assert.equal(decode(g, g.run()), wanted, label);
            checks++;
          } catch (e) {
            failures.push(label + ": " + (e.stderr?.toString() || e.message));
          }
        }
  // The transform module stays cached across every invocation in this process.
  const asc = await import("assemblyscript/asc");
  const keys = [
    "JSON_MODE",
    "JSON_STRICT",
    "JSON_DIAGNOSTICS",
    "JSON_CACHE",
    "JSON_USE_FAST_PATH",
    "JSON_AS_LIBRARY_SOURCE",
  ];
  const saved = keys.map((key) => process.env[key]);
  try {
    for (const mode of process.env.PROBE_QUICK
      ? ["SWAR"]
      : ["NAIVE", "SWAR", "SIMD"])
      for (const [strict, diagnostics, cache, fast, flags, size] of [
        [false, true, "false", "1", 10, 0],
        [true, false, "64KB", "0", 5, 64000],
        [false, true, "false", "1", 10, 0],
      ]) {
        Object.assign(process.env, {
          JSON_MODE: mode,
          JSON_STRICT: String(strict),
          JSON_DIAGNOSTICS: String(diagnostics),
          JSON_CACHE: cache,
          JSON_USE_FAST_PATH: fast,
          JSON_AS_LIBRARY_SOURCE: "assembly/index",
        });
        const file = path.join(dir, "config.wasm");
        const result = await asc.main(
          [
            "assembly/__tests__/declaration-edges/config.fixture.ts",
            "--transform",
            "./transform",
            "-o",
            file,
            ...(mode === "SIMD" ? ["--enable", "simd"] : []),
          ],
          {
            stdout: asc.createMemoryStream(),
            stderr: asc.createMemoryStream(),
          },
        );
        assert.ifError(result.error && Error(result.stderr.toString()));
        assert.doesNotMatch(
          result.stderr.toString(),
          /(?:WARNING|PEDANTIC) AS\d+:/,
          mode + "/configuration diagnostics",
        );
        const g = new WebAssembly.Instance(
          new WebAssembly.Module(fs.readFileSync(file)),
          {
            env: {
              abort() {
                throw Error("parse rejected");
              },
            },
          },
        ).exports;
        assert.equal(g.flags(), flags, mode + "/configuration");
        assert.equal(g.cacheSize(), size, mode + "/cache");
        assert.equal(g.run(), 9, mode + "/valid parse");
        if (strict) assert.throws(() => g.invalid());
        else assert.equal(g.invalid(), 7);
        checks += 4;
      }
  } finally {
    keys.forEach((key, i) => {
      if (saved[i] === undefined) delete process.env[key];
      else process.env[key] = saved[i];
    });
  }
  assert.deepEqual(failures, []);
  console.log(
    `Declaration edges: ${checks} export, callback, lexical scope and override checks passed`,
  );
} finally {
  if (failures.length) console.error(failures.join("\n"));
  fs.rmSync(dir, { recursive: true, force: true });
}
