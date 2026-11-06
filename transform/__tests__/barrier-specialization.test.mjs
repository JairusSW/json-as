import assert from "node:assert/strict";
import fs from "node:fs";
import "../lib/index.js";
import { Parser } from "assemblyscript";
import { toString } from "../lib/util.js";
import { specializeObjectBarrier } from "../lib/barrier.js";
const standard =
  fs.readFileSync(
    "node_modules/assemblyscript/std/assembly/rt/itcms.ts",
    "utf8",
  ) + "\nconst __json_as_link_object = 0;";
function fixture(kind = "stock") {
  const parser = new Parser();
  parser.parseFile(
    "export namespace JSON { export class Value {} export class Obj {} export class Arr {} export class Raw {} }",
    "assembly/index.ts",
    false,
  );
  parser.parseFile(
    "const __json_as_runtime_link = 1;export function linkObject(parent:usize,child:usize,multiple:bool):void { __link(parent,child,multiple); }",
    "assembly/util/runtime.ts",
    false,
  );
  parser.parseFile(
    kind === "custom"
      ? standard.replace(
          "if (!childPtr) return;",
          'if (!childPtr) { return; } if (TRACE) trace("changed");',
        )
      : standard,
    kind === "minimal" ? "~lib/rt/tcms.ts" : "~lib/rt/itcms.ts",
    false,
  );
  parser.parseFile(
    "function __link(p:usize,c:usize,m:bool):void {} export function f():void {__link(1,2,false);}",
    "app.ts",
    false,
  );
  return parser.sources;
}
for (const kind of ["stock", "custom", "minimal"]) {
  const sources = fixture(kind),
    runtime = sources.find((s) => s.internalPath.startsWith("~lib/rt/")),
    target = sources.find((s) => s.internalPath === "assembly/util/runtime"),
    app = sources.find((s) => s.internalPath === "app");
  const original = runtime.statements.find((s) => s.name?.text === "__link"),
    before = toString(original),
    appBefore = toString(app),
    targetBefore = toString(target);
  specializeObjectBarrier(sources);
  assert.equal(toString(original), before);
  assert.equal(toString(app), appBefore);
  if (kind === "minimal") {
    assert.equal(toString(target), targetBefore);
    continue;
  }
  const copy = runtime.statements.at(-1);
  assert.notEqual(copy.name.text, "__json_as_link_object");
  assert.match(toString(copy), /@inline/);
  assert.doesNotMatch(toString(copy), /@global/);
  assert.match(
    toString(target),
    /__json_as_runtime_link0\(parent, child, multiple\)/,
  );
  const once = toString(runtime) + toString(target);
  specializeObjectBarrier(sources);
  assert.equal(
    toString(runtime) + toString(target),
    once,
    "specialization is idempotent",
  );
  if (kind === "stock") assert.match(toString(copy.body), /const parent =/);
  else assert.equal(toString(copy.body), toString(original.body));
}
console.log(
  "Barrier specialization: stock parent-first selection, unknown-body fallback, other runtimes, name hygiene and untouched global/application calls passed",
);
