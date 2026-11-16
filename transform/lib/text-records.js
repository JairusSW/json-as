// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { createHash } from "node:crypto";
import { Node, } from "assemblyscript/dist/assemblyscript.js";
import { arrayRowAstFingerprint } from "./array-row-safety.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
import { TEXT_RECORD_SOURCES } from "./text-record-runtime.js";
import { NodeKind } from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
export class TextRecordWriters {
    names;
    stringSource = null;
    indexSource = null;
    entry = null;
    constructor(parser, names) {
        this.names = names;
        const root = diagnosticsRuntimeRoot(parser.sources);
        if (root === undefined)
            return;
        for (const [key, [text, ast]] of TEXT_RECORD_SOURCES) {
            const source = parser.sources.find((s) => s.internalPath === root + key);
            if (!source ||
                createHash("sha256").update(source.text).digest("hex") !== text)
                return;
            try {
                if (arrayRowAstFingerprint(source.statements, root) !== ast)
                    return;
            }
            catch {
                return;
            }
        }
        this.stringSource = parser.sources.find((s) => s.internalPath === root + "assembly/serialize/simd/string");
        this.indexSource = parser.sources.find((s) => s.internalPath === root + "assembly/serialize/index/string");
    }
    rewrite(serializer, fields) {
        if (!this.stringSource || !this.indexSource)
            return;
        const calls = [];
        class Find extends Visitor {
            visitCallExpression(call, parent) {
                if (call.expression.kind === NodeKind.PropertyAccess &&
                    call.expression.property.text ===
                        "__serializeStringPointerReservedAt")
                    calls.push(call);
                super.visitCallExpression(call, parent);
            }
        }
        new Find().visit(serializer.body);
        if (calls.length !== fields)
            return;
        const entry = this.entry ?? this.create();
        if (!entry)
            return;
        for (const call of calls)
            call.expression = Node.createIdentifierExpression(entry, call.expression.range);
    }
    create() {
        const source = this.stringSource, index = this.indexSource;
        const find = (source, name) => source.statements.find((n) => n.kind === NodeKind.FunctionDeclaration &&
            n.name.text === name);
        const original = find(source, "serializeShortStringReservedAt_SIMD");
        const originalEntry = find(index, "serializeStringPointerReservedAt");
        if (!original || !originalEntry)
            return null;
        let suffix = 0, short, entry;
        do {
            const stem = "__json_text_record_" + suffix++;
            short = stem + "_short";
            entry = stem + "_entry";
        } while (this.names.has(short) || this.names.has(entry));
        this.names.add(short);
        this.names.add(entry);
        const sc = cloneNode(original);
        const ec = cloneNode(originalEntry);
        sc.name.text = short;
        ec.name.text = entry;
        const global = SimpleParser.parseTopLevelStatement("@global function marker():void{}").decorators[0];
        sc.decorators = [
            ...(sc.decorators ?? []),
            cloneNode(global),
        ];
        ec.decorators = [
            ...(ec.decorators ?? []),
            cloneNode(global),
        ];
        sc.signature.parameters.splice(1, 1);
        sc.body = SimpleParser.parseStatement(`{
      const first=load<u32>(srcStart);const third=load<u16>(srcStart,4);
      let block=i32x4.replace_lane(SPLAT_0020,0,first);
      block=i16x8.replace_lane(block,2,third);
      if(hasStringSpecial(block))return serializeStringRangeReservedAt_SIMD(srcStart,6,dstStart);
      store<u16>(dstStart,34);store<u32>(dstStart+2,first);
      store<u16>(dstStart+6,third);store<u16>(dstStart+8,34);
      return dstStart+10;
    }`);
        let changed = 0;
        class Redirect extends Visitor {
            visitIfStatement(node, parent) {
                if (toString(node.condition) === "size < 16") {
                    node.ifTrue = SimpleParser.parseStatement(`{
            if(size==6)return ${short}(src,dst);
            return serializeShortStringReservedAt_SIMD(src,size,dst);
          }`);
                    changed++;
                }
                else
                    super.visitIfStatement(node, parent);
            }
        }
        new Redirect().visit(ec.body);
        if (changed !== 1)
            return null;
        class Bind extends Visitor {
            range;
            constructor(range) {
                super();
                this.range = range;
            }
            _visit(node, parent) {
                node.range = this.range;
                super._visit(node, parent);
            }
        }
        new Bind(original.range).visit(sc);
        new Bind(originalEntry.range).visit(ec);
        source.statements.push(sc);
        index.statements.push(ec);
        this.entry = entry;
        return entry;
    }
}
