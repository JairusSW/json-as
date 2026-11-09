// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import {
  BlockStatement,
  CallExpression,
  FunctionDeclaration,
  IdentifierExpression,
  ImportStatement,
  Node,
  ReturnStatement,
  Source,
} from "assemblyscript/dist/assemblyscript.js";
import { NodeKind } from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";

/** Fuse string initialization with the installed incremental allocator's fill.
 * Unknown allocator bodies retain the ordinary allocate-then-copy path. */
export function specializeCopiedStringAllocator(sources: Source[]): void {
  const root = diagnosticsRuntimeRoot(sources);
  if (root === undefined) return;
  const target = sources.find(
    (s) => s.internalPath === root + "assembly/util/runtime",
  );
  const runtime = sources.find((s) => s.internalPath === "~lib/rt/itcms");
  if (!target || !runtime) return;
  const fn = (source: Source, name: string) =>
    source.statements.find(
      (s) =>
        s.kind === NodeKind.FunctionDeclaration &&
        (s as FunctionDeclaration).name.text === name,
    ) as FunctionDeclaration | undefined;
  const original = fn(runtime, "__new");
  const allocate = fn(target, "allocateObject");
  const helper = fn(target, "allocateCopiedString");
  const capability = fn(target, "canAllocateCopiedString");
  if (!original?.body || !allocate?.body || !helper?.body || !capability?.body)
    return;
  const expected =
    SimpleParser.parseTopLevelStatement(`function expected(size: usize, id: i32): usize {
    if (size >= OBJECT_MAXSIZE) throw new Error(E_ALLOCATION_TOO_LARGE);
    if (total >= threshold) interrupt();
    let obj = changetype<Object>(__alloc(OBJECT_OVERHEAD + size) - BLOCK_OVERHEAD);
    obj.rtId = id; obj.rtSize = <u32>size; obj.linkTo(fromSpace, white); total += obj.size;
    let ptr = changetype<usize>(obj) + TOTAL_OVERHEAD;
    memory.fill(ptr, 0, size); return ptr;
  }`) as FunctionDeclaration;
  const normalized = (node: Node) => toString(node).replace(/\s/g, "");
  if (normalized(original.body) !== normalized(expected.body!)) return;
  const statement = (allocate.body as BlockStatement).statements[0];
  if (statement?.kind !== NodeKind.Return) return;
  const call = (statement as ReturnStatement).value;
  if (call?.kind !== NodeKind.Call) return;
  const expression = (call as CallExpression).expression;
  if (expression.kind !== NodeKind.Identifier) return;
  const localAllocator = (expression as IdentifierExpression).text;
  const importedAllocator = target.statements
    .filter(
      (s) =>
        s.kind === NodeKind.Import &&
        (s as ImportStatement).internalPath === runtime.internalPath,
    )
    .flatMap((s) => (s as ImportStatement).declarations ?? [])
    .find((d) => d.name.text === localAllocator);
  if (!importedAllocator) return;
  const scoped = fn(runtime, importedAllocator.foreignName.text);
  if (!scoped?.body || scoped === original) return;
  // This factory is installed once, even if the transform is revisited.
  if (normalized(capability.body) !== "{returnfalse;}") return;
  const unused = (source: Source, prefix: string): string => {
    let name = prefix;
    const text =
      source.text + source.statements.map((s) => toString(s)).join("\n");
    for (let i = 0; text.includes(name); i++) name = prefix + i;
    return name;
  };
  const name = unused(runtime, "__json_as_allocate_copied_string");
  const local = unused(target, "__json_as_copy_string");
  const copy = cloneNode(scoped) as FunctionDeclaration;
  copy.name.text = name;
  class Bind extends Visitor {
    _visit(node: Node, parent: Node | null): void {
      node.range = copy.range;
      super._visit(node, parent);
    }
  }
  const parameter = (
    SimpleParser.parseTopLevelStatement(
      "function parameter(__jsonAsStringSource: usize): void {}",
    ) as FunctionDeclaration
  ).signature.parameters[0];
  new Bind().visit(parameter);
  copy.signature.parameters.push(parameter);
  let fills = 0;
  class Fill extends Visitor {
    visitCallExpression(
      node: CallExpression,
      parent: Node | null = null,
    ): void {
      if (
        normalized(node.expression) === "memory.fill" &&
        node.args.length === 3 &&
        normalized(node.args[0]) === "ptr" &&
        normalized(node.args[1]) === "0" &&
        normalized(node.args[2]) === "size"
      ) {
        node.expression = SimpleParser.parseExpression("memory.copy");
        node.args[1] = SimpleParser.parseExpression("__jsonAsStringSource");
        new Bind().visit(node.expression);
        new Bind().visit(node.args[1]);
        fills++;
      }
      super.visitCallExpression(node, parent);
    }
  }
  new Fill().visit(copy.body!);
  if (fills !== 1) return;
  // Reuse the zeroing proof, not the copied-string capability: generated
  // object clears have their own conservative fallback. Canonicalize only
  // the library-owned native backing call before comparing the entire body.
  const canonical = cloneNode(scoped) as FunctionDeclaration;
  const backingNames = new Set(
    runtime.statements
      .filter(
        (s) =>
          s.kind === NodeKind.Import &&
          (s as ImportStatement).internalPath === target.internalPath,
      )
      .flatMap((s) => (s as ImportStatement).declarations ?? [])
      .filter((d) => d.foreignName.text === "allocateSmallBlock")
      .map((d) => d.name.text),
  );
  class CanonicalBacking extends Visitor {
    visitCallExpression(node: CallExpression, parent: Node | null): void {
      if (
        node.expression.kind === NodeKind.Identifier &&
        backingNames.has((node.expression as IdentifierExpression).text)
      )
        node.expression = Node.createIdentifierExpression(
          "__alloc",
          node.expression.range,
        );
      super.visitCallExpression(node, parent);
    }
  }
  new CanonicalBacking().visit(canonical.body!);
  const clear = fn(target, "clearAllocatedObject");
  if (
    clear?.body &&
    normalized(clear.body) === "{memory.fill(ptr,0,size);}" &&
    normalized(canonical.body!) === normalized(expected.body!)
  ) {
    const replacement =
      SimpleParser.parseTopLevelStatement(`function clear(ptr: usize, size: usize): void {
      if (ASC_RUNTIME != 2 || sizeof<usize>() != 4 || isDefined(ASC_RTRACE)) memory.fill(ptr, 0, size);
    }`) as FunctionDeclaration;
    class ClearBind extends Visitor {
      _visit(node: Node, parent: Node | null): void {
        node.range = clear!.range;
        super._visit(node, parent);
      }
    }
    new ClearBind().visit(replacement.body!);
    clear.body = replacement.body;
  }
  runtime.statements.push(copy);
  const imported = Node.createImportStatement(
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
  imported.internalPath = runtime.internalPath;
  target.statements.unshift(imported);
  const replacement =
    SimpleParser.parseTopLevelStatement(`function replacement(source: usize, size: usize): usize {
    return ${local}(size, idof<string>(), source);
  }`) as FunctionDeclaration;
  class TargetBind extends Visitor {
    _visit(node: Node, parent: Node | null): void {
      node.range = helper!.range;
      super._visit(node, parent);
    }
  }
  new TargetBind().visit(replacement.body!);
  helper.body = replacement.body;
  capability.body = Node.createBlockStatement(
    [
      Node.createReturnStatement(
        Node.createTrueExpression(capability.range),
        capability.range,
      ),
    ],
    capability.range,
  );
}
