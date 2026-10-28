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
    function runAtMemoryEnd(name, source) {
      const instance = new WebAssembly.Instance(module, {
        env: {
          abort() {
            throw new Error("JSON decoder rejected input");
          },
        },
      });
      const wasm = instance.exports;
      wasm.memory.grow(1);
      const bytes = Buffer.from(source, "utf16le");
      const ptr = wasm.memory.buffer.byteLength - bytes.length;
      new Uint8Array(wasm.memory.buffer, ptr, bytes.length).set(bytes);
      return wasm[name](ptr, bytes.length);
    }
    const rejectionCases = {
      rawLength: ["[] []", "[]0]", "[true] [false]", "{}"],
      boxLength: ["[] []", "[]0]", "[true] [false]", "{}"],
      typedLength: [
        "12",
        "{}",
        '{"n":1}',
        '"[1,2]"',
        "null",
        "true",
        "[1,2] trailing",
        "prefix [1,2]",
        "[1 2]",
        "[1,,2]",
        "[1,]",
        "[1.0]",
        "[1e1]",
      ],
      floatLength: [
        "12",
        "{}",
        '"[1,2]"',
        "[1,2] trailing",
        "prefix [1,2]",
        "[1 2]",
        "[1,,2]",
        "[1,]",
        "[1e]",
      ],
      bufferLength: [
        "12",
        "{}",
        '{"n":1}',
        '"[1,2]"',
        "null",
        "true",
        "[1,2] trailing",
        "prefix [1,2]",
        "[1 2]",
        "[1,,2]",
        "[1,]",
        "[-1]",
        "[1.0]",
      ],
      staticBoolLength: [
        "true",
        "{}",
        '"[true]"',
        "[true] trailing",
        "prefix [true]",
        "[true false]",
        "[true,,false]",
        "[true,]",
        "[trux]",
        "[falsx]",
      ],
      staticIntLength: [
        "12",
        "{}",
        '"[1,2]"',
        "[1,2] trailing",
        "[1 2]",
        "[1,,2]",
        "[1,]",
        "[1.0]",
      ],
      staticFloatLength: [
        "12",
        "{}",
        '"[1,2]"',
        "[1,2] trailing",
        "[1 2]",
        "[1,,2]",
        "[1,]",
        "[1e]",
      ],
      staticStringLength: [
        '"x"',
        "{}",
        '["x"] trailing',
        '["x" "y"]',
        '["x",, "y"]',
        '["x",]',
        '["unterminated]',
      ],
      boolValue: ["truex", "falsex", "true false", "false true", '"true"'],
      valueType: [
        "nullx",
        "null true",
        "truex",
        "1e",
        '"ok" trailing',
        "[] trailing",
        "{} trailing",
      ],
      valueTypeInternal: [
        "nullx",
        "truex",
        "1e",
        '"ok" trailing',
        "[] trailing",
        "{} trailing",
      ],
    };
    for (const [name, inputs] of Object.entries(rejectionCases)) {
      for (const input of inputs) {
        assert.throws(
          () => run(name, input),
          /JSON decoder rejected input/,
          `${mode}: ${name} accepted ${JSON.stringify(input)}`,
        );
        checks++;
      }
    }
    assert.equal(run("rawLength", "[true,false]"), 2);
    assert.equal(run("boxLength", "[true,false]"), 2);
    assert.equal(run("typedLength", "[-1,2]"), 2);
    assert.equal(run("floatLength", "[1.5,-2e3]"), 2);
    assert.equal(run("bufferLength", "[0,255,256]"), 3);
    assert.equal(run("staticBoolLength", "[true,false]"), 2);
    assert.equal(run("staticIntLength", "[-1,2]"), 2);
    assert.equal(run("staticFloatLength", "[1.5,-2e3]"), 2);
    assert.equal(run("staticStringLength", '["x","y"]'), 2);
    assert.equal(runAtMemoryEnd("staticBoolLengthAt", "[true ]"), 1);
    assert.equal(runAtMemoryEnd("staticBoolLengthAt", "[false ]"), 1);
    assert.equal(runAtMemoryEnd("staticBoolLengthAt", "[true,false ]"), 2);
    assert.equal(run("boolValue", "true \n"), 1);
    assert.equal(run("boolValue", "false\t"), 0);
    assert.equal(run("valueType", "null \n"), 0);
    assert.equal(run("valueType", '"ok" \n'), 13);
    assert.equal(run("valueType", "[] \n"), 15);
    assert.equal(run("valueType", "{} \n"), 14);
    assert.equal(run("valueType", "01"), 11);
    assert.equal(run("valueType", "1."), 11);
    assert.equal(run("valueType", "-Infinity"), 11);
    assert.equal(run("valueType", "NaN"), 11);
    assert.equal(run("valueTypeInternal", '"ok" \n'), 13);
    assert.equal(run("valueTypeInternal", "[] \n"), 15);
    assert.equal(run("valueTypeInternal", "{} \n"), 14);
    assert.equal(run("typedLength", "[01]"), 1);
    assert.equal(run("floatLength", "[01,1.]"), 2);
    assert.equal(run("floatFirst", "[1e00001]"), 10);
    assert.equal(run("bufferLength", "[01]"), 1);
    assert.equal(run("staticIntLength", "[01]"), 1);
    assert.equal(run("staticFloatLength", "[01,1.]"), 2);
    assert.ok(Number.isNaN(run("floatFirst", "[NaN]")));
    assert.equal(run("floatFirst", "[Infinity]"), Infinity);
    assert.equal(run("floatFirst", "[-Infinity]"), -Infinity);
    checks += 34;
  }
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
console.log(`Builtin array bounds: ${checks} direct Wasm checks passed`);
