// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { Node, } from "assemblyscript/dist/assemblyscript.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
import { NodeKind } from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
export class RowIntegerWriters {
    parser;
    names;
    entry = null;
    constructor(parser, names) {
        this.parser = parser;
        this.names = names;
    }
    rewrite(worker, source, owner) {
        const calls = [];
        const parser = this.parser;
        const parameters = source.classTypeParameters(owner);
        class Find extends Visitor {
            visitCallExpression(call, parent) {
                if (call.expression.kind === NodeKind.PropertyAccess &&
                    call.expression.property.text ===
                        "__serializePrimitiveAt" &&
                    call.typeArguments?.length === 1) {
                    const type = source.resolveTypeMeaning(toString(call.typeArguments[0]), "", parser, parameters);
                    if (!type.declaration &&
                        !type.nullable &&
                        !type.arguments.length &&
                        (type.name === "i64" || type.name === "u64"))
                        calls.push(call);
                }
                super.visitCallExpression(call, parent);
            }
        }
        new Find().visit(worker.body);
        if (!calls.length)
            return;
        const entry = this.entry ?? this.create();
        if (!entry)
            return;
        for (const call of calls)
            call.expression = Node.createIdentifierExpression(entry, call.expression.range);
    }
    create() {
        const root = diagnosticsRuntimeRoot(this.parser.sources);
        if (root === undefined)
            return null;
        const input = this.parser.sources.find((source) => source.internalPath === root + "assembly/util/itoa-fast");
        if (!input)
            return null;
        const find = (name) => input.statements.find((node) => node.kind === NodeKind.FunctionDeclaration &&
            node.name.text === name);
        const original32 = find("itoaU32");
        const original64 = find("itoaU64");
        const originalFast = find("itoaFast");
        if (!original32 || !original64 || !originalFast)
            return null;
        let index = 0;
        let symbols;
        do {
            const stem = "__json_triplet_" + index++;
            symbols = ["entry", "u32", "u64", "fast", "entry_triplets"].map((name) => stem + "_" + name);
        } while (symbols.some((name) => this.names.has(name)));
        for (const name of symbols)
            this.names.add(name);
        const [entry, width32, width64, fast, tableName] = symbols;
        const copy = (original, name) => {
            const fn = cloneNode(original);
            fn.name.text = name;
            return fn;
        };
        const fn32 = copy(original32, width32);
        const fn64 = copy(original64, width64);
        const fnFast = copy(originalFast, fast);
        class Bind extends Visitor {
            _visit(node, parent) {
                node.range = input.range;
                super._visit(node, parent);
            }
        }
        const units = [];
        for (let value = 0; value < 1000; value++)
            for (const char of String(value).padStart(3, "0"))
                units.push(char.charCodeAt(0));
        units.push(0);
        const table = SimpleParser.parseTopLevelStatement(`const ${tableName}:usize=memory.data<u16>([${units.join(",")}]);`);
        const block = SimpleParser.parseStatement(`{
      const q=v/1000;
      const hi=v/1000000;
      const mid=q-hi*1000;
      const lo=v-q*1000;
      store<u64>(buf,load<u64>(${tableName}+<usize>hi*6));
      store<u64>(buf,load<u64>(${tableName}+<usize>mid*6),6);
      store<u64>(buf,load<u64>(${tableName}+<usize>lo*6),12);
      return 9;
    }`);
        new Bind().visit([table, block]);
        const branches = fn32.body.statements;
        branches[4].ifTrue = block;
        class BindCalls extends Visitor {
            visitCallExpression(call, parent) {
                if (call.expression.kind === NodeKind.Identifier) {
                    const identifier = call.expression;
                    if (identifier.text === "itoaU32")
                        identifier.text = width32;
                    else if (identifier.text === "itoaU64")
                        identifier.text = width64;
                }
                super.visitCallExpression(call, parent);
            }
        }
        new BindCalls().visit([fn64.body, fnFast.body]);
        const declaration = SimpleParser.parseTopLevelStatement(`@global @inline function ${entry}<T extends number>(dst:usize,data:T):usize { ensureItoaPairs();const count=${fast}<T>(dst,data);return dst+(<usize>count<<1); }`);
        new Bind().visit(declaration);
        input.statements.push(table, fn32, fn64, fnFast, declaration);
        this.entry = entry;
        return entry;
    }
}
