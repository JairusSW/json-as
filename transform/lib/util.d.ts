// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { Source, Expression, Statement, NamespaceDeclaration, ClassDeclaration, DeclarationStatement, Range, Node } from "assemblyscript/dist/assemblyscript.js";
export declare class SimpleParser {
    private static get parser();
    private static getTokenizer;
    static parseExpression(s: string): Expression;
    static parseStatement(s: string, topLevel?: boolean): Statement;
    static parseTopLevelStatement(s: string, namespace?: NamespaceDeclaration | null): Statement;
    static parseClassMember(s: string, _class: ClassDeclaration): DeclarationStatement;
}
export declare function isStdlib(s: Source | {
    range: Range;
}): boolean;
export declare function toString(node: Node): string;
export declare function replaceRef(node: Node, replacement: Node | Node[], ref: Node | Node[] | null): void;
export declare function cloneNode(input: Node | Node[] | null, seen?: WeakMap<object, any>, path?: string): Node | Node[] | null;
export declare function stripExpr(node: Node): Node;
export declare function removeExtension(filePath: string): string;
