// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { Source, TypeDeclaration, TypeNode, TypeParameterNode } from "assemblyscript/dist/assemblyscript.js";
export declare function effectiveTypeArguments(parameters: TypeParameterNode[] | null, supplied?: TypeNode[]): TypeNode[] | null;
export declare class TypeAlias {
    name: string;
    type: TypeAlias | string;
    constructor(name: string, type: TypeAlias | string);
    parameters: string[];
    declaration: TypeDeclaration | null;
    arguments(supplied?: TypeNode[]): TypeNode[] | null;
    getBaseType(arguments_?: TypeNode[]): string;
    static foundAliases: Map<string, string>;
    static parameters: Map<string, string[]>;
    static declarations: Map<string, TypeDeclaration>;
    static aliases: Map<string, TypeAlias>;
    static add(name: string, type: TypeNode, parameters?: TypeParameterNode[] | null, declaration?: TypeDeclaration | null): void;
    static getAliases(source: Source): TypeAlias[];
}
