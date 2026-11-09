// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { Node, } from "assemblyscript/dist/assemblyscript.js";
import { NodeKind } from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
export function specializeObjectBarrier(sources) {
    const root = diagnosticsRuntimeRoot(sources);
    if (root === undefined)
        return;
    const target = sources.find((s) => s.internalPath === root + "assembly/util/runtime");
    const runtime = sources.find((s) => s.internalPath === "~lib/rt/itcms");
    if (!target || !runtime)
        return;
    const find = (source, name) => source.statements.find((s) => s.kind === NodeKind.FunctionDeclaration &&
        s.name.text === name);
    const helper = find(target, "linkObject");
    const original = find(runtime, "__link");
    if (!helper?.body ||
        !original?.body ||
        original.signature.parameters.length !== 3)
        return;
    const statement = helper.body.statements[0];
    if (statement?.kind !== NodeKind.Expression)
        return;
    const call = statement.expression;
    if (call.kind !== NodeKind.Call ||
        call.expression.kind !== NodeKind.Identifier ||
        call.expression.text !== "__link")
        return;
    const unused = (source, prefix) => {
        let name = prefix;
        for (let i = 0; source.text.includes(name); i++)
            name = prefix + i;
        return name;
    };
    const name = unused(runtime, "__json_as_link_object");
    const local = unused(target, "__json_as_runtime_link");
    const copy = cloneNode(original);
    copy.name.text = name;
    copy.decorators = (copy.decorators ?? []).filter((d) => !["global", "inline"].includes(d.name.text));
    copy.decorators.push(Node.createDecorator(Node.createIdentifierExpression("inline", copy.range), null, copy.range));
    const expected = SimpleParser.parseTopLevelStatement(`function barrier(parentPtr: usize, childPtr: usize, expectMultiple: bool): void {
    if (!childPtr) return;
    if (DEBUG) assert(parentPtr);
    let child = changetype<Object>(childPtr - TOTAL_OVERHEAD);
    if (child.color == white) {
      let parent = changetype<Object>(parentPtr - TOTAL_OVERHEAD);
      let parentColor = parent.color;
      if (parentColor == i32(!white)) {
        if (expectMultiple) { parent.makeGray(); } else { child.makeGray(); }
      } else if (parentColor == transparent && state == STATE_MARK) {
        child.makeGray();
      }
    }
  }`);
    if (toString(original.body) === toString(expected.body)) {
        const reordered = SimpleParser.parseTopLevelStatement(`function barrier(parentPtr: usize, childPtr: usize, expectMultiple: bool): void {
      if (!childPtr) return;
      if (DEBUG) assert(parentPtr);
      const parent = changetype<Object>(parentPtr - TOTAL_OVERHEAD);
      const parentColor = parent.color;
      if (parentColor == i32(!white)) {
        const child = changetype<Object>(childPtr - TOTAL_OVERHEAD);
        if (child.color == white) {
          if (expectMultiple) parent.makeGray(); else child.makeGray();
        }
      } else if (parentColor == transparent && state == STATE_MARK) {
        const child = changetype<Object>(childPtr - TOTAL_OVERHEAD);
        if (child.color == white) child.makeGray();
      }
    }`);
        class Bind extends Visitor {
            _visit(node, parent) {
                node.range = original.range;
                super._visit(node, parent);
            }
        }
        new Bind().visit(reordered.body);
        copy.body = reordered.body;
    }
    runtime.statements.push(copy);
    const imports = Node.createImportStatement([
        Node.createImportDeclaration(Node.createIdentifierExpression(name, target.range), Node.createIdentifierExpression(local, target.range), target.range),
    ], Node.createStringLiteralExpression("rt/itcms", target.range), target.range);
    imports.internalPath = runtime.internalPath;
    target.statements.unshift(imports);
    call.expression = Node.createIdentifierExpression(local, call.range);
}
