// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { Node, } from "assemblyscript/dist/assemblyscript.js";
import { INTEGER_TYPES } from "./scalars.js";
import { NodeKind, PropertyFlags, } from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
import { arrayRowSafety } from "./array-row-safety.js";
import { RowIntegerWriters } from "./row-integers.js";
import { TextRecordWriters } from "./text-records.js";
import { ClosedMapProof } from "./closed-map.js";
import { RecordCursorWriters } from "./record-cursors.js";
import { NumericRowBatches } from "./numeric-row-batches.js";
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
    integerWriters = null;
    textWriters = null;
    arrayUses = new Set();
    textArrayUses = new Set();
    nestedRecords = new Set();
    recordReservationCount = 0;
    derived = new Set();
    eligibleRows = new Set();
    unknownBase = false;
    rows = [];
    declarations = new Map();
    closedRecords = new Set();
    nativeScalarBox = null;
    manualSerializers = new Set();
    borrowedRecordEntry = null;
    borrowedRecordCount = 0;
    closedMapProof = null;
    recordCursors = null;
    numericBatches = null;
    constructor(sources, parser, sourceSet, options) {
        this.parser = parser;
        this.names = arrayRowSafety(parser.sources, options);
        if (!this.names)
            return;
        this.integerWriters = new RowIntegerWriters(parser, this.names);
        this.textWriters = new TextRecordWriters(parser, this.names, options.hasFeature(16));
        if (this.textWriters.verified) {
            this.closedMapProof = new ClosedMapProof(parser, this.names);
            this.recordCursors = new RecordCursorWriters(parser, this.names);
            this.numericBatches = new NumericRowBatches(this.names);
        }
        const root = diagnosticsRuntimeRoot(parser.sources);
        const runtime = parser.sources.find((source) => source.internalPath === root + "assembly/index");
        const namespace = runtime.statements.find((statement) => statement.kind === NodeKind.NamespaceDeclaration &&
            statement.name.text === "JSON");
        this.nativeScalarBox = namespace.members.find((member) => member.kind === NodeKind.ClassDeclaration &&
            member.name.text === "Box");
        const manual = this.manualSerializers;
        const derived = this.derived;
        let unknownBase = false;
        class InspectClasses extends Visitor {
            source;
            constructor(source) {
                super();
                this.source = source;
            }
            visitClassDeclaration(node, isDefault = false, parent) {
                if (node.members.some((member) => member.name?.text?.startsWith("__SERIALIZE")))
                    manual.add(node);
                if (node.extendsType) {
                    const scope = this.source
                        .getQualifiedName(node)
                        .split(".")
                        .slice(0, -1)
                        .join(".");
                    const parameters = this.source.classTypeParameters(node);
                    const type = this.source.resolveTypeMeaning(toString(node.extendsType), scope, parser, parameters);
                    if (type.declaration?.kind === NodeKind.ClassDeclaration)
                        derived.add(type.declaration);
                    else if (parameters.has(type.name) || !NATIVE_BASES.has(type.name))
                        unknownBase = true;
                }
                super.visitClassDeclaration(node, isDefault, parent);
            }
        }
        for (const source of parser.sources)
            new InspectClasses(sourceSet.get(source)).visit(source.statements);
        this.unknownBase = unknownBase;
        for (const input of sources) {
            const source = sourceSet.get(input);
            for (const statement of input.statements) {
                if (statement.kind !== NodeKind.Variable)
                    continue;
                for (const declaration of statement
                    .declarations) {
                    const types = declaration.type ? [declaration.type] : [];
                    if (declaration.initializer?.kind === NodeKind.Call)
                        types.push(...(declaration.initializer.typeArguments ??
                            []));
                    for (const node of types) {
                        const type = source.resolveTypeMeaning(toString(node), "", parser);
                        if (!type.declaration &&
                            type.name === "Array" &&
                            type.arguments.length === 1 &&
                            type.arguments[0].declaration?.kind === NodeKind.ClassDeclaration)
                            this.textArrayUses.add(type.arguments[0].declaration);
                    }
                }
            }
            for (const owner of source.getClasses()) {
                const scope = source
                    .getQualifiedName(owner)
                    .split(".")
                    .slice(0, -1)
                    .join(".");
                const parameters = source.classTypeParameters(owner);
                for (const member of owner.members) {
                    if (member.kind !== NodeKind.FieldDeclaration)
                        continue;
                    const field = member;
                    if (field.type?.kind !== NodeKind.NamedType)
                        continue;
                    const type = source.resolveTypeMeaning(toString(field.type), scope, parser, parameters);
                    this.rememberRecord(type);
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
    rememberRecord(type) {
        if (type.declaration?.kind === NodeKind.ClassDeclaration)
            this.nestedRecords.add(type.declaration);
        for (const argument of type.arguments)
            this.rememberRecord(argument);
    }
    finishMapProof(knownGc) {
        if (knownGc)
            this.closedMapProof?.lower(this.closedRecords);
    }
    finishRecord(node, schema, source, serializer) {
        if (!this.names ||
            !this.nestedRecords.has(node) ||
            schema.custom ||
            !schema.static ||
            node.typeParameters?.length ||
            schema.members.some((member) => member.flags.has(PropertyFlags.Lazy)))
            return;
        const scope = source
            .getQualifiedName(node)
            .split(".")
            .slice(0, -1)
            .join(".");
        const parameters = source.classTypeParameters(node);
        if (!schema.members.some((member) => {
            const type = source.resolveTypeMeaning(member.type, scope, this.parser, parameters);
            return (!type.declaration &&
                !type.nullable &&
                !type.arguments.length &&
                (INTEGER_TYPES.includes(type.name) ||
                    type.name === "f32" ||
                    type.name === "f64"));
        }))
            return;
        let reserved, begin;
        do {
            const index = this.recordReservationCount++;
            reserved = `__json_record_reserved_${index}`;
            begin = `__json_record_begin_${index}`;
        } while (this.names.has(reserved) || this.names.has(begin));
        this.names.add(reserved);
        this.names.add(begin);
        const start = SimpleParser.parseStatement(`const ${reserved} = bs.stackSize;`);
        const offset = SimpleParser.parseStatement(`const ${begin} = bs.offset - bs.buffer;`);
        const end = SimpleParser.parseStatement(`bs.stackSize = (${reserved} >= ${begin} ? ${reserved} : ${begin}) + (bs.offset - bs.buffer - ${begin});`);
        class BindRange extends Visitor {
            _visit(child, parent) {
                child.range = serializer.range;
                super._visit(child, parent);
            }
        }
        new BindRange().visit([start, offset, end]);
        const body = serializer.body;
        body.statements.unshift(start, offset);
        body.statements.push(end);
    }
    borrowRecord(node, schema, source, serializer) {
        if (!this.names ||
            !this.textWriters?.verified ||
            this.unknownBase ||
            ++this.borrowedRecordCount > 512 ||
            node.extendsType ||
            node.typeParameters?.length ||
            this.derived.has(node) ||
            this.manualSerializers.has(node) ||
            schema.custom ||
            !schema.static ||
            node.decorators?.some((decorator) => toString(decorator.name) === "unmanaged") ||
            !node.range.source.statements.includes(node))
            return;
        const parameters = source.classTypeParameters(node);
        const safe = (type, depth = 0) => {
            if (depth > 8)
                return false;
            if (this.nativeScalarBox &&
                type.declaration === this.nativeScalarBox &&
                !this.derived.has(this.nativeScalarBox) &&
                type.arguments.length === 1) {
                const value = type.arguments[0];
                return (!value.declaration &&
                    !value.nullable &&
                    !value.arguments.length &&
                    (INTEGER_TYPES.includes(value.name) ||
                        value.name === "bool" ||
                        value.name === "boolean"));
            }
            if (type.declaration)
                return this.closedRecords.has(type.declaration);
            if (!type.arguments.length) {
                if (type.name === "string" || type.name === "String")
                    return true;
                return (!type.nullable &&
                    (INTEGER_TYPES.includes(type.name) ||
                        type.name === "bool" ||
                        type.name === "boolean"));
            }
            return (type.name === "Array" &&
                type.arguments.length === 1 &&
                safe(type.arguments[0], depth + 1));
        };
        if (!schema.members.every((member) => member.node.kind === NodeKind.FieldDeclaration &&
            !member.custom &&
            ![
                PropertyFlags.Lazy,
                PropertyFlags.OmitIf,
                PropertyFlags.OmitNull,
            ].some((flag) => member.flags.has(flag))))
            return;
        const closed = schema.members.every((member) => safe(source.resolveTypeMeaning(member.type, "", this.parser, parameters)));
        let receiver = false;
        class FindReceiver extends Visitor {
            visitThisExpression() {
                receiver = true;
            }
        }
        new FindReceiver().visit(serializer.body);
        if (receiver)
            return;
        if (closed)
            this.closedRecords.add(node);
        const parser = this.parser;
        const closedRecords = this.closedRecords;
        const entry = () => this.borrowedEntry();
        class BorrowCalls extends Visitor {
            visitCallExpression(call, parent) {
                if (call.expression.kind === NodeKind.PropertyAccess &&
                    ["__serializeObject", "__serialize"].includes(call.expression.property.text) &&
                    call.typeArguments?.length === 1 &&
                    call.args.length === 1) {
                    const type = source.resolveTypeMeaning(toString(call.typeArguments[0]), "", parser, parameters);
                    const argument = call.args[0];
                    if (type.declaration &&
                        closedRecords.has(type.declaration) &&
                        argument.kind === NodeKind.Call) {
                        const load = argument;
                        if (load.expression.kind === NodeKind.Identifier &&
                            toString(load.expression) === "load" &&
                            load.typeArguments?.length === 1 &&
                            source.resolveTypeMeaning(toString(load.typeArguments[0]), "", parser, parameters).declaration === type.declaration) {
                            const raw = SimpleParser.parseExpression("load<usize>(0)").typeArguments[0];
                            class Bind extends Visitor {
                                _visit(child, owner) {
                                    child.range = load.typeArguments[0].range;
                                    super._visit(child, owner);
                                }
                            }
                            new Bind().visit(raw);
                            load.typeArguments[0] = raw;
                            call.expression = Node.createIdentifierExpression(entry(), call.expression.range);
                        }
                    }
                }
                super.visitCallExpression(call, parent);
            }
        }
        new BorrowCalls().visit(serializer.body);
        const cursor = this.recordCursors?.rewrite(node, source, serializer, closed);
        if (cursor) {
            node.range.source.statements.push(cursor);
            const declarations = this.declarations.get(node.range.source) ?? [];
            declarations.push(cursor);
            this.declarations.set(node.range.source, declarations);
        }
    }
    borrowedEntry() {
        if (this.borrowedRecordEntry)
            return this.borrowedRecordEntry;
        let index = 0, name;
        do {
            name = "__json_borrow_record_" + index++;
        } while (this.names.has(name));
        this.names.add(name);
        const root = diagnosticsRuntimeRoot(this.parser.sources);
        const runtime = this.parser.sources.find((source) => source.internalPath === root + "assembly/index");
        const helper = SimpleParser.parseTopLevelStatement(`@global @inline function ${name}<T>(ptr: usize): void {
      if (isNullable<T>() && ptr == 0) {
        JSON.__serialize<T>(changetype<T>(ptr));
        return;
      }
      changetype<nonnull<T>>(0).__SERIALIZE(ptr);
    }`);
        class Bind extends Visitor {
            _visit(child, parent) {
                child.range = runtime.range;
                super._visit(child, parent);
            }
        }
        new Bind().visit(helper);
        runtime.statements.push(helper);
        this.borrowedRecordEntry = name;
        return name;
    }
    rewriteTextRecord(node, schema, source, serializer) {
        if (!this.textWriters ||
            (!this.arrayUses.has(node) && !this.textArrayUses.has(node)) ||
            this.unknownBase ||
            this.derived.has(node) ||
            node.extendsType ||
            node.typeParameters?.length ||
            schema.custom ||
            !schema.static ||
            schema.members.length < 3 ||
            schema.members.length > 64 ||
            !node.range.source.statements.includes(node) ||
            node.members.some((member) => member.name.text === "__SERIALIZE"))
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
            return (!type.declaration &&
                !type.nullable &&
                !type.arguments.length &&
                (type.name === "string" || type.name === "String"));
        }))
            return;
        this.textWriters.rewrite(serializer, schema.members.length);
    }
    add(node, schema, source, serializer) {
        this.rewriteTextRecord(node, schema, source, serializer);
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
            if (element.declaration?.kind === NodeKind.ClassDeclaration)
                return this.eligibleRows.has(element.declaration);
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
                ...[
                    "id",
                    "write",
                    "array",
                    "source",
                    "length",
                    "index",
                    "ptr",
                    "reserved",
                    "begin",
                ].map((name) => stem + "_" + name),
            ];
        } while (symbols.some((name) => this.names.has(name)));
        for (const symbol of symbols)
            this.names.add(symbol);
        const [id, writer, arrayType, input, length, index, pointer, reserved, begin,] = symbols.slice(1);
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
        this.eligibleRows.add(node);
        node.members.push(SimpleParser.parseClassMember(MARKER + "(): void {}", node));
        const getter = SimpleParser.parseTopLevelStatement(`@global @inline function ${id}(): u32 { return idof<${className}>(); }`);
        const worker = SimpleParser.parseTopLevelStatement(`@global @inline function ${writer}<${arrayType} extends any[]>(${input}: ${arrayType}, ${length}: i32): void {
      for (let ${index} = 0; ${index} < ${length}; ${index}++) {
        const ${reserved} = bs.stackSize;
        const ${begin} = bs.offset - bs.buffer;
        const ${pointer} = JSON.__serializeFlatNumericElement<${arrayType}>(changetype<usize>(${input}), ${index});
        if (isNullable<valueof<${arrayType}>>() && ${pointer} == 0) JSON.__serialize<valueof<${arrayType}>>(changetype<valueof<${arrayType}>>(${pointer}));
        else ${toString(body)}
        // Keep every caller reservation; retire only this completed row's unused estimate.
        bs.stackSize = (${reserved} >= ${begin} ? ${reserved} : ${begin}) + (bs.offset - bs.buffer - ${begin});
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
        this.integerWriters.rewrite(worker, source, node);
        const batches = this.numericBatches?.rewrite(worker, source, this.parser) ?? [];
        node.range.source.statements.push(getter, worker, ...batches);
        const declarations = this.declarations.get(node.range.source) ?? [];
        declarations.push(getter, worker, ...batches);
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
