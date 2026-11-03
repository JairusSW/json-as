import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-join-oracle-"));
const valid = [
  [],
  [""],
  [null],
  ["a", "b"],
  [null, "", null, "x", null],
  ["café", "中文", "😀", "a\u0000b", "\ud800", '"\\\n'],
  [true, 7, -2.5, false, null],
  ["x", [1, "y"], { key: 7 }],
  Array.from({ length: 1000 }, (_, i) => "value-" + i),
];
const separators = ["", ",", "::", "🟢"];
let checks = 0;
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const runtime of ["incremental", "minimal"]) {
      const wasm = path.join(dir, "join.wasm");
      execFileSync(
        process.execPath,
        [
          path.join(root, "node_modules/assemblyscript/bin/asc.js"),
          "assembly/__tests__/join-oracle.fixture.ts",
          "--transform",
          "./transform",
          "--exportRuntime",
          "--runtime",
          runtime,
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
            JSON_STRICT: "false",
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
              throw new Error("Join aborted");
            },
          },
        },
      ).exports;
      const encode = (text) => {
        const bytes = Buffer.from(text, "utf16le");
        const ptr = g.__pin(g.allocInput(bytes.length));
        new Uint8Array(g.memory.buffer, ptr, bytes.length).set(bytes);
        return ptr;
      };
      for (const values of valid)
        for (const separator of separators)
          for (const eager of [false, true]) {
            const source = encode(JSON.stringify(values)),
              sep = encode(separator);
            try {
              const ptr = g.run(source, sep, eager);
              const size =
                new DataView(g.memory.buffer).getUint32(ptr - 4, true) &
                0x7fffffff;
              const actual = Buffer.from(g.memory.buffer, ptr, size).toString(
                "utf16le",
              );
              const expected = values
                .map((value) =>
                  typeof value === "string"
                    ? value
                    : value === null
                      ? ""
                      : JSON.stringify(value),
                )
                .join(separator);
              assert.equal(actual, expected, `${mode}/${runtime}/${eager}`);
              checks++;
            } finally {
              g.__unpin(sep);
              g.__unpin(source);
            }
          }
    }
  console.log(
    `V8 join oracle: ${checks} lazy/eager checks across six mode/runtime configurations`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
