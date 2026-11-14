// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { createHash } from "node:crypto";
import {
  BlockStatement,
  ClassDeclaration,
  FunctionDeclaration,
  IfStatement,
  MethodDeclaration,
  Node,
  Source,
  ThisExpression,
} from "assemblyscript/dist/assemblyscript.js";
import { NodeKind } from "./types.js";
import { cloneNode, replaceRef, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";

const STOCK = new Map([
  [
    "~lib/rt/itcms",
    "7ef783af8bc200fa9cd4acda183b8642166f0549ff82da1078ed612b7f1f6dea",
  ],
  [
    "~lib/rt/common",
    "8864fd8a1dcf43b0aa8f01030cf37f21760a52ee69e24cfb3f7b641c4386e36b",
  ],
  [
    "~lib/rt/tlsf",
    "4199f0fc9bd1faf5ca7df44a05931d7d1cbeff86255c0e845788024349c2f47b",
  ],
]);
const BINDINGS = new Set([
  "Object",
  "OBJECT",
  "BLOCK",
  "TOTAL_OVERHEAD",
  "__visit",
  "__typeinfo",
  "__heap_base",
  "__stack_pointer",
  "__finalize",
  "makeGray",
  "unlink",
  "linkTo",
  "isPointerfree",
  "iter",
  "toSpace",
  "white",
  "gray",
  "visitCount",
  "RTRACE",
  "PROFILE",
  "assert",
  "isDefined",
  "i32",
]);

/** Expand the stock marking call without changing GC pacing or transitions. */
export function inlineGcMarking(
  sources: Source[],
  aliases: Map<string, string> | null,
): boolean {
  if (diagnosticsRuntimeRoot(sources) === undefined) return false;
  if (
    aliases &&
    [...aliases.keys()].some((name) =>
      BINDINGS.has(name.split(/[.#/]/).at(-1)!),
    )
  )
    return false;
  for (const [path, expected] of STOCK) {
    const source = sources.find((s) => s.internalPath === path);
    if (
      !source ||
      createHash("sha256").update(source.text).digest("hex") !== expected
    )
      return false;
  }
  const runtime = sources.find((s) => s.internalPath === "~lib/rt/itcms")!;
  const object = runtime.statements.find(
    (n) =>
      n.kind === NodeKind.ClassDeclaration &&
      (n as ClassDeclaration).name.text === "Object",
  ) as ClassDeclaration;
  const visit = runtime.statements.find(
    (n) =>
      n.kind === NodeKind.FunctionDeclaration &&
      (n as FunctionDeclaration).name.text === "__visit",
  ) as FunctionDeclaration;
  const gray = object?.members.find(
    (n) => n.kind === NodeKind.MethodDeclaration && n.name.text === "makeGray",
  ) as MethodDeclaration;
  if (
    !visit?.body ||
    !gray?.body ||
    gray.signature.parameters.length !== 0 ||
    visit.signature.parameters.length !== 2 ||
    visit.signature.parameters.map((p) => p.name.text).join(",") !==
      "ptr,cookie" ||
    visit.signature.parameters.map((p) => toString(p.type)).join(",") !==
      "usize,i32"
  )
    return false;
  const expectedVisit =
    SimpleParser.parseTopLevelStatement(`function expected(ptr: usize, cookie: i32): void {
    if (!ptr) return;
    let obj = changetype<Object>(ptr - TOTAL_OVERHEAD);
    if (RTRACE) if (!onvisit(obj)) return;
    if (obj.color == white) { obj.makeGray(); ++visitCount; }
  }`) as FunctionDeclaration;
  const expectedGray =
    SimpleParser.parseTopLevelStatement(`function expected(): void {
    if (this == iter) iter = assert(this.prev);
    this.unlink();
    this.linkTo(toSpace, this.isPointerfree ? i32(!white) : gray);
  }`) as FunctionDeclaration;
  const normalized = (n: Node) => toString(n).replace(/\s/g, "");
  if (
    normalized(visit.body) !== normalized(expectedVisit.body!) ||
    normalized(gray.body) !== normalized(expectedGray.body!)
  )
    return false;

  const expanded = cloneNode(gray.body) as BlockStatement;
  let replacements = 0;
  class BindReceiver extends Visitor {
    visitThisExpression(node: ThisExpression, parent: Node | null): void {
      replaceRef(
        node,
        Node.createIdentifierExpression("obj", node.range),
        parent,
      );
      replacements++;
    }
  }
  new BindReceiver().visit(expanded);
  if (replacements !== 5) return false;
  const white = (visit.body as BlockStatement).statements[3] as IfStatement;
  const body = white.ifTrue as BlockStatement;
  const original = body.statements[0];
  const guarded = SimpleParser.parseStatement(
    "if (RTRACE || PROFILE || isDefined(__finalize)) {} else {}",
  ) as IfStatement;
  class BindRange extends Visitor {
    _visit(node: Node, parent: Node | null): void {
      node.range = original.range;
      super._visit(node, parent);
    }
  }
  new BindRange().visit(guarded);
  (guarded.ifTrue as BlockStatement).statements = [original];
  guarded.ifFalse = expanded;
  body.statements[0] = guarded;
  return true;
}
