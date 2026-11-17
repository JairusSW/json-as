// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import "../lib/index.js";
import { Node, Source, SourceKind } from "assemblyscript";
import { SimpleParser, toString } from "../lib/util.js";
const source = new Source(SourceKind.User, "literal.ts", "");
const values = [
  "\ud800",
  "\udc00",
  "a\ud800b",
  "\ud800\ud800\udc00",
  "\udc00\udc00",
  "\ud83d\ude00",
  "\u00001\u2028\u2029",
  Array.from({ length: 65536 }, (_, i) => String.fromCharCode(i)).join(""),
];
for (const value of values) {
  const literal = Node.createStringLiteralExpression(value, source.range);
  const emitted = Buffer.from(toString(literal), "utf8").toString("utf8");
  assert.equal(SimpleParser.parseExpression(emitted).value, value);
}
for (const value of values.slice(0, 3)) {
  const original = SimpleParser.parseExpression("tag`" + value + "`");
  const regenerated = SimpleParser.parseExpression(toString(original));
  assert.deepEqual(regenerated.parts, original.parts);
  assert.deepEqual(regenerated.rawParts, original.rawParts);
}
console.log(
  `Binary literals: ${values.length} UTF-8 source round trips preserve every UTF-16 unit`,
);
