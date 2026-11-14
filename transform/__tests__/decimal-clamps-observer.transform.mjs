// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import Base from "../lib/index.js";
import { SimpleParser, cloneNode } from "../lib/util.js";
import { Visitor } from "../lib/visitor.js";

// Untimed instrumentation. Exercise the actual rounding tail on arbitrary
// boundaries, and count products to distinguish work elimination from output equality.
export default class extends Base {
  afterParse(parser) {
    const dtoa = parser.sources.find((s) =>
      s.internalPath.endsWith("xjb-as/assembly/dtoa"),
    );
    const xjb = parser.sources.find((s) =>
      s.internalPath.endsWith("xjb-as/assembly/xjb"),
    );
    assert.ok(dtoa && xjb);
    const target = dtoa.statements.find(
      (s) => s.name?.text === "toDecimalDouble",
    );
    const normal = dtoa.statements.find(
      (s) => s.name?.text === "toDecimalDoubleNormal",
    );
    const original = cloneNode(target.body);
    const originalNormal = cloneNode(normal.body);
    const product = xjb.statements.find(
      (s) => s.name?.text === "umul64hiCarry",
    );
    class Bind extends Visitor {
      constructor(range) {
        super();
        this.range = range;
      }
      _visit(n, parent) {
        n.range = this.range;
        super._visit(n, parent);
      }
    }
    const bind = (n, source) => {
      new Bind(source.range).visit(n);
      return n;
    };
    const increment = () =>
      bind(SimpleParser.parseStatement("__clampProducts++;"), xjb);
    // An earlier transform changing the helper must force the conservative path.
    if (process.env.CLAMP_CONTROL === "modified")
      product.body.statements.unshift(increment());
    super.afterParse(parser);
    const selected = target.body.statements.at(-4).ifTrue !== undefined;
    assert.equal(selected, process.env.CLAMP_CONTROL !== "modified");
    if (process.env.CLAMP_CONTROL === "original") {
      target.body = original;
      normal.body = originalNormal;
    }
    if (process.env.CLAMP_CONTROL !== "modified")
      product.body.statements.unshift(increment());
    for (const text of [
      "let __clampProducts:i32 = 0;",
      "export function __resetClampProducts():void { __clampProducts = 0; }",
      "export function __readClampProducts():i32 { return __clampProducts; }",
      "export function __readClampSig():u64 { return <u64>gSig; }",
      "export function __readClampDigit():i32 { return gLastDigit; }",
      "export function __readClampHasDigit():bool { return gHasLastDigit; }",
      "export function __readClampExp():i32 { return gExp; }",
    ])
      xjb.statements.push(bind(SimpleParser.parseTopLevelStatement(text), xjb));
    for (const [name, fn] of [
      ["__clampProbe", target],
      ["__clampProbeNormal", normal],
    ]) {
      const probe = bind(
        SimpleParser.parseTopLevelStatement(
          `export function ${name}(integral:u64,dotOne:u64,halfUlp:u64,decExp:i32):void {}`,
        ),
        dtoa,
      );
      probe.body.statements.push(...cloneNode(fn.body.statements.slice(-4)));
      dtoa.statements.push(probe);
    }
  }
}
