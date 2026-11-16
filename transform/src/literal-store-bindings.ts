// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import {
  ClassDeclaration,
  Parser,
} from "assemblyscript/dist/assemblyscript.js";
import { arrayRowSourceInfo } from "./array-row-safety.js";
import { SourceSet } from "./types.js";
import { isStdlib } from "./util.js";

/** Literal widths describe bytes, independently of a model's local aliases. */
export class LiteralStoreBindings {
  private native = new WeakMap<ClassDeclaration, Map<string, boolean>>();
  private helpers = new Map<string, string>();
  private names: Set<string> | null = null;
  private nextIndex = 0;

  store(
    parser: Parser,
    sources: SourceSet,
    model: ClassDeclaration,
    type: string,
    target: string,
    value: string,
    offset: number,
  ): string | null {
    let native = this.native.get(model);
    if (!native) this.native.set(model, (native = new Map()));
    if (!native.has(type)) {
      const source = sources.get(model.range.source);
      const parameters = source.classTypeParameters(model);
      const scope = source
        .getQualifiedName(model)
        .split(".")
        .slice(0, -1)
        .join(".");
      const meaning = source.resolveTypeMeaning(
        type,
        scope,
        parser,
        parameters,
      );
      native.set(
        type,
        !parameters.has(type) &&
          meaning.name === type &&
          !meaning.nullable &&
          !meaning.arguments.length &&
          (!meaning.declaration || isStdlib(meaning.declaration)),
      );
    }
    if (native.get(type)) return null;
    let helper = this.helpers.get(type);
    if (!helper) {
      if (!this.names) {
        this.names = new Set();
        for (const source of parser.sources)
          for (const name of arrayRowSourceInfo(source).names)
            this.names.add(name);
      }
      let file: string;
      do {
        helper = "__json_literal_store_" + this.nextIndex++;
        file = helper + ".ts";
      } while (
        this.names.has(helper) ||
        parser.sources.some(
          (source) =>
            source.normalizedPath === file || source.internalPath === helper,
        )
      );
      this.names.add(helper);
      // A separate source gives both the parameter and intrinsic their native
      // binding. No managed storage or startup initializer is introduced.
      parser.parseFile(
        `@global @inline function ${helper}(dst:usize,value:${type},offset:usize):void {
          store<${type}>(dst+offset,value);
        }`,
        file,
        false,
      );
      this.helpers.set(type, helper);
    }
    return `${helper}(${target}, ${value}, ${offset});`;
  }
}
