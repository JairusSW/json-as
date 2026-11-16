// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { NodeKind } from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
export class NumericRowBatches {
    names;
    nextIndex = 0;
    constructor(names) {
        this.names = names;
    }
    rewrite(worker) {
        const loop = worker.body?.statements[0];
        if (loop?.kind !== NodeKind.For)
            return [];
        const text = toString(worker.body);
        if (text.includes("__serializeArrayPointer") ||
            text.includes("__serializeObject") ||
            text.includes("__serializeString"))
            return [];
        const row = loop.body.statements.find((statement) => statement.kind === NodeKind.If);
        if (row?.ifFalse?.kind !== NodeKind.Block)
            return [];
        const body = cloneNode(row.ifFalse);
        let unsupported = false;
        class CheckCalls extends Visitor {
            visitCallExpression(node, parent) {
                if (node.expression.kind === NodeKind.PropertyAccess) {
                    const name = node.expression.property
                        .text;
                    if (toString(node.expression) !== "bs.proposeSize" &&
                        name !== "__integerArrayReservedBytes" &&
                        name !== "__serializePrimitiveAt" &&
                        name !== "__serializeIntegerArrayPointerReservedAt")
                        unsupported = true;
                }
                super.visitCallExpression(node, parent);
            }
        }
        new CheckCalls().visit(body);
        if (unsupported)
            return [];
        const proposal = body.statements[0];
        const call = proposal.expression;
        if (proposal.kind !== NodeKind.Expression ||
            call.kind !== NodeKind.Call ||
            toString(call.expression) !== "bs.proposeSize" ||
            call.args.length !== 1 ||
            (toString(body).match(/bs\.proposeSize/g) ?? []).length !== 1)
            return [];
        body.statements.shift();
        const input = worker.signature.parameters[0].name.text;
        const length = worker.signature.parameters[1].name.text;
        const array = worker.typeParameters[0].name.text;
        const prefix = worker.name.text.replace(/_write$/, "");
        const pointer = prefix + "_ptr";
        const index = prefix + "_index";
        let stem;
        do
            stem = "__json_numeric_batch_" + this.nextIndex++;
        while ([
            "original",
            "capacity",
            "dst",
            "start",
            "end",
            "bytes",
            "reserved",
            "begin",
        ].some((suffix) => this.names.has(stem + "_" + suffix)));
        const [originalName, capacity, dst, start, end, bytes, reserved, begin] = [
            "original",
            "capacity",
            "dst",
            "start",
            "end",
            "bytes",
            "reserved",
            "begin",
        ].map((suffix) => stem + "_" + suffix);
        for (const name of [
            originalName,
            capacity,
            dst,
            start,
            end,
            bytes,
            reserved,
            begin,
        ])
            this.names.add(name);
        const original = cloneNode(worker);
        original.name.text = originalName;
        const parameter = SimpleParser.parseTopLevelStatement(`function parameter(${start}: i32): void {}`).signature.parameters[0];
        original.signature.parameters.push(parameter);
        const originalLoop = original.body
            .statements[0];
        originalLoop.initializer.declarations[0].initializer = SimpleParser.parseExpression(start);
        const wide = SimpleParser.parseTopLevelStatement(`@global @inline
      function ${capacity}<T extends number[]>(data: usize): u64 {
        const length = <u64>load<u32>(data, offsetof<T>("length_"));
        if (sizeof<valueof<T>>() == 1) return length * (isSigned<valueof<T>>() ? 10 : 8);
        if (sizeof<valueof<T>>() == 2) return length * (isSigned<valueof<T>>() ? 14 : 12);
        if (sizeof<valueof<T>>() == 4) return length * (isSigned<valueof<T>>() ? 24 : 22);
        return length * (isSigned<valueof<T>>() ? 44 : 42);
      }`);
        const estimate = cloneNode(call.args[0]);
        class Widen extends Visitor {
            visitCallExpression(node, parent) {
                if (node.expression.kind === NodeKind.PropertyAccess &&
                    node.expression.property.text ===
                        "__integerArrayReservedBytes")
                    node.expression = SimpleParser.parseExpression(capacity);
                super.visitCallExpression(node, parent);
            }
        }
        new Widen().visit(estimate);
        const bound = toString(estimate);
        const cursor = body.statements
            .filter((statement) => statement.kind === NodeKind.Variable)
            .flatMap((statement) => statement.declarations)
            .find((declaration) => declaration.name.text === "__dst");
        const publish = body.statements.find((statement) => toString(statement) === "bs.offset = __dst");
        if (!cursor || toString(cursor.initializer) !== "bs.offset" || !publish)
            return [];
        cursor.initializer = SimpleParser.parseExpression(dst);
        publish.expression.left =
            SimpleParser.parseExpression(dst);
        const rowText = toString(body);
        const budget = bound.includes(pointer)
            ? `for(let ${index}=${start};${index}<${end};${index}++) {
          const ${pointer}=JSON.__serializeFlatNumericElement<${array}>(changetype<usize>(${input}),${index});
          if(isNullable<valueof<${array}>>() && ${pointer}==0) ${bytes}+=8;
          else ${bytes}+=<u64>(${bound});
        }`
            : `${bytes}+=<u64>(${bound})*<u64>(${end}-${start});`;
        worker.body = SimpleParser.parseStatement(`{
      for(let ${start}=0;${start}<${length};) {
        const ${end}=${start}+min<i32>(16,${length}-${start});
        let ${bytes}:u64=<u64>(${end}-${start})*2;
        ${budget}
        if(${bytes}>0x3fffffff) {
          ${originalName}<${array}>(${input},${end},${start});
          ${start}=${end};continue;
        }
        const ${reserved}=bs.stackSize;
        const ${begin}=bs.offset-bs.buffer;
        bs.proposeSize(<u32>${bytes});
        let ${dst}=bs.offset;
        for(let ${index}=${start};${index}<${end};${index}++) {
          const ${pointer}=JSON.__serializeFlatNumericElement<${array}>(changetype<usize>(${input}),${index});
          if(isNullable<valueof<${array}>>() && ${pointer}==0) {
            store<u64>(${dst},30399761348886638);${dst}+=8;
          } else ${rowText}
          store<u16>(${dst},44);${dst}+=2;
        }
        bs.offset=${dst};
        bs.stackSize=max<usize>(${reserved},${begin})+(bs.offset-bs.buffer-${begin});
        ${start}=${end};
      }
    }`);
        class Bind extends Visitor {
            _visit(node, parent) {
                node.range = worker.range;
                super._visit(node, parent);
            }
        }
        new Bind().visit([worker.body, original, wide]);
        return [original, wide];
    }
}
