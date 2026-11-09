// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import {
  IdentifierExpression,
  IfStatement,
  ExpressionStatement,
  UnaryPrefixExpression,
  BlockStatement,
  ReturnStatement,
  CallExpression,
  FunctionDeclaration,
  Node,
  Source,
} from "assemblyscript/dist/assemblyscript.js";
import { NodeKind } from "./types.js";
import { cloneNode, SimpleParser } from "./util.js";
import { Visitor } from "./visitor.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";

/** Expose constant schema sizes to the standard allocator, preserving its body. */
export function specializeObjectAllocator(sources: Source[]): void {
  const root = diagnosticsRuntimeRoot(sources);
  if (root === undefined) return;
  const target = sources.find(
    (s) => s.internalPath === root + "assembly/util/runtime",
  );
  const runtime = sources.find((s) => s.internalPath === "~lib/rt/itcms");
  // Other runtimes and custom runtime implementations retain the normal entry.
  if (!target || !runtime) return;
  const helper = target.statements.find(
    (s) =>
      s.kind === NodeKind.FunctionDeclaration &&
      (s as FunctionDeclaration).name.text === "allocateObject",
  ) as FunctionDeclaration | undefined;
  const original = runtime.statements.find(
    (s) =>
      s.kind === NodeKind.FunctionDeclaration &&
      (s as FunctionDeclaration).name.text === "__new",
  ) as FunctionDeclaration | undefined;
  if (!helper || !original || !helper.body || !original.body) return;
  const unused = (source: Source, prefix: string): string => {
    const text = source.text;
    let name = prefix;
    for (let i = 0; text.includes(name); i++) name = prefix + i;
    return name;
  };
  const name = unused(runtime, "__json_as_allocate_object");
  const local = unused(target, "__json_as_runtime_allocate");
  const copy = cloneNode(original) as FunctionDeclaration;
  copy.name.text = name;
  copy.decorators = (copy.decorators ?? []).filter(
    (d) =>
      (d.name as IdentifierExpression).text !== "global" &&
      (d.name as IdentifierExpression).text !== "inline",
  );
  copy.decorators.push(
    Node.createDecorator(
      Node.createIdentifierExpression("inline", copy.range),
      null,
      copy.range,
    ),
  );
  runtime.statements.push(copy);
  const imports = Node.createImportStatement(
    [
      Node.createImportDeclaration(
        Node.createIdentifierExpression(name, target.range),
        Node.createIdentifierExpression(local, target.range),
        target.range,
      ),
    ],
    Node.createStringLiteralExpression("rt/itcms", target.range),
    target.range,
  );
  imports.internalPath = runtime.internalPath;
  target.statements.unshift(imports);
  // This exact library helper owns one call. No user expressions are rewritten.
  const statement = (helper.body as BlockStatement).statements[0];
  if (statement.kind !== NodeKind.Return)
    throw new Error("Unexpected allocation helper body");
  const call = (statement as ReturnStatement).value as CallExpression;
  if (call.kind !== NodeKind.Call)
    throw new Error("Unexpected allocation helper call");
  call.expression = Node.createIdentifierExpression(local, call.range);
  const tlsf = sources.find((s) => s.internalPath === "~lib/rt/tlsf");
  const batch = target.statements.find(
    (s) =>
      s.kind === NodeKind.FunctionDeclaration &&
      (s as FunctionDeclaration).name.text === "trySmallBatch",
  ) as FunctionDeclaration | undefined;
  const small = target.statements.find(
    (s) =>
      s.kind === NodeKind.FunctionDeclaration &&
      (s as FunctionDeclaration).name.text === "allocateSmallBlock",
  ) as FunctionDeclaration | undefined;
  const release = target.statements.find(
    (s) =>
      s.kind === NodeKind.FunctionDeclaration &&
      (s as FunctionDeclaration).name.text === "releaseSmallBatches",
  ) as FunctionDeclaration | undefined;
  if (!tlsf || !batch || !small || !release) return;
  const allocate = tlsf.statements.find(
    (s) =>
      s.kind === NodeKind.FunctionDeclaration &&
      (s as FunctionDeclaration).name.text === "allocateBlock",
  ) as FunctionDeclaration | undefined;
  const growth = (allocate?.body as BlockStatement | null)?.statements.find(
    (s) => {
      if (s.kind !== NodeKind.If) return false;
      const condition = (s as IfStatement).condition;
      if (
        condition.kind !== NodeKind.UnaryPrefix ||
        (condition as UnaryPrefixExpression).operand.kind !==
          NodeKind.Identifier ||
        ((condition as UnaryPrefixExpression).operand as IdentifierExpression)
          .text !== "block"
      )
        return false;
      const body = (s as IfStatement).ifTrue as BlockStatement;
      const first = body.statements?.[0];
      const expression =
        first?.kind === NodeKind.Expression
          ? (first as ExpressionStatement).expression
          : null;
      return (
        expression?.kind === NodeKind.Call &&
        (expression as CallExpression).expression.kind ===
          NodeKind.Identifier &&
        ((expression as CallExpression).expression as IdentifierExpression)
          .text === "growMemory"
      );
    },
  ) as IfStatement | undefined;
  if (!growth) return;
  const nativeAlloc = tlsf.statements.find(
    (s) =>
      s.kind === NodeKind.FunctionDeclaration &&
      (s as FunctionDeclaration).name.text === "__alloc",
  ) as FunctionDeclaration | undefined;
  if (
    !nativeAlloc ||
    !["prepareSize", "searchBlock", "removeBlock", "prepareBlock"].every(
      (name) =>
        tlsf.statements.some(
          (s) =>
            s.kind === NodeKind.FunctionDeclaration &&
            (s as FunctionDeclaration).name.text === name,
        ),
    )
  )
    return;
  const batchName = unused(tlsf, "__json_as_try_allocate_batch");
  const batchLocal = unused(target, "__json_as_try_batch");
  const smallLocal = unused(runtime, "__json_as_small_block");
  const lookup = SimpleParser.parseTopLevelStatement(`
    export function ${batchName}(size: usize): usize {
      if (!ROOT) return 0;
      // Require a free-capacity class at least eight times the batch size.
      // This keeps speculative reservations out of tightly constrained heaps.
      const pressureLevel = (<usize>32 - clz<usize>(size * 8 - 1)) - (SB_BITS - 1);
      if (!(ROOT.flMap & (~<usize>0 << pressureLevel))) return 0;
      const payload = prepareSize(size);
      const block = searchBlock(ROOT, payload);
      if (!block) return 0;
      removeBlock(ROOT, block);
      prepareBlock(ROOT, block, payload);
      return changetype<usize>(block) + BLOCK_OVERHEAD;
    }
  `) as FunctionDeclaration;
  // Bind new syntax to the allocator module's lexical scope. Private TLSF
  // bindings never escape as text into a consumer or the JSON namespace.
  class Bind extends Visitor {
    _visit(node: Node, parent: Node | null): void {
      node.range = nativeAlloc!.range;
      super._visit(node, parent);
    }
  }
  new Bind().visit(lookup);
  tlsf.statements.push(lookup);
  const inject = (
    source: Source,
    foreign: string,
    local: string,
    from: Source,
  ): void => {
    const statement = Node.createImportStatement(
      [
        Node.createImportDeclaration(
          Node.createIdentifierExpression(foreign, source.range),
          Node.createIdentifierExpression(local, source.range),
          source.range,
        ),
      ],
      Node.createStringLiteralExpression(
        from.internalPath.startsWith("~lib/")
          ? from.internalPath.slice(5)
          : from.internalPath,
        source.range,
      ),
      source.range,
    );
    statement.internalPath = from.internalPath;
    source.statements.unshift(statement);
  };
  inject(target, batchName, batchLocal, tlsf);
  inject(runtime, "allocateSmallBlock", smallLocal, target);
  const releaseLocal = unused(tlsf, "__json_as_release_small_batches");
  inject(tlsf, "releaseSmallBatches", releaseLocal, target);
  const retry = SimpleParser.parseStatement(
    `if (${releaseLocal}()) block = searchBlock(root, payloadSize);`,
  );
  const remaining = SimpleParser.parseStatement(
    `if (!block) {}`,
  ) as IfStatement;
  new Bind().visit(retry);
  new Bind().visit(remaining);
  remaining.ifTrue = growth.ifTrue;
  growth.ifTrue = Node.createBlockStatement(
    [retry, remaining],
    growth.ifTrue.range,
  );

  const result = Node.createCallExpression(
    Node.createIdentifierExpression(batchLocal, batch.range),
    null,
    [
      Node.createIdentifierExpression(
        batch.signature.parameters[0].name.text,
        batch.range,
      ),
    ],
    batch.range,
  );
  batch.body = Node.createBlockStatement(
    [Node.createReturnStatement(result, batch.range)],
    batch.range,
  );
  class Backing extends Visitor {
    visitCallExpression(
      node: CallExpression,
      parent: Node | null = null,
    ): void {
      if (
        node.expression.kind === NodeKind.Identifier &&
        (node.expression as IdentifierExpression).text === "__alloc"
      )
        node.expression = Node.createIdentifierExpression(
          smallLocal,
          node.expression.range,
        );
      super.visitCallExpression(node, parent);
    }
  }
  new Backing().visit(copy.body!);
}
