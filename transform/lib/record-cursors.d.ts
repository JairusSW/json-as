// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { ClassDeclaration, FunctionDeclaration, MethodDeclaration, Parser } from "assemblyscript/dist/assemblyscript.js";
import { Src } from "./types.js";
export declare class RecordCursorWriters {
    private parser;
    private names;
    private writers;
    private nextIndex;
    constructor(parser: Parser, names: Set<string>);
    rewrite(model: ClassDeclaration, source: Src, serializer: MethodDeclaration, closed: boolean): FunctionDeclaration | null;
}
