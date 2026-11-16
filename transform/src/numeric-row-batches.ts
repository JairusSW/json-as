// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import {
  BinaryExpression,
  BlockStatement,
  CallExpression,
  ExpressionStatement,
  ForStatement,
  FunctionDeclaration,
  IfStatement,
  Node,
  Parser,
  PropertyAccessExpression,
  VariableStatement,
} from "assemblyscript/dist/assemblyscript.js";
import { NodeKind, Src } from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";

/** Batch only the existing proved numeric row workers, never user callbacks. */
export class NumericRowBatches {
  private nextIndex = 0;

  constructor(private names: Set<string>) {}

  rewrite(
    worker: FunctionDeclaration,
    source: Src,
    parser: Parser,
    comma: (target: string) => string,
  ): FunctionDeclaration[] {
    // These names are emitted as arithmetic types in the declaring module.
    // A local alias must not silently narrow capacity or cursor arithmetic.
    for (const name of ["u64", "u32", "i32", "usize"]) {
      const type = source.resolveTypeMeaning(name, "", parser);
      if (
        type.name !== name ||
        type.declaration ||
        type.nullable ||
        type.arguments.length
      )
        return [];
    }
    const loop = (worker.body as BlockStatement | null)?.statements[0] as
      ForStatement | undefined;
    if (loop?.kind !== NodeKind.For) return [];
    const text = toString(worker.body!);
    if (
      text.includes("__serializeArrayPointer") ||
      text.includes("__serializeObject") ||
      text.includes("__serializeString")
    )
      return [];
    const row = (loop.body as BlockStatement).statements.find(
      (statement) => statement.kind === NodeKind.If,
    ) as IfStatement | undefined;
    if (row?.ifFalse?.kind !== NodeKind.Block) return [];
    const body = cloneNode(row.ifFalse) as BlockStatement;
    let unsupported = false;
    class CheckCalls extends Visitor {
      visitCallExpression(node: CallExpression, parent: Node): void {
        if (node.expression.kind === NodeKind.PropertyAccess) {
          const name = (node.expression as PropertyAccessExpression).property
            .text;
          if (
            toString(node.expression) !== "bs.proposeSize" &&
            name !== "__integerArrayReservedBytes" &&
            name !== "__serializePrimitiveAt" &&
            name !== "__serializeIntegerArrayPointerReservedAt"
          )
            unsupported = true;
        }
        super.visitCallExpression(node, parent);
      }
    }
    new CheckCalls().visit(body);
    if (unsupported) return [];
    const proposal = body.statements[0] as ExpressionStatement;
    const call = proposal.expression as CallExpression;
    if (
      proposal.kind !== NodeKind.Expression ||
      call.kind !== NodeKind.Call ||
      toString(call.expression) !== "bs.proposeSize" ||
      call.args.length !== 1 ||
      (toString(body).match(/bs\.proposeSize/g) ?? []).length !== 1
    )
      return [];
    body.statements.shift();

    const input = worker.signature.parameters[0].name.text;
    const length = worker.signature.parameters[1].name.text;
    const array = worker.typeParameters![0].name.text;
    const prefix = worker.name.text.replace(/_write$/, "");
    const pointer = prefix + "_ptr";
    const index = prefix + "_index";
    let stem: string;
    do stem = "__json_numeric_batch_" + this.nextIndex++;
    while (
      [
        "original",
        "capacity",
        "dst",
        "start",
        "end",
        "bytes",
        "reserved",
        "begin",
      ].some((suffix) => this.names.has(stem + "_" + suffix))
    );
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

    const original = cloneNode(worker) as FunctionDeclaration;
    original.name.text = originalName;
    const parameter = (
      SimpleParser.parseTopLevelStatement(
        `function parameter(${start}: i32): void {}`,
      ) as FunctionDeclaration
    ).signature.parameters[0];
    original.signature.parameters.push(parameter);
    const originalLoop = (original.body as BlockStatement)
      .statements[0] as ForStatement;
    (
      originalLoop.initializer as VariableStatement
    ).declarations[0].initializer = SimpleParser.parseExpression(start);

    // Accumulate in u64 before narrowing. Oversized chunks retain the original
    // per-row path instead of allowing a wrapped batch reservation.
    const wide = SimpleParser.parseTopLevelStatement(`@global @inline
      function ${capacity}<T extends number[]>(data: usize): u64 {
        const length = <u64>load<u32>(data, offsetof<T>("length_"));
        if (sizeof<valueof<T>>() == 1) return length * (isSigned<valueof<T>>() ? 10 : 8);
        if (sizeof<valueof<T>>() == 2) return length * (isSigned<valueof<T>>() ? 14 : 12);
        if (sizeof<valueof<T>>() == 4) return length * (isSigned<valueof<T>>() ? 24 : 22);
        return length * (isSigned<valueof<T>>() ? 44 : 42);
      }`);
    const estimate = cloneNode(call.args[0]) as Node;
    class Widen extends Visitor {
      visitCallExpression(node: CallExpression, parent: Node): void {
        if (
          node.expression.kind === NodeKind.PropertyAccess &&
          (node.expression as PropertyAccessExpression).property.text ===
            "__integerArrayReservedBytes"
        )
          node.expression = SimpleParser.parseExpression(capacity);
        super.visitCallExpression(node, parent);
      }
    }
    new Widen().visit(estimate);
    const bound = toString(estimate);
    const cursor = body.statements
      .filter((statement) => statement.kind === NodeKind.Variable)
      .flatMap((statement) => (statement as VariableStatement).declarations)
      .find((declaration) => declaration.name.text === "__dst");
    const publish = body.statements.find(
      (statement) => toString(statement) === "bs.offset = __dst",
    ) as ExpressionStatement | undefined;
    if (!cursor || toString(cursor.initializer!) !== "bs.offset" || !publish)
      return [];
    cursor.initializer = SimpleParser.parseExpression(dst);
    (publish.expression as BinaryExpression).left =
      SimpleParser.parseExpression(dst);
    const rowText = toString(body);
    const budget = bound.includes(pointer)
      ? `for(let ${index}=${start};${index}<${end};${index}++) {
          const ${pointer}=JSON.__serializeFlatNumericElement<${array}>(changetype<usize>(${input}),${index});
          if(isNullable<valueof<${array}>>() && ${pointer}==0) ${bytes}+=8;
          else ${bytes}+=<u64>(${bound});
        }`
      : `${bytes}+=<u64>(${bound})*<u64>(${end}-${start});`;
    // The array already reserved each comma. Match the original per-row
    // retirement: keep caller credits plus row bytes, with a floor at the
    // cursor before the final comma when no caller credits remain.
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
          ${comma(dst)}
        }
        bs.offset=${dst};
        bs.stackSize=max<usize>(
          ${reserved}+(${dst}-bs.buffer-${begin}-(<usize>(${end}-${start})<<1)),
          ${dst}-bs.buffer-2
        );
        ${start}=${end};
      }
    }`) as BlockStatement;
    class Bind extends Visitor {
      _visit(node: Node, parent: Node | null): void {
        node.range = worker.range;
        super._visit(node, parent);
      }
    }
    new Bind().visit([worker.body, original, wide]);
    return [original, wide as FunctionDeclaration];
  }
}
