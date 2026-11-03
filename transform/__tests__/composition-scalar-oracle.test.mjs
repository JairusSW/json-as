import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-static-oracle-"));
const values = [
  0,
  -0,
  1.5,
  -7.25,
  1e20,
  1e-100,
  Number.MIN_VALUE,
  Number.MAX_VALUE,
];
let checks = 0;
const decode = (g, p) => {
  const bytes =
    new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff;
  return Buffer.from(g.memory.buffer, p, bytes).toString("utf16le");
};
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const strict of [false, true])
      for (const fast of [false, true]) {
        const wasm = path.join(dir, "static.wasm");
        execFileSync(
          process.execPath,
          [
            path.join(root, "node_modules/assemblyscript/bin/asc.js"),
            "assembly/__tests__/composition-scalar-oracle.fixture.ts",
            "--transform",
            "./transform",
            "--exportRuntime",
            "-O3",
            "-o",
            wasm,
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
        const g = new WebAssembly.Instance(
          new WebAssembly.Module(fs.readFileSync(wasm)),
          {
            env: {
              abort() {
                throw new Error("Rejected JSON");
              },
            },
          },
        ).exports;
        const call = (source, kind, reuse) => {
          const bytes = Buffer.from(source, "utf16le");
          const ptr = g.__pin(g.allocInput(bytes.length));
          new Uint8Array(g.memory.buffer, ptr, bytes.length).set(bytes);
          try {
            return decode(g, g.run(ptr, kind, reuse));
          } finally {
            g.__unpin(ptr);
          }
        };
        const inputs = values
          .map((value, i) => ({
            kind: 0,
            value: { value, signed: i - 4, unsigned: i * 100 },
          }))
          .concat(
            [1, 257, 258, -1, 2147483647].map((value) => ({
              kind: 1,
              value: { value },
            })),
          )
          .concat([0, 1, 7].map((value) => ({ kind: 2, value: { value } })));
        for (const { kind, value } of inputs)
          for (const space of [undefined, 2])
            for (const reuse of [false, true]) {
              const source = JSON.stringify(value, null, space);
              assert.deepEqual(
                JSON.parse(call(source, kind, reuse)),
                JSON.parse(source),
                `${mode}/${strict}/${fast}/${kind}/${reuse}: ${source}`,
              );
              checks++;
            }
        if (strict)
          for (const source of [
            "{",
            '{"value":257,}',
            '{"value":01}',
            '{"value":NaN}',
          ]) {
            assert.throws(() => JSON.parse(source));
            assert.throws(() => call(source, 1, false));
            checks++;
          }
      }
  console.log(
    `Scalar spelling/cast/import V8/RFC oracle: ${checks} root/field/reuse checks across 12 configurations`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
