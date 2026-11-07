import assert from "node:assert/strict";
import fs from "node:fs";
import "../lib/index.js";
import { Parser } from "assemblyscript";
import { specializeObjectAllocator } from "../lib/allocation.js";
import { specializeCopiedStringAllocator } from "../lib/copied-string.js";
import { specializeSweepRuns } from "../lib/sweep.js";
import { SimpleParser, toString } from "../lib/util.js";

function fixture(kind = "stock") {
  const parser = new Parser();
  parser.parseFile(
    "export namespace JSON {export class Value{} export class Obj{} export class Arr{} export class Raw{}}",
    "assembly/index.ts",
    false,
  );
  parser.parseFile(
    fs.readFileSync("assembly/util/runtime.ts", "utf8"),
    "assembly/util/runtime.ts",
    false,
  );
  for (const name of ["itcms", "common", "tlsf"]) {
    let text = fs.readFileSync(
      `node_modules/assemblyscript/std/assembly/rt/${name}.ts`,
      "utf8",
    );
    if (kind === name) text += "\n// unknown runtime version\n";
    parser.parseFile(text, `~lib/rt/${name}.ts`, false);
  }
  parser.parseFile(
    "export function application():usize { __collect(); return __new(8,3); }",
    "app.ts",
    false,
  );
  specializeObjectAllocator(parser.sources);
  specializeCopiedStringAllocator(parser.sources);
  return parser.sources;
}
const find = (source, name) =>
  source.statements.find((n) => n.name?.text === name);
for (const kind of [
  "stock",
  "itcms",
  "common",
  "tlsf",
  "ast",
  "alias",
  "allocator",
]) {
  const sources = fixture(kind);
  const rt = sources.find((s) => s.internalPath === "~lib/rt/itcms");
  const target = sources.find(
    (s) => s.internalPath === "assembly/util/runtime",
  );
  const app = sources.find((s) => s.internalPath === "app");
  if (kind === "ast")
    find(rt, "step").body.statements.unshift(
      SimpleParser.parseStatement("trace('changed');"),
    );
  if (kind === "allocator")
    find(target, "allocateObject").body = SimpleParser.parseStatement(
      "{return __new(size,id);}",
    );
  const before = sources.map(toString);
  const originals = ["free", "step", "interrupt", "__new", "__collect"].map(
    (name) => toString(find(rt, name)),
  );
  const application = toString(app);
  specializeSweepRuns(
    sources,
    kind === "alias" ? new Map([["__free", "customFree"]]) : null,
  );
  assert.equal(toString(app), application);
  assert.deepEqual(
    ["free", "step", "interrupt", "__new", "__collect"].map((name) =>
      toString(find(rt, name)),
    ),
    originals,
  );
  if (kind !== "stock") {
    assert.deepEqual(
      sources.map(toString),
      before,
      `${kind} must preserve original allocation/collector policy`,
    );
    continue;
  }
  const capability = toString(find(target, "canCoalesceSweepRuns"));
  assert.match(capability, /return __json_as_sweep_capability\(/);
  const enabled = toString(find(rt, "__json_as_can_coalesce_sweep_runs"));
  for (const guard of [
    "sizeof<usize>() == 4",
    "ASC_RUNTIME == 2",
    "!RTRACE",
    "!TRACE",
    "!PROFILE",
    "!isDefined(__finalize)",
  ])
    assert.ok(enabled.includes(guard), guard);
  const collector = toString(find(rt, "__json_as_sweep_interrupt"));
  assert.equal(
    (collector.match(/__json_as_sweep_flush\(\)/g) ?? []).length,
    2,
    "flush before early return and fallthrough",
  );
  assert.match(
    toString(find(rt, "__json_as_sweep_step")),
    /__json_as_sweep_free\(obj\)/,
  );
  assert.match(
    toString(find(rt, "__json_as_sweep_free")),
    /__json_as_sweep_defer\(/,
  );
  const once = sources.map(toString);
  specializeSweepRuns(sources, null);
  assert.deepEqual(sources.map(toString), once, "idempotence");
}
console.log(
  "Sweep specialization: activation, untouched globals, flush exits, idempotence, three ABI guards, AST and allocator-hook fallbacks passed",
);
