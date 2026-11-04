import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-consistency-"));
const failures = [];
let checks = 0;
const expected = [
  "7",
  "7",
  "7",
  "7",
  "7",
  "7",
  "true:1",
  '{"a":1,"b":2}',
  '{"a":1,"b":2}',
  '{"a":1,"b":2}',
  '{"a":1,"b":2}',
  "true:1",
  "true:1",
  '{"a":1,"b":2}',
];
const bindings = {
  enum: '{"value":1}',
  codec: '{"value":7}',
  namespace: '{"value":[1,2],"kind":1,"item":{"n":3},"tail":9}',
  string: "7:7:7",
};
function decode(g, p) {
  if (!p) return "<unknown>";
  return Buffer.from(
    g.memory.buffer,
    p,
    new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
  ).toString("utf16le");
}
function instantiate(module) {
  let g;
  g = new WebAssembly.Instance(module, {
    env: {
      abort(m, f, l, c) {
        throw Error(decode(g, m) + ` (${decode(g, f)}:${l}:${c})`);
      },
    },
  }).exports;
  return g;
}
function check(label, fn, wanted) {
  checks++;
  try {
    assert.equal(fn(), wanted);
  } catch (error) {
    failures.push(label + ": " + error.message);
  }
}
try {
  for (const mode of process.env.PROBE_QUICK
    ? ["NAIVE"]
    : ["NAIVE", "SWAR", "SIMD"])
    for (const strict of process.env.PROBE_QUICK ? [false] : [false, true])
      for (const fast of process.env.PROBE_QUICK ? [true] : [false, true]) {
        const prefix = `${mode}/strict=${strict}/fast=${fast}`;
        const compile = (name) => {
          const output = path.join(dir, name + ".wasm");
          execFileSync(
            process.execPath,
            [
              path.join(root, "node_modules/assemblyscript/bin/asc.js"),
              `assembly/__tests__/consistency-edges/${name}.fixture.ts`,
              "--transform",
              "./transform",
              "--exportRuntime",
              "-O3",
              "-o",
              output,
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
          return new WebAssembly.Module(fs.readFileSync(output));
        };
        try {
          const module = process.env.PROBE_BINDING ? null : compile("runtime");
          for (let kind = 0; kind < (module ? expected.length : 0); kind++)
            for (const reuse of [false, true])
              check(
                prefix + "/runtime/" + kind + "/" + reuse,
                () => {
                  const g = instantiate(module);
                  return decode(g, g.run(kind, reuse));
                },
                expected[kind],
              );
        } catch (error) {
          failures.push(
            prefix +
              "/runtime compilation: " +
              (error.stderr?.toString() || error.message),
          );
        }
        // Alias dispatch needs the complete parser matrix. Signature and namespace
        // binding checks cover both strict routes under every code generator.
        if (!process.env.PROBE_RUNTIME_ONLY)
          for (const [name, wanted] of Object.entries(bindings).filter(
            ([name]) =>
              !process.env.PROBE_BINDING || name === process.env.PROBE_BINDING,
          )) {
            if (
              name !== "enum" &&
              name !== "codec" &&
              !(
                (strict && !fast) ||
                (!strict && fast) ||
                process.env.PROBE_QUICK
              )
            )
              continue;
            try {
              const module = compile(name);
              for (const reuse of [false, true])
                check(
                  prefix + "/" + name + "/" + reuse,
                  () => {
                    const g = instantiate(module);
                    return decode(g, g.run(reuse));
                  },
                  wanted,
                );
            } catch (error) {
              failures.push(
                prefix +
                  "/" +
                  name +
                  " compilation: " +
                  (error.stderr?.toString() || error.message),
              );
            }
          }
        console.log(prefix + " checked");
      }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
assert.equal(failures.length, 0, failures.join("\n"));
console.log(`Consistency edges: ${checks} checks passed`);
