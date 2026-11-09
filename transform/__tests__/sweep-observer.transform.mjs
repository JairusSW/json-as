// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// Untimed observer only: callbacks count reclaimed objects and native frees.
import Base from "../lib/index.js";
import { SimpleParser, toString } from "../lib/util.js";
import { Visitor } from "../lib/visitor.js";
export default class extends Base {
  afterParse(parser) {
    super.afterParse(parser);
    const rt = parser.sources.find((s) => s.internalPath === "~lib/rt/itcms");
    const defer = rt?.statements.find(
      (n) => n.body && n.name?.text.startsWith("__json_as_sweep_defer"),
    );
    const flush = rt?.statements.find(
      (n) => n.body && n.name?.text.startsWith("__json_as_sweep_flush"),
    );
    if (!defer || !flush) throw Error("Missing optimized sweep helpers");
    class Bind extends Visitor {
      _visit(n, p) {
        n.range = defer.range;
        super._visit(n, p);
      }
    }
    const bind = (n) => {
      new Bind().visit(n);
      return n;
    };
    const item = "__json_as_observe_sweep_item",
      run = "__json_as_observe_sweep_run";
    rt.statements.push(
      bind(
        SimpleParser.parseTopLevelStatement(
          `@external("env","jsonSweepItem") declare function ${item}():void;`,
        ),
      ),
      bind(
        SimpleParser.parseTopLevelStatement(
          `@external("env","jsonSweepRun") declare function ${run}():void;`,
        ),
      ),
    );
    defer.body.statements.unshift(
      bind(SimpleParser.parseStatement(`${item}();`)),
    );
    const held = flush.body.statements[1];
    if (!held.ifTrue?.statements) throw Error("Unexpected flush body");
    held.ifTrue.statements.unshift(
      bind(SimpleParser.parseStatement(`${run}();`)),
    );
    const step = rt.statements.find(
      (n) => n.name?.text === "__json_as_sweep_step",
    );
    rt.statements.push(
      bind(
        SimpleParser.parseTopLevelStatement(
          '@external("env", "jsonStaticArrayScan") declare function __json_as_observe_static_scan(): void;',
        ),
      ),
    );
    class ObserveStaticScan extends Visitor {
      visitIfStatement(node, parent) {
        if (toString(node.condition).includes("idof<Array<i64>>")) {
          node.ifFalse = bind(
            SimpleParser.parseStatement("{ __json_as_observe_static_scan(); }"),
          );
        }
        super.visitIfStatement(node, parent);
      }
    }
    new ObserveStaticScan().visit(step);
  }
}
