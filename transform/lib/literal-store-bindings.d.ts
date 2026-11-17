// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { ClassDeclaration, Parser } from "assemblyscript/dist/assemblyscript.js";
import { SourceSet } from "./types.js";
export declare class LiteralStoreBindings {
    private native;
    private helpers;
    private names;
    private nextIndex;
    private vectors;
    private nextVectorIndex;
    storeVector(parser: Parser, data: string, target: string, offset: number): string;
    private reserveNames;
    store(parser: Parser, sources: SourceSet, model: ClassDeclaration, type: string, target: string, value: string, offset: number): string | null;
}
