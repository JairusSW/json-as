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
import { specializeArrayDtoa } from "../lib/array-dtoa.js";
import { specializeDecimalClamps } from "../lib/decimal-clamps.js";
import { SimpleParser, toString } from "../lib/util.js";

function fixture(kind) {
  const parser = new Parser();
  parser.parseFile(
    "export namespace JSON {export class Value{} export class Obj{} export class Arr{} export class Raw{}}",
    "assembly/index.ts",
    false,
  );
  for (const name of ["dtoa", "xjb"]) {
    let text = fs.readFileSync(
      `node_modules/xjb-as/assembly/${name}.ts`,
      "utf8",
    );
    if (kind === name + "-text") text += "\n// unknown runtime\n";
    parser.parseFile(text, `~lib/xjb-as/assembly/${name}.ts`, false);
  }
  let barrel = fs.readFileSync("node_modules/xjb-as/index.ts", "utf8");
  if (kind === "star") barrel = 'export * from "./assembly/dtoa";';
  if (kind === "local-export")
    barrel =
      'import {dtoa_buffered as actual}from"./assembly/dtoa";export{actual as dtoa_buffered};';
  if (kind === "wrapper")
    barrel =
      'import {dtoa_buffered as actual}from"./assembly/dtoa";export function dtoa_buffered(p:usize,n:f64):u32{return actual(p,n);}';
  if (kind === "cycle") barrel = 'export{dtoa_buffered}from"./cycle";';
  parser.parseFile(barrel, "~lib/xjb-as/index.ts", false);
  if (kind === "cycle")
    parser.parseFile(
      'export{dtoa_buffered}from"./index";',
      "~lib/xjb-as/cycle.ts",
      false,
    );
  parser.parseFile(
    fs.readFileSync("assembly/serialize/naive/array.ts", "utf8"),
    "assembly/serialize/naive/array.ts",
    false,
  );
  const sources = parser.sources;
  if (kind !== "unclamped") specializeDecimalClamps(sources, null);
  const dtoa = sources.find((source) =>
    source.internalPath.endsWith("/assembly/dtoa"),
  );
  const peer = sources.find((source) =>
    source.internalPath.endsWith("/assembly/xjb"),
  );
  const array = sources.find(
    (source) => source.internalPath === "assembly/serialize/naive/array",
  );
  const writer = array.statements.find(
    (node) => node.name?.text === "serializeF64ArrayFast",
  );
  if (kind === "dtoa-ast")
    dtoa.statements
      .find((node) => node.name?.text === "formatDouble")
      .body.statements.unshift(
        SimpleParser.parseStatement("trace('unknown');"),
      );
  if (kind === "peer-ast")
    peer.statements
      .find((node) => node.name?.text === "umul64hiCarry")
      .body.statements.unshift(
        SimpleParser.parseStatement("trace('unknown');"),
      );
  if (kind === "array-ast")
    writer.body.statements.unshift(
      SimpleParser.parseStatement("trace('unknown');"),
    );
  if (kind === "array-text") array.text += "\n// unknown array writer\n";
  if (kind === "collision")
    parser.parseFile(
      "const __json_array_dtoa_buffered=1;function scope():string{return `${__json_array_round10}`;}",
      "collision.ts",
      false,
    );
  return { sources, dtoa, writer };
}
let checks = 0;
for (const kind of [
  "stock",
  "unclamped",
  "star",
  "local-export",
  "collision",
  "dtoa-text",
  "xjb-text",
  "dtoa-ast",
  "peer-ast",
  "array-ast",
  "array-text",
  "wrapper",
  "cycle",
  "alias",
  "qualified-alias",
  "json-alias",
]) {
  const { sources, dtoa, writer } = fixture(kind);
  const before = sources.map(toString);
  const originals = new Map(
    dtoa.statements
      .filter((node) => node.name)
      .map((node) => [node, toString(node)]),
  );
  const aliases =
    kind === "alias"
      ? new Map([["u64", "custom"]])
      : kind === "qualified-alias"
        ? new Map([["xjb/umul64hiCarry", "custom"]])
        : kind === "json-alias"
          ? new Map([["JSON_STRICT", "true"]])
          : null;
  const selected = specializeArrayDtoa(sources, aliases);
  const expected = [
    "stock",
    "unclamped",
    "star",
    "local-export",
    "collision",
    "json-alias",
  ].includes(kind);
  assert.equal(!!selected, expected, kind);
  checks++;
  if (!expected) {
    assert.deepEqual(sources.map(toString), before, kind);
    checks++;
    continue;
  }
  for (const [node, text] of originals)
    assert.equal(toString(node), text, kind);
  assert.match(toString(writer), new RegExp(selected.entry));
  const helper = dtoa.statements.find(
    (node) => node.name?.text === selected.rounding,
  );
  assert.match(toString(helper), /4294967295/);
  assert.ok(dtoa.statements.some((node) => node.name?.text === selected.entry));
  const prefix = selected.entry.slice(0, -"dtoa_buffered".length);
  const clonedText = dtoa.statements
    .filter((node) => node.name?.text.startsWith(prefix))
    .map(toString)
    .join("\n");
  assert.equal(clonedText.match(/pLo == 0/g)?.length, 2);
  if (kind === "collision")
    assert.equal(selected.entry, "__json_array_1_dtoa_buffered");
  else assert.equal(selected.entry, "__json_array_dtoa_buffered");
  const after = sources.map(toString);
  assert.equal(specializeArrayDtoa(sources, aliases), null);
  assert.deepEqual(sources.map(toString), after);
  checks += 8;
}
console.log(
  `Array dtoa: ${checks} source/AST/binding/hygiene/fallback/idempotence checks passed`,
);
