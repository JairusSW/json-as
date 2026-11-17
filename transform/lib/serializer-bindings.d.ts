// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { ClassDeclaration, Parser } from "assemblyscript/dist/assemblyscript.js";
import { SourceSet } from "./types.js";
export declare class SerializerBindings {
    private parser;
    private sources;
    private aliases;
    private declarations;
    private globals;
    private certified;
    constructor(parser: Parser, sources: SourceSet, aliases: Map<string, string> | null);
    hasNativeBindings(model: ClassDeclaration): boolean;
}
