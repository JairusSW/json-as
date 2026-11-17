// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import fs from "node:fs";
import "../lib/index.js";
import { Parser } from "assemblyscript";
import { inlineGcMarking } from "../lib/gc-marking.js";
import { SimpleParser, toString } from "../lib/util.js";

function fixture(kind) {
  const parser = new Parser();
  if (kind !== "unrelated")
    parser.parseFile(
      "export namespace JSON {export class Value{} export class Obj{} export class Arr{} export class Raw{}}",
      "assembly/index.ts",
      false,
    );
  for (const name of ["itcms", "common", "tlsf"]) {
    let text = fs.readFileSync(
      `node_modules/assemblyscript/std/assembly/rt/${name}.ts`,
      "utf8",
    );
    if (kind === name) text += "\n// unknown source control\n";
    parser.parseFile(text, `~lib/rt/${name}.ts`, false);
  }
  return parser.sources;
}
let checks = 0;
for (const kind of [
  "stock",
  "itcms",
  "common",
  "tlsf",
  "visit-body",
  "mark-body",
  "signature",
  "unrelated",
  "alias",
  "method-alias",
  "intrinsic-alias",
  "unrelated-alias",
]) {
  const sources = fixture(kind);
  const rt = sources.find((s) => s.internalPath === "~lib/rt/itcms");
  const visit = rt.statements.find((n) => n.name?.text === "__visit");
  const object = rt.statements.find((n) => n.name?.text === "Object");
  const gray = object.members.find((n) => n.name.text === "makeGray");
  if (kind === "visit-body")
    visit.body.statements.unshift(
      SimpleParser.parseStatement("trace('control');"),
    );
  if (kind === "mark-body")
    gray.body.statements.unshift(
      SimpleParser.parseStatement("trace('control');"),
    );
  if (kind === "signature") visit.signature.parameters[1].name.text = "other";
  const before = sources.map(toString);
  const originalGray = toString(gray);
  const aliases =
    kind === "alias"
      ? new Map([["__visit", "custom"]])
      : kind === "method-alias"
        ? new Map([["~lib/rt/itcms/Object#makeGray", "custom"]])
        : kind === "intrinsic-alias"
          ? new Map([["isDefined", "custom"]])
          : kind === "unrelated-alias"
            ? new Map([["PUB_PROBE_FAST", "1"]])
            : null;
  const selected = inlineGcMarking(sources, aliases);
  const expected = kind === "stock" || kind === "unrelated-alias";
  assert.equal(selected, expected, kind);
  checks++;
  if (!expected) {
    assert.deepEqual(sources.map(toString), before, kind);
    checks++;
    continue;
  }
  const body = toString(visit.body);
  assert.match(body, /RTRACE \|\| PROFILE \|\| isDefined\(__finalize\)/);
  assert.match(body, /obj\.unlink\(\)/);
  assert.match(body, /obj\.linkTo\(toSpace/);
  assert.doesNotMatch(body, /\bthis\b/);
  assert.equal(toString(gray), originalGray);
  const after = sources.map(toString);
  assert.equal(inlineGcMarking(sources, aliases), false);
  assert.deepEqual(sources.map(toString), after);
  checks += 7;
}
console.log(
  `GC marking: ${checks} selection, body, alias, unchanged fallback and idempotence checks passed`,
);
