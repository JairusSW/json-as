// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { createHash } from "node:crypto";
import {
  ClassDeclaration,
  FunctionDeclaration,
  Node,
  Parser,
  Source,
} from "assemblyscript/dist/assemblyscript.js";
import { arrayRowAstFingerprint } from "./array-row-safety.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
import { SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";

/** Reuse the closed-record proof to remove an entire Map callback prepass. */
export class ClosedMapProof {
  private source: Source | null = null;

  constructor(
    parser: Parser,
    private names: Set<string>,
  ) {
    const root = diagnosticsRuntimeRoot(parser.sources);
    if (root === undefined) return;
    const source = parser.sources.find(
      (item) => item.internalPath === root + "assembly/serialize/naive/map",
    );
    if (
      source &&
      createHash("sha256").update(source.text).digest("hex") ===
        "53f59e4ed68f0c4dc702aa86748acb663a13d2e13e67abca2599714cbcdbb8e4" &&
      arrayRowAstFingerprint(source.statements, root) ===
        "abbc0c90fd336b6b5bd8f522a0ee31c30180e5882e8067720d6fc71fc7b18fbd"
    )
      this.source = source;
  }

  lower(models: Set<ClassDeclaration>): void {
    if (!this.source || !models.size) return;
    const source = this.source;
    const fn = source.statements.find(
      (node) =>
        (node as FunctionDeclaration).name?.text ===
        "canSerializeMapWithoutCallbacks",
    ) as FunctionDeclaration | undefined;
    if (!fn?.body) return;
    const body = toString(fn.body);
    const needle = "if (!canSnapshotCallbackKeys()) return false;";
    if (body.split(needle).length !== 2) return;
    class Bind extends Visitor {
      constructor(private source: Source) {
        super();
      }
      _visit(node: Node, parent: Node | null): void {
        node.range = this.source.range;
        super._visit(node, parent);
      }
    }
    const guard: string[] = [];
    let index = 0;
    for (const model of models) {
      let name: string;
      do name = "__json_map_pure_" + index++;
      while (this.names.has(name));
      this.names.add(name);
      const helper = SimpleParser.parseTopLevelStatement(
        `@global @inline function ${name}():u32{return idof<${model.name.text}>();}`,
      );
      new Bind(model.range.source).visit(helper);
      model.range.source.statements.push(helper);
      guard.push(`idof<nonnull<valueof<T>>>() == ${name}()`);
    }
    fn.body = SimpleParser.parseStatement(
      body.replace(
        needle,
        needle +
          `if(isString<indexof<T>>() && isManaged<valueof<T>>()){if(${guard.join(" || ")}) return true;}`,
      ),
    ) as typeof fn.body;
    new Bind(source).visit(fn.body);
  }
}
