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
    private nativeBindings;
    private names;
    private integerWriters;
    private textWriters;
    private arrayUses;
    private textArrayUses;
    private nestedRecords;
    private recordReservationCount;
    private derived;
    private eligibleRows;
    private unknownBase;
    private rows;
    private declarations;
    private closedRecords;
    private nativeScalarBox;
    private manualSerializers;
    private borrowedRecordEntry;
    private borrowedRecordCount;
    private closedMapProof;
    private recordCursors;
    private numericBatches;
    constructor(sources: Source[], parser: Parser, sourceSet: SourceSet, options: Options, nativeBindings: (model: ClassDeclaration) => boolean);
    private rememberRecord;
    finishMapProof(knownGc: boolean): void;
    finishRecord(node: ClassDeclaration, schema: Schema, source: Src, serializer: MethodDeclaration): void;
    borrowRecord(node: ClassDeclaration, schema: Schema, source: Src, serializer: MethodDeclaration): void;
    private borrowedEntry;
    private rewriteTextRecord;
    add(node: ClassDeclaration, schema: Schema, source: Src, serializer: MethodDeclaration, comma: (target: string) => string): void;
    bind(source: Source, visitor: Visitor): void;
    finish(sources: Source[], knownGc: boolean): void;
}
