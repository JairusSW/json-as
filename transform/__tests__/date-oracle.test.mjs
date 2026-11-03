import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-date-oracle-"));
const cases = [];
for (const year of [
  -10000, -400, -100, -4, -1, 0, 1, 4, 99, 100, 400, 1969, 1970, 2000, 9999,
  10000,
])
  for (const month of [0, 1, 11])
    for (const day of [1, 28, 29]) {
      const value = new Date(0);
      value.setUTCFullYear(year, month, day);
      value.setUTCHours(12, 34, 56, 789);
      cases.push(value.toISOString());
    }
cases.push(
  "-271821-04-20T00:00:00.000Z",
  "+275760-09-13T00:00:00.000Z",
  "1970-01-01T00:00:00.000Z",
  "2000-02-29T12:34:56Z",
  "2000-02-29T12:34:56.7Z",
  "2000-02-29T12:34:56.789+02:00",
);
let checks = 0;
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const strict of [false, true]) {
      const file = path.join(dir, "date.wasm");
      execFileSync(
        process.execPath,
        [
          path.join(root, "node_modules/assemblyscript/bin/asc.js"),
          "assembly/__tests__/date-oracle.fixture.ts",
          "--transform",
          "./transform",
          "--exportRuntime",
          "-O3",
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
            JSON_AS_LIBRARY_SOURCE: "assembly/index",
          },
          stdio: "pipe",
        },
      );
      const g = new WebAssembly.Instance(
        new WebAssembly.Module(fs.readFileSync(file)),
        {
          env: {
            abort() {
              throw new Error("Date rejected input");
            },
          },
        },
      ).exports;
      for (const text of cases) {
        const json = JSON.stringify(text);
        const source = Buffer.from(json, "utf16le");
        const ptr = g.__pin(g.allocInput(source.length));
        new Uint8Array(g.memory.buffer, ptr, source.length).set(source);
        for (let route = 0; route < 4; route++) {
          assert.equal(
            g.run(ptr, route),
            BigInt(Date.parse(JSON.parse(json))),
            `${mode}/${strict}/${route}: ${json}`,
          );
          checks++;
        }
        g.__unpin(ptr);
      }
    }
  console.log(`V8 Date/JSON oracle: ${checks} root/reuse/field/array checks`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
