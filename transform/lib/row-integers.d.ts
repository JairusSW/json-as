// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { ClassDeclaration, FunctionDeclaration, Parser } from "assemblyscript/dist/assemblyscript.js";
import { Src } from "./types.js";
export declare class RowIntegerWriters {
    private parser;
    private names;
    private entry;
    constructor(parser: Parser, names: Set<string>);
    rewrite(worker: FunctionDeclaration, source: Src, owner: ClassDeclaration): void;
    private create;
}
