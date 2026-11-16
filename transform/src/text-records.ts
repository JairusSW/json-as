// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { createHash } from "node:crypto";
import {
  CallExpression,
  DecoratorNode,
  FunctionDeclaration,
  IfStatement,
  IdentifierExpression,
  VariableDeclaration,
  VariableStatement,
  MethodDeclaration,
  Node,
  Parser,
  PropertyAccessExpression,
  Source,
} from "assemblyscript/dist/assemblyscript.js";
import { arrayRowAstFingerprint } from "./array-row-safety.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
import { TEXT_RECORD_SOURCES } from "./text-record-runtime.js";
import { NodeKind } from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";

/** Preserve the public short-string caller while specializing flat text records. */
export class TextRecordWriters {
  private stringSource: Source | null = null;
  private indexSource: Source | null = null;
  private entry: string | null = null;

  constructor(
    parser: Parser,
    private names: Set<string>,
  ) {
    const root = diagnosticsRuntimeRoot(parser.sources);
    if (root === undefined) return;
    for (const [key, [text, ast]] of TEXT_RECORD_SOURCES) {
      const source = parser.sources.find((s) => s.internalPath === root + key);
      if (
        !source ||
        createHash("sha256").update(source.text).digest("hex") !== text
      )
        return;
      try {
        if (arrayRowAstFingerprint(source.statements, root) !== ast) return;
      } catch {
        return;
      }
    }
    this.stringSource = parser.sources.find(
      (s) => s.internalPath === root + "assembly/serialize/simd/string",
    )!;
    this.indexSource = parser.sources.find(
      (s) => s.internalPath === root + "assembly/serialize/index/string",
    )!;
  }

  rewrite(serializer: MethodDeclaration, fields: number): void {
    if (!this.stringSource || !this.indexSource) return;
    const calls: CallExpression[] = [];
    class Find extends Visitor {
      visitCallExpression(call: CallExpression, parent: Node): void {
        if (
          call.expression.kind === NodeKind.PropertyAccess &&
          (call.expression as PropertyAccessExpression).property.text ===
            "__serializeStringPointerReservedAt"
        )
          calls.push(call);
        super.visitCallExpression(call, parent);
      }
    }
    new Find().visit(serializer.body!);
    if (calls.length !== fields) return;
    const entry = this.entry ?? this.create();
    if (!entry) return;
    for (const call of calls)
      call.expression = Node.createIdentifierExpression(
        entry,
        call.expression.range,
      );
  }

