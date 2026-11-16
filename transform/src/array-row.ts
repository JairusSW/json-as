// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import {
  BlockStatement,
  CallExpression,
  ClassDeclaration,
  FieldDeclaration,
  FunctionDeclaration,
  MethodDeclaration,
  NamedTypeNode,
  NamespaceDeclaration,
  Node,
  Options,
  Parser,
  PropertyAccessExpression,
  Source,
  VariableStatement,
} from "assemblyscript/dist/assemblyscript.js";
import { INTEGER_TYPES } from "./scalars.js";
import {
  NodeKind,
  PropertyFlags,
  Schema,
  SourceSet,
  Src,
  TypeMeaning,
} from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
import { arrayRowSafety } from "./array-row-safety.js";
import { RowIntegerWriters } from "./row-integers.js";
import { TextRecordWriters } from "./text-records.js";

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

/** Keep a row's owning array rooted while its callback-free writer borrows it. */
export class ArrayRowSerializers {
  private names: Set<string> | null;
  private integerWriters: RowIntegerWriters | null = null;
  private textWriters: TextRecordWriters | null = null;
  private arrayUses = new Set<ClassDeclaration>();
  private textArrayUses = new Set<ClassDeclaration>();
  private nestedRecords = new Set<ClassDeclaration>();
  private recordReservationCount = 0;
  private derived = new Set<ClassDeclaration>();
  private eligibleRows = new Set<ClassDeclaration>();
  private unknownBase = false;
  private rows: { id: string; writer: string }[] = [];
  private declarations = new Map<Source, Node[]>();
  private closedRecords = new Set<ClassDeclaration>();
  private manualSerializers = new Set<ClassDeclaration>();
  private borrowedRecordEntry: string | null = null;
  private borrowedRecordCount = 0;

