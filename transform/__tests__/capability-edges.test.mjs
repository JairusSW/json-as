import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-capability-"));
const failures = [];
let checks = 0;
const expected = [
  "0:1970:0:1",
  "0:true",
  "7",
  "2:2:10,20",
  "2:2:10,20",
  "[1,2]:0",
  "[1,2]:0",
  "[1,2]:0",
  "[1,2]:0",
  '{"null":7}',
  '{"null":{"n":7}}',
  '{"null":7}',
  "[1,2]",
  '{"a":7}',
  '{"a":{"n":7}}',
  '["stored"]',
  "[7]",
  "2:2:10,20",
  "2:2:10,20",
  '{"a":{"n":7}}',
  '{"a":{"n":8}}',
];
const bindings = {
  "reused-inherited": "7:2|7:2",
  "reused-defaults": "7:2:null|7:2:null|7:2|7:2:null|7:2:null|7:2:null",
  defaults: "7:8|7:8",
  "map-slots": '{"n":9007199254740993,"tail":true}|7|{"a":7,"tail":true}',

  nested: '{"field":{"value":7},"items":[{"value":8}]}',
  writer: '{"inner":{"value":7}}',
  lazy: "float:1.5",
  parameter: "float:1.5",
  timing: "0:7:1",
  self: "7",
  gc: "[1,2]",
  "gc-control": "[1,2]",
  "gc-pressure": "[1,2]",
  "gc-pressure-control": "[1,2]",
  "gc-pressure-object": "[1,2]",
  "gc-pressure-box": "[1,2]",
  "null-object": '{"null":7}',
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
    ? ["SWAR"]
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
              `assembly/__tests__/capability-edges/${name}.fixture.ts`,
              "--transform",
              "./transform",
              "--exportRuntime",
              "--runtime",
              process.env.PROBE_RUNTIME || "incremental",
              process.env.PROBE_OPT === "0" ? "-O0" : "-O3",
              ...(name.startsWith("gc-pressure")
                ? [
                    "--use",
                    "ASC_GC_GRANULARITY=16",
                    "--use",
                    "ASC_GC_IDLEFACTOR=0",
                    "--use",
                    "ASC_GC_SWEEPFACTOR=10000",
                  ]
                : []),
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
              !process.env.PROBE_BINDING ||
              name === process.env.PROBE_BINDING ||
              (process.env.PROBE_BINDING === "gc-all" && name.startsWith("gc")),
          )) {
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
console.log(`Capability edges: ${checks} checks passed`);