  private create(): string | null {
    const source = this.stringSource!,
      index = this.indexSource!;
    const find = (source: Source, name: string) =>
      source.statements.find(
        (n) =>
          n.kind === NodeKind.FunctionDeclaration &&
          (n as FunctionDeclaration).name.text === name,
      ) as FunctionDeclaration | undefined;
    const original = find(source, "serializeShortStringReservedAt_SIMD");
    const originalEntry = find(index, "serializeStringPointerReservedAt");
    const originalRange = find(source, "serializeStringRangeReservedAt_SIMD");
    const originalPointer = find(
      source,
      "serializeStringPointerReservedAt_SIMD",
    );
    if (!original || !originalEntry || !originalRange || !originalPointer)
      return null;
    let suffix = 0;
    let symbols: string[];
    do {
      const stem = "__json_text_record_" + suffix++;
      symbols = ["short", "entry", "range", "pointer", "mask", "select"].map(
        (name) => stem + "_" + name,
      );
    } while (symbols.some((name) => this.names.has(name)));
    for (const name of symbols) this.names.add(name);
    const [short, entry, rangeName, pointerName, maskName, selectName] =
      symbols;
    const sc = cloneNode(original) as FunctionDeclaration;
    const ec = cloneNode(originalEntry) as FunctionDeclaration;
    sc.name.text = short;
    ec.name.text = entry;
    const global = (
      SimpleParser.parseTopLevelStatement(
        "@global function marker():void{}",
      ) as FunctionDeclaration
    ).decorators![0];
    sc.decorators = [
      ...(sc.decorators ?? []),
      cloneNode(global) as DecoratorNode,
    ];
    ec.decorators = [
      ...(ec.decorators ?? []),
      cloneNode(global) as DecoratorNode,
    ];
    sc.signature.parameters.splice(1, 1);
    // Load exactly three code units. No source read depends on allocator padding.
    sc.body = SimpleParser.parseStatement(`{
      const first=load<u32>(srcStart);const third=load<u16>(srcStart,4);
      let block=i32x4.replace_lane(SPLAT_0020,0,first);
      block=i16x8.replace_lane(block,2,third);
      if(hasStringSpecial(block))return serializeStringRangeReservedAt_SIMD(srcStart,6,dstStart);
      store<u16>(dstStart,34);store<u32>(dstStart+2,first);
      store<u16>(dstStart+6,third);store<u16>(dstStart+8,34);
      return dstStart+10;
    }`);
    const range = cloneNode(originalRange) as FunctionDeclaration;
    const pointer = cloneNode(originalPointer) as FunctionDeclaration;
    range.name.text = rangeName;
    pointer.name.text = pointerName;
    pointer.decorators = [
      ...(pointer.decorators ?? []),
      cloneNode(global) as DecoratorNode,
    ];
    const mask =
      SimpleParser.parseTopLevelStatement(`@inline function ${maskName}(a:v128,b:v128):v128 {
      const escaped=v128.or(v128.or(i16x8.eq(a,SPLAT_0022),i16x8.eq(b,SPLAT_0022)),v128.or(i16x8.eq(a,SPLAT_005C),i16x8.eq(b,SPLAT_005C)));
      const controls=i16x8.lt_u(i16x8.min_u(a,b),SPLAT_0020);
      const surrogates=v128.or(i16x8.eq(v128.and(a,SURROGATE_MASK),SURROGATE_BASE),i16x8.eq(v128.and(b,SURROGATE_MASK),SURROGATE_BASE));
      return v128.or(escaped,v128.or(controls,surrogates));
    }`);
    // The signed packed ASCII scan treats upper BMP text as a conservative hit.
    // Two bounded words test the first eight code units without a vector bitmask.
    // Use the exact two-vector predicate only when that prefix has an upper unit.
    const select =
      SimpleParser.parseTopLevelStatement(`@inline function ${selectName}(src:usize,size:u32,dst:usize):usize {
      if((load<u64>(src)|load<u64>(src,8))&0x8000800080008000)return ${rangeName}(src,size,dst);
      return serializeStringRangeReservedAt_SIMD(src,size,dst);
    }`);
    let predicates = 0;
    class Predicates extends Visitor {
      visitVariableDeclaration(node: VariableDeclaration, parent: Node): void {
        if (node.name.text === "special" && predicates === 0) {
          node.initializer = (
            SimpleParser.parseStatement(
              `const x=${maskName}(first,second);`,
            ) as VariableStatement
          ).declarations[0].initializer;
          predicates++;
        } else if (node.name.text === "tailSpecial") {
          node.initializer = (
            SimpleParser.parseStatement(
              `const x=${maskName}(tailFirst,tailSecond);`,
            ) as VariableStatement
          ).declarations[0].initializer;
          predicates++;
        }
        super.visitVariableDeclaration(node, parent);
      }
    }
    new Predicates().visit(range.body!);
    if (predicates !== 2) return null;
    class PointerCalls extends Visitor {
      visitCallExpression(call: CallExpression, parent: Node): void {
        if (
          call.expression.kind === NodeKind.Identifier &&
          (call.expression as IdentifierExpression).text ===
            "serializeStringRangeReservedAt_SIMD"
        )
          (call.expression as IdentifierExpression).text = selectName;
        super.visitCallExpression(call, parent);
      }
    }
    new PointerCalls().visit(pointer.body!);
    let changed = 0;
    class Redirect extends Visitor {
      visitCallExpression(call: CallExpression, parent: Node): void {
        if (
          call.expression.kind === NodeKind.Identifier &&
          (call.expression as IdentifierExpression).text ===
            "serializeStringPointerReservedAt_SIMD"
        )
          (call.expression as IdentifierExpression).text = pointerName;
        super.visitCallExpression(call, parent);
      }
      visitIfStatement(node: IfStatement, parent: Node): void {
        if (toString(node.condition) === "size < 16") {
          node.ifTrue = SimpleParser.parseStatement(`{
            if(size==6)return ${short}(src,dst);
            return serializeShortStringReservedAt_SIMD(src,size,dst);
          }`);
          changed++;
        } else super.visitIfStatement(node, parent);
      }
    }
    new Redirect().visit(ec.body!);
    if (changed !== 1) return null;
    class Bind extends Visitor {
      constructor(private range: Source["range"]) {
        super();
      }
      _visit(node: Node, parent: Node | null): void {
        node.range = this.range;
        super._visit(node, parent);
      }
    }
    new Bind(original.range).visit(sc);
    new Bind(originalEntry.range).visit(ec);
    new Bind(originalRange.range).visit([mask, select, range, pointer]);
    source.statements.push(sc, mask, select, range, pointer);
    index.statements.push(ec);
    this.entry = entry;
    return entry;
  }
}
