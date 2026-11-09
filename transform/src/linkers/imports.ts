// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import {
  ImportStatement,
  Node,
  Source,
} from "assemblyscript/dist/assemblyscript.js";
import { Visitor } from "../visitor.js";

class ImportGetter extends Visitor {
  static SN: ImportGetter = new ImportGetter();

  private imports: ImportStatement[] = [];

  visitImportStatement(node: ImportStatement, _ref?: Node | null): void {
    this.imports.push(node);
  }

  static getImports(source: Source): ImportStatement[] {
    ImportGetter.SN.imports = [];
    ImportGetter.SN.visit(source);
    return ImportGetter.SN.imports;
  }
}

export function getImports(source: Source): ImportStatement[] {
  return ImportGetter.getImports(source);
}
