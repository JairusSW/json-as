// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import {
  BlockStatement,
  CallExpression,
  ClassDeclaration,
  FunctionDeclaration,
  IdentifierExpression,
  IfStatement,
  Node,
  Parser,
  PropertyAccessExpression,
} from "assemblyscript/dist/assemblyscript.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
import { NodeKind, Src } from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";

/** Private integer writers for rows already accepted by arrayRowSafety. */
export class RowIntegerWriters {
  private entry: string | null = null;

  constructor(
    private parser: Parser,
    private names: Set<string>,
  ) {}

  rewrite(
    worker: FunctionDeclaration,
    source: Src,
    owner: ClassDeclaration,
  ): void {
    const calls: CallExpression[] = [];
    const parser = this.parser;
    const parameters = source.classTypeParameters(owner);
    class Find extends Visitor {
      visitCallExpression(call: CallExpression, parent: Node): void {
        if (
          call.expression.kind === NodeKind.PropertyAccess &&
          (call.expression as PropertyAccessExpression).property.text ===
            "__serializePrimitiveAt" &&
          call.typeArguments?.length === 1
        ) {
          const type = source.resolveTypeMeaning(
            toString(call.typeArguments[0]),
            "",
            parser,
            parameters,
          );
          // Leave narrower fields on their original, independently compiled path.
          if (
            !type.declaration &&
            !type.nullable &&
            !type.arguments.length &&
            (type.name === "i64" || type.name === "u64")
          )
            calls.push(call);
        }
        super.visitCallExpression(call, parent);
      }
    }
    new Find().visit(worker.body!);
    if (!calls.length) return;
    const entry = this.entry ?? this.create();
    if (!entry) return;
    for (const call of calls)
      call.expression = Node.createIdentifierExpression(
        entry,
        call.expression.range,
      );
  }

  private create(): string | null {
    const root = diagnosticsRuntimeRoot(this.parser.sources);
    if (root === undefined) return null;
    const input = this.parser.sources.find(
      (source) => source.internalPath === root + "assembly/util/itoa-fast",
    );
    if (!input) return null;
    const find = (name: string) =>
      input.statements.find(
        (node) =>
          node.kind === NodeKind.FunctionDeclaration &&
          (node as FunctionDeclaration).name.text === name,
      ) as FunctionDeclaration | undefined;
    const original32 = find("itoaU32");
    const original64 = find("itoaU64");
    const originalFast = find("itoaFast");
    if (!original32 || !original64 || !originalFast) return null;

    let index = 0;
    let symbols: string[];
    do {
      const stem = "__json_triplet_" + index++;
      symbols = ["entry", "u32", "u64", "fast", "entry_triplets"].map(
        (name) => stem + "_" + name,
      );
    } while (symbols.some((name) => this.names.has(name)));
    for (const name of symbols) this.names.add(name);
    const [entry, width32, width64, fast, tableName] = symbols;
    const copy = (original: FunctionDeclaration, name: string) => {
      const fn = cloneNode(original) as FunctionDeclaration;
      fn.name.text = name;
      return fn;
    };
    const fn32 = copy(original32, width32);
    const fn64 = copy(original64, width64);
    const fnFast = copy(originalFast, fast);
    class Bind extends Visitor {
      _visit(node: Node, parent: Node | null): void {
        node.range = input!.range;
        super._visit(node, parent);
      }
    }

    // Six bytes per triplet, plus one code unit for the last bounded u64 load.
    // This is immutable module data; there is no managed startup allocation.
    const units: number[] = [];
    for (let value = 0; value < 1000; value++)
      for (const char of String(value).padStart(3, "0"))
        units.push(char.charCodeAt(0));
    units.push(0);
    const table = SimpleParser.parseTopLevelStatement(
      `const ${tableName}:usize=memory.data<u16>([${units.join(",")}]);`,
    );
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
    // The source and semantic AST have already passed the stock-runtime proof.
    // Keep every width check and every other formatting branch unchanged.
    const branches = (fn32.body! as BlockStatement).statements;
    (branches[4] as IfStatement).ifTrue = block;

    class BindCalls extends Visitor {
      visitCallExpression(call: CallExpression, parent: Node): void {
        if (call.expression.kind === NodeKind.Identifier) {
          const identifier = call.expression as IdentifierExpression;
          if (identifier.text === "itoaU32") identifier.text = width32;
          else if (identifier.text === "itoaU64") identifier.text = width64;
        }
        super.visitCallExpression(call, parent);
      }
    }
    new BindCalls().visit([fn64.body!, fnFast.body!]);
    // The final overlapping store ends at byte 20, within itoaU32's existing
    // reservation. Return the logical nine-character length, not that padding.
    // Keep writeU64Large unchanged, including its padded trailing groups.
    const declaration = SimpleParser.parseTopLevelStatement(
      `@global @inline function ${entry}<T extends number>(dst:usize,data:T):usize { ensureItoaPairs();const count=${fast}<T>(dst,data);return dst+(<usize>count<<1); }`,
    );
    new Bind().visit(declaration);
    input.statements.push(table, fn32, fn64, fnFast, declaration);
    this.entry = entry;
    return entry;
  }
}
