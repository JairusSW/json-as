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
  FunctionExpression,
  ForStatement,
  ForOfStatement,
  IdentifierExpression,
  MethodDeclaration,
  Node,
  PropertyAccessExpression,
  VariableStatement,
  TryStatement,
  ExportDefaultStatement,
} from "assemblyscript/dist/assemblyscript.js";
import { NodeKind } from "../types.js";
import { Visitor } from "../visitor.js";

/** Rewrite runtime calls without changing application-owned receiver bindings. */
export class CustomTransform extends Visitor {
  private scopes: Set<string>[] = [];

  private constructor(private runtimeReceiver: (name: string) => boolean) {
    super();
  }

  private names(nodes: Node[]): Set<string> {
    const names = new Set<string>();
    for (let node of nodes) {
      if (node.kind === NodeKind.ExportDefault)
        node = (node as ExportDefaultStatement).declaration;
      if (node.kind === NodeKind.Variable) {
        for (const declaration of (node as VariableStatement).declarations)
          names.add(declaration.name.text);
      } else {
        const name = (node as unknown as { name?: IdentifierExpression }).name;
        if (name) names.add(name.text);
      }
    }
    return names;
  }

  visitBlockStatement(node: BlockStatement): void {
    this.scopes.push(this.names(node.statements));
    super.visitBlockStatement(node);
    this.scopes.pop();
  }

  visitForStatement(node: ForStatement): void {
    this.scopes.push(this.names(node.initializer ? [node.initializer] : []));
    super.visitForStatement(node);
    this.scopes.pop();
  }

  visitForOfStatement(node: ForOfStatement): void {
    this.scopes.push(this.names([node.variable]));
    super.visitForOfStatement(node);
    this.scopes.pop();
  }

  visitTryStatement(node: TryStatement): void {
    for (const [statements, variable] of [
      [node.bodyStatements, null],
      [node.catchStatements, node.catchVariable],
      [node.finallyStatements, null],
    ] as [Node[] | null, IdentifierExpression | null][]) {
      if (!statements) continue;
      const scope = this.names(statements);
      if (variable) scope.add(variable.text);
      this.scopes.push(scope);
      this.visit(statements, node);
      this.scopes.pop();
    }
  }

  private callable(node: MethodDeclaration | FunctionDeclaration): void {
    this.scopes.push(
      new Set(node.signature.parameters.map((p) => p.name.text)),
    );
    this.visit(node.body, node);
    this.scopes.pop();
  }

  visitMethodDeclaration(node: MethodDeclaration): void {
    this.callable(node);
  }
  visitFunctionDeclaration(node: FunctionDeclaration): void {
    this.callable(node);
  }
  visitFunctionExpression(node: FunctionExpression): void {
    this.visit(node.declaration, node);
  }

  visitCallExpression(node: CallExpression): void {
    super.visitCallExpression(node);
    if (node.expression.kind !== NodeKind.PropertyAccess) return;
    const expression = node.expression as PropertyAccessExpression;
    if (!["stringify", "parse"].includes(expression.property.text)) return;
    const receiver = expression.expression;
    if (receiver.kind !== NodeKind.Identifier) return;
    const name = (receiver as IdentifierExpression).text;
    if (
      this.scopes.some((scope) => scope.has(name)) ||
      !this.runtimeReceiver(name)
    )
      return;
    expression.expression = Node.createPropertyAccessExpression(
      receiver,
      Node.createIdentifierExpression("internal", node.expression.range),
      node.expression.range,
    );
  }

  static visit(
    node: MethodDeclaration,
    runtimeReceiver: (name: string) => boolean,
    scopes: Node[][],
  ): void {
    const visitor = new CustomTransform(runtimeReceiver);
    visitor.scopes = scopes.map((nodes) => visitor.names(nodes));
    visitor.visit(node);
  }
}
