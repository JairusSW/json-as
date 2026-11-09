// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { BlockStatement, CallExpression, FunctionDeclaration, FunctionExpression, ForStatement, ForOfStatement, MethodDeclaration, Node, TryStatement } from "assemblyscript/dist/assemblyscript.js";
import { Visitor } from "../visitor.js";
export declare class CustomTransform extends Visitor {
    private runtimeReceiver;
    private scopes;
    private constructor();
    private names;
    visitBlockStatement(node: BlockStatement): void;
    visitForStatement(node: ForStatement): void;
    visitForOfStatement(node: ForOfStatement): void;
    visitTryStatement(node: TryStatement): void;
    private callable;
    visitMethodDeclaration(node: MethodDeclaration): void;
    visitFunctionDeclaration(node: FunctionDeclaration): void;
    visitFunctionExpression(node: FunctionExpression): void;
    visitCallExpression(node: CallExpression): void;
    static visit(node: MethodDeclaration, runtimeReceiver: (name: string) => boolean, scopes: Node[][]): void;
}
