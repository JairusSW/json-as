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
import { specializeDecimalClamps } from "../lib/decimal-clamps.js";
import { SimpleParser, toString } from "../lib/util.js";

let checks = 0;
for (const kind of [
  "stock",
  "bundled",
  "renamed",
  "unrelated",
  "dtoa-text",
  "xjb-text",
  "dtoa-body",
  "xjb-body",
  "signature",
  "binding",
  "missing-peer",
  "alias",
  "qualified-alias",
  "unrelated-alias",
]) {
  const parser = new Parser();
  const root =
    kind === "bundled"
      ? "~lib/json-as/node_modules/xjb-as/assembly/"
      : kind === "renamed"
        ? "~lib/json-toolkit/node_modules/xjb-as/assembly/"
        : "~lib/xjb-as/assembly/";
  if (kind !== "unrelated")
    parser.parseFile(
      "export namespace JSON {export class Value{} export class Obj{} export class Arr{} export class Raw{}}",
      kind === "renamed"
        ? "~lib/json-toolkit/assembly/index.ts"
        : "assembly/index.ts",
      false,
    );
  for (const name of ["dtoa", "xjb"]) {
    if (kind === "missing-peer" && name === "xjb") continue;
    let text = fs.readFileSync(
      `node_modules/xjb-as/assembly/${name}.ts`,
      "utf8",
    );
    if (kind === name + "-text") text += "\n// unknown source\n";
    parser.parseFile(text, root + name + ".ts", false);
  }
  const dtoa = parser.sources.find((s) => s.internalPath === root + "dtoa");
  const xjb = parser.sources.find((s) => s.internalPath === root + "xjb");
  const target = (name) => dtoa.statements.find((s) => s.name?.text === name);
  if (kind === "dtoa-body")
    target("setDecimalResult").body.statements.unshift(
      SimpleParser.parseStatement("trace('changed');"),
    );
  if (kind === "xjb-body")
    xjb.statements
      .find((s) => s.name?.text === "umul64hiCarry")
      .body.statements.unshift(
        SimpleParser.parseStatement("trace('changed');"),
      );
  if (kind === "signature")
    target("toDecimalDouble").signature.parameters[0].name.text = "other";
  if (kind === "binding")
    dtoa.statements.find(
      (s) => s.declarations,
    ).declarations[0].foreignName.text = "other";
  const aliases =
    kind === "alias"
      ? new Map([["umul64hiCarry", "other"]])
      : kind === "qualified-alias"
        ? new Map([["~lib/xjb-as/assembly/xjb/umul64hiCarry", "other"]])
        : kind === "unrelated-alias"
          ? new Map([["PUB_PROBE_FAST", "1"]])
          : null;
  const before = parser.sources.map(toString);
  const expected = ["stock", "bundled", "renamed", "unrelated-alias"].includes(
    kind,
  );
  assert.equal(
    specializeDecimalClamps(parser.sources, aliases),
    expected,
    kind,
  );
  checks++;
  if (!expected) {
    assert.deepEqual(parser.sources.map(toString), before, kind);
    checks++;
    continue;
  }
  for (const name of ["toDecimalDoubleNormal", "toDecimalDouble"]) {
    const tail = target(name).body.statements.slice(-4).map(toString);
    assert.match(tail[0], /if \(u64.MAX_VALUE - dotOne < halfUlp\)/);
    assert.match(tail[0], /setDecimalResult\(integral, 10, decExp\)/);
    assert.match(tail[1], /if \(dotOne < halfUlp\)/);
    assert.match(tail[1], /setDecimalResult\(integral, 0, decExp\)/);
    assert.match(tail[2], /let one = umul64hiCarry/);
    assert.match(tail[3], /setDecimalResult\(integral, one, decExp\)/);
    checks += 6;
  }
  assert.equal(toString(xjb), before.at(-1));
  const after = parser.sources.map(toString);
  assert.equal(specializeDecimalClamps(parser.sources, aliases), false);
  assert.deepEqual(parser.sources.map(toString), after);
  checks += 3;
}
console.log(
  `Decimal clamps: ${checks} selection, purity, binding, order and idempotence checks passed`,
);
