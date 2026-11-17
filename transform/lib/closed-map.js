// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { createHash } from "node:crypto";
import { arrayRowAstFingerprint } from "./array-row-safety.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
import { SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
export const CLOSED_MAP_SOURCE = [
    "1944047a984ccf0c3929fd4a4eced823fa02d454d60a3b0e4390d25272aa50c5",
    "abbc0c90fd336b6b5bd8f522a0ee31c30180e5882e8067720d6fc71fc7b18fbd",
];
export class ClosedMapProof {
    names;
    source = null;
    constructor(parser, names) {
        this.names = names;
        const root = diagnosticsRuntimeRoot(parser.sources);
        if (root === undefined)
            return;
        const source = parser.sources.find((item) => item.internalPath === root + "assembly/serialize/naive/map");
        if (source &&
            createHash("sha256").update(source.text).digest("hex") ===
                CLOSED_MAP_SOURCE[0] &&
            arrayRowAstFingerprint(source.statements, root) === CLOSED_MAP_SOURCE[1])
            this.source = source;
    }
    lower(models) {
        if (!this.source || !models.size)
            return;
        const source = this.source;
        const fn = source.statements.find((node) => node.name?.text ===
            "canSerializeMapWithoutCallbacks");
        if (!fn?.body)
            return;
        const body = toString(fn.body);
        const needle = "if (!canSnapshotCallbackKeys()) return false;";
        if (body.split(needle).length !== 2)
            return;
        class Bind extends Visitor {
            source;
            constructor(source) {
                super();
                this.source = source;
            }
            _visit(node, parent) {
                node.range = this.source.range;
                super._visit(node, parent);
            }
        }
        const guard = [];
        let index = 0;
        for (const model of models) {
            let name;
            do
                name = "__json_map_pure_" + index++;
            while (this.names.has(name));
            this.names.add(name);
            const helper = SimpleParser.parseTopLevelStatement(`@global @inline function ${name}():u32{return idof<${model.name.text}>();}`);
            new Bind(model.range.source).visit(helper);
            model.range.source.statements.push(helper);
            guard.push(`idof<nonnull<valueof<T>>>() == ${name}()`);
        }
        fn.body = SimpleParser.parseStatement(body.replace(needle, needle +
            `if(isString<indexof<T>>() && isManaged<valueof<T>>()){if(${guard.join(" || ")}) return true;}`));
        new Bind(source).visit(fn.body);
    }
}
