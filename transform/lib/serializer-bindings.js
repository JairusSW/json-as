// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { isStdlib } from "./util.js";
const OPERATIONS = new Set([
    "load",
    "store",
    "changetype",
    "offsetof",
    "idof",
    "sizeof",
    "isDefined",
    "isNullable",
    "isManaged",
    "reinterpret",
    "memory",
    "i16x8",
]);
export class SerializerBindings {
    parser;
    sources;
    aliases;
    declarations = new WeakMap();
    globals = new Set();
    certified = new WeakMap();
    constructor(parser, sources, aliases) {
        this.parser = parser;
        this.sources = sources;
        this.aliases = aliases;
        for (const source of parser.sources) {
            const names = new Set();
            const walk = (value) => {
                if (Array.isArray(value)) {
                    for (const child of value)
                        walk(child);
                    return;
                }
                if (!value || typeof value !== "object")
                    return;
                const node = value;
                if (typeof node.kind !== "number")
                    return;
                if (node.name?.text) {
                    names.add(node.name.text);
                    if (!isStdlib(node) &&
                        node.decorators?.some((d) => d.name?.text === "global"))
                        this.globals.add(node.name.text);
                }
                if (node.namespaceName?.text)
                    names.add(node.namespaceName.text);
                for (const [key, child] of Object.entries(node))
                    if (key !== "range" && key !== "parent")
                        walk(child);
            };
            walk(source.statements);
            this.declarations.set(source, names);
        }
    }
    hasNativeBindings(model) {
        const cached = this.certified.get(model);
        if (cached !== undefined)
            return cached;
        const source = this.sources.get(model.range.source);
        const parameters = source.classTypeParameters(model);
        const scope = source
            .getQualifiedName(model)
            .split(".")
            .slice(0, -1)
            .join(".");
        const nativeTypes = ["i32", "u32", "usize", "bool"].every((name) => {
            const type = source.resolveTypeMeaning(name, scope, this.parser, parameters);
            return (!parameters.has(name) &&
                !this.aliases?.has(name) &&
                type.name === name &&
                !type.nullable &&
                !type.arguments.length &&
                (!type.declaration || isStdlib(type.declaration)));
        });
        const names = this.declarations.get(model.range.source);
        const safe = nativeTypes &&
            !!names &&
            [...OPERATIONS].every((name) => !this.globals.has(name) &&
                !names?.has(name) &&
                !parameters.has(name) &&
                !this.aliases?.has(name));
        this.certified.set(model, safe);
        return safe;
    }
}
