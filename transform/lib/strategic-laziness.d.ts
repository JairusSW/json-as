// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { BinaryExpression, BlockStatement, CallExpression, ClassDeclaration, FunctionDeclaration, IfStatement, MethodDeclaration, Node, PropertyAccessExpression, Source, TernaryExpression, VariableDeclaration, NamespaceDeclaration, WhileStatement, ForStatement, DoStatement, ForOfStatement, SwitchStatement, TryStatement } from "assemblyscript/dist/assemblyscript.js";
import { Visitor } from "./visitor.js";
export type AccessPath = ReadonlyMap<number, boolean>;
export declare function accessProbability(paths: AccessPath[]): number;
export interface AccessDecision {
    probability: number;
    expectedReads: number;
    decodeCost: number;
    eagerCost: number;
    lazyCost: number;
    eager: boolean;
}
export declare function materializationDecision(paths: AccessPath[], decodeCost: number, origin?: AccessPath[]): AccessDecision;
export interface StrategicSite {
    call: CallExpression;
    source: Source;
    declaration: ClassDeclaration;
    origin: AccessPath[];
    accesses: Map<string, AccessPath[]>;
}
export declare class StrategicAccessAnalysis extends Visitor {
    private resolveParse;
    readonly sites: StrategicSite[];
    private scopes;
    private paths;
    private exits;
    private branch;
    private terminated;
    private namespace;
    private thisSite;
    private callableNamespaces;
    private declarations;
    private captures;
    private expanding;
    private byCall;
    constructor(resolveParse: (call: CallExpression, shadowed: (name: string) => boolean, scope: string) => ClassDeclaration | null);
    private binding;
    private shadowed;
    private names;
    visitSource(node: Source): void;
    private origin;
    private read;
    visitPropertyAccessExpression(node: PropertyAccessExpression): void;
    visitVariableDeclaration(node: VariableDeclaration): void;
    visitBlockStatement(node: BlockStatement): void;
    private registerFunctions;
    visitCallExpression(node: CallExpression): void;
    private callable;
    visitNamespaceDeclaration(node: NamespaceDeclaration): void;
    visitFunctionDeclaration(node: FunctionDeclaration): void;
    visitMethodDeclaration(node: MethodDeclaration): void;
    visitReturnStatement(node: Node): void;
    visitThrowStatement(node: Node): void;
    visitBreakStatement(): void;
    visitContinueStatement(): void;
    private fork;
    private merge;
    private conditionValue;
    visitIfStatement(node: IfStatement): void;
    visitTernaryExpression(node: TernaryExpression): void;
    visitBinaryExpression(node: BinaryExpression): void;
    private loop;
    visitWhileStatement(node: WhileStatement): void;
    visitForStatement(node: ForStatement): void;
    visitDoStatement(node: DoStatement): void;
    visitForOfStatement(node: ForOfStatement): void;
    visitSwitchStatement(node: SwitchStatement): void;
    visitTryStatement(node: TryStatement): void;
}
