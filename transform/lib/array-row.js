// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { INTEGER_TYPES } from "./scalars.js";
import { NodeKind, PropertyFlags } from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
import { arrayRowSafety } from "./array-row-safety.js";
const NATIVE_BASES = new Set([
    "Map",
    "Set",
    "Date",
    "Array",
    "StaticArray",
    "ArrayBuffer",
    "ArrayBufferView",
    "DataView",
    "Error",
    "RangeError",
    "TypeError",
    "String",
    "Number",
    "Boolean",
    "Object",
    "Function",
    "RegExp",
    "Int8Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Int16Array",
    "Uint16Array",
    "Int32Array",
    "Uint32Array",
    "Int64Array",
    "Uint64Array",
    "Float32Array",
    "Float64Array",
]);
const ARRAY_INTEGERS = new Set(["i16", "u16", "i32", "u32", "i64", "u64"]);
const MARKER = "__SERIALIZE_FLAT_NUMERIC_FIELDS";
export class ArrayRowSerializers {
    parser;
    names;
    arrayUses = new Set();
    derived = new Set();
    unknownBase = false;
    rows = [];
    declarations = new Map();
    constructor(sources, parser, sourceSet, options) {
        this.parser = parser;
        this.names = arrayRowSafety(parser.sources, options);
        if (!this.names)
            return;
        for (const input of sources) {
            const source = sourceSet.get(input);
            for (const owner of source.getClasses()) {
                const scope = source
                    .getQualifiedName(owner)
                    .split(".")
                    .slice(0, -1)
                    .join(".");
                const parameters = source.classTypeParameters(owner);
                if (owner.extendsType) {
                    const type = source.resolveTypeMeaning(toString(owner.extendsType), scope, parser, parameters);
                    if (type.declaration?.kind === NodeKind.ClassDeclaration) {
                        this.derived.add(type.declaration);
                    }
                    else if (parameters.has(type.name) ||
                        !NATIVE_BASES.has(type.name)) {
                        this.unknownBase = true;
                    }
                }
                for (const member of owner.members) {
                    if (member.kind !== NodeKind.FieldDeclaration)
                        continue;
                    const field = member;
                    if (field.type?.kind !== NodeKind.NamedType)
                        continue;
                    const type = source.resolveTypeMeaning(toString(field.type), scope, parser, parameters);
                    if (type.name === "Array" &&
                        !type.declaration &&
                        type.arguments.length === 1 &&
                        type.arguments[0].declaration?.kind === NodeKind.ClassDeclaration) {
                        this.arrayUses.add(type.arguments[0].declaration);
                    }
                }
            }
        }
    }
    add(node, schema, source, serializer) {
        if (!this.names ||
            this.unknownBase ||
            !this.arrayUses.has(node) ||
            this.derived.has(node) ||
            node.typeParameters?.length ||
            node.extendsType ||
            schema.custom ||
            !schema.static ||
            !schema.members.length ||
            schema.members.length > 64 ||
            this.rows.length >= 128 ||
            !node.range.source.statements.includes(node) ||
            node.members.some((member) => member.name.text === "__SERIALIZE" || member.name.text === MARKER))
            return;
        const parameters = source.classTypeParameters(node);
        if (!schema.members.every((member) => {
            if (member.node.kind !== NodeKind.FieldDeclaration ||
                member.custom ||
                member.flags.has(PropertyFlags.Lazy) ||
                member.flags.has(PropertyFlags.OmitIf) ||
                member.flags.has(PropertyFlags.OmitNull))
                return false;
            const type = source.resolveTypeMeaning(member.type, "", this.parser, parameters);
            if (type.declaration || type.nullable)
                return false;
            if (!type.arguments.length)
                return (INTEGER_TYPES.includes(type.name) ||
                    type.name === "bool" ||
                    type.name === "boolean");
            if (type.name !== "Array" || type.arguments.length !== 1)
                return false;
            const element = type.arguments[0];
            return (!element.declaration &&
                !element.nullable &&
                !element.arguments.length &&
                ARRAY_INTEGERS.has(element.name));
        }))
            return;
        let suffix = this.rows.length;
        let stem;
        let symbols;
        do {
            stem = "__json_as_flat_strings_" + suffix++;
            symbols = [
                stem,
                ...["id", "write", "array", "source", "length", "index", "ptr"].map((name) => stem + "_" + name),
            ];
        } while (symbols.some((name) => this.names.has(name)));
        for (const symbol of symbols)
            this.names.add(symbol);
        const [id, writer, arrayType, input, length, index, pointer] = symbols.slice(1);
        const body = cloneNode(serializer.body);
        let receiver = false;
        const className = node.name.text;
        class BindBody extends Visitor {
            visitNamedTypeNode(type) {
                if (type.name.identifier.text === "this")
                    type.name.identifier.text = className;
            }
            visitIdentifierExpression(identifier) {
                if (identifier.text === "ptr")
                    identifier.text = pointer;
            }
            visitThisExpression() {
                receiver = true;
            }
        }
        new BindBody().visit(body);
        if (receiver)
            return;
        node.members.push(SimpleParser.parseClassMember(MARKER + "(): void {}", node));
        const getter = SimpleParser.parseTopLevelStatement(`@global @inline function ${id}(): u32 { return idof<${className}>(); }`);
        const worker = SimpleParser.parseTopLevelStatement(`@global @inline function ${writer}<${arrayType} extends any[]>(${input}: ${arrayType}, ${length}: i32): void {
      for (let ${index} = 0; ${index} < ${length}; ${index}++) {
        const ${pointer} = JSON.__serializeFlatNumericElement<${arrayType}>(changetype<usize>(${input}), ${index});
        if (isNullable<valueof<${arrayType}>>() && ${pointer} == 0) JSON.__serialize<valueof<${arrayType}>>(changetype<valueof<${arrayType}>>(${pointer}));
        else ${toString(body)}
        store<u16>(bs.offset, 44); bs.offset += 2;
      }
    }`);
        class BindRange extends Visitor {
            _visit(child, parent) {
                child.range = node.range;
                super._visit(child, parent);
            }
        }
        new BindRange().visit([getter, worker]);
        node.range.source.statements.push(getter, worker);
        const declarations = this.declarations.get(node.range.source) ?? [];
        declarations.push(getter, worker);
        this.declarations.set(node.range.source, declarations);
        this.rows.push({ id, writer });
    }
    bind(source, visitor) {
        visitor.visit(this.declarations.get(source) ?? []);
    }
    finish(sources, knownGc) {
        if (!knownGc || !this.rows.length)
            return;
        const root = diagnosticsRuntimeRoot(sources);
        const runtime = sources.find((source) => source.internalPath === root + "assembly/index");
        const array = sources.find((source) => source.internalPath === root + "assembly/serialize/naive/array");
        const namespace = runtime.statements.find((node) => node.kind === NodeKind.NamespaceDeclaration &&
            node.name.text === "JSON");
        const writer = array.statements.find((node) => node.kind === NodeKind.FunctionDeclaration &&
            node.name.text === "serializeArray");
        const body = writer.body;
        const loop = body.statements.findIndex((node) => node.kind === NodeKind.For);
        const dispatcher = SimpleParser.parseTopLevelStatement(`@inline function __serializeFlatNumericArray<T extends any[]>(data: T, length: i32): bool {
      if (ASC_RUNTIME != 2 || isDefined(ASC_RTRACE) || isDefined(ASC_GC_PROFILE) || isDefined(__finalize) || idof<T>() != idof<Array<valueof<T>>>()) return false;
      ${this.rows.map(({ id, writer }) => `if (idof<nonnull<valueof<T>>>() == ${id}()) { ${writer}<T>(data, length); return true; }`).join("\n")}
      return false;
    }`);
        const element = SimpleParser.parseTopLevelStatement(`@inline function __serializeFlatNumericElement<T extends any[]>(data: usize, index: i32): usize {
      return load<usize>(load<usize>(data, offsetof<Array<valueof<T>>>("dataStart")) + <usize>index * sizeof<usize>());
    }`);
        class BindRuntime extends Visitor {
            _visit(child, parent) {
                child.range = namespace.range;
                super._visit(child, parent);
            }
        }
        new BindRuntime().visit([dispatcher, element]);
        namespace.members.push(dispatcher, element);
        const select = SimpleParser.parseStatement(`if (isManaged<valueof<T>>() && isDefined(changetype<nonnull<valueof<T>>>(0).${MARKER})) {
      if (JSON.__serializeFlatNumericArray<T>(src, len)) { store<u16>(bs.offset - 2, BRACKET_RIGHT); return; }
    }`);
        class BindArray extends Visitor {
            _visit(child, parent) {
                child.range = writer.range;
                super._visit(child, parent);
            }
        }
        new BindArray().visit(select);
        body.statements.splice(loop, 0, select);
    }
}
