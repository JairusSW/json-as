// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { Options, Source } from "assemblyscript/dist/assemblyscript.js";
export declare function arrayRowAstFingerprint(node: unknown, root?: string): string;
export declare function arrayRowSourceInfo(source: Source): {
    names: Set<string>;
    hooks: Set<string>;
};
export declare function arrayRowSafety(sources: Source[], options: Options): Set<string> | null;
