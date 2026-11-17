// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { ClassDeclaration, Parser } from "assemblyscript/dist/assemblyscript.js";
export declare const CLOSED_MAP_SOURCE: readonly [string, string];
export declare class ClosedMapProof {
    private names;
    private source;
    constructor(parser: Parser, names: Set<string>);
    lower(models: Set<ClassDeclaration>): void;
}
