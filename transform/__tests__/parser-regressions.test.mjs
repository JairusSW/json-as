import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

// Fresh guests isolate real aborts: try-as cannot catch all generic helper
// errors. Host-owned strings also let these tests release the only input root
// and collect before touching lazy fields, unlike constant-string fixtures.
const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "json-as-regressions-"),
);
const date = '"2020-01-01T00:00:00.000Z"';
const positive = [
  ["directInt", " -2147483648 \n", -2147483648],
  ["directInt", "-0", 0],
  ["directUnsigned", "42", 42],
  ["narrowInt", "256", 0],
  ["fieldInt", '{"n":42}', 42],
  ["lazyInt", '{"n":42}', 42],
  ["setBool", "[true, false,true]", "[true,false]"],
  ["setBool", "[]", "[]"],
  ["setInt", "[-12,0,34]", "[-12,0,34]"],
  ["setUnsigned", "[0,42]", "[0,42]"],
  ["mapInt", ' {"x":1} \n', '{"x":1}'],
  ["mapInt", " {} ", "{}"],
  ["nullableRawMap", '{"x":null}', 1],
  ["nonnullRawMap", '{"x":null}', 1],
  ["nullableRawTransitions", '{"x":[1,2]}', '{"x":[1,2]}'],
  ["arrayDate", `[${date}]`, `[${date}]`],
  ["staticDate", `[null,${date}]`, `[null,${date}]`],
  ["reuseStaticDate", `[${date},null]`, `[${date},null]`],
  ["staticSet", "[[1,2],null,[]]", "[[1,2],null,[]]"],
  ["staticArr", "[[1,2],null,[]]", "[[1,2],null,[]]"],
  ["arrayStatic", "[[1,2],null,[]]", "[[1,2],null,[]]"],
  ["reuseArrayStatic", "[[1,2],null]", "[[1,2],null]"],
  ["arrayArr", "[[1,2],null,[]]", "[[1,2],null,[]]"],
  ["arrayNested", "[[1],[2]]", "[[1],[2]]"],
  ...[
    "arrayDate",
    "staticDate",
    "staticSet",
    "staticArr",
    "arrayStatic",
    "arrayArr",
  ].map((name) => [name, "[]", "[]"]),
  ["uniqueArrayIdentity", '[{"n":1},{"n":2}]', 1],
  ["uniqueMapIdentity", '{"a":{"n":1},"b":{"n":2}}', 1],
  ["sharedRawMap", '{"a":1,"b":2}', '{"a":1,"b":2}'],
  ["sharedNullableArray", '[{"n":1},null,{"n":3}]', '[{"n":1},null,{"n":3}]'],
];
const collections = `{"dates":[${date},null],"sets":[[1,2],null],"arrays":[[3,4],null],"dynamic":[[5,6],null]}`;
positive.push(["fieldCollections", collections, collections]);
for (const value of [
  [{ n: 1 }, { n: 2 }],
  [{ n: 1 }, { n: 2 }, { n: 3 }],
  [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }],
]) {
  for (const indent of [undefined, 2]) {
    positive.push([
      "sharedArray",
      JSON.stringify(value, null, indent),
      JSON.stringify(value),
    ]);
    positive.push([
      "sharedArrayField",
      JSON.stringify({ items: value }, null, indent),
      JSON.stringify({ items: value }),
    ]);
  }
}
for (const value of [
  { a: { n: 1 }, b: { n: 2 } },
  { c: { n: 3 }, a: { n: 1 }, b: { n: 2 } },
]) {
  // Map insertion order is preserved on reuse, even when input keys reorder.
  const expected = Object.fromEntries(
    ["a", "b", "c"]
      .filter((key) => key in value)
      .map((key) => [key, value[key]]),
  );
  positive.push(["sharedMap", JSON.stringify(value), JSON.stringify(expected)]);
  positive.push([
    "sharedMap",
    JSON.stringify(value, null, 2),
    JSON.stringify(expected),
  ]);
}
const rejection = {
  directInt: ["1e2", "1.5", "1x", "+1", "-", "", "true"],
  directUnsigned: ["1e2", "1.5", "-1"],
  fieldInt: ['{"n":1e2}', '{"n":1.5}'],
  lazyInt: ['{"n":1e2}', '{"n":1.5}'],
  setInt: ["[1e2]", "[1.5]", "[1x]", "[-]"],
  setUnsigned: ["[-1]", "[1e2]", "[1.5]"],
  setBool: ["[truX]", "[fxxxx]", "[tru]", "[fals]", "[truefalse]", "[true,]"],
  mapInt: ['{"x":1} {"y":2}', "{} {}", "{}0}", '{"x":1e2}', '{"x":1.5}'],
  arrayDate: [`[${date},]`, `[${date}, \n ]`, "[,]"],
  arrayNested: ["[[1],]", "[[1], \n ]"],
  staticDate: [`[${date},]`],
  arrayStatic: ["[[1],]"],
  arrayArr: ["[[1],]"],
  staticSet: ["[[1],]"],
};
const lazyCases = [
  '{"text":"kept"}',
  '{"x":{"text":"kept"}}',
  '[{"text":"kept"}]',
  '{"item":{"text":"kept"}}',
  '{"item":{"text":"kept"}}',
  '{"items":[{"text":"kept"}]}',
  '{"values":{"x":{"text":"kept"}}}',
  '{"dynamic":{"child":{"text":"kept"}}}',
];
let checks = 0;
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
    for (const fast of ["0", "1"]) {
      for (const strict of ["false", "true"]) {
        const label = `${mode}/fast=${fast}/strict=${strict}`;
        const output = path.join(directory, `${mode}-${fast}-${strict}.wasm`);
        execFileSync(
          process.execPath,
          [
            path.join(root, "node_modules/assemblyscript/bin/asc.js"),
            "assembly/__tests__/parser-regressions.fixture.ts",
            "--transform",
            "./transform",
            "--runtime",
            "incremental",
            "--exportRuntime",
            "-o",
            output,
            ...(mode === "SIMD" ? ["--enable", "simd"] : []),
          ],
          {
            cwd: root,
            env: {
              ...process.env,
              JSON_MODE: mode,
              JSON_USE_FAST_PATH: fast,
              JSON_STRICT: strict,
              JSON_AS_LIBRARY_SOURCE: "assembly/index",
            },
            stdio: "pipe",
          },
        );
        const module = new WebAssembly.Module(fs.readFileSync(output));
        function guest() {
          const wasm = new WebAssembly.Instance(module, {
            env: {
              abort() {
                throw new Error("JSON rejected input");
              },
            },
          }).exports;
          return {
            wasm,
            input(source) {
              const bytes = Buffer.from(source, "utf16le");
              const ptr = wasm.__pin(wasm.allocInput(bytes.length));
              new Uint8Array(wasm.memory.buffer, ptr, bytes.length).set(bytes);
              return ptr;
            },
            read(ptr) {
              return Buffer.from(
                wasm.memory.buffer,
                ptr,
                new DataView(wasm.memory.buffer).getUint32(ptr - 4, true),
              ).toString("utf16le");
            },
          };
        }
        for (const [name, source, expected] of positive) {
          const g = guest();
          const result = g.wasm[name](g.input(source));
          assert.equal(
            typeof expected === "string" ? g.read(result) : result,
            expected,
            `${label} ${name}: ${source}`,
          );
          checks++;
        }
        for (const [name, sources] of Object.entries(rejection)) {
          for (const source of sources) {
            const g = guest();
            assert.throws(
              () => g.wasm[name](g.input(source)),
              /JSON rejected input/,
              `${label} ${name}: ${source}`,
            );
            checks++;
          }
        }
        // Preserve the existing non-strict scalar/set leading-zero extension.
        for (const [name, source, expected] of [
          ["directInt", "00042", 42],
          ["directUnsigned", "00042", 42],
          ["fieldInt", '{"n":00042}', 42],
          ["setInt", "[00042]", "[42]"],
        ]) {
          const g = guest();
          if (strict === "true") {
            assert.throws(
              () => g.wasm[name](g.input(source)),
              /JSON rejected input/,
            );
          } else {
            const result = g.wasm[name](g.input(source));
            assert.equal(
              typeof expected === "string" ? g.read(result) : result,
              expected,
              `${label} ${name}: ${source}`,
            );
          }
          checks++;
        }
        for (const spelling of [
          "\\n",
          "\\u0061",
          "\\t",
          '\\"',
          "\\\\",
          "\\/",
        ]) {
          const g = guest();
          const source = `{"${spelling}":1}`;
          const result = g.wasm.reusedEscapedMap(
            g.input(source),
            g.input(spelling),
          );
          assert.deepEqual(
            JSON.parse(g.read(result)),
            JSON.parse(source),
            `${label} escaped key ${spelling}`,
          );
          checks++;
        }
        for (const [kind, source] of lazyCases.flatMap((source, kind) => [
          [kind, source],
          [kind, JSON.stringify(JSON.parse(source), null, 2)],
        ])) {
          const g = guest();
          const ptr = g.input(source);
          g.wasm.saveLazy(ptr, kind);
          g.wasm.__unpin(ptr);
          function collectAndChurn() {
            g.wasm.__collect();
            for (let i = 0; i < 100; i++) {
              const allocation = g.wasm.allocInput(source.length * 2);
              new Uint16Array(
                g.wasm.memory.buffer,
                allocation,
                source.length,
              ).fill(0x58);
            }
          }
          collectAndChurn();
          g.wasm.materializeLazy(kind);
          collectAndChurn();
          assert.equal(
            g.read(g.wasm.readLazy(kind)),
            "kept",
            `${label} lazy kind=${kind}`,
          );
          checks++;
        }
      }
    }
  }
  console.log(
    `Parser regressions: ${checks} checks passed across 12 configurations`,
  );
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
