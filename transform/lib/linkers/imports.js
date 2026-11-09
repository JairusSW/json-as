// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { Visitor } from "../visitor.js";
class ImportGetter extends Visitor {
    static SN = new ImportGetter();
    imports = [];
    visitImportStatement(node, _ref) {
        this.imports.push(node);
    }
    static getImports(source) {
        ImportGetter.SN.imports = [];
        ImportGetter.SN.visit(source);
        return ImportGetter.SN.imports;
    }
}
export function getImports(source) {
    return ImportGetter.getImports(source);
}
