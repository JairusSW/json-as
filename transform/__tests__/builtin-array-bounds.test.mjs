import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

// Exercise actual guest aborts. The pinned try-as version cannot catch these
// generic helper throws reliably, so each rejection gets a fresh Wasm instance.
const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "json-as-array-bounds-"),
);
let checks = 0;
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
    const output = path.join(directory, `${mode}.wasm`);
    execFileSync(
      process.execPath,
      [
        path.join(root, "node_modules/assemblyscript/bin/asc.js"),
        "assembly/__tests__/builtin-array-bounds.fixture.ts",
        "--transform",
        "./transform",
        "--runtime",
        "incremental",
        "--exportRuntime",
        ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        "-o",
        output,
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
    const module = await WebAssembly.compile(fs.readFileSync(output));
    function run(name, source) {
      const instance = new WebAssembly.Instance(module, {
        env: {
          abort() {
            throw new Error("JSON decoder rejected input");
          },
        },
      });
      const wasm = instance.exports;
      const bytes = Buffer.from(source, "utf16le");
      const ptr = wasm.__pin(wasm.allocInput(bytes.length));
      new Uint8Array(wasm.memory.buffer, ptr, bytes.length).set(bytes);
      try {
        return wasm[name](ptr);
      } finally {
        wasm.__unpin(ptr);
      }
    }
    for (const name of ["rawLength", "boxLength"]) {
      for (const input of ["[] []", "[]0]", "[true] [false]", "{}"]) {
        assert.throws(() => run(name, input), /JSON decoder rejected input/);
        checks++;
      }
      assert.equal(run(name, "[true,false]"), 2);
      checks++;
    }
  }
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
console.log(`Builtin array bounds: ${checks} direct Wasm checks passed`);
