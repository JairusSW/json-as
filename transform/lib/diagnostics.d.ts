// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { MethodDeclaration, Source } from "assemblyscript/dist/assemblyscript.js";
export declare function parseDiagnosticsFlag(value: string | undefined): boolean;
export declare function collectOriginalMethods(sources: Source[]): WeakSet<MethodDeclaration>;
export declare function diagnosticsRuntimeRoot(sources: Source[]): string | undefined;
export declare function lowerDiagnostics(source: Source, originalMethods: WeakSet<MethodDeclaration>, runtimeRoot: string | undefined): void;
