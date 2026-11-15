// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { ClassDeclaration, MethodDeclaration, Options, Parser, Source } from "assemblyscript/dist/assemblyscript.js";
import { Schema, SourceSet, Src } from "./types.js";
import { Visitor } from "./visitor.js";
export declare class ArrayRowSerializers {
    private parser;
    private names;
    private arrayUses;
    private nestedRecords;
    private recordReservationCount;
    private derived;
    private eligibleRows;
    private unknownBase;
    private rows;
    private declarations;
    constructor(sources: Source[], parser: Parser, sourceSet: SourceSet, options: Options);
    private rememberRecord;
    finishRecord(node: ClassDeclaration, schema: Schema, source: Src, serializer: MethodDeclaration): void;
    add(node: ClassDeclaration, schema: Schema, source: Src, serializer: MethodDeclaration): void;
    bind(source: Source, visitor: Visitor): void;
    finish(sources: Source[], knownGc: boolean): void;
}
