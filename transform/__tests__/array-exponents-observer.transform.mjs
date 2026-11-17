// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import Base from "../lib/index.js";
import { SimpleParser } from "../lib/util.js";
import { Visitor } from "../lib/visitor.js";
export default class extends Base {
  afterParse(parser) {
    super.afterParse(parser);
    const source = parser.sources.find((source) =>
      source.statements.some((node) =>
        /^__json_array_(?:\d+_)?decimal_table$/.test(
          node.declarations?.[0]?.name.text || "",
        ),
      ),
    );
    assert.ok(source);
    const table = source.statements.find((node) =>
      /^__json_array_(?:\d+_)?decimal_table$/.test(
        node.declarations?.[0]?.name.text || "",
      ),
    ).declarations[0].name.text;
    const probe = SimpleParser.parseTopLevelStatement(
      `@global function __json_decimal_test_frame(raw:i32,slot:i32):u64{return load<u64>(${table}+(<usize>raw<<5)+(<usize>slot<<3));}`,
    );
    class Bind extends Visitor {
      _visit(node, parent) {
        node.range = source.range;
        super._visit(node, parent);
      }
    }
    new Bind().visit(probe);
    source.statements.push(probe);
  }
}
