// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import "../lib/index.js";
import { Parser } from "assemblyscript";
import { specializeObjectAllocator } from "../lib/allocation.js";
import { specializeCopiedStringAllocator } from "../lib/copied-string.js";
import { SimpleParser, toString } from "../lib/util.js";
const stock = `if(size>=OBJECT_MAXSIZE)throw new Error(E_ALLOCATION_TOO_LARGE);
if(total>=threshold)interrupt();
let obj=changetype<Object>(__alloc(OBJECT_OVERHEAD+size)-BLOCK_OVERHEAD);
obj.rtId=id;obj.rtSize=<u32>size;obj.linkTo(fromSpace,white);total+=obj.size;
let ptr=changetype<usize>(obj)+TOTAL_OVERHEAD;memory.fill(ptr,0,size);return ptr;`;
function fixture(runtime = "itcms", body = stock) {
  const p = new Parser();
  for (const [name, text] of [
    [
      "assembly/index",
      "export namespace JSON {export class Value{} export class Obj{} export class Arr{} export class Raw{}}",
    ],
    [
      "assembly/util/runtime",
      `const __json_as_copy_string=0; const __json_as_output_allocate=0;
 export function allocateObject(size:usize,id:u32):usize{return __new(size,id);}
 export function allocateUninitialized(size:usize,id:u32):usize{
 if(isDefined(__newUninitialized))return __newUninitialized(size,id);return __new(size,id);}

 export function clearAllocatedObject(ptr:usize,size:usize):void{memory.fill(ptr,0,size);}
 export function canAllocateCopiedString():bool{return false;}
 export function allocateCopiedString(source:usize,size:usize):usize{const out=allocateObject(size,idof<string>());memory.copy(out,source,size);return out;}`,
    ],
    [
      `~lib/rt/${runtime}`,
      `const __json_as_allocate_copied_string=0; const __json_as_allocate_output_string=0; @global @unsafe export function __new(size:usize,id:i32):usize{${body}}`,
    ],
    ["app", "export function application():usize{return __new(8,3);}"],
  ])
    p.parseFile(text, name + ".ts", false);
  specializeObjectAllocator(p.sources);
  return p.sources;
}
const sources = fixture();
const rt = sources.find((s) => s.internalPath === "~lib/rt/itcms");
const helper = sources.find((s) => s.internalPath === "assembly/util/runtime");
const app = sources.find((s) => s.internalPath === "app");
const original = toString(rt.statements.find((s) => s.name?.text === "__new"));
const application = toString(app);
specializeCopiedStringAllocator(sources);
assert.equal(
  toString(rt.statements.find((s) => s.name?.text === "__new")),
  original,
);
assert.equal(toString(app), application);
const outputAllocator = rt.statements.find((s) => s.name?.text === "__json_as_allocate_output_string0");
assert.ok(outputAllocator);
assert.match(toString(outputAllocator), /id != idof<string>\(\) \|\| isDefined\(ASC_RTRACE\)/);
assert.match(toString(outputAllocator), /memory.fill\(ptr, 0, size\)/);
assert.match(toString(outputAllocator), /obj.linkTo\(fromSpace, white\)/);
assert.match(toString(helper), /return __json_as_output_allocate0\(size, id\)/);
assert.match(toString(helper), /isDefined\(__newUninitialized\)/);

assert.match(toString(helper), /return true/);
const copy = rt.statements.at(-1);
assert.equal(copy.name.text, "__json_as_allocate_copied_string0");
assert.match(toString(copy), /memory.copy\(ptr, __jsonAsStringSource, size\)/);
assert.doesNotMatch(toString(copy), /memory.fill/);
assert.match(toString(copy), /obj.linkTo\(fromSpace, white\)/);
assert.match(
  toString(helper),
  /__json_as_copy_string0\(size, idof<string>\(\), source\)/,
);
const clear = helper.statements.find(
  (s) => s.name?.text === "clearAllocatedObject",
);
assert.match(toString(clear.body), /ASC_RUNTIME != 2/);
assert.match(toString(clear.body), /sizeof<usize>\(\) != 4/);
assert.match(toString(clear.body), /isDefined\(ASC_RTRACE\)/);
const once = sources.map(toString);
specializeCopiedStringAllocator(sources);
assert.deepEqual(sources.map(toString), once);
for (const [runtime, body] of [
  [
    "itcms",
    stock.replace("memory.fill(ptr,0,size)", "memory.fill(ptr,7,size)"),
  ],
  ["tcms", stock],
  ["stub", stock],
  ["custom", stock],
]) {
  const sources = fixture(runtime, body),
    before = sources.map(toString);
  specializeCopiedStringAllocator(sources);
  assert.deepEqual(sources.map(toString), before, `${runtime} fallback`);
}
console.log(
  "Copied-string allocator: exact stock body, GC bookkeeping, name hygiene, idempotence and unknown/runtime fallbacks passed",
);

// A known original is insufficient if another transform changes the actual
// allocation helper. The clear must remain for a modified scoped allocator.
const altered = fixture();
const alteredRt = altered.find((s) => s.internalPath === "~lib/rt/itcms");
const scoped = alteredRt.statements.find((s) =>
  s.name?.text.startsWith("__json_as_allocate_object"),
);
scoped.body.statements.unshift(SimpleParser.parseStatement("size = 0;"));
const alteredHelper = altered.find(
  (s) => s.internalPath === "assembly/util/runtime",
);
const originalClear = alteredHelper.statements.find(
  (s) => s.name?.text === "clearAllocatedObject",
);
const beforeClear = toString(originalClear.body);
const beforeScoped = toString(scoped.body);
specializeCopiedStringAllocator(altered);
assert.equal(toString(originalClear.body), beforeClear);
assert.equal(
  toString(scoped.body),
  beforeScoped,
  "canonical proof must not change the allocator",
);
console.log(
  "Fresh-object clear: zeroing proof, actual scoped allocator, instrumentation and unknown-runtime fallback passed",
);