  constructor(
    sources: Source[],
    private parser: Parser,
    sourceSet: SourceSet,
    options: Options,
  ) {
    this.names = arrayRowSafety(parser.sources, options);
    if (!this.names) return;
    this.integerWriters = new RowIntegerWriters(parser, this.names);
    this.textWriters = new TextRecordWriters(parser, this.names);
    const manual = this.manualSerializers;
    class FindManual extends Visitor {
      visitClassDeclaration(
        node: ClassDeclaration,
        isDefault = false,
        parent?: Node,
      ): void {
        if (
          node.members.some((member) =>
            member.name?.text?.startsWith("__SERIALIZE"),
          )
        )
          manual.add(node);
        super.visitClassDeclaration(node, isDefault, parent);
      }
    }
    for (const source of parser.sources)
      new FindManual().visit(source.statements);
    for (const input of sources) {
      const source = sourceSet.get(input);
      // Top-level typed arrays also include root parse results, which have no
      // enclosing schema field. Resolve their element declaration in this source.
      for (const statement of input.statements) {
        if (statement.kind !== NodeKind.Variable) continue;
        for (const declaration of (statement as VariableStatement)
          .declarations) {
          const types = declaration.type ? [declaration.type] : [];
          if (declaration.initializer?.kind === NodeKind.Call)
            types.push(
              ...((declaration.initializer as CallExpression).typeArguments ??
                []),
            );
          for (const node of types) {
            const type = source.resolveTypeMeaning(toString(node), "", parser);
            if (
              !type.declaration &&
              type.name === "Array" &&
              type.arguments.length === 1 &&
              type.arguments[0].declaration?.kind === NodeKind.ClassDeclaration
            )
              this.textArrayUses.add(
                type.arguments[0].declaration as ClassDeclaration,
              );
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
        if (owner.extendsType) {
          const type = source.resolveTypeMeaning(
            toString(owner.extendsType),
            scope,
            parser,
            parameters,
          );
          if (type.declaration?.kind === NodeKind.ClassDeclaration) {
            this.derived.add(type.declaration as ClassDeclaration);
          } else if (
            parameters.has(type.name) ||
            !NATIVE_BASES.has(type.name)
          ) {
            this.unknownBase = true;
          }
        }
        for (const member of owner.members) {
          if (member.kind !== NodeKind.FieldDeclaration) continue;
          const field = member as FieldDeclaration;
          if (field.type?.kind !== NodeKind.NamedType) continue;
          const type = source.resolveTypeMeaning(
            toString(field.type),
            scope,
            parser,
            parameters,
          );
          this.rememberRecord(type);
          if (
            type.name === "Array" &&
            !type.declaration &&
            type.arguments.length === 1 &&
            type.arguments[0].declaration?.kind === NodeKind.ClassDeclaration
          ) {
            this.arrayUses.add(
              type.arguments[0].declaration as ClassDeclaration,
            );
          }
        }
      }
    }
  }

  private rememberRecord(type: TypeMeaning): void {
    if (type.declaration?.kind === NodeKind.ClassDeclaration)
      this.nestedRecords.add(type.declaration as ClassDeclaration);
    for (const argument of type.arguments) this.rememberRecord(argument);
  }

  /** Retire completed nested records' unused numeric capacity estimates. */
  finishRecord(
    node: ClassDeclaration,
    schema: Schema,
    source: Src,
    serializer: MethodDeclaration,
  ): void {
    if (
      !this.names ||
      !this.nestedRecords.has(node) ||
      schema.custom ||
      !schema.static ||
      node.typeParameters?.length ||
      schema.members.some((member) => member.flags.has(PropertyFlags.Lazy))
    )
      return;
    const scope = source
      .getQualifiedName(node)
      .split(".")
      .slice(0, -1)
      .join(".");
    const parameters = source.classTypeParameters(node);
    if (
      !schema.members.some((member) => {
        const type = source.resolveTypeMeaning(
          member.type,
          scope,
          this.parser,
          parameters,
        );
        return (
          !type.declaration &&
          !type.nullable &&
          !type.arguments.length &&
          (INTEGER_TYPES.includes(type.name) ||
            type.name === "f32" ||
            type.name === "f64")
        );
      })
    )
      return;

    let reserved: string, begin: string;
    do {
      const index = this.recordReservationCount++;
      reserved = `__json_record_reserved_${index}`;
      begin = `__json_record_begin_${index}`;
    } while (this.names.has(reserved) || this.names.has(begin));
    this.names.add(reserved);
    this.names.add(begin);
    const start = SimpleParser.parseStatement(
      `const ${reserved} = bs.stackSize;`,
    );
    const offset = SimpleParser.parseStatement(
      `const ${begin} = bs.offset - bs.buffer;`,
    );
    // Preserve all caller credits and use relative offsets across buffer growth.
    const end = SimpleParser.parseStatement(
      `bs.stackSize = (${reserved} >= ${begin} ? ${reserved} : ${begin}) + (bs.offset - bs.buffer - ${begin});`,
    );
    class BindRange extends Visitor {
      _visit(child: Node, parent: Node | null): void {
        child.range = serializer.range;
        super._visit(child, parent);
      }
    }
    new BindRange().visit([start, offset, end]);
    const body = serializer.body as BlockStatement;
    body.statements.unshift(start, offset);
    body.statements.push(end);
  }

  /** Borrow freshly loaded children only while a traced, callback-free owner
   * keeps their complete graph alive. Uncertain graphs retain managed roots. */
  borrowRecord(
    node: ClassDeclaration,
    schema: Schema,
    source: Src,
    serializer: MethodDeclaration,
  ): void {
    if (
      !this.names ||
      !this.textWriters?.verified ||
      this.unknownBase ||
      ++this.borrowedRecordCount > 512 ||
      node.extendsType ||
      node.typeParameters?.length ||
      this.derived.has(node) ||
      this.manualSerializers.has(node) ||
      schema.custom ||
      !schema.static ||
      node.decorators?.some(
        (decorator) => toString(decorator.name) === "unmanaged",
      ) ||
      !node.range.source.statements.includes(node)
    )
      return;
    const parameters = source.classTypeParameters(node);
    const safe = (type: TypeMeaning, depth = 0): boolean => {
      if (depth > 8) return false;
      if (type.declaration)
        return this.closedRecords.has(type.declaration as ClassDeclaration);
      if (!type.arguments.length) {
        if (type.name === "string" || type.name === "String") return true;
        return (
          !type.nullable &&
          (INTEGER_TYPES.includes(type.name) ||
            type.name === "bool" ||
            type.name === "boolean")
        );
      }
      return (
        type.name === "Array" &&
        type.arguments.length === 1 &&
        safe(type.arguments[0], depth + 1)
      );
    };
    if (
      !schema.members.every(
        (member) =>
          member.node.kind === NodeKind.FieldDeclaration &&
          !member.custom &&
          ![
            PropertyFlags.Lazy,
            PropertyFlags.OmitIf,
            PropertyFlags.OmitNull,
          ].some((flag) => member.flags.has(flag)) &&
          safe(
            source.resolveTypeMeaning(member.type, "", this.parser, parameters),
          ),
      )
    )
      return;
    let receiver = false;
    class FindReceiver extends Visitor {
      visitThisExpression(): void {
        receiver = true;
      }
    }
    new FindReceiver().visit(serializer.body!);
    if (receiver) return;
    this.closedRecords.add(node);
    const parser = this.parser;
    const closedRecords = this.closedRecords;
    const entry = () => this.borrowedEntry();
    class BorrowCalls extends Visitor {
      visitCallExpression(call: CallExpression, parent: Node): void {
        if (
          call.expression.kind === NodeKind.PropertyAccess &&
          ["__serializeObject", "__serialize"].includes(
            (call.expression as PropertyAccessExpression).property.text,
          ) &&
          call.typeArguments?.length === 1 &&
          call.args.length === 1
        ) {
          const type = source.resolveTypeMeaning(
            toString(call.typeArguments[0]),
            "",
            parser,
            parameters,
          );
          const argument = call.args[0];
          if (
            type.declaration &&
            closedRecords.has(type.declaration as ClassDeclaration) &&
            argument.kind === NodeKind.Call
          ) {
            const load = argument as CallExpression;
            if (
              load.expression.kind === NodeKind.Identifier &&
              toString(load.expression) === "load" &&
              load.typeArguments?.length === 1 &&
              source.resolveTypeMeaning(
                toString(load.typeArguments[0]),
                "",
                parser,
                parameters,
              ).declaration === type.declaration
            ) {
              const raw = (
                SimpleParser.parseExpression("load<usize>(0)") as CallExpression
              ).typeArguments![0];
              class Bind extends Visitor {
                _visit(child: Node, owner: Node | null): void {
                  child.range = load.typeArguments![0].range;
                  super._visit(child, owner);
                }
              }
              new Bind().visit(raw);
              load.typeArguments![0] = raw;
              call.expression = Node.createIdentifierExpression(
                entry(),
                call.expression.range,
              );
            }
          }
        }
        super.visitCallExpression(call, parent);
      }
    }
    new BorrowCalls().visit(serializer.body!);
  }

  private borrowedEntry(): string {
    if (this.borrowedRecordEntry) return this.borrowedRecordEntry;
    let index = 0,
      name: string;
    do {
      name = "__json_borrow_record_" + index++;
    } while (this.names!.has(name));
    this.names!.add(name);
    const root = diagnosticsRuntimeRoot(this.parser.sources)!;
    const runtime = this.parser.sources.find(
      (source) => source.internalPath === root + "assembly/index",
    )!;
    const helper =
      SimpleParser.parseTopLevelStatement(`@global @inline function ${name}<T>(ptr: usize): void {
      if (isNullable<T>() && ptr == 0) {
        JSON.__serialize<T>(changetype<T>(ptr));
        return;
      }
      changetype<nonnull<T>>(0).__SERIALIZE(ptr);
    }`);
    class Bind extends Visitor {
      _visit(child: Node, parent: Node | null): void {
        child.range = runtime.range;
        super._visit(child, parent);
      }
    }
    new Bind().visit(helper);
    runtime.statements.push(helper);
    this.borrowedRecordEntry = name;
    return name;
  }

  private rewriteTextRecord(
    node: ClassDeclaration,
    schema: Schema,
    source: Src,
    serializer: MethodDeclaration,
  ): void {
    if (
      !this.textWriters ||
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
      node.members.some((member) => member.name.text === "__SERIALIZE")
    )
      return;
    const parameters = source.classTypeParameters(node);
    if (
      !schema.members.every((member) => {
        if (
          member.node.kind !== NodeKind.FieldDeclaration ||
          member.custom ||
          member.flags.has(PropertyFlags.Lazy) ||
          member.flags.has(PropertyFlags.OmitIf) ||
          member.flags.has(PropertyFlags.OmitNull)
        )
          return false;
        const type = source.resolveTypeMeaning(
          member.type,
          "",
          this.parser,
          parameters,
        );
        return (
          !type.declaration &&
          !type.nullable &&
          !type.arguments.length &&
          (type.name === "string" || type.name === "String")
        );
      })
    )
      return;
    this.textWriters.rewrite(serializer, schema.members.length);
  }

  add(
    node: ClassDeclaration,
    schema: Schema,
    source: Src,
    serializer: MethodDeclaration,
  ): void {
    this.rewriteTextRecord(node, schema, source, serializer);
    if (
      !this.names ||
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
      node.members.some(
        (member) =>
          member.name.text === "__SERIALIZE" || member.name.text === MARKER,
      )
    )
      return;
    const parameters = source.classTypeParameters(node);
    if (
      !schema.members.every((member) => {
        if (
          member.node.kind !== NodeKind.FieldDeclaration ||
          member.custom ||
          member.flags.has(PropertyFlags.Lazy) ||
          member.flags.has(PropertyFlags.OmitIf) ||
          member.flags.has(PropertyFlags.OmitNull)
        )
          return false;
        const type = source.resolveTypeMeaning(
          member.type,
          "",
          this.parser,
          parameters,
        );
        if (type.declaration || type.nullable) return false;
        if (!type.arguments.length)
          return (
            INTEGER_TYPES.includes(type.name) ||
            type.name === "bool" ||
            type.name === "boolean"
          );
        if (type.name !== "Array" || type.arguments.length !== 1) return false;
        const element = type.arguments[0];
        if (element.declaration?.kind === NodeKind.ClassDeclaration)
          return this.eligibleRows.has(element.declaration as ClassDeclaration);
        return (
          !element.declaration &&
          !element.nullable &&
          !element.arguments.length &&
          ARRAY_INTEGERS.has(element.name)
        );
      })
    )
      return;

    let suffix = this.rows.length;
    let stem: string;
    let symbols: string[];
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
    } while (symbols.some((name) => this.names!.has(name)));
    for (const symbol of symbols) this.names.add(symbol);
    const [
      id,
      writer,
      arrayType,
      input,
      length,
      index,
      pointer,
      reserved,
      begin,
    ] = symbols.slice(1);
    const body = cloneNode(serializer.body!) as BlockStatement;
    let receiver = false;
    const className = node.name.text;
    class BindBody extends Visitor {
      visitNamedTypeNode(type: NamedTypeNode): void {
        if (type.name.identifier.text === "this")
          type.name.identifier.text = className;
      }
      visitIdentifierExpression(identifier: { text: string }): void {
        if (identifier.text === "ptr") identifier.text = pointer;
      }
      visitThisExpression(): void {
        receiver = true;
      }
    }
    new BindBody().visit(body);
    if (receiver) return;
    this.eligibleRows.add(node);

    node.members.push(
      SimpleParser.parseClassMember(MARKER + "(): void {}", node),
    );
    const getter = SimpleParser.parseTopLevelStatement(
      `@global @inline function ${id}(): u32 { return idof<${className}>(); }`,
    );
    const worker =
      SimpleParser.parseTopLevelStatement(`@global @inline function ${writer}<${arrayType} extends any[]>(${input}: ${arrayType}, ${length}: i32): void {
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
      _visit(child: Node, parent: Node | null): void {
        child.range = node.range;
        super._visit(child, parent);
      }
    }
    new BindRange().visit([getter, worker]);
    this.integerWriters!.rewrite(worker as FunctionDeclaration, source, node);
    node.range.source.statements.push(getter, worker);
    const declarations = this.declarations.get(node.range.source) ?? [];
    declarations.push(getter, worker);
    this.declarations.set(node.range.source, declarations);
    this.rows.push({ id, writer });
  }

  bind(source: Source, visitor: Visitor): void {
    visitor.visit(this.declarations.get(source) ?? []);
  }

  finish(sources: Source[], knownGc: boolean): void {
    if (!knownGc || !this.rows.length) return;
    const root = diagnosticsRuntimeRoot(sources)!;
    const runtime = sources.find(
      (source) => source.internalPath === root + "assembly/index",
    )!;
    const array = sources.find(
      (source) =>
        source.internalPath === root + "assembly/serialize/naive/array",
    )!;
    const namespace = runtime.statements.find(
      (node) =>
        node.kind === NodeKind.NamespaceDeclaration &&
        (node as NamespaceDeclaration).name.text === "JSON",
    ) as NamespaceDeclaration;
    const writer = array.statements.find(
      (node) =>
        node.kind === NodeKind.FunctionDeclaration &&
        (node as FunctionDeclaration).name.text === "serializeArray",
    ) as FunctionDeclaration;
    const body = writer.body! as BlockStatement;
    const loop = body.statements.findIndex(
      (node) => node.kind === NodeKind.For,
    );
    const dispatcher =
      SimpleParser.parseTopLevelStatement(`@inline function __serializeFlatNumericArray<T extends any[]>(data: T, length: i32): bool {
      if (ASC_RUNTIME != 2 || isDefined(ASC_RTRACE) || isDefined(ASC_GC_PROFILE) || isDefined(__finalize) || idof<T>() != idof<Array<valueof<T>>>()) return false;
      ${this.rows.map(({ id, writer }) => `if (idof<nonnull<valueof<T>>>() == ${id}()) { ${writer}<T>(data, length); return true; }`).join("\n")}
      return false;
    }`);
    const element =
      SimpleParser.parseTopLevelStatement(`@inline function __serializeFlatNumericElement<T extends any[]>(data: usize, index: i32): usize {
      return load<usize>(load<usize>(data, offsetof<Array<valueof<T>>>("dataStart")) + <usize>index * sizeof<usize>());
    }`);
    class BindRuntime extends Visitor {
      _visit(child: Node, parent: Node | null): void {
        child.range = namespace.range;
        super._visit(child, parent);
      }
    }
    new BindRuntime().visit([dispatcher, element]);
    namespace.members.push(dispatcher, element);
    const select =
      SimpleParser.parseStatement(`if (isManaged<valueof<T>>() && isDefined(changetype<nonnull<valueof<T>>>(0).${MARKER})) {
      if (JSON.__serializeFlatNumericArray<T>(src, len)) { store<u16>(bs.offset - 2, BRACKET_RIGHT); return; }
    }`);
    class BindArray extends Visitor {
      _visit(child: Node, parent: Node | null): void {
        child.range = writer.range;
        super._visit(child, parent);
      }
    }
    new BindArray().visit(select);
    body.statements.splice(loop, 0, select);
  }
}
