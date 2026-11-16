// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { MethodDeclaration, Parser } from "assemblyscript/dist/assemblyscript.js";
export declare class TextRecordWriters {
    private names;
    private stringSource;
    private indexSource;
    private entry;
    constructor(parser: Parser, names: Set<string>, simd: boolean);
    get verified(): boolean;
    rewrite(serializer: MethodDeclaration, fields: number): void;
    private create;
}
