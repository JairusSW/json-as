import assert from "node:assert/strict";
// Initialize the transform's type/visitor modules before the shared AST tools.
import "../lib/index.js";
import { Parser } from "assemblyscript";
import { specializeObjectAllocator } from "../lib/allocation.js";
import { toString } from "../lib/util.js";

function fixture(runtime = "itcms") {
  const parser = new Parser();
  for (const [name, source] of [
    [
      "assembly/index",
      "export namespace JSON { export class Value {} export class Obj {} export class Arr {} export class Raw {} }",
    ],
    [
      "assembly/util/runtime",
      "const __json_as_runtime_allocate = 1; export function allocateObject(size:usize,id:u32):usize { return __new(size,id); }",
    ],
    [
      `~lib/rt/${runtime}`,
      "const __json_as_allocate_object = 1; @global @unsafe export function __new(size:usize,id:i32):usize { memory.fill(0,0,size); return size + id; }",
    ],
    [
      "app",
      "function __new(size:usize,id:i32):usize { return 123; } export function run():usize { return __new(8,3); }",
    ],
  ])
    parser.parseFile(source, name + ".ts", false);
  return parser.sources;
}
const sources = fixture();
const runtime = sources.find((s) => s.internalPath === "~lib/rt/itcms");
const helper = sources.find((s) => s.internalPath === "assembly/util/runtime");
const application = sources.find((s) => s.internalPath === "app");
const original = toString(runtime.statements[1]);
const appBefore = toString(application);
specializeObjectAllocator(sources);
assert.equal(
  toString(runtime.statements[1]),
  original,
  "the global allocator is unchanged",
);
assert.equal(
  toString(application),
  appBefore,
  "application allocation calls are untouched",
);
const copy = runtime.statements.at(-1);
assert.equal(
  toString(copy.body),
  toString(runtime.statements[1].body),
  "all runtime GC and zeroing operations are preserved",
);
assert.notEqual(
  copy.name.text,
  "__json_as_allocate_object",
  "existing runtime names are respected",
);
assert.match(toString(copy), /@inline/);
assert.doesNotMatch(toString(copy), /@global/);
assert.equal(helper.statements[0].internalPath, runtime.internalPath);
assert.match(
  toString(helper),
  /return __json_as_runtime_allocate0\(size, id\)/,
);
for (const runtime of ["tcms", "stub", "custom"]) {
  const sources = fixture(runtime);
  const before = sources.map(toString);
  specializeObjectAllocator(sources);
  assert.deepEqual(
    sources.map(toString),
    before,
    runtime + " uses the normal allocation entry",
  );
}
console.log(
  "Allocation specialization preserves runtime operations, application calls and fallback runtimes",
);
