import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-builtin-names-"));
const failures = [];
let checks = 0;
const fixtures = ["typed", "array", "array-after", "codec-array", "control"];

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
        for (const name of fixtures) {
          const label = `${name}/${mode}/strict=${strict}/fast=${fast}`;
          try {
            const file = path.join(dir, `${name}.wasm`);
            execFileSync(
              process.execPath,
              [
                path.join(root, "node_modules/assemblyscript/bin/asc.js"),
                `assembly/__tests__/builtin-name-edges/${name}.fixture.ts`,
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
                stdio: "pipe",
              },
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
            for (const kind of [0, 1, 2, 3]) {
              assert.equal(g.run(kind), 7, label + "/route=" + kind);
              checks++;
            }
            assert.equal(
              decode(g, g.roundtrip()),
              '{"child":{"value":7}}',
              label + "/roundtrip",
            );
            checks++;
            if (name === "control")
              for (const reuse of [false, true]) {
                assert.equal(
                  decode(g, g.native(reuse)),
                  '{"bytes":[1,2],"rows":[3,4]}',
                  label + "/native/" + reuse,
                );
                checks++;
              }
          } catch (e) {
            failures.push(label + ": " + (e.stderr?.toString() || e.message));
          }
        }
  assert.deepEqual(failures, []);
  console.log(
    `Builtin name edges: ${checks} root/nested, fresh/reused and native-control checks passed`,
  );
} finally {
  if (failures.length) console.error(failures.join("\n"));
  fs.rmSync(dir, { recursive: true, force: true });
}
