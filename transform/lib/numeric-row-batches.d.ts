// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { FunctionDeclaration, Parser } from "assemblyscript/dist/assemblyscript.js";
import { Src } from "./types.js";
export declare class NumericRowBatches {
    private names;
    private nextIndex;
    constructor(names: Set<string>);
    rewrite(worker: FunctionDeclaration, source: Src, parser: Parser, comma: (target: string) => string): FunctionDeclaration[];
}
