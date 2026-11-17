// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { arrayRowSourceInfo } from "./array-row-safety.js";
import { isStdlib } from "./util.js";
export class LiteralStoreBindings {
    native = new WeakMap();
    helpers = new Map();
    names = null;
    nextIndex = 0;
    vectors = new Map();
    nextVectorIndex = 0;
    storeVector(parser, data, target, offset) {
        let helper = this.vectors.get(data);
        if (!helper) {
            this.reserveNames(parser);
            let file;
            do {
                helper = "__json_large_literal_" + this.nextVectorIndex++;
                file = helper + ".ts";
            } while (this.names.has(helper) ||
                parser.sources.some((source) => source.normalizedPath === file || source.internalPath === helper));
            this.names.add(helper);
            const units = Array.from({ length: 8 }, (_, i) => data.charCodeAt(i));
            parser.parseFile(`@lazy const DATA:usize=memory.data<u16>([${units.join(",")}],16);
        @global @inline function ${helper}(dst:usize,offset:usize):void {
          store<v128>(dst+offset,load<v128>(DATA));
        }`, file, false);
            this.vectors.set(data, helper);
        }
        return `${helper}(${target}, ${offset});`;
    }
    reserveNames(parser) {
        if (this.names)
            return;
        this.names = new Set();
        for (const source of parser.sources)
            for (const name of arrayRowSourceInfo(source).names)
                this.names.add(name);
    }
    store(parser, sources, model, type, target, value, offset) {
        let native = this.native.get(model);
        if (!native)
            this.native.set(model, (native = new Map()));
        if (!native.has(type)) {
            const source = sources.get(model.range.source);
            const parameters = source.classTypeParameters(model);
            const scope = source
                .getQualifiedName(model)
                .split(".")
                .slice(0, -1)
                .join(".");
            const meaning = source.resolveTypeMeaning(type, scope, parser, parameters);
            native.set(type, !parameters.has(type) &&
                meaning.name === type &&
                !meaning.nullable &&
                !meaning.arguments.length &&
                (!meaning.declaration || isStdlib(meaning.declaration)));
        }
        if (native.get(type))
            return null;
        const vector = type === "v128";
        const key = vector ? type + ":" + value : type;
        let helper = this.helpers.get(key);
        if (!helper) {
            this.reserveNames(parser);
            let file;
            do {
                helper = "__json_literal_store_" + this.nextIndex++;
                file = helper + ".ts";
            } while (this.names.has(helper) ||
                parser.sources.some((source) => source.normalizedPath === file || source.internalPath === helper));
            this.names.add(helper);
            parser.parseFile(vector
                ? `@global @inline function ${helper}(dst:usize,offset:usize):void {
              store<v128>(dst+offset,${value});
            }`
                : `@global @inline function ${helper}(dst:usize,value:${type},offset:usize):void {
              store<${type}>(dst+offset,value);
            }`, file, false);
            this.helpers.set(key, helper);
        }
        return vector
            ? `${helper}(${target}, ${offset});`
            : `${helper}(${target}, ${value}, ${offset});`;
    }
}
