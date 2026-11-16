// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { NodeKind } from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
export class RecordCursorWriters {
    parser;
    names;
    writers = new Map();
    nextIndex = 0;
    constructor(parser, names) {
        this.parser = parser;
        this.names = names;
    }
    rewrite(model, source, serializer, closed) {
        const writers = this.writers;
        const parser = this.parser;
        const parameters = source.classTypeParameters(model);
        class Bind extends Visitor {
            _visit(node, parent) {
                node.range = serializer.range;
                super._visit(node, parent);
            }
        }
        class Calls extends Visitor {
            visitBlockStatement(block, parent) {
                for (let i = 0; i + 2 < block.statements.length; i++) {
                    const [before, middle, after] = block.statements.slice(i, i + 3);
                    if (toString(before) !== "bs.offset = __dst" ||
                        toString(after) !== "__dst = bs.offset" ||
                        middle.kind !== NodeKind.Expression)
                        continue;
                    const call = middle
                        .expression;
                    if (call.kind !== NodeKind.Call ||
                        !/^__json_borrow_record_\d+$/.test(toString(call.expression)) ||
                        call.typeArguments?.length !== 1 ||
                        call.args.length !== 1)
                        continue;
                    const type = source.resolveTypeMeaning(toString(call.typeArguments[0]), "", parser, parameters);
                    const writer = writers.get(type.declaration);
                    if (!writer)
                        continue;
                    const replacement = SimpleParser.parseStatement(`__dst = ${writer}(${toString(call.args[0])}, __dst);`);
                    new Bind().visit(replacement);
                    block.statements.splice(i, 3, replacement);
                }
                super.visitBlockStatement(block, parent);
            }
        }
        new Calls().visit(serializer.body);
        if (!closed || writers.has(model))
            return null;
        const body = cloneNode(serializer.body);
        const statements = body.statements;
        if (!statements.some((node) => toString(node) === "let __dst = bs.offset"))
            return null;
        let end = statements.length - 1;
        while (end >= 0 && toString(statements[end]) !== "bs.offset = __dst")
            end--;
        if (end < 0 ||
            statements
                .slice(end + 1)
                .some((node) => !toString(node).startsWith("bs.stackSize =")))
            return null;
        statements.splice(end, 1);
        class LocalOffset extends Visitor {
            visitPropertyAccessExpression(node, parent) {
                if (toString(node) !== "bs.offset") {
                    super.visitPropertyAccessExpression(node, parent);
                    return;
                }
                const owner = parent;
                for (const key of Object.keys(owner))
                    if (owner[key] === node)
                        owner[key] = SimpleParser.parseExpression("__dst");
            }
        }
        for (const statement of statements.slice(end))
            new LocalOffset().visit(statement);
        let name, input;
        do {
            const index = this.nextIndex++;
            name = `__json_cursor_record_${index}`;
            input = `__json_record_input_${index}`;
        } while (this.names.has(name) || this.names.has(input));
        this.names.add(name);
        this.names.add(input);
        statements.unshift(SimpleParser.parseStatement(`bs.offset = ${input};`));
        statements.push(SimpleParser.parseStatement("return __dst;"));
        class Types extends Visitor {
            visitNamedTypeNode(type) {
                if (type.name.identifier.text === "this")
                    type.name.identifier.text = model.name.text;
            }
        }
        new Types().visit(body);
        const helper = SimpleParser.parseTopLevelStatement(`@global function ${name}(ptr: usize, ${input}: usize): usize ${toString(body)}`);
        new Bind().visit(helper);
        writers.set(model, name);
        return helper;
    }
}
