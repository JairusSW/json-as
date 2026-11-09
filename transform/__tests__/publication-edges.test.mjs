import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-type-binding-"));
const failures = [];
let checks = 0;
const expected = {
  nul: '3|11|"a\\u0000b"|"left\\u00001right"',
  lines: "10|10",
  arrays:
    '{"flags":[true,false],"text":["one","two"],"rows":[{"value":7}]}|[7]|[7]|[7]',
  exports: '{"x":1}|7|0',
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
            execFileSync(
              process.execPath,
              [
                path.join(root, "node_modules/assemblyscript/bin/asc.js"),
                `assembly/__tests__/publication-edges/${name}.fixture.ts`,
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
            assert.equal(decode(g, g.run()), wanted, label);
            checks++;
          } catch (e) {
            failures.push(label + ": " + (e.stderr?.toString() || e.message));
          }
        }
  assert.deepEqual(failures, []);
  console.log(
    `Publication edges: ${checks} literal, native-array and package-export checks passed`,
  );
} finally {
  if (failures.length) console.error(failures.join("\n"));
  fs.rmSync(dir, { recursive: true, force: true });
}
