// Generated strict-key errors use Wasm abort rather than try-as exceptions.
// Assert that boundary directly, instead of treating a crashed as-test file as
// evidence of rejection. No third-party test dependency is needed.
import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
mkdirSync(path.join(root, ".as-test"), { recursive: true });
const dir = mkdtempSync(path.join(root, ".as-test/key-dispatch-"));
const inputs = [
  '{"n999":1,"n000":23}',
  '{"s999":"unknown","n000":23}',
  '{"a999":[1,2],"n000":23}',
  '{"o999":{"value":2},"n000":23}',
  '{"b999":true,"n000":23}',
  '{"b999":false,"n000":23}',
  '{"z999":null,"n000":23}',
  '{"x999":7,"n000":23}',
];
const fields = [];
for (const [prefix, type, initial] of [
  ["n", "i32", "0"],
  ["s", "string", '""'],
  ["a", "i32[]", "[]"],
  ["o", "Child", "new Child()"],
  ["b", "bool", "false"],
  ["z", "string | null", "null"],
]) {
  for (let i = 0; i < 12; i++)
    fields.push(
      `${prefix}${i.toString().padStart(3, "0")}: ${type} = ${initial};`,
    );
}
writeFileSync(
  path.join(dir, "fixture.tmp.ts"),
  [
    'import { JSON } from "../../assembly";',
    "@json class Child { value: i32 = 0; }",
    `@json class Mixed { ${fields.join("\n")} }`,
    `const inputs = ${JSON.stringify(inputs)};`,
    "export function check(index: i32): bool {",
    "  const expected = JSON.stringify(JSON.parse<Mixed>('{\"n000\":23}'));",
    "  return JSON.stringify(JSON.parse<Mixed>(inputs[index])) == expected;",
    "}",
  ].join("\n"),
);
let checks = 0;
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
    for (const fast of ["0", "1"]) {
      for (const strict of [false, true]) {
        const binary = path.join(dir, `${mode}-${fast}-${strict}.wasm`);
        const build = spawnSync(
          process.execPath,
          [
            "node_modules/assemblyscript/bin/asc.js",
            path.relative(root, path.join(dir, "fixture.tmp.ts")),
            "--transform",
            "./transform",
            "--runtime",
            "incremental",
            "-o",
            binary,
            ...(mode === "SIMD" ? ["--enable", "simd"] : []),
          ],
          {
            cwd: root,
            encoding: "utf8",
            env: {
              ...process.env,
              JSON_MODE: mode,
              JSON_USE_FAST_PATH: fast,
              JSON_STRICT: strict ? "true" : "false",
              JSON_AS_LIBRARY_SOURCE: "assembly/index",
            },
          },
        );
        assert.equal(build.status, 0, build.stdout + build.stderr);
        for (let index = 0; index < inputs.length; index++) {
          // A host abort can bypass Wasm stack cleanup; use a fresh instance
          // per rejection, just as an application would after a fatal trap.
          let memory;
          const { instance } = await WebAssembly.instantiate(
            readFileSync(binary),
            {
              env: {
                abort(message) {
                  const size = new DataView(memory.buffer).getUint32(
                    message - 4,
                    true,
                  );
                  throw new Error(
                    Buffer.from(memory.buffer, message, size).toString(
                      "utf16le",
                    ),
                  );
                },
              },
            },
          );
          memory = instance.exports.memory;
          if (strict)
            assert.throws(
              () => instance.exports.check(index),
              /Unexpected key value pair/,
            );
          else
            assert.equal(
              instance.exports.check(index),
              1,
              `${mode}/${fast}/${index}`,
            );
          checks++;
        }
      }
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`Key dispatch runtime boundary: ${checks} checks passed`);
