import {
  ClassDeclaration,
  CommonFlags,
  Feature,
  FieldDeclaration,
  FloatLiteralExpression,
  FunctionExpression,
  IdentifierExpression,
  ImportStatement,
  IntegerLiteralExpression,
  LiteralExpression,
  LiteralKind,
  MethodDeclaration,
  NamedTypeNode,
  Node,
  NodeKind,
  Parser,
  Program,
  Range,
  Source,
  SourceKind,
  StringLiteralExpression,
  Type,
} from "assemblyscript/dist/assemblyscript.js";
import { Transform } from "assemblyscript/dist/transform.js";
import { readFileSync, writeFileSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  getComparison,
  isArray,
  isBoolean,
  isEnum,
  isPrimitive,
  isString,
  sizeof,
  sortMembers,
  strToNum,
  stripNull,
  toMemCDecl,
} from "./codegen/common.js";
import { CustomTransform } from "./linkers/custom.js";
import {
  Property,
  PropertyFlags,
  Schema,
  SourceSet,
  Src,
  StringHintMode,
} from "./types.js";
import { isStdlib, removeExtension, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";

let indent = "  ";

let id = 0;

const WRITE = process.env["JSON_WRITE"]?.trim();
const rawValue = process.env["JSON_DEBUG"]?.trim();

const DEBUG =
  rawValue === "true"
    ? 1
    : rawValue === "false" || rawValue === ""
      ? 0
      : isNaN(Number(rawValue))
        ? 0
        : Number(rawValue);

const STRICT =
  process.env["JSON_STRICT"] && process.env["JSON_STRICT"] == "true";

export class JSONTransform extends Visitor {
  static SN: JSONTransform = new JSONTransform();

  public program!: Program;
  public baseCWD!: string;
  public parser!: Parser;
  public schemas: Map<string, Schema[]> = new Map<string, Schema[]>();
  public schema!: Schema;
  public sources: SourceSet = new SourceSet();
  public imports: ImportStatement[] = [];
  public simdStatements: string[] = [];

  public visitedClasses: Set<string> = new Set<string>();

  visitClassDeclarationRef(node: ClassDeclaration): void {
    if (
      !node.decorators?.length ||
      !node.decorators.some((decorator) => {
        const name = (<IdentifierExpression>decorator.name).text;
        return name === "json" || name === "serializable";
      })
    )
      throw new Error(
        "Class " +
          node.name.text +
          " is missing an @json or @serializable decorator in " +
          node.range.source.internalPath,
      );
    this.visitClassDeclaration(node);
  }

  resolveType(type: string, source: Src, visited = new Set<string>()): string {
    const stripped = stripNull(type);

    if (visited.has(stripped)) {
      return stripped;
    }
    visited.add(stripped);

    const resolvedType = source.aliases
      .find((v) => stripNull(v.name) === stripped)
      ?.getBaseType();

    if (resolvedType) {
      return this.resolveType(resolvedType, source, visited);
    }

    for (const imp of source.imports) {
      if (!imp.declarations) continue;

      for (const decl of imp.declarations) {
        if (decl.name.text === stripped) {
          const externalSource = this.parser.sources.find(
            (s) => s.internalPath === imp.internalPath,
          );
          if (externalSource) {
            const externalSrc = this.sources.get(externalSource);
            if (!externalSrc) continue;

            const externalAlias = externalSrc.aliases.find(
              (a) => a.name === decl.foreignName.text,
            );

            if (externalAlias) {
              const externalType = externalAlias.getBaseType();
              return this.resolveType(externalType, externalSrc, visited);
            }
          }
        }
      }
    }

    return type;
  }

  visitClassDeclaration(node: ClassDeclaration): void {
    if (!node.decorators?.length) return;

    if (
      !node.decorators.some((decorator) => {
        const name = (<IdentifierExpression>decorator.name).text;
        return name === "json" || name === "serializable";
      })
    )
      return;

    const source = this.sources.get(node.range.source);

    const fullClassPath = source.getFullPath(node);

    if (this.visitedClasses.has(fullClassPath)) return;
    if (!this.schemas.has(source.internalPath))
      this.schemas.set(source.internalPath, []);

    const members: FieldDeclaration[] = [
      ...(node.members.filter(
        (v) =>
          v.kind === NodeKind.FieldDeclaration &&
          v.flags !== CommonFlags.Static &&
          v.flags !== CommonFlags.Private &&
          v.flags !== CommonFlags.Protected &&
          !v.decorators?.some(
            (decorator) =>
              (<IdentifierExpression>decorator.name).text === "omit",
          ),
      ) as FieldDeclaration[]),
    ];
    const serializers: MethodDeclaration[] = [
      ...node.members.filter(
        (v) =>
          v.kind === NodeKind.MethodDeclaration &&
          v.decorators &&
          v.decorators.some(
            (e) =>
              (<IdentifierExpression>e.name).text.toLowerCase() ===
              "serializer",
          ),
      ),
    ] as MethodDeclaration[];
    const deserializers: MethodDeclaration[] = [
      ...node.members.filter(
        (v) =>
          v.kind === NodeKind.MethodDeclaration &&
          v.decorators &&
          v.decorators.some(
            (e) =>
              (<IdentifierExpression>e.name).text.toLowerCase() ===
              "deserializer",
          ),
      ),
    ] as MethodDeclaration[];

    const schema = new Schema();
    schema.node = node;
    schema.name = source.getQualifiedName(node);

    if (node.extendsType) {
      const extendsName = source.resolveExtendsName(node);

      if (!schema.parent) {
        const depSearch = schema.deps.find((v) => v.name == extendsName);
        if (depSearch) {
          if (DEBUG > 0)
            console.log(
              "Found " +
                extendsName +
                " in dependencies of " +
                source.internalPath,
            );
          if (!schema.deps.some((v) => v.name == depSearch.name))
            schema.deps.push(depSearch);
          schema.parent = depSearch;
        } else {
          const internalSearch = source.getClass(extendsName);
          if (internalSearch) {
            if (DEBUG > 0)
              console.log(
                "Found " +
                  extendsName +
                  " internally from " +
                  source.internalPath,
              );
            if (!this.visitedClasses.has(source.getFullPath(internalSearch))) {
              this.visitClassDeclarationRef(internalSearch);
              this.schemas
                .get(internalSearch.range.source.internalPath)
                .push(this.schema);
              this.visitClassDeclaration(node);
              return;
            }
            const schem = this.schemas
              .get(internalSearch.range.source.internalPath)
              ?.find((s) => s.name == extendsName);
            if (!schem)
              throw new Error(
                "Could not find schema for " +
                  internalSearch.name.text +
                  " in " +
                  internalSearch.range.source.internalPath,
              );
            schema.deps.push(schem);
            schema.parent = schem;
          } else {
            const externalSearch = source.getImportedClass(
              extendsName,
              this.parser,
            );
            if (externalSearch) {
              if (DEBUG > 0)
                console.log(
                  "Found " +
                    externalSearch.name.text +
                    " externally from " +
                    source.internalPath,
                );
              const externalSource = this.sources.get(
                externalSearch.range.source,
              );
              if (
                !this.visitedClasses.has(
                  externalSource.getFullPath(externalSearch),
                )
              ) {
                this.visitClassDeclarationRef(externalSearch);
                this.schemas.get(externalSource.internalPath).push(this.schema);
                this.visitClassDeclaration(node);
                return;
              }
              const schem = this.schemas
                .get(externalSource.internalPath)
                ?.find((s) => s.name == extendsName);
              if (!schem)
                throw new Error(
                  "Could not find schema for " +
                    externalSearch.name.text +
                    " in " +
                    externalSource.internalPath,
                );
              schema.deps.push(schem);
              schema.parent = schem;
            }
          }
        }
      }
      if (schema.parent?.members) {
        for (let i = schema.parent.members.length - 1; i >= 0; i--) {
          const replace = schema.members.find(
            (v) => v.name == schema.parent?.members[i]?.name,
          );
          if (!replace) {
            members.unshift(schema.parent?.members[i]!.node);
          }
        }
      }
    }

    const getUnknownTypes = (type: string, types: string[] = []): string[] => {
      type = stripNull(type);
      type = this.resolveType(type, source);
      if (type.startsWith("Array<")) {
        return getUnknownTypes(type.slice(6, -1));
      } else if (type.startsWith("StaticArray<")) {
        return getUnknownTypes(type.slice(12, -1));
      } else if (type.startsWith("Set<")) {
        return getUnknownTypes(type.slice(4, -1));
      } else if (type.startsWith("Map<")) {
        const parts = type.slice(4, -1).split(",");
        return getUnknownTypes(parts[0]) || getUnknownTypes(parts[1]);
      } else if (isString(type) || isPrimitive(type)) {
        return types;
      } else if (
        ["JSON.Box", "JSON.Obj", "JSON.Value", "JSON.Raw"].includes(type)
      ) {
        return types;
      } else if (
        node.isGeneric &&
        node.typeParameters.some((p) => p.name.text == type)
      ) {
        return types;
      } else if (type == node.name.text) {
        return types;
      }
      types.push(type);
      return types;
    };

    for (const member of members) {
      const type = toString(member.type);
      const unknown = getUnknownTypes(type);

      for (const unknownType of unknown) {
        const depSearch = schema.deps.find((v) => v.name == unknownType);
        if (depSearch) {
          if (DEBUG > 0)
            console.log(
              "Found " +
                unknownType +
                " in dependencies of " +
                source.internalPath,
            );
          if (!schema.deps.some((v) => v.name == depSearch.name)) {
            schema.deps.push(depSearch);
          }
        } else {
          const internalSearch = source.getClass(unknownType);
          if (internalSearch) {
            if (DEBUG > 0)
              console.log(
                "Found " +
                  unknownType +
                  " internally from " +
                  source.internalPath,
              );
            if (!this.visitedClasses.has(source.getFullPath(internalSearch))) {
              this.visitClassDeclarationRef(internalSearch);
              const internalSchema = this.schemas
                .get(internalSearch.range.source.internalPath)
                ?.find((s) => s.name == unknownType);
              // if (internalSchema.custom) mem.custom = true;
              schema.deps.push(internalSchema);
              this.schemas
                .get(internalSearch.range.source.internalPath)
                .push(this.schema);
              this.visitClassDeclaration(node);
              return;
            }
            const schem = this.schemas
              .get(internalSearch.range.source.internalPath)
              ?.find((s) => s.name == unknownType);
            if (!schem)
              throw new Error(
                "Could not find schema for " +
                  internalSearch.name.text +
                  " in " +
                  internalSearch.range.source.internalPath,
              );
            schema.deps.push(schem);
          } else {
            const externalSearch = source.getImportedClass(
              unknownType,
              this.parser,
            );
            if (externalSearch) {
              if (DEBUG > 0)
                console.log(
                  "Found " +
                    externalSearch.name.text +
                    " externally from " +
                    source.internalPath,
                );
              const externalSource = this.sources.get(
                externalSearch.range.source,
              );
              if (
                !this.visitedClasses.has(
                  externalSource.getFullPath(externalSearch),
                )
              ) {
                this.visitClassDeclarationRef(externalSearch);
                const externalSchema = this.schemas
                  .get(externalSource.internalPath)
                  ?.find((s) => s.name == unknownType);
                schema.deps.push(externalSchema);
                this.schemas.get(externalSource.internalPath).push(this.schema);
                this.visitClassDeclaration(node);
                return;
              }
              const schem = this.schemas
                .get(externalSource.internalPath)
                ?.find((s) => s.name == unknownType);
              if (!schem)
                throw new Error(
                  "Could not find schema for " +
                    externalSearch.name.text +
                    " in " +
                    externalSource.internalPath,
                );
              schema.deps.push(schem);
            }
          }
        }
      }
    }

    this.schemas.get(source.internalPath).push(schema);
    this.schema = schema;
    this.visitedClasses.add(fullClassPath);

    let SERIALIZE = "__SERIALIZE(ptr: usize): void {\n";
    let INITIALIZE = "@inline __INITIALIZE(): this {\n";
    let DESERIALIZE =
      "__DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {\n";
    let DESERIALIZE_CUSTOM = "";
    let SERIALIZE_CUSTOM = "";

    if (DEBUG > 0)
      console.log(
        "Created schema: " +
          this.schema.name +
          " in file " +
          source.normalizedPath +
          (this.schema.deps.length
            ? " with dependencies:\n  " +
              this.schema.deps.map((v) => v.name).join("\n  ")
            : ""),
      );

    if (serializers.length > 1)
      throwError(
        "Multiple serializers detected for class " +
          node.name.text +
          " but schemas can only have one serializer!",
        serializers[1].range,
      );
    if (deserializers.length > 1)
      throwError(
        "Multiple deserializers detected for class " +
          node.name.text +
          " but schemas can only have one deserializer!",
        deserializers[1].range,
      );

    if (serializers.length) {
      this.schema.custom = true;
      const serializer = serializers[0];
      const hasCall = CustomTransform.hasCall(serializer);

      CustomTransform.visit(serializer);

      // if (!serializer.signature.parameters.length) throwError("Could not find any parameters in custom serializer for " + this.schema.name + ". Serializers must have one parameter like 'serializer(self: " + this.schema.name + "): string {}'", serializer.range);
      if (serializer.signature.parameters.length > 1)
        throwError(
          "Found too many parameters in custom serializer for " +
            this.schema.name +
            ", but serializers can only accept one parameter of type '" +
            this.schema.name +
            "'!",
          serializer.signature.parameters[1].range,
        );
      if (
        serializer.signature.parameters.length > 0 &&
        (<NamedTypeNode>serializer.signature.parameters[0].type).name.identifier
          .text != node.name.text &&
        (<NamedTypeNode>serializer.signature.parameters[0].type).name.identifier
          .text != "this"
      )
        throwError(
          "Type of parameter for custom serializer does not match! It should be 'string'either be 'this' or '" +
            this.schema.name +
            "'",
          serializer.signature.parameters[0].type.range,
        );
      if (
        !serializer.signature.returnType ||
        !(<NamedTypeNode>(
          serializer.signature.returnType
        )).name.identifier.text.includes("string")
      )
        throwError(
          "Could not find valid return type for serializer in " +
            this.schema.name +
            "!. Set the return type to type 'string' and try again",
          serializer.signature.returnType.range,
        );

      if (
        !serializer.decorators.some(
          (v) => (<IdentifierExpression>v.name).text == "inline",
        )
      ) {
        serializer.decorators.push(
          Node.createDecorator(
            Node.createIdentifierExpression("inline", serializer.range),
            null,
            serializer.range,
          ),
        );
      }
      SERIALIZE_CUSTOM += "  __SERIALIZE(ptr: usize): void {\n";
      SERIALIZE_CUSTOM +=
        "    const data = this." +
        serializer.name.text +
        "(" +
        (serializer.signature.parameters.length ? "this" : "") +
        ");\n";
      if (hasCall) SERIALIZE_CUSTOM += "    bs.resetState();\n";
      SERIALIZE_CUSTOM += "    const dataSize = data.length << 1;\n";
      SERIALIZE_CUSTOM +=
        "    memory.copy(bs.offset, changetype<usize>(data), dataSize);\n";
      SERIALIZE_CUSTOM += "    bs.offset += dataSize;\n";
      SERIALIZE_CUSTOM += "  }\n";
    }

    if (deserializers.length) {
      this.schema.custom = true;
      const deserializer = deserializers[0];
      if (!deserializer.signature.parameters.length)
        throwError(
          "Could not find any parameters in custom deserializer for " +
            this.schema.name +
            ". Deserializers must have one parameter like 'deserializer(data: string): " +
            this.schema.name +
            " {}'",
          deserializer.range,
        );
      if (deserializer.signature.parameters.length > 1)
        throwError(
          "Found too many parameters in custom deserializer for " +
            this.schema.name +
            ", but deserializers can only accept one parameter of type 'string'!",
          deserializer.signature.parameters[1].range,
        );
      if (
        (<NamedTypeNode>deserializer.signature.parameters[0].type).name
          .identifier.text != "string"
      )
        throwError(
          "Type of parameter for custom deserializer does not match! It must be 'string'",
          deserializer.signature.parameters[0].type.range,
        );
      if (
        !deserializer.signature.returnType ||
        !(
          (<NamedTypeNode>(
            deserializer.signature.returnType
          )).name.identifier.text.includes(this.schema.name) ||
          (<NamedTypeNode>(
            deserializer.signature.returnType
          )).name.identifier.text.includes("this")
        )
      )
        throwError(
          "Could not find valid return type for deserializer in " +
            this.schema.name +
            "!. Set the return type to type '" +
            this.schema.name +
            "' or 'this' and try again",
          deserializer.signature.returnType.range,
        );

      if (
        !deserializer.decorators.some(
          (v) => (<IdentifierExpression>v.name).text == "inline",
        )
      ) {
        deserializer.decorators.push(
          Node.createDecorator(
            Node.createIdentifierExpression("inline", deserializer.range),
            null,
            deserializer.range,
          ),
        );
      }

      DESERIALIZE_CUSTOM +=
        "  __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {\n";
      DESERIALIZE_CUSTOM +=
        "    return inline.always(this." +
        deserializer.name.text +
        "(JSON.Util.ptrToStr(srcStart, srcEnd)));\n";
      DESERIALIZE_CUSTOM += "  }\n";
    }

    if (!members.length && !deserializers.length && !serializers.length) {
      this.generateEmptyMethods(node);
      return;
    }

    for (const member of members) {
      if (!member.type) throwError("Fields must be strongly typed", node.range);
      let type = toString(member.type!);
      type = this.resolveType(type, source);

      const name = member.name;
      const value = member.initializer ? toString(member.initializer!) : null;

      // if (!this.isValidType(type, node)) throwError("Invalid Type. " + type + " is not a JSON-compatible type. Either decorate it with @omit, set it to private, or remove it.", member.type.range);

      if (type.startsWith("(") && type.includes("=>")) continue;

      const mem = new Property();
      mem.parent = this.schema;
      mem.name = name.text;
      mem.type = type;
      mem.value = value;
      mem.node = member;
      mem.byteSize = sizeof(mem.type);

      this.schema.byteSize += mem.byteSize;

      if (member.decorators) {
        for (const decorator of member.decorators) {
          const decoratorName = (decorator.name as IdentifierExpression).text
            .toLowerCase()
            .trim();
          switch (decoratorName) {
            case "alias": {
              const arg = decorator.args[0];
              if (
                !arg ||
                (arg.kind != NodeKind.Literal &&
                  (arg as LiteralExpression).literalKind !=
                    LiteralKind.String &&
                  (arg as LiteralExpression).literalKind !=
                    LiteralKind.Integer &&
                  (arg as LiteralExpression).literalKind != LiteralKind.Float)
              )
                throwError(
                  "@alias must have an argument of type string or number",
                  member.range,
                );
              mem.alias = (
                arg as
                  | StringLiteralExpression
                  | IntegerLiteralExpression
                  | FloatLiteralExpression
              ).value.toString();
              break;
            }
            case "omitif": {
              const arg = decorator.args[0];
              if (!decorator.args?.length)
                throwError(
                  "@omitif must have an argument or callback that resolves to type bool",
                  member.range,
                );
              mem.flags.set(PropertyFlags.OmitIf, arg);
              this.schema.static = false;
              break;
            }
            case "omitnull": {
              if (isPrimitive(type)) {
                throwError(
                  "@omitnull cannot be used on primitive types!",
                  member.range,
                );
              } else if (!member.type.isNullable) {
                throwError(
                  "@omitnull cannot be used on non-nullable types!",
                  member.range,
                );
              }
              mem.flags.set(PropertyFlags.OmitNull, null);
              this.schema.static = false;
              break;
            }
            case "stringmode": {
              if (!isString(type)) {
                throwError(
                  "@stringmode can only be used with fields of type string",
                  member.range,
                );
              }
              mem.stringHint = parseStringHintDecorator(
                decorator.args,
                member.range,
              );
              break;
            }
            case "stringnoescape":
            case "stringascii":
            case "stringfast": {
              if (!isString(type)) {
                throwError(
                  "String hint decorators can only be used with fields of type string",
                  member.range,
                );
              }
              mem.stringHint = StringHintMode.NoEscape;
              break;
            }
            case "stringraw": {
              if (!isString(type)) {
                throwError(
                  "String hint decorators can only be used with fields of type string",
                  member.range,
                );
              }
              mem.stringHint = StringHintMode.Raw;
              break;
            }
          }
        }
      }

      this.schema.members.push(mem);
    }

    if (!this.schema.static)
      this.schema.members = sortMembers(this.schema.members);

    indent = "  ";

    if (this.schema.static == false) {
      if (
        this.schema.members.some((v) => v.flags.has(PropertyFlags.OmitNull))
      ) {
        SERIALIZE += indent + "let block: usize = 0;\n";
      }
      this.schema.byteSize += 2;
      SERIALIZE += indent + "store<u16>(bs.offset, 123, 0); // {\n";
      SERIALIZE += indent + "bs.offset += 2;\n";
    }

    const isPure = this.schema.static;
    let isRegular = isPure;
    let isFirst = true;

    const isFastSerializableStringMember = (member: Property): boolean => {
      if (member.generic || member.custom) return false;
      if (member.node.type.isNullable) return false;
      return isString(member.type);
    };

    const getSerializeValueCall = (
      member: Property,
      fieldName: string,
    ): string => {
      const loadExpr = `load<${member.type}>(ptr, offsetof<this>(${JSON.stringify(fieldName)}))`;
      if (!isFastSerializableStringMember(member)) {
        return `JSON.__serialize<${member.type}>(${loadExpr});\n`;
      }

      if (member.stringHint === StringHintMode.Raw) {
        return `this.__SERIALIZE_STRING_RAW(changetype<string>(${loadExpr}));\n`;
      }

      if (member.stringHint === StringHintMode.NoEscape) {
        return `this.__SERIALIZE_STRING_NOESCAPE(changetype<string>(${loadExpr}));\n`;
      }

      return `JSON.__serialize<${member.type}>(${loadExpr});\n`;
    };

    for (let i = 0; i < this.schema.members.length; i++) {
      const member = this.schema.members[i];
      const aliasName = JSON.stringify(member.alias || member.name);
      const realName = member.name;
      const isLast = i == this.schema.members.length - 1;

      if (member.value) {
        if (
          member.value != "null" &&
          member.value != "0" &&
          member.value != "0.0" &&
          member.value != "false"
        ) {
          INITIALIZE += `  store<${member.type}>(changetype<usize>(this), ${member.value}, offsetof<this>(${JSON.stringify(member.name)}));\n`;
        }
      } else if (member.generic) {
        INITIALIZE += `  if (isManaged<nonnull<${member.type}>>() || isReference<nonnull<${member.type}>>()) {\n`;
        INITIALIZE += `    store<${member.type}>(changetype<usize>(this), changetype<nonnull<${member.type}>>(__new(offsetof<nonnull<${member.type}>>(), idof<nonnull<${member.type}>>())), offsetof<this>(${JSON.stringify(member.name)}));\n`;
        INITIALIZE += `    if (isDefined(this.${member.name}.__INITIALIZE)) changetype<nonnull<${member.type}>>(this.${member.name}).__INITIALIZE();\n`;
        INITIALIZE += `  }\n`;
      } else if (!member.node.type.isNullable) {
        if (this.getSchema(member.type)) {
          INITIALIZE += `  store<${member.type}>(changetype<usize>(this), changetype<nonnull<${member.type}>>(__new(offsetof<nonnull<${member.type}>>(), idof<nonnull<${member.type}>>())).__INITIALIZE(), offsetof<this>(${JSON.stringify(member.name)}));\n`;
        } else if (member.type.startsWith("Array<")) {
          INITIALIZE += `  store<${member.type}>(changetype<usize>(this), [], offsetof<this>(${JSON.stringify(member.name)}));\n`;
        } else if (member.type.startsWith("Map<")) {
          INITIALIZE += `  store<${member.type}>(changetype<usize>(this), new ${member.type}(), offsetof<this>(${JSON.stringify(member.name)}));\n`;
        } else if (member.type.startsWith("Set<")) {
          INITIALIZE += `  store<${member.type}>(changetype<usize>(this), new ${member.type}(), offsetof<this>(${JSON.stringify(member.name)}));\n`;
        } else if (member.type.startsWith("StaticArray<")) {
          // StaticArray needs special handling - we can't pre-initialize it without knowing the size
          // Leave it uninitialized, it will be set during deserialization
        } else if (member.type == "string" || member.type == "String") {
          INITIALIZE += `  store<${member.type}>(changetype<usize>(this), "", offsetof<this>(${JSON.stringify(member.name)}));\n`;
        }
      }

      const SIMD_ENABLED = this.program.options.hasFeature(Feature.Simd);
      if (
        !isRegular &&
        !member.flags.has(PropertyFlags.OmitIf) &&
        !member.flags.has(PropertyFlags.OmitNull)
      )
        isRegular = true;
      if (isRegular && isPure) {
        const keyPart = (isFirst ? "{" : ",") + aliasName + ":";
        this.schema.byteSize += keyPart.length << 1;
        SERIALIZE += this.getStores(keyPart, SIMD_ENABLED)
          .map((v) => indent + v + "\n")
          .join("");
        SERIALIZE += indent + getSerializeValueCall(member, realName);
        if (isFirst) isFirst = false;
      } else if (isRegular && !isPure) {
        const keyPart = (isFirst ? "" : ",") + aliasName + ":";
        this.schema.byteSize += keyPart.length << 1;
        SERIALIZE += this.getStores(keyPart, SIMD_ENABLED)
          .map((v) => indent + v + "\n")
          .join("");
        SERIALIZE += indent + getSerializeValueCall(member, realName);
        if (isFirst) isFirst = false;
      } else {
        if (member.flags.has(PropertyFlags.OmitNull)) {
          SERIALIZE +=
            indent +
            `if ((block = load<usize>(ptr, offsetof<this>(${JSON.stringify(realName)}))) !== 0) {\n`;
          indentInc();
          const keyPart = aliasName + ":";
          this.schema.byteSize += keyPart.length << 1;
          SERIALIZE += this.getStores(keyPart, SIMD_ENABLED)
            .map((v) => indent + v + "\n")
            .join("");
          SERIALIZE += indent + getSerializeValueCall(member, realName);

          if (!isLast) {
            this.schema.byteSize += 2;
            SERIALIZE += indent + `store<u16>(bs.offset, 44, 0); // ,\n`;
            SERIALIZE += indent + `bs.offset += 2;\n`;
          }

          indentDec();
          this.schema.byteSize += 2;
          SERIALIZE += indent + `}\n`;
        } else if (member.flags.has(PropertyFlags.OmitIf)) {
          if (
            member.flags.get(PropertyFlags.OmitIf).kind == NodeKind.Function
          ) {
            const arg = member.flags.get(
              PropertyFlags.OmitIf,
            ) as FunctionExpression;
            arg.declaration.signature.parameters[0].type = Node.createNamedType(
              Node.createSimpleTypeName("this", node.range),
              null,
              false,
              node.range,
            );
            // @ts-expect-error: Type should be guaranteed
            arg.declaration.signature.returnType.name =
              Node.createSimpleTypeName(
                "boolean",
                (arg.declaration.signature.returnType as NamedTypeNode).name
                  .range,
              );
            SERIALIZE +=
              indent +
              `if (!(${toString(member.flags.get(PropertyFlags.OmitIf))})(this)) {\n`;
          } else {
            SERIALIZE +=
              indent +
              `if (${toString(member.flags.get(PropertyFlags.OmitIf))}) {\n`;
          }
          indentInc();
          SERIALIZE += this.getStores(aliasName + ":", SIMD_ENABLED)
            .map((v) => indent + v + "\n")
            .join("");
          SERIALIZE += indent + getSerializeValueCall(member, realName);

          if (!isLast) {
            this.schema.byteSize += 2;
            SERIALIZE += indent + `store<u16>(bs.offset, 44, 0); // ,\n`;
            SERIALIZE += indent + `bs.offset += 2;\n`;
          }

          indentDec();
          SERIALIZE += indent + `}\n`;
        }
      }
    }

    const sortedMembers: {
      string: Property[];
      number: Property[];
      boolean: Property[];
      null: Property[];
      array: Property[];
      object: Property[];
    } = {
      string: [],
      number: [],
      boolean: [],
      null: [],
      array: [],
      object: [],
    };

    for (const member of this.schema.members) {
      const type = stripNull(member.type);
      if (member.custom || member.generic) {
        sortedMembers.string.push(member);
        sortedMembers.number.push(member);
        sortedMembers.object.push(member);
        sortedMembers.array.push(member);
        sortedMembers.boolean.push(member);
        sortedMembers.null.push(member);
      } else {
        if (member.node.type.isNullable) sortedMembers.null.push(member);
        if (isString(type) || type == "JSON.Raw")
          sortedMembers.string.push(member);
        else if (isBoolean(type) || type.startsWith("JSON.Box<bool"))
          sortedMembers.boolean.push(member);
        else if (
          isPrimitive(type) ||
          type.startsWith("JSON.Box<") ||
          isEnum(
            type,
            this.sources.get(this.schema.node.range.source),
            this.parser,
          )
        )
          sortedMembers.number.push(member);
        else if (isArray(type)) sortedMembers.array.push(member);
        else sortedMembers.object.push(member);
        // else console.warn("Could not determine type " + type + " for member " + member.name + " in class " + this.schema.name);
      }
    }

    indent = "";

    DESERIALIZE += indent + "  let keyStart: usize = 0;\n";
    DESERIALIZE += indent + "  let keyEnd: usize = 0;\n";
    DESERIALIZE += indent + "  let isKey = false;\n";
    if (!STRICT || sortedMembers.object.length || sortedMembers.array.length)
      DESERIALIZE += indent + "  let depth: i32 = 0;\n";
    DESERIALIZE += indent + "  let lastIndex: usize = 0;\n\n";

    DESERIALIZE +=
      indent +
      "  while (srcStart < srcEnd && JSON.Util.isSpace(load<u16>(srcStart))) srcStart += 2;\n";
    DESERIALIZE +=
      indent +
      "  while (srcEnd > srcStart && JSON.Util.isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;\n";
    DESERIALIZE +=
      indent +
      '  if (srcStart - srcEnd == 0) throw new Error("Input string had zero length or was all whitespace");\n';
    DESERIALIZE +=
      indent +
      "  if (load<u16>(srcStart) != 123) throw new Error(\"Expected '{' at start of object at position \" + (srcEnd - srcStart).toString());\n";
    DESERIALIZE +=
      indent +
      "  if (load<u16>(srcEnd - 2) != 125) throw new Error(\"Expected '}' at end of object at position \" + (srcEnd - srcStart).toString());\n";
    DESERIALIZE += indent + "  srcStart += 2;\n\n";

    DESERIALIZE += indent + "  while (srcStart < srcEnd) {\n";
    DESERIALIZE += indent + "    let code = load<u16>(srcStart);\n";
    DESERIALIZE +=
      indent +
      "    while (JSON.Util.isSpace(code)) code = load<u16>(srcStart += 2);\n";
    DESERIALIZE += indent + "    if (keyStart == 0) {\n";
    DESERIALIZE +=
      indent + "      if (code == 34 && load<u16>(srcStart - 2) !== 92) {\n";
    DESERIALIZE += indent + "        if (isKey) {\n";
    DESERIALIZE += indent + "          keyStart = lastIndex;\n";
    DESERIALIZE += indent + "          keyEnd = srcStart;\n";
    if (DEBUG > 1)
      DESERIALIZE +=
        indent +
        '          console.log("Key: " + JSON.Util.ptrToStr(keyStart, keyEnd));\n';
    DESERIALIZE +=
      indent +
      "          while (JSON.Util.isSpace((code = load<u16>((srcStart += 2))))) {}\n";
    DESERIALIZE +=
      indent +
      "          if (code !== 58) throw new Error(\"Expected ':' after key at position \" + (srcEnd - srcStart).toString());\n";
    DESERIALIZE += indent + "          isKey = false;\n";
    DESERIALIZE += indent + "        } else {\n";
    DESERIALIZE += indent + "          isKey = true;\n";
    DESERIALIZE += indent + "          lastIndex = srcStart + 2;\n";
    DESERIALIZE += indent + "        }\n";
    DESERIALIZE += indent + "      }\n";
    DESERIALIZE += indent + "      srcStart += 2;\n";
    DESERIALIZE += indent + "    } else {\n";
    // if (shouldGroup) DESERIALIZE += "    const keySize = keyEnd - keyStart;\n";

    const groupMembers = (members: Property[]): Property[][] => {
      // const customMembers = this.schema.members.filter((m) => m.flags.has(PropertyFlags.Custom));
      // console.log("Custom members: ", customMembers.map((m) => m.name));

      // members.push(...customMembers)

      const groups = new Map<number, Property[]>();

      for (const member of members) {
        const name = member.alias || member.name;
        const length = name.length;

        if (!groups.has(length)) {
          groups.set(length, []);
        }

        groups.get(length)!.push(member);
      }

      return [...groups.values()]
        .map((group) =>
          group.sort((a, b) => {
            const aLen = (a.alias || a.name).length;
            const bLen = (b.alias || b.name).length;
            return aLen - bLen;
          }),
        )
        .sort((a, b) => b.length - a.length);
    };

    // const groupMembers = (members: Property[]): Property[][] => {
    //   const customMembers = this.schema.members.filter((m) =>
    //     m.flags.has(PropertyFlags.Custom)
    //   );
    //   console.log("Custom members: ", customMembers.map((m) => m.name));

    //   const customSet = new Set(customMembers);
    //   members = members.filter((m) => !customSet.has(m));
    //   members.push(...customMembers);

    //   const groups = new Map<number, Property[]>();

    //   for (const member of members) {
    //     const name = member.alias || member.name;
    //     const length = name.length;

    //     if (!groups.has(length)) {
    //       groups.set(length, []);
    //     }

    //     groups.get(length)!.push(member);
    //   }

    //   return [...groups.entries()]
    //     .sort(([a], [b]) => a - b)
    //     .map(([_, group]) => {
    //       const regulars = group.filter((m) => !customSet.has(m));
    //       const customs = group.filter((m) => customSet.has(m));

    //       const sortByLength = (a: Property, b: Property) =>
    //         (a.alias || a.name).length - (b.alias || b.name).length;

    //       return [...regulars.sort(sortByLength), ...customs.sort(sortByLength)];
    //     });
    // };

    const generateGroups = (
      members: Property[],
      cb: (group: Property[]) => void,
      type: "string" | "array" | "object" | "number" | "boolean" | "null",
    ) => {
      if (!members.length) {
        if (STRICT) {
          DESERIALIZE +=
            indent +
            '              throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
        } else {
          if (type == "string") {
            DESERIALIZE += indent + "              srcStart += 4;\n";
          } else if (type == "boolean" || type == "null" || type == "number") {
            DESERIALIZE += indent + "              srcStart += 2;\n";
          }

          DESERIALIZE += indent + "              keyStart = 0;\n";
          if (
            type == "string" ||
            type == "object" ||
            type == "array" ||
            type == "number"
          )
            DESERIALIZE += indent + "              break;\n";
        }
      } else {
        const groups = groupMembers(members);
        DESERIALIZE += "     switch (<u32>keyEnd - <u32>keyStart) {\n";

        for (const group of groups) {
          const groupLen = (group[0].alias || group[0].name).length << 1;
          DESERIALIZE += "           case " + groupLen + ": {\n";
          cb(group);
          DESERIALIZE += "\n            }\n";
        }

        DESERIALIZE += "    default: {\n";
        if (STRICT) {
          DESERIALIZE +=
            indent +
            '              throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
        } else {
          if (type == "string") {
            DESERIALIZE += indent + "              srcStart += 4;\n";
          } else if (type == "boolean" || type == "null" || type == "number") {
            DESERIALIZE += indent + "              srcStart += 2;\n";
          }
          DESERIALIZE += indent + "              keyStart = 0;\n";
          if (
            type == "string" ||
            type == "object" ||
            type == "array" ||
            type == "number"
          )
            DESERIALIZE += indent + "              break;\n";
        }
        DESERIALIZE += "        }\n";
        DESERIALIZE += "    }\n";
        if (type != "null" && type != "boolean") DESERIALIZE += "  break;\n";
      }
    };

    const generateConsts = (members: Property[]): void => {
      if (members.some((m) => (m.alias || m.name).length << 1 == 2)) {
        DESERIALIZE += "            const code16 = load<u16>(keyStart);\n";
      }
      if (members.some((m) => (m.alias || m.name).length << 1 == 4)) {
        DESERIALIZE += "            const code32 = load<u32>(keyStart);\n";
      }
      if (members.some((m) => (m.alias || m.name).length << 1 == 6)) {
        DESERIALIZE +=
          "            const code48 = load<u64>(keyStart) & 0x0000FFFFFFFFFFFF;\n";
      }
      if (members.some((m) => (m.alias || m.name).length << 1 == 8)) {
        DESERIALIZE += "            const code64 = load<u64>(keyStart);\n";
      }
      if (members.some((m) => (m.alias || m.name).length << 1 > 8)) {
        DESERIALIZE += toMemCDecl(
          Math.max(...members.map((m) => (m.alias || m.name).length << 1)),
          "            ",
        );
      }
    };

    const isFastStringMember = (member: Property): boolean => {
      if (member.generic || member.custom) return false;
      return isString(member.type);
    };

    const getStringValueStoreStatement = (member: Property): string => {
      const offsetExpr = `offsetof<this>(${JSON.stringify(member.name)})`;
      const outExpr = "changetype<usize>(out)";
      if (!isFastStringMember(member)) {
        return (
          "store<" +
          member.type +
          ">(" +
          outExpr +
          ", JSON.__deserialize<" +
          member.type +
          ">(lastIndex, srcStart + 2), " +
          offsetExpr +
          ");\n"
        );
      }

      const helperName =
        member.stringHint === StringHintMode.Default
          ? "__DESERIALIZE_STRING_FAST_PLACEHOLDER"
          : "__DESERIALIZE_STRING_COPY_FAST";

      return (
        "if (!this." +
        helperName +
        "(lastIndex, srcStart, " +
        outExpr +
        " + " +
        offsetExpr +
        ")) store<" +
        member.type +
        ">(" +
        outExpr +
        ", changetype<" +
        member.type +
        ">(JSON.__deserialize<string>(lastIndex, srcStart + 2)), " +
        offsetExpr +
        ");\n"
      );
    };

    let mbElse = "      ";
    if (!STRICT || sortedMembers.string.length) {
      // generateGroups(sortedMembers.string, generateComparisons)
      DESERIALIZE += mbElse + "if (code == 34) {\n";
      DESERIALIZE += "          lastIndex = srcStart;\n";
      DESERIALIZE += "          srcStart += 2;\n";
      DESERIALIZE += "          while (srcStart < srcEnd) {\n";
      DESERIALIZE += "            const code = load<u16>(srcStart);\n";
      DESERIALIZE +=
        "            if (code == 34 && load<u16>(srcStart - 2) !== 92) {\n";
      if (DEBUG > 1)
        DESERIALIZE +=
          '              console.log("Value (string, ' +
          ++id +
          '): " + JSON.Util.ptrToStr(lastIndex, srcStart + 2));';
      generateGroups(
        sortedMembers.string,
        (group) => {
          generateConsts(group);
          const first = group[0];
          const fName = first.alias || first.name;
          DESERIALIZE +=
            indent +
            "            if (" +
            (first.generic ? "isString<" + first.type + ">() && " : "") +
            getComparison(fName) +
            ") { // " +
            fName +
            "\n";
          DESERIALIZE +=
            indent + "              " + getStringValueStoreStatement(first);
          DESERIALIZE += indent + "              srcStart += 4;\n";
          DESERIALIZE += indent + "              keyStart = 0;\n";
          DESERIALIZE += indent + "              break;\n";
          DESERIALIZE += indent + "            }";

          for (let i = 1; i < group.length; i++) {
            const mem = group[i];
            const memName = mem.alias || mem.name;
            DESERIALIZE +=
              indent +
              " else if (" +
              (mem.generic ? "isString<" + mem.type + ">() && " : "") +
              getComparison(memName) +
              ") { // " +
              memName +
              "\n";
            DESERIALIZE +=
              indent + "              " + getStringValueStoreStatement(mem);
            DESERIALIZE += indent + "              srcStart += 4;\n";
            DESERIALIZE += indent + "              keyStart = 0;\n";
            DESERIALIZE += indent + "              break;\n";
            DESERIALIZE += indent + "            }";
          }

          if (STRICT) {
            DESERIALIZE += " else {\n";
            DESERIALIZE +=
              indent +
              '              throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
            DESERIALIZE += indent + "            }\n";
          } else {
            DESERIALIZE += " else {\n";
            DESERIALIZE += indent + "              srcStart += 4;\n";
            DESERIALIZE += indent + "              keyStart = 0;\n";
            DESERIALIZE += indent + "              break;\n";
            DESERIALIZE += indent + "            }\n";
          }
        },
        "string",
      );
      DESERIALIZE += "          }\n"; // Close break char check
      DESERIALIZE += "          srcStart += 2;\n";
      DESERIALIZE += "        }\n"; // Close char scan loop
      DESERIALIZE += "      }\n"; // Close first char check
      mbElse = " else ";
    }

    if (!STRICT || sortedMembers.number.length) {
      DESERIALIZE += mbElse + "if (code - 48 <= 9 || code == 45) {\n";
      DESERIALIZE += "        lastIndex = srcStart;\n";
      DESERIALIZE += "        srcStart += 2;\n";
      DESERIALIZE += "        while (srcStart < srcEnd) {\n";
      DESERIALIZE += "          const code = load<u16>(srcStart);\n";
      DESERIALIZE +=
        "          if (code == 44 || code == 125 || JSON.Util.isSpace(code)) {\n";
      if (DEBUG > 1)
        DESERIALIZE +=
          '              console.log("Value (number, ' +
          ++id +
          '): " + JSON.Util.ptrToStr(lastIndex, srcStart));';
      // DESERIALIZE += "          console.log(JSON.Util.ptrToStr(keyStart,keyEnd) + \" = \" + load<u16>(keyStart).toString() + \" val \" + JSON.Util.ptrToStr(lastIndex, srcStart));\n";

      generateGroups(
        sortedMembers.number,
        (group) => {
          generateConsts(group);
          const first = group[0];
          const fName = first.alias || first.name;
          DESERIALIZE +=
            indent +
            "            if (" +
            (first.generic
              ? "(isInteger<" +
                first.type +
                ">() || isFloat<" +
                first.type +
                ">()) && "
              : "") +
            getComparison(fName) +
            ") { // " +
            fName +
            "\n";
          DESERIALIZE +=
            indent +
            "              store<" +
            first.type +
            ">(changetype<usize>(out), JSON.__deserialize<" +
            first.type +
            ">(lastIndex, srcStart), offsetof<this>(" +
            JSON.stringify(first.name) +
            "));\n";
          DESERIALIZE += indent + "              srcStart += 2;\n";
          DESERIALIZE += indent + "              keyStart = 0;\n";
          DESERIALIZE += indent + "              break;\n";
          DESERIALIZE += indent + "            }";

          for (let i = 1; i < group.length; i++) {
            const mem = group[i];
            const memName = mem.alias || mem.name;
            DESERIALIZE +=
              indent +
              " else if (" +
              (mem.generic
                ? "(isInteger<" +
                  mem.type +
                  ">() || isFloat<" +
                  mem.type +
                  ">()) && "
                : "") +
              getComparison(memName) +
              ") { // " +
              memName +
              "\n";
            DESERIALIZE +=
              indent +
              "              store<" +
              mem.type +
              ">(changetype<usize>(out), JSON.__deserialize<" +
              mem.type +
              ">(lastIndex, srcStart), offsetof<this>(" +
              JSON.stringify(mem.name) +
              "));\n";
            DESERIALIZE += indent + "              srcStart += 2;\n";
            DESERIALIZE += indent + "              keyStart = 0;\n";
            DESERIALIZE += indent + "              break;\n";
            DESERIALIZE += indent + "            }";
          }

          if (STRICT) {
            DESERIALIZE += " else {\n";
            DESERIALIZE +=
              indent +
              '              throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
            DESERIALIZE += indent + "            }\n";
          } else {
            DESERIALIZE += " else {\n";
            DESERIALIZE += indent + "              srcStart += 2;\n";
            DESERIALIZE += indent + "              keyStart = 0;\n";
            DESERIALIZE += indent + "              break;\n";
            DESERIALIZE += indent + "            }\n";
          }
        },
        "number",
      );
      DESERIALIZE += "          }\n"; // Close break char check
      DESERIALIZE += "          srcStart += 2;\n";
      DESERIALIZE += "        }\n"; // Close char scan loop
      DESERIALIZE += "      }"; // Close first char check
      mbElse = " else ";
    }

    if (!STRICT || sortedMembers.object.length) {
      DESERIALIZE += mbElse + "if (code == 123) {\n";
      DESERIALIZE += "        lastIndex = srcStart;\n";
      DESERIALIZE += "        depth++;\n";
      DESERIALIZE += "        srcStart += 2;\n";
      DESERIALIZE += "        while (srcStart < srcEnd) {\n";
      DESERIALIZE += "          const code = load<u16>(srcStart);\n";
      DESERIALIZE += "          if (code == 34) {\n";
      DESERIALIZE += "            srcStart += 2;\n";
      DESERIALIZE +=
        "            while (!(load<u16>(srcStart) == 34 && load<u16>(srcStart - 2) != 92)) srcStart += 2;\n";
      DESERIALIZE += "          } else if (code == 125) {\n";
      DESERIALIZE += "            if (--depth == 0) {\n";
      DESERIALIZE += "              srcStart += 2;\n";
      if (DEBUG > 1)
        DESERIALIZE +=
          '              console.log("Value (object, ' +
          ++id +
          '): " + JSON.Util.ptrToStr(lastIndex, srcStart));';

      indent = "  ";
      generateGroups(
        sortedMembers.object,
        (group) => {
          generateConsts(group);
          const first = group[0];
          const fName = first.alias || first.name;
          DESERIALIZE +=
            indent +
            "            if (" +
            (first.generic ? "isDefined(out.__DESERIALIZE) &&" : "") +
            getComparison(fName) +
            ") { // " +
            fName +
            "\n";
          DESERIALIZE +=
            indent +
            "              store<" +
            first.type +
            ">(changetype<usize>(out), JSON.__deserialize<" +
            first.type +
            ">(lastIndex, srcStart), offsetof<this>(" +
            JSON.stringify(first.name) +
            "));\n";
          DESERIALIZE += indent + "              keyStart = 0;\n";
          DESERIALIZE += indent + "              break;\n";
          DESERIALIZE += indent + "            }";

          for (let i = 1; i < group.length; i++) {
            const mem = group[i];
            const memName = mem.alias || mem.name;
            DESERIALIZE +=
              indent +
              " else if (" +
              (mem.generic ? "isDefined(out.__DESERIALIZE) &&" : "") +
              getComparison(memName) +
              ") { // " +
              memName +
              "\n";
            DESERIALIZE +=
              indent +
              "              store<" +
              mem.type +
              ">(changetype<usize>(out), JSON.__deserialize<" +
              mem.type +
              ">(lastIndex, srcStart), offsetof<this>(" +
              JSON.stringify(mem.name) +
              "));\n";
            DESERIALIZE += indent + "              keyStart = 0;\n";
            DESERIALIZE += indent + "              break;\n";
            DESERIALIZE += indent + "            }";
          }

          if (STRICT) {
            DESERIALIZE += " else {\n";
            DESERIALIZE +=
              indent +
              '              throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
            DESERIALIZE += indent + "            }\n";
          } else {
            DESERIALIZE += " else {\n";
            DESERIALIZE += indent + "              keyStart = 0;\n";
            DESERIALIZE += indent + "              break;\n";
            DESERIALIZE += indent + "            }\n";
          }
        },
        "object",
      );
      indent = "";

      DESERIALIZE += "            }\n"; // Close break char check
      DESERIALIZE += "          } else if (code == 123) depth++;\n";
      DESERIALIZE += "          srcStart += 2;\n";
      DESERIALIZE += "        }\n"; // Close char scan loop
      DESERIALIZE += "      }"; // Close first char check
      mbElse = " else ";
    }
    if (!STRICT || sortedMembers.array.length) {
      DESERIALIZE += mbElse + "if (code == 91) {\n";
      DESERIALIZE += "        lastIndex = srcStart;\n";
      DESERIALIZE += "        depth++;\n";
      DESERIALIZE += "        srcStart += 2;\n";
      DESERIALIZE += "        while (srcStart < srcEnd) {\n";
      DESERIALIZE += "          const code = load<u16>(srcStart);\n";
      DESERIALIZE += "          if (code == 34) {\n";
      DESERIALIZE += "            srcStart += 2;\n";
      DESERIALIZE +=
        "            while (!(load<u16>(srcStart) == 34 && load<u16>(srcStart - 2) != 92)) srcStart += 2;\n";
      DESERIALIZE += "          } else if (code == 93) {\n";
      DESERIALIZE += "            if (--depth == 0) {\n";
      DESERIALIZE += "              srcStart += 2;\n";
      if (DEBUG > 1)
        DESERIALIZE +=
          '              console.log("Value (object, ' +
          ++id +
          '): " + JSON.Util.ptrToStr(lastIndex, srcStart));';

      indent = "  ";
      generateGroups(
        sortedMembers.array,
        (group) => {
          generateConsts(group);
          const first = group[0];
          const fName = first.alias || first.name;
          DESERIALIZE +=
            indent +
            "            if (" +
            (first.generic ? "isArray<" + first.type + ">() && " : "") +
            getComparison(fName) +
            ") { // " +
            fName +
            "\n";
          DESERIALIZE +=
            indent +
            "              store<" +
            first.type +
            ">(changetype<usize>(out), JSON.__deserialize<" +
            first.type +
            ">(lastIndex, srcStart), offsetof<this>(" +
            JSON.stringify(first.name) +
            "));\n";
          DESERIALIZE += indent + "              keyStart = 0;\n";
          DESERIALIZE += indent + "              break;\n";
          DESERIALIZE += indent + "            }";

          for (let i = 1; i < group.length; i++) {
            const mem = group[i];
            const memName = mem.alias || mem.name;
            DESERIALIZE +=
              indent +
              " else if (" +
              (mem.generic ? "isArray" + mem.type + ">() && " : "") +
              getComparison(memName) +
              ") { // " +
              memName +
              "\n";
            DESERIALIZE +=
              indent +
              "              store<" +
              mem.type +
              ">(changetype<usize>(out), JSON.__deserialize<" +
              mem.type +
              ">(lastIndex, srcStart), offsetof<this>(" +
              JSON.stringify(mem.name) +
              "));\n";
            DESERIALIZE += indent + "              keyStart = 0;\n";
            DESERIALIZE += indent + "              break;\n";
            DESERIALIZE += indent + "            }";
          }

          if (STRICT) {
            DESERIALIZE += " else {\n";
            DESERIALIZE +=
              indent +
              '              throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
            DESERIALIZE += indent + "            }\n";
          } else {
            DESERIALIZE += " else {\n";
            DESERIALIZE += indent + "              keyStart = 0;\n";
            DESERIALIZE += indent + "              break;\n";
            DESERIALIZE += indent + "            }\n";
          }
        },
        "array",
      );
      indent = "";

      DESERIALIZE += "            }\n"; // Close break char check
      DESERIALIZE += "          } else if (code == 91) depth++;\n";
      DESERIALIZE += "          srcStart += 2;\n";
      DESERIALIZE += "        }\n"; // Close char scan loop
      DESERIALIZE += "      }"; // Close first char check
      mbElse = " else ";
    }

    if (!STRICT || sortedMembers.boolean.length) {
      // TRUE
      DESERIALIZE += mbElse + "if (code == 116) {\n";

      DESERIALIZE +=
        "        if (load<u64>(srcStart) == 28429475166421108) {\n";
      DESERIALIZE += "          srcStart += 8;\n";
      if (DEBUG > 1)
        DESERIALIZE +=
          '              console.log("Value (bool, ' +
          ++id +
          '): " + JSON.Util.ptrToStr(lastIndex, srcStart - 8));';
      generateGroups(
        sortedMembers.boolean,
        (group) => {
          generateConsts(group);
          const first = group[0];
          const fName = first.alias || first.name;
          DESERIALIZE +=
            indent +
            "          if (" +
            (first.generic ? "isBoolean<" + first.type + ">() && " : "") +
            getComparison(fName) +
            ") { // " +
            fName +
            "\n";
          DESERIALIZE +=
            indent +
            "            store<boolean>(changetype<usize>(out), true, offsetof<this>(" +
            JSON.stringify(first.name) +
            "));\n";
          DESERIALIZE += indent + "            srcStart += 2;\n";
          DESERIALIZE += indent + "            keyStart = 0;\n";
          DESERIALIZE += indent + "            break;\n";
          DESERIALIZE += indent + "          }";

          for (let i = 1; i < group.length; i++) {
            const mem = group[i];
            const memName = mem.alias || mem.name;
            DESERIALIZE +=
              indent +
              " else if (" +
              (mem.generic ? "isBoolean<" + mem.type + ">() && " : "") +
              getComparison(memName) +
              ") { // " +
              memName +
              "\n";
            DESERIALIZE +=
              indent +
              "            store<boolean>(changetype<usize>(out), true, offsetof<this>(" +
              JSON.stringify(mem.name) +
              "));\n";
            DESERIALIZE += indent + "            srcStart += 2;\n";
            DESERIALIZE += indent + "            keyStart = 0;\n";
            DESERIALIZE += indent + "            break;\n";
            DESERIALIZE += indent + "          }";
          }

          if (STRICT) {
            DESERIALIZE += " else {\n";
            DESERIALIZE +=
              indent +
              '            throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
            DESERIALIZE += indent + "          }\n";
          } else {
            DESERIALIZE += " else { \n";
            DESERIALIZE += indent + "              srcStart += 2;\n";
            DESERIALIZE += indent + "              keyStart = 0;\n";
            DESERIALIZE += indent + "              break;\n";
            DESERIALIZE += indent + "            }\n";
          }
        },
        "boolean",
      );

      DESERIALIZE += "        }"; // Close first char check
      DESERIALIZE += " else {\n";
      DESERIALIZE +=
        "          throw new Error(\"Expected to find 'true' but found '\" + JSON.Util.ptrToStr(lastIndex, srcStart) + \"' instead at position \" + (srcEnd - srcStart).toString());\n";
      DESERIALIZE += "        }"; // Close error check
      DESERIALIZE += "\n      }"; // Close first char check

      mbElse = " else ";

      // FALSE
      DESERIALIZE += mbElse + "if (code == 102) {\n";

      DESERIALIZE +=
        "        if (load<u64>(srcStart, 2) == 28429466576093281) {\n";
      DESERIALIZE += "          srcStart += 10;\n";
      if (DEBUG > 1)
        DESERIALIZE +=
          '              console.log("Value (bool, ' +
          ++id +
          '): " + JSON.Util.ptrToStr(lastIndex, srcStart - 10));';
      generateGroups(
        sortedMembers.boolean,
        (group) => {
          generateConsts(group);

          const first = group[0];
          const fName = first.alias || first.name;
          DESERIALIZE +=
            indent +
            "          if (" +
            (first.generic ? "isBoolean<" + first.type + ">() && " : "") +
            getComparison(fName) +
            ") { // " +
            fName +
            "\n";
          DESERIALIZE +=
            indent +
            "            store<boolean>(changetype<usize>(out), false, offsetof<this>(" +
            JSON.stringify(first.name) +
            "));\n";
          DESERIALIZE += indent + "            srcStart += 2;\n";
          DESERIALIZE += indent + "            keyStart = 0;\n";
          DESERIALIZE += indent + "            break;\n";
          DESERIALIZE += indent + "          }";

          for (let i = 1; i < group.length; i++) {
            const mem = group[i];
            const memName = mem.alias || mem.name;
            DESERIALIZE +=
              indent +
              " else if (" +
              (mem.generic ? "isBoolean<" + mem.type + ">() && " : "") +
              getComparison(memName) +
              ") { // " +
              memName +
              "\n";
            DESERIALIZE +=
              indent +
              "            store<boolean>(changetype<usize>(out), false, offsetof<this>(" +
              JSON.stringify(mem.name) +
              "));\n";
            DESERIALIZE += indent + "            srcStart += 2;\n";
            DESERIALIZE += indent + "            keyStart = 0;\n";
            DESERIALIZE += indent + "            break;\n";
            DESERIALIZE += indent + "          }";
          }

          if (STRICT) {
            DESERIALIZE += " else {\n";
            DESERIALIZE +=
              indent +
              '            throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
            DESERIALIZE += indent + "          }\n";
          } else {
            DESERIALIZE += " else { \n";
            DESERIALIZE += indent + "              srcStart += 2;\n";
            DESERIALIZE += indent + "              keyStart = 0;\n";
            DESERIALIZE += indent + "              break;\n";
            DESERIALIZE += indent + "            }\n";
          }
        },
        "boolean",
      );

      DESERIALIZE += "        }"; // Close first char check
      DESERIALIZE += " else {\n";
      DESERIALIZE +=
        "          throw new Error(\"Expected to find 'false' but found '\" + JSON.Util.ptrToStr(lastIndex, srcStart) + \"' instead at position \" + (srcEnd - srcStart).toString());\n";
      DESERIALIZE += "        }"; // Close error check
      DESERIALIZE += "\n      }"; // Close first char check

      mbElse = " else ";
    }

    if (!STRICT || sortedMembers.null.length) {
      DESERIALIZE += mbElse + "if (code == 110) {\n";

      DESERIALIZE +=
        "        if (load<u64>(srcStart) == 30399761348886638) {\n";
      DESERIALIZE += "          srcStart += 8;\n";
      if (DEBUG > 1)
        DESERIALIZE +=
          '              console.log("Value (null, ' +
          ++id +
          '): " + JSON.Util.ptrToStr(lastIndex, srcStart - 8));';
      generateGroups(
        sortedMembers.null,
        (group) => {
          generateConsts(group);

          const first = group[0];
          const fName = first.alias || first.name;
          DESERIALIZE +=
            indent +
            "          if (" +
            (first.generic ? "isNullable<" + first.type + ">() && " : "") +
            getComparison(fName) +
            ") { // " +
            fName +
            "\n";
          DESERIALIZE +=
            indent +
            "            store<usize>(changetype<usize>(out), 0, offsetof<this>(" +
            JSON.stringify(first.name) +
            "));\n";
          DESERIALIZE += indent + "            srcStart += 2;\n";
          DESERIALIZE += indent + "            keyStart = 0;\n";
          DESERIALIZE += indent + "            break;\n";
          DESERIALIZE += indent + "          }";

          for (let i = 1; i < group.length; i++) {
            const mem = group[i];
            const memName = mem.alias || mem.name;
            DESERIALIZE +=
              indent +
              " else if (" +
              (mem.generic ? "isNullable<" + mem.type + ">() && " : "") +
              getComparison(memName) +
              ") { // " +
              memName +
              "\n";
            DESERIALIZE +=
              indent +
              "            store<usize>(changetype<usize>(out), 0, offsetof<this>(" +
              JSON.stringify(mem.name) +
              "));\n";
            DESERIALIZE += indent + "            srcStart += 2;\n";
            DESERIALIZE += indent + "            keyStart = 0;\n";
            DESERIALIZE += indent + "            break;\n";
            DESERIALIZE += indent + "          }";
          }

          if (STRICT) {
            DESERIALIZE += " else {\n";
            DESERIALIZE +=
              indent +
              '            throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
            DESERIALIZE += indent + "          }\n";
          } else {
            DESERIALIZE += " else { \n";
            DESERIALIZE += indent + "              srcStart += 2;\n";
            DESERIALIZE += indent + "              keyStart = 0;\n";
            DESERIALIZE += indent + "              break;\n";
            DESERIALIZE += indent + "            }\n";
          }
        },
        "null",
      );

      DESERIALIZE += "        }"; // Close first char check
      DESERIALIZE += "\n      }"; // Close first char check

      mbElse = " else ";
    }

    DESERIALIZE += " else {\n";
    DESERIALIZE += "   srcStart += 2;\n";
    DESERIALIZE += "   keyStart = 0;\n";
    DESERIALIZE += "}\n";
    DESERIALIZE += "\n    }\n"; // Close value portion

    indentDec();
    DESERIALIZE += `  }\n`; // Close while loop
    indentDec();
    DESERIALIZE += `  return out;\n}\n`; // Close function

    indent = "  ";

    this.schema.byteSize += 2;
    SERIALIZE += indent + "store<u16>(bs.offset, 125, 0); // }\n";
    SERIALIZE += indent + "bs.offset += 2;\n";
    SERIALIZE += "}";

    SERIALIZE =
      SERIALIZE.slice(0, 32) +
      indent +
      "bs.proposeSize(" +
      this.schema.byteSize +
      ");\n" +
      SERIALIZE.slice(32);

    INITIALIZE += "  return this;\n";
    INITIALIZE += "}";

    const needsSerializeRawStringHelper = this.schema.members.some(
      (member) =>
        isFastSerializableStringMember(member) &&
        member.stringHint === StringHintMode.Raw,
    );
    const needsSerializeNoEscapeStringHelper = this.schema.members.some(
      (member) =>
        isFastSerializableStringMember(member) &&
        member.stringHint === StringHintMode.NoEscape,
    );

    const serializeStringHelpers: string[] =
      !SERIALIZE_CUSTOM &&
      (needsSerializeRawStringHelper || needsSerializeNoEscapeStringHelper)
        ? [
            "@inline __SERIALIZE_STRING_RAW(src: string): void {\n" +
              "  const srcStart = changetype<usize>(src);\n" +
              "  const srcSize = src.length << 1;\n" +
              "  bs.proposeSize(srcSize + 4);\n" +
              "  store<u16>(bs.offset, 34);\n" +
              "  memory.copy(bs.offset + 2, srcStart, srcSize);\n" +
              "  store<u16>(bs.offset + srcSize + 2, 34);\n" +
              "  bs.offset += srcSize + 4;\n" +
              "}\n",
            ...(needsSerializeNoEscapeStringHelper
              ? [
                  "@inline __SERIALIZE_STRING_NOESCAPE(src: string): void {\n" +
                    "  const srcStart = changetype<usize>(src);\n" +
                    "  const srcEnd = srcStart + (src.length << 1);\n" +
                    "  let ptr = srcStart;\n" +
                    "  while (ptr < srcEnd) {\n" +
                    "    const code = load<u16>(ptr);\n" +
                    "    if (code == 34 || code == 92 || code < 32 || (code >= 55296 && code <= 57343)) {\n" +
                    "      JSON.__serialize<string>(src);\n" +
                    "      return;\n" +
                    "    }\n" +
                    "    ptr += 2;\n" +
                    "  }\n" +
                    "  this.__SERIALIZE_STRING_RAW(src);\n" +
                    "}\n",
                ]
              : []),
          ]
        : [];

    const hasFastStringMembers = this.schema.members.some((member) =>
      isFastStringMember(member),
    );
    const canEmitCanonicalFastPath =
      !DESERIALIZE_CUSTOM &&
      this.schema.static &&
      this.schema.members.every(
        (member) =>
          !member.flags.has(PropertyFlags.OmitIf) &&
          !member.flags.has(PropertyFlags.OmitNull),
      );

    const integerTypes = new Set([
      "u8",
      "u16",
      "u32",
      "u64",
      "usize",
      "i8",
      "i16",
      "i32",
      "i64",
      "isize",
    ]);
    const unsignedIntegerTypes = new Set(["u8", "u16", "u32", "u64", "usize"]);
    const canEmitIntegerStringUltraFastPath =
      canEmitCanonicalFastPath &&
      this.schema.members.length > 0 &&
      this.schema.members.length <= 30 &&
      this.schema.members.every((member) => {
        if (member.node.type.isNullable || member.generic || member.custom) {
          return false;
        }
        const memberType = stripNull(member.type);
        return (
          isString(member.type) ||
          integerTypes.has(memberType) ||
          isBoolean(memberType)
        );
      });

    const generatePrefixCheck = (prefix: string, ptrVar: string): string => {
      const chunks = strToNum(prefix, false);
      let offset = 0;
      let out = "";

      for (const [size, value] of chunks) {
        const offsetExpr = offset > 0 ? `, ${offset}` : "";
        if (size === "u64") {
          out += `  if (load<u64>(${ptrVar}${offsetExpr}) != ${value}) return false;\n`;
          offset += 8;
        } else if (size === "u32") {
          out += `  if (load<u32>(${ptrVar}${offsetExpr}) != ${value}) return false;\n`;
          offset += 4;
        } else if (size === "u16") {
          out += `  if (load<u16>(${ptrVar}${offsetExpr}) != ${value}) return false;\n`;
          offset += 2;
        }
      }

      if (offset > 0) out += `  ${ptrVar} += ${offset};\n`;
      return out;
    };

    const getFastStringDecoderName = (
      mode: "NAIVE" | "SWAR" | "SIMD",
      member: Property,
    ): string => {
      if (member.stringHint === StringHintMode.Default) {
        return `__DESERIALIZE_STRING_${mode}_FAST`;
      }
      return "__DESERIALIZE_STRING_COPY_FAST";
    };

    const generateFastValueParse = (
      mode: "NAIVE" | "SWAR" | "SIMD",
      member: Property,
    ): string => {
      const fieldPtrExpr = `changetype<usize>(out) + offsetof<this>(${JSON.stringify(member.name)})`;
      const memberType = stripNull(member.type);
      let out = "";

      if (isString(member.type)) {
        out += "  const valueEnd = this.__FAST_FIND_VALUE_END(ptr, srcEnd);\n";
        out += "  if (valueEnd <= ptr || load<u16>(ptr) != 34) return false;\n";
        out += "  const quoteEnd = valueEnd - 2;\n";
        out += `  if (!this.${getFastStringDecoderName(mode, member)}(ptr, quoteEnd, ${fieldPtrExpr})) return false;\n`;
        out += "  ptr = valueEnd;\n";
        return out;
      }

      if (isBoolean(memberType)) {
        out += "  if (load<u64>(ptr) == 28429475166421108) {\n";
        out += `    store<boolean>(${fieldPtrExpr}, true);\n`;
        out += "    ptr += 8;\n";
        out += "  } else if (load<u64>(ptr, 2) == 28429466576093281) {\n";
        out += `    store<boolean>(${fieldPtrExpr}, false);\n`;
        out += "    ptr += 10;\n";
        out += "  } else {\n";
        out += "    return false;\n";
        out += "  }\n";
        return out;
      }

      if (member.node.type.isNullable) {
        out += "  const valueEnd = this.__FAST_FIND_VALUE_END(ptr, srcEnd);\n";
        out += "  if (valueEnd <= ptr) return false;\n";
        out +=
          "  if (valueEnd - ptr == 8 && load<u64>(ptr) == 30399761348886638) {\n";
        out += `    store<usize>(${fieldPtrExpr}, 0);\n`;
        out += "    ptr = valueEnd;\n";
        out += "  } else {\n";
        out += `    store<${member.type}>(${fieldPtrExpr}, JSON.__deserialize<${member.type}>(ptr, valueEnd));\n`;
        out += "    ptr = valueEnd;\n";
        out += "  }\n";
        return out;
      }

      if (integerTypes.has(memberType)) {
        const unsignedGuard = unsignedIntegerTypes.has(memberType)
          ? "  if (isNegative) return false;\n"
          : "";
        out += "  let isNegative = false;\n";
        out += "  if (load<u16>(ptr) == 45) {\n";
        out += "    isNegative = true;\n";
        out += "    ptr += 2;\n";
        out += "  }\n";
        out += "  let digit = <u32>load<u16>(ptr) - 48;\n";
        out += "  if (digit > 9) return false;\n";
        out += "  let value: i64 = digit;\n";
        out += "  ptr += 2;\n";
        out += "  while (ptr < srcEnd) {\n";
        out += "    digit = <u32>load<u16>(ptr) - 48;\n";
        out += "    if (digit > 9) break;\n";
        out += "    value = value * 10 + digit;\n";
        out += "    ptr += 2;\n";
        out += "  }\n";
        out += unsignedGuard;
        out += "  if (isNegative) value = -value;\n";
        out += `  store<${member.type}>(${fieldPtrExpr}, <${member.type}>value);\n`;
        return out;
      }

      out += "  const valueEnd = this.__FAST_FIND_VALUE_END(ptr, srcEnd);\n";
      out += "  if (valueEnd <= ptr) return false;\n";
      out += `  store<${member.type}>(${fieldPtrExpr}, JSON.__deserialize<${member.type}>(ptr, valueEnd));\n`;
      out += "  ptr = valueEnd;\n";
      return out;
    };

    const generateCanonicalFastPathMethod = (
      mode: "NAIVE" | "SWAR" | "SIMD",
    ): string => {
      let out = `@inline __DESERIALIZE_${mode}_FAST_PATH<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): bool {\n`;
      out +=
        "  while (srcStart < srcEnd && JSON.Util.isSpace(load<u16>(srcStart))) srcStart += 2;\n";
      out +=
        "  while (srcEnd > srcStart && JSON.Util.isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;\n";
      out += "  if (srcStart >= srcEnd) return false;\n";
      out +=
        "  if (load<u16>(srcStart) != 123 || load<u16>(srcEnd - 2) != 125) return false;\n";
      out += "  let ptr = srcStart + 2;\n";

      for (let i = 0; i < this.schema.members.length; i++) {
        const member = this.schema.members[i];
        const key = JSON.stringify(member.alias || member.name);
        const prefix = key + ":";
        out += generatePrefixCheck(prefix, "ptr");
        out += "{\n";
        out += generateFastValueParse(mode, member);
        out += "}\n";

        if (i < this.schema.members.length - 1) {
          out += "  if (load<u16>(ptr) != 44) return false;\n";
          out += "  ptr += 2;\n";
        }
      }

      out += "  if (load<u16>(ptr) != 125) return false;\n";
      out += "  ptr += 2;\n";
      out += "  return ptr == srcEnd;\n";
      out += "}\n";
      return out;
    };

    const generateUltraIntStringFastValueParse = (
      mode: "NAIVE" | "SWAR" | "SIMD",
      member: Property,
      index: number,
      fieldPtrExpr: string,
      isLastMember: boolean,
    ): string => {
      const memberType = stripNull(member.type);
      let out = "";

      if (isString(member.type)) {
        if (isLastMember) {
          out += "  if (load<u16>(ptr) != 34) return false;\n";
          out += `  const quoteEnd${index} = srcEnd - 4;\n`;
          out += `  if (quoteEnd${index} <= ptr || load<u16>(quoteEnd${index}) != 34) return false;\n`;
          out += `  if (!this.${getFastStringDecoderName(mode, member)}(ptr, quoteEnd${index}, ${fieldPtrExpr})) return false;\n`;
          out += `  ptr = quoteEnd${index} + 2;\n`;
        } else {
          out += `  const valueEnd${index} = this.__PARSE_STRING_${mode}_FASTPATH(ptr, srcEnd, ${fieldPtrExpr});\n`;
          out += `  if (valueEnd${index} == 0) return false;\n`;
          out += `  ptr = valueEnd${index};\n`;
        }
        return out;
      }

      if (isBoolean(memberType)) {
        out += "  const boolCode = load<u16>(ptr);\n";
        out +=
          "  if (boolCode == 116 && load<u64>(ptr) == 0x65007500720074) {\n";
        out += `    store<boolean>(${fieldPtrExpr}, true);\n`;
        out += "    ptr += 8;\n";
        out +=
          "  } else if (boolCode == 102 && load<u64>(ptr, 2) == 0x650073006c0061) {\n";
        out += `    store<boolean>(${fieldPtrExpr}, false);\n`;
        out += "    ptr += 10;\n";
        out += "  } else {\n";
        out += "    return false;\n";
        out += "  }\n";
        return out;
      }

      if (unsignedIntegerTypes.has(memberType)) {
        out += "  if (load<u16>(ptr) == 45) return false;\n";
      } else {
        out += `  let isNegative${index} = false;\n`;
        out += "  if (load<u16>(ptr) == 45) {\n";
        out += `    isNegative${index} = true;\n`;
        out += "    ptr += 2;\n";
        out += "  }\n";
      }

      out += `  let digit${index} = <u32>load<u16>(ptr) - 48;\n`;
      out += `  if (digit${index} > 9) return false;\n`;
      out += `  let value${index}: i64 = digit${index};\n`;
      out += "  ptr += 2;\n";
      out += "  while (ptr < srcEnd) {\n";
      out += `    digit${index} = <u32>load<u16>(ptr) - 48;\n`;
      out += `    if (digit${index} > 9) break;\n`;
      out += `    value${index} = value${index} * 10 + digit${index};\n`;
      out += "    ptr += 2;\n";
      out += "  }\n";
      if (!unsignedIntegerTypes.has(memberType)) {
        out += `  if (isNegative${index}) value${index} = -value${index};\n`;
      }
      out += `  store<${member.type}>(${fieldPtrExpr}, <${member.type}>value${index});\n`;
      return out;
    };

    const generateUltraIntStringSlowValueParse = (
      mode: "NAIVE" | "SWAR" | "SIMD",
      member: Property,
      index: number,
      fieldPtrExpr: string,
    ): string => {
      const memberType = stripNull(member.type);
      let out = "";

      if (isString(member.type)) {
        out += "  if (load<u16>(ptr) != 34) return false;\n";
        out += `  const quoteEnd${index} = this.__FAST_FIND_STRING_END(ptr, srcEnd);\n`;
        out += `  if (quoteEnd${index} == 0) return false;\n`;
        out += `  if (!this.${getFastStringDecoderName(mode, member)}(ptr, quoteEnd${index}, ${fieldPtrExpr})) return false;\n`;
        out += `  ptr = quoteEnd${index} + 2;\n`;
        return out;
      }

      if (isBoolean(memberType)) {
        out += "  const boolCode = load<u16>(ptr);\n";
        out +=
          "  if (boolCode == 116 && load<u64>(ptr) == 0x65007500720074) {\n";
        out += `    store<boolean>(${fieldPtrExpr}, true);\n`;
        out += "    ptr += 8;\n";
        out +=
          "  } else if (boolCode == 102 && load<u64>(ptr, 2) == 0x650073006c0061) {\n";
        out += `    store<boolean>(${fieldPtrExpr}, false);\n`;
        out += "    ptr += 10;\n";
        out += "  } else {\n";
        out += "    return false;\n";
        out += "  }\n";
        return out;
      }

      if (unsignedIntegerTypes.has(memberType)) {
        out += "  if (load<u16>(ptr) == 45) return false;\n";
      } else {
        out += `  let isNegative${index} = false;\n`;
        out += "  if (load<u16>(ptr) == 45) {\n";
        out += `    isNegative${index} = true;\n`;
        out += "    ptr += 2;\n";
        out += "  }\n";
      }

      out += `  let digit${index} = <u32>load<u16>(ptr) - 48;\n`;
      out += `  if (digit${index} > 9) return false;\n`;
      out += `  let value${index}: i64 = digit${index};\n`;
      out += "  ptr += 2;\n";
      out += "  while (ptr < srcEnd) {\n";
      out += `    digit${index} = <u32>load<u16>(ptr) - 48;\n`;
      out += `    if (digit${index} > 9) break;\n`;
      out += `    value${index} = value${index} * 10 + digit${index};\n`;
      out += "    ptr += 2;\n";
      out += "  }\n";
      if (!unsignedIntegerTypes.has(memberType)) {
        out += `  if (isNegative${index}) value${index} = -value${index};\n`;
      }
      out += `  store<${member.type}>(${fieldPtrExpr}, <${member.type}>value${index});\n`;
      return out;
    };

    const generateUltraIntStringFastPathMethod = (
      mode: "NAIVE" | "SWAR" | "SIMD",
    ): string => {
      let out = `@inline __DESERIALIZE_INTSTR_${mode}_FAST_PATH<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): bool {\n`;
      out += "  if (srcStart >= srcEnd) return false;\n";
      out +=
        "  if (load<u16>(srcStart) != 123 || load<u16>(srcEnd - 2) != 125) return false;\n";
      out += "  const dst = changetype<usize>(out);\n";
      for (let i = 0; i < this.schema.members.length; i++) {
        const member = this.schema.members[i];
        out += `  const outPtr${i} = dst + offsetof<this>(${JSON.stringify(member.name)});\n`;
      }
      out += "  let ptr = srcStart + 2;\n";

      for (let i = 0; i < this.schema.members.length; i++) {
        const member = this.schema.members[i];
        const key = JSON.stringify(member.alias || member.name);
        const prefix = key + ":";
        out += generatePrefixCheck(prefix, "ptr");
        out += "{\n";
        out += generateUltraIntStringFastValueParse(
          mode,
          member,
          i,
          `outPtr${i}`,
          i === this.schema.members.length - 1,
        );
        out += "}\n";

        if (i < this.schema.members.length - 1) {
          out += "  if (load<u16>(ptr) != 44) return false;\n";
          out += "  ptr += 2;\n";
        } else {
          out += "  if (load<u16>(ptr) != 125) return false;\n";
          out += "  ptr += 2;\n";
        }
      }

      out += "  return ptr == srcEnd;\n";
      out += "}\n";
      return out;
    };

    const DESERIALIZE_DISPATCH =
      "@inline __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {\n" +
      "  if (JSON_MODE === 1) {\n" +
      "    return this.__DESERIALIZE_SIMD(srcStart, srcEnd, out);\n" +
      "  } else if (JSON_MODE === 0) {\n" +
      "    return this.__DESERIALIZE_SWAR(srcStart, srcEnd, out);\n" +
      "  }\n" +
      "  return this.__DESERIALIZE_NAIVE(srcStart, srcEnd, out);\n" +
      "}\n";

    const DESERIALIZE_NAIVE = DESERIALIZE.replace(
      "__DESERIALIZE<__JSON_T>",
      "__DESERIALIZE_NAIVE<__JSON_T>",
    ).replaceAll(
      "__DESERIALIZE_STRING_FAST_PLACEHOLDER",
      "__DESERIALIZE_STRING_NAIVE_FAST",
    );

    const DESERIALIZE_SWAR = DESERIALIZE.replace(
      "__DESERIALIZE<__JSON_T>",
      "__DESERIALIZE_SWAR<__JSON_T>",
    ).replaceAll(
      "__DESERIALIZE_STRING_FAST_PLACEHOLDER",
      "__DESERIALIZE_STRING_SWAR_FAST",
    );

    const DESERIALIZE_SIMD = DESERIALIZE.replace(
      "__DESERIALIZE<__JSON_T>",
      "__DESERIALIZE_SIMD<__JSON_T>",
    ).replaceAll(
      "__DESERIALIZE_STRING_FAST_PLACEHOLDER",
      "__DESERIALIZE_STRING_SIMD_FAST",
    );

    const useCanonicalFastPath =
      canEmitCanonicalFastPath && !canEmitIntegerStringUltraFastPath;
    const hasUltraFastStringMembers =
      canEmitIntegerStringUltraFastPath &&
      this.schema.members.some((member) => isString(member.type));
    const needsFastStringEndHelper = canEmitIntegerStringUltraFastPath;
    const allSeenMask = canEmitIntegerStringUltraFastPath
      ? (1 << this.schema.members.length) - 1
      : 0;

    const generateUltraSlowPathUnknownSkip = (
      indent: string = "          ",
    ): string => {
      return (
        indent +
        "const valueEnd = this.__FAST_SKIP_VALUE(ptr, srcEnd);\n" +
        indent +
        "if (valueEnd == 0) return false;\n" +
        indent +
        "ptr = valueEnd;\n"
      );
    };

    const generateUltraSlowPathKeyDispatch = (
      mode: "NAIVE" | "SWAR" | "SIMD",
    ): string => {
      const groups = new Map<number, { member: Property; index: number }[]>();
      for (let i = 0; i < this.schema.members.length; i++) {
        const member = this.schema.members[i];
        const keyBytes = (member.alias || member.name).length << 1;
        const current = groups.get(keyBytes);
        const entry = { member, index: i };
        if (current) current.push(entry);
        else groups.set(keyBytes, [entry]);
      }

      const sortedGroups = [...groups.entries()].sort((a, b) => b[0] - a[0]);
      let out = "    switch (<u32>keyEnd - <u32>keyStart) {\n";

      for (const [keyBytes, entries] of sortedGroups) {
        out += `      case ${keyBytes}: {\n`;
        if (keyBytes == 2) {
          out += "        const code16 = load<u16>(keyStart);\n";
        } else if (keyBytes == 4) {
          out += "        const code32 = load<u32>(keyStart);\n";
        } else if (keyBytes == 6) {
          out +=
            "        const code48 = load<u64>(keyStart) & 0x0000FFFFFFFFFFFF;\n";
        } else if (keyBytes == 8) {
          out += "        const code64 = load<u64>(keyStart);\n";
        } else {
          out += toMemCDecl(keyBytes, "        ");
        }

        for (let i = 0; i < entries.length; i++) {
          const { member, index } = entries[i];
          const key = member.alias || member.name;
          const prefix = i == 0 ? "        if" : " else if";
          out += `${prefix} (${getComparison(key)}) {\n`;
          out += generateUltraIntStringSlowValueParse(
            mode,
            member,
            index,
            `outPtr${index}`,
          );
          out += `          seenMask |= ${1 << index};\n`;
          out += "        }";
        }

        out += " else {\n";
        out += generateUltraSlowPathUnknownSkip("          ");
        out += "        }\n";
        out += "        break;\n";
        out += "      }\n";
      }

      out += "      default: {\n";
      out += generateUltraSlowPathUnknownSkip("        ");
      out += "        break;\n";
      out += "      }\n";
      out += "    }\n";
      return out;
    };

    const generateUltraSlowPathMethod = (
      mode: "NAIVE" | "SWAR" | "SIMD",
    ): string => {
      let out = `@inline __DESERIALIZE_INTSTR_${mode}_SLOW_PATH<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): bool {\n`;
      out += "  const dst = changetype<usize>(out);\n";
      for (let i = 0; i < this.schema.members.length; i++) {
        const member = this.schema.members[i];
        out += `  const outPtr${i} = dst + offsetof<this>(${JSON.stringify(member.name)});\n`;
      }
      out += "  let ptr = this.__FAST_SKIP_SPACE(srcStart, srcEnd);\n";
      out += "  if (ptr >= srcEnd || load<u16>(ptr) != 123) return false;\n";
      out += "  ptr += 2;\n";
      out += "  let seenMask: u32 = 0;\n";
      out += "  while (ptr < srcEnd) {\n";
      out += "    ptr = this.__FAST_SKIP_SPACE(ptr, srcEnd);\n";
      out += "    if (ptr >= srcEnd) return false;\n";
      out += "    const code = load<u16>(ptr);\n";
      out += "    if (code == 125) {\n";
      out += "      ptr = this.__FAST_SKIP_SPACE(ptr + 2, srcEnd);\n";
      out += `      return ptr == srcEnd && seenMask == ${allSeenMask};\n`;
      out += "    }\n";
      out += "    if (code != 34) return false;\n";
      out += "    const keyStart = ptr + 2;\n";
      out += "    const keyEnd = this.__FAST_FIND_STRING_END(ptr, srcEnd);\n";
      out += "    if (keyEnd == 0) return false;\n";
      out += "    ptr = this.__FAST_SKIP_SPACE(keyEnd + 2, srcEnd);\n";
      out += "    if (ptr >= srcEnd || load<u16>(ptr) != 58) return false;\n";
      out += "    ptr = this.__FAST_SKIP_SPACE(ptr + 2, srcEnd);\n";
      out += "    if (ptr >= srcEnd) return false;\n";
      out += generateUltraSlowPathKeyDispatch(mode);
      out += "    ptr = this.__FAST_SKIP_SPACE(ptr, srcEnd);\n";
      out += "    if (ptr >= srcEnd) return false;\n";
      out += "    const sep = load<u16>(ptr);\n";
      out += "    if (sep == 44) {\n";
      out += "      ptr += 2;\n";
      out += "      continue;\n";
      out += "    }\n";
      out += "    if (sep == 125) {\n";
      out += "      ptr = this.__FAST_SKIP_SPACE(ptr + 2, srcEnd);\n";
      out += `      return ptr == srcEnd && seenMask == ${allSeenMask};\n`;
      out += "    }\n";
      out += "    return false;\n";
      out += "  }\n";
      out += "  return false;\n";
      out += "}\n";
      return out;
    };

    const generateUltraFastStringParseMethod = (
      mode: "NAIVE" | "SWAR" | "SIMD",
    ): string => {
      let out = `@inline __PARSE_STRING_${mode}_FASTPATH(srcStart: usize, srcEnd: usize, dstFieldPtr: usize): usize {\n`;
      out += "  if (load<u16>(srcStart) != 34) return 0;\n";
      out += "  const payloadStart = srcStart + 2;\n";
      out += "  let ptr = payloadStart;\n";
      if (mode === "SWAR") {
        out += "  const srcEnd8 = srcEnd - 8;\n";
        out += "  while (ptr <= srcEnd8) {\n";
        out += "    const block = load<u64>(ptr);\n";
        out +=
          "    if ((this.__BACKSLASH_MASK_UNSAFE(block) | this.__QUOTE_MASK_UNSAFE(block)) == 0) {\n";
        out += "      ptr += 8;\n";
        out += "      continue;\n";
        out += "    }\n";
        out += "    break;\n";
        out += "  }\n";
      } else if (mode === "SIMD") {
        out += "  const srcEnd16 = srcEnd - 16;\n";
        out += "  const splatBackSlash = i16x8.splat(92);\n";
        out += "  const splatQuote = i16x8.splat(34);\n";
        out += "  while (ptr <= srcEnd16) {\n";
        out += "    const block = load<v128>(ptr);\n";
        out +=
          "    const mask = i16x8.bitmask(i16x8.eq(block, splatBackSlash)) | i16x8.bitmask(i16x8.eq(block, splatQuote));\n";
        out += "    if (mask == 0) {\n";
        out += "      ptr += 16;\n";
        out += "      continue;\n";
        out += "    }\n";
        out += "    break;\n";
        out += "  }\n";
      }
      out += "  while (ptr < srcEnd) {\n";
      out += "    const code = load<u16>(ptr);\n";
      out += "    if (code == 92) return 0;\n";
      out += "    if (code == 34) {\n";
      out +=
        "      this.__COPY_STRING_TO_FIELD(dstFieldPtr, payloadStart, <u32>(ptr - payloadStart));\n";
      out += "      return ptr + 2;\n";
      out += "    }\n";
      out += "    ptr += 2;\n";
      out += "  }\n";
      out += "  return 0;\n";
      out += "}\n";
      return out;
    };

    const DESERIALIZE_FAST_PATH_HELPERS: string[] =
      useCanonicalFastPath || canEmitIntegerStringUltraFastPath
        ? [
            ...(needsFastStringEndHelper
              ? [
                  "@inline __FAST_FIND_STRING_END(srcStart: usize, srcEnd: usize): usize {\n" +
                    "  if (load<u16>(srcStart) != 34) return 0;\n" +
                    "  let ptr = srcStart + 2;\n" +
                    "  while (ptr < srcEnd) {\n" +
                    "    const code = load<u16>(ptr);\n" +
                    "    if (code == 92) {\n" +
                    "      ptr += 4;\n" +
                    "      continue;\n" +
                    "    }\n" +
                    "    if (code == 34) return ptr;\n" +
                    "    ptr += 2;\n" +
                    "  }\n" +
                    "  return 0;\n" +
                    "}\n",
                ]
              : []),
            ...(useCanonicalFastPath
              ? [
                  "@inline __FAST_FIND_VALUE_END(srcStart: usize, srcEnd: usize): usize {\n" +
                    "  let ptr = srcStart;\n" +
                    "  let depth: i32 = 0;\n" +
                    "  let inString = false;\n" +
                    "  let escaped = false;\n" +
                    "  while (ptr < srcEnd) {\n" +
                    "    const code = load<u16>(ptr);\n" +
                    "    if (inString) {\n" +
                    "      if (code == 92) {\n" +
                    "        escaped = !escaped;\n" +
                    "        ptr += 2;\n" +
                    "        continue;\n" +
                    "      }\n" +
                    "      if (code == 34 && !escaped) {\n" +
                    "        inString = false;\n" +
                    "      } else {\n" +
                    "        escaped = false;\n" +
                    "      }\n" +
                    "      ptr += 2;\n" +
                    "      continue;\n" +
                    "    }\n" +
                    "    if (code == 34) {\n" +
                    "      inString = true;\n" +
                    "      escaped = false;\n" +
                    "      ptr += 2;\n" +
                    "      continue;\n" +
                    "    }\n" +
                    "    if (code == 123 || code == 91) {\n" +
                    "      depth++;\n" +
                    "      ptr += 2;\n" +
                    "      continue;\n" +
                    "    }\n" +
                    "    if (code == 125 || code == 93) {\n" +
                    "      if (depth == 0) return ptr;\n" +
                    "      depth--;\n" +
                    "      ptr += 2;\n" +
                    "      continue;\n" +
                    "    }\n" +
                    "    if (depth == 0 && code == 44) return ptr;\n" +
                    "    ptr += 2;\n" +
                    "  }\n" +
                    "  return srcEnd;\n" +
                    "}\n",
                  generateCanonicalFastPathMethod("NAIVE"),
                  generateCanonicalFastPathMethod("SWAR"),
                  generateCanonicalFastPathMethod("SIMD"),
                ]
              : []),
            ...(canEmitIntegerStringUltraFastPath
              ? [
                  ...(hasUltraFastStringMembers
                    ? [
                        "@inline __QUOTE_MASK_UNSAFE(block: u64): u64 {\n" +
                          "  const q = block ^ 0x0022_0022_0022_0022;\n" +
                          "  return (q - 0x0001_0001_0001_0001) & ~q & 0x0080_0080_0080_0080;\n" +
                          "}\n",
                        generateUltraFastStringParseMethod("NAIVE"),
                        generateUltraFastStringParseMethod("SWAR"),
                        generateUltraFastStringParseMethod("SIMD"),
                      ]
                    : []),
                  generateUltraIntStringFastPathMethod("NAIVE"),
                  generateUltraIntStringFastPathMethod("SWAR"),
                  generateUltraIntStringFastPathMethod("SIMD"),
                ]
              : []),
          ]
        : [];

    const DESERIALIZE_INTSTR_SLOW_HELPERS: string[] =
      canEmitIntegerStringUltraFastPath
        ? [
            "@inline __FAST_SKIP_SPACE(ptr: usize, srcEnd: usize): usize {\n" +
              "  while (ptr < srcEnd && JSON.Util.isSpace(load<u16>(ptr))) ptr += 2;\n" +
              "  return ptr;\n" +
              "}\n",
            "@inline __FAST_SCAN_PRIMITIVE_END(ptr: usize, srcEnd: usize): usize {\n" +
              "  while (ptr < srcEnd) {\n" +
              "    const code = load<u16>(ptr);\n" +
              "    if (code == 44 || code == 125 || code == 93 || JSON.Util.isSpace(code)) break;\n" +
              "    ptr += 2;\n" +
              "  }\n" +
              "  return ptr;\n" +
              "}\n",
            "@inline __FAST_SKIP_VALUE(ptr: usize, srcEnd: usize): usize {\n" +
              "  ptr = this.__FAST_SKIP_SPACE(ptr, srcEnd);\n" +
              "  if (ptr >= srcEnd) return 0;\n" +
              "  const first = load<u16>(ptr);\n" +
              "  if (first == 34) {\n" +
              "    const quoteEnd = this.__FAST_FIND_STRING_END(ptr, srcEnd);\n" +
              "    return quoteEnd == 0 ? 0 : quoteEnd + 2;\n" +
              "  }\n" +
              "  if (first == 123 || first == 91) {\n" +
              "    const open = first;\n" +
              "    const close: u16 = first == 123 ? 125 : 93;\n" +
              "    let depth: i32 = 1;\n" +
              "    ptr += 2;\n" +
              "    while (ptr < srcEnd) {\n" +
              "      const code = load<u16>(ptr);\n" +
              "      if (code == 34) {\n" +
              "        const quoteEnd = this.__FAST_FIND_STRING_END(ptr, srcEnd);\n" +
              "        if (quoteEnd == 0) return 0;\n" +
              "        ptr = quoteEnd + 2;\n" +
              "        continue;\n" +
              "      }\n" +
              "      if (code == open) {\n" +
              "        depth++;\n" +
              "      } else if (code == close) {\n" +
              "        if (--depth == 0) return ptr + 2;\n" +
              "      }\n" +
              "      ptr += 2;\n" +
              "    }\n" +
              "    return 0;\n" +
              "  }\n" +
              "  return this.__FAST_SCAN_PRIMITIVE_END(ptr, srcEnd);\n" +
              "}\n",
            generateUltraSlowPathMethod("NAIVE"),
            generateUltraSlowPathMethod("SWAR"),
            generateUltraSlowPathMethod("SIMD"),
          ]
        : [];

    const buildDeserializerFastPathGuards = (
      mode: "NAIVE" | "SWAR" | "SIMD",
    ): string => {
      let guards = "";
      if (canEmitIntegerStringUltraFastPath) {
        guards += `  if (this.__DESERIALIZE_INTSTR_${mode}_FAST_PATH(srcStart, srcEnd, out)) return out;\n`;
      }
      if (useCanonicalFastPath) {
        guards += `  if (this.__DESERIALIZE_${mode}_FAST_PATH(srcStart, srcEnd, out)) return out;\n`;
      }
      return guards;
    };

    const applyFastPathGuards = (
      baseDeserializer: string,
      mode: "NAIVE" | "SWAR" | "SIMD",
    ): string => {
      const guards = buildDeserializerFastPathGuards(mode);
      if (!guards.length) return baseDeserializer;
      return baseDeserializer.replace("{\n", "{\n" + guards);
    };

    const DESERIALIZE_NAIVE_WITH_FAST_PATH = applyFastPathGuards(
      DESERIALIZE_NAIVE,
      "NAIVE",
    );

    const DESERIALIZE_SWAR_WITH_FAST_PATH = applyFastPathGuards(
      DESERIALIZE_SWAR,
      "SWAR",
    );

    const DESERIALIZE_SIMD_WITH_FAST_PATH = applyFastPathGuards(
      DESERIALIZE_SIMD,
      "SIMD",
    );

    const DESERIALIZE_INTSTR_NAIVE_COMPACT =
      "@inline __DESERIALIZE_NAIVE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {\n" +
      "  if (this.__DESERIALIZE_INTSTR_NAIVE_FAST_PATH(srcStart, srcEnd, out)) return out;\n" +
      "  if (this.__DESERIALIZE_INTSTR_NAIVE_SLOW_PATH(srcStart, srcEnd, out)) return out;\n" +
      '  throw new Error("Failed to parse JSON");\n' +
      "}\n";

    const DESERIALIZE_INTSTR_SWAR_COMPACT =
      "@inline __DESERIALIZE_SWAR<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {\n" +
      "  if (this.__DESERIALIZE_INTSTR_SWAR_FAST_PATH(srcStart, srcEnd, out)) return out;\n" +
      "  if (this.__DESERIALIZE_INTSTR_SWAR_SLOW_PATH(srcStart, srcEnd, out)) return out;\n" +
      '  throw new Error("Failed to parse JSON");\n' +
      "}\n";

    const DESERIALIZE_INTSTR_SIMD_COMPACT =
      "@inline __DESERIALIZE_SIMD<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {\n" +
      "  if (this.__DESERIALIZE_INTSTR_SIMD_FAST_PATH(srcStart, srcEnd, out)) return out;\n" +
      "  if (this.__DESERIALIZE_INTSTR_SIMD_SLOW_PATH(srcStart, srcEnd, out)) return out;\n" +
      '  throw new Error("Failed to parse JSON");\n' +
      "}\n";

    const DESERIALIZE_STRING_HELPERS: string[] = hasFastStringMembers
      ? [
          "@inline __COPY_STRING_TO_FIELD(dstFieldPtr: usize, srcStart: usize, byteLength: u32): void {\n" +
            '  if (byteLength == 0) {\n    store<usize>(dstFieldPtr, changetype<usize>(""));\n    return;\n  }\n' +
            "  const outPtr = __new(byteLength, idof<string>());\n" +
            "  memory.copy(outPtr, srcStart, byteLength);\n" +
            "  store<usize>(dstFieldPtr, outPtr);\n" +
            "}\n",
          "@inline __DESERIALIZE_STRING_COPY_FAST(srcStart: usize, quoteEnd: usize, dstFieldPtr: usize): bool {\n" +
            "  if (load<u16>(srcStart) != 34) return false;\n" +
            "  const payloadStart = srcStart + 2;\n" +
            "  if (quoteEnd < payloadStart) return false;\n" +
            "  this.__COPY_STRING_TO_FIELD(dstFieldPtr, payloadStart, <u32>(quoteEnd - payloadStart));\n" +
            "  return true;\n" +
            "}\n",
          "@inline __BACKSLASH_MASK_UNSAFE(block: u64): u64 {\n" +
            "  const b = block ^ 0x005c_005c_005c_005c;\n" +
            "  return (b - 0x0001_0001_0001_0001) & ~b & 0x0080_0080_0080_0080;\n" +
            "}\n",
          "@inline __DESERIALIZE_STRING_NAIVE_FAST(srcStart: usize, quoteEnd: usize, dstFieldPtr: usize): bool {\n" +
            "  if (load<u16>(srcStart) != 34) return false;\n" +
            "  const payloadStart = srcStart + 2;\n" +
            "  let ptr = payloadStart;\n" +
            "  while (ptr < quoteEnd) {\n" +
            "    if (load<u16>(ptr) == 92) {\n" +
            "      store<usize>(dstFieldPtr, changetype<usize>(JSON.__deserialize<string>(srcStart, quoteEnd + 2)));\n" +
            "      return true;\n" +
            "    }\n" +
            "    ptr += 2;\n" +
            "  }\n" +
            "  this.__COPY_STRING_TO_FIELD(dstFieldPtr, payloadStart, <u32>(quoteEnd - payloadStart));\n" +
            "  return true;\n" +
            "}\n",
          "@inline __DESERIALIZE_STRING_SWAR_FAST(srcStart: usize, quoteEnd: usize, dstFieldPtr: usize): bool {\n" +
            "  if (load<u16>(srcStart) != 34) return false;\n" +
            "  const payloadStart = srcStart + 2;\n" +
            "  let ptr = payloadStart;\n" +
            "  const quoteEnd8 = quoteEnd - 8;\n" +
            "  while (ptr <= quoteEnd8) {\n" +
            "    if (this.__BACKSLASH_MASK_UNSAFE(load<u64>(ptr)) == 0) {\n" +
            "      ptr += 8;\n" +
            "      continue;\n" +
            "    }\n" +
            "    store<usize>(dstFieldPtr, changetype<usize>(JSON.__deserialize<string>(srcStart, quoteEnd + 2)));\n" +
            "    return true;\n" +
            "  }\n" +
            "  while (ptr < quoteEnd) {\n" +
            "    if (load<u16>(ptr) == 92) {\n" +
            "      store<usize>(dstFieldPtr, changetype<usize>(JSON.__deserialize<string>(srcStart, quoteEnd + 2)));\n" +
            "      return true;\n" +
            "    }\n" +
            "    ptr += 2;\n" +
            "  }\n" +
            "  this.__COPY_STRING_TO_FIELD(dstFieldPtr, payloadStart, <u32>(quoteEnd - payloadStart));\n" +
            "  return true;\n" +
            "}\n",
          "@inline __DESERIALIZE_STRING_SIMD_FAST(srcStart: usize, quoteEnd: usize, dstFieldPtr: usize): bool {\n" +
            "  if (load<u16>(srcStart) != 34) return false;\n" +
            "  const payloadStart = srcStart + 2;\n" +
            "  let ptr = payloadStart;\n" +
            "  const quoteEnd16 = quoteEnd - 16;\n" +
            "  const splatBackSlash = i16x8.splat(92);\n" +
            "  while (ptr <= quoteEnd16) {\n" +
            "    const block = load<v128>(ptr);\n" +
            "    if (i16x8.bitmask(i16x8.eq(block, splatBackSlash)) == 0) {\n" +
            "      ptr += 16;\n" +
            "      continue;\n" +
            "    }\n" +
            "    store<usize>(dstFieldPtr, changetype<usize>(JSON.__deserialize<string>(srcStart, quoteEnd + 2)));\n" +
            "    return true;\n" +
            "  }\n" +
            "  while (ptr < quoteEnd) {\n" +
            "    if (load<u16>(ptr) == 92) {\n" +
            "      store<usize>(dstFieldPtr, changetype<usize>(JSON.__deserialize<string>(srcStart, quoteEnd + 2)));\n" +
            "      return true;\n" +
            "    }\n" +
            "    ptr += 2;\n" +
            "  }\n" +
            "  this.__COPY_STRING_TO_FIELD(dstFieldPtr, payloadStart, <u32>(quoteEnd - payloadStart));\n" +
            "  return true;\n" +
            "}\n",
        ]
      : [];

    const deserializerMethods = DESERIALIZE_CUSTOM
      ? [DESERIALIZE_CUSTOM]
      : canEmitIntegerStringUltraFastPath
        ? [
            DESERIALIZE_DISPATCH,
            DESERIALIZE_INTSTR_NAIVE_COMPACT,
            DESERIALIZE_INTSTR_SWAR_COMPACT,
            DESERIALIZE_INTSTR_SIMD_COMPACT,
            ...DESERIALIZE_FAST_PATH_HELPERS,
            ...DESERIALIZE_INTSTR_SLOW_HELPERS,
            ...DESERIALIZE_STRING_HELPERS,
          ]
        : [
            DESERIALIZE_DISPATCH,
            DESERIALIZE_NAIVE_WITH_FAST_PATH,
            DESERIALIZE_SWAR_WITH_FAST_PATH,
            DESERIALIZE_SIMD_WITH_FAST_PATH,
            ...DESERIALIZE_FAST_PATH_HELPERS,
            ...DESERIALIZE_STRING_HELPERS,
          ];

    if (DEBUG > 0) {
      console.log(SERIALIZE_CUSTOM || SERIALIZE);
      console.log(INITIALIZE);
      for (const method of serializeStringHelpers) {
        console.log(method);
      }
      for (const method of deserializerMethods) {
        console.log(method);
      }
    }

    const SERIALIZE_METHOD = SimpleParser.parseClassMember(
      SERIALIZE_CUSTOM || SERIALIZE,
      node,
    );
    const INITIALIZE_METHOD = SimpleParser.parseClassMember(INITIALIZE, node);

    if (!node.members.find((v) => v.name.text == "__SERIALIZE"))
      node.members.push(SERIALIZE_METHOD);
    if (!node.members.find((v) => v.name.text == "__INITIALIZE"))
      node.members.push(INITIALIZE_METHOD);

    for (const method of serializeStringHelpers) {
      const parsedMethod = SimpleParser.parseClassMember(method, node);
      if (!node.members.find((v) => v.name.text == parsedMethod.name.text)) {
        node.members.push(parsedMethod);
      }
    }

    for (const method of deserializerMethods) {
      const parsedMethod = SimpleParser.parseClassMember(method, node);
      if (!node.members.find((v) => v.name.text == parsedMethod.name.text)) {
        node.members.push(parsedMethod);
      }
    }

    super.visitClassDeclaration(node);
  }
  getSchema(name: string): Schema | null {
    name = stripNull(name);
    return (
      this.schemas
        .get(this.schema.node.range.source.internalPath)
        .find((s) => s.name == name) || null
    );
  }
  generateEmptyMethods(node: ClassDeclaration): void {
    const SERIALIZE_EMPTY =
      "@inline __SERIALIZE(ptr: usize): void {\n  bs.proposeSize(4);\n  store<u32>(bs.offset, 8192123);\n  bs.offset += 4;\n}";
    const INITIALIZE_EMPTY =
      "@inline __INITIALIZE(): this {\n  return this;\n}";
    const DESERIALIZE_EMPTY =
      "@inline __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {\n  return out;\n}";

    if (DEBUG > 0) {
      console.log(SERIALIZE_EMPTY);
      console.log(INITIALIZE_EMPTY);
      console.log(DESERIALIZE_EMPTY);
    }

    const SERIALIZE_METHOD_EMPTY = SimpleParser.parseClassMember(
      SERIALIZE_EMPTY,
      node,
    );
    const INITIALIZE_METHOD_EMPTY = SimpleParser.parseClassMember(
      INITIALIZE_EMPTY,
      node,
    );
    const DESERIALIZE_METHOD_EMPTY = SimpleParser.parseClassMember(
      DESERIALIZE_EMPTY,
      node,
    );

    if (!node.members.find((v) => v.name.text == "__SERIALIZE"))
      node.members.push(SERIALIZE_METHOD_EMPTY);
    if (!node.members.find((v) => v.name.text == "__INITIALIZE"))
      node.members.push(INITIALIZE_METHOD_EMPTY);
    if (!node.members.find((v) => v.name.text == "__DESERIALIZE"))
      node.members.push(DESERIALIZE_METHOD_EMPTY);
  }
  // visitCallExpression(node: CallExpression, ref: Node): void {
  //   super.visitCallExpression(node, ref);
  //   if (!(node.expression.kind == NodeKind.PropertyAccess && (node.expression as PropertyAccessExpression).property.text == "stringifyTo") && !(node.expression.kind == NodeKind.Identifier && (node.expression as IdentifierExpression).text == "stringifyTo")) return;

  //   const source = node.range.source;

  //   if (ref.kind == NodeKind.Call) {
  //     const newNode = Node.createBinaryExpression(Token.Equals, node.args[1], node, node.range);

  //     (<CallExpression>ref).args[(<CallExpression>ref).args.indexOf(node)] = newNode;
  //   } else {
  //     const newNode = Node.createExpressionStatement(Node.createBinaryExpression(Token.Equals, node.args[1], node, node.range));

  //     const nodeIndex = source.statements.findIndex((n: Node) => {
  //       if (n == node) return true;
  //       if (n.kind == NodeKind.Expression && (<ExpressionStatement>n).expression == node) return true;
  //       return false;
  //     });

  //     if (nodeIndex > 0) source.statements[nodeIndex] = newNode;
  //   }
  // }
  // visitBinaryExpression(node: BinaryExpression, ref?: Node | null): void {
  //   // if (node.right.kind == NodeKind.Call && (<CallExpression>node).)
  // }
  visitImportStatement(node: ImportStatement): void {
    super.visitImportStatement(node);
    this.imports.push(node);
  }
  visitSource(node: Source): void {
    this.imports = [];
    super.visitSource(node);
  }
  addImports(node: Source): void {
    // console.log("Separator: " + path.sep)
    // console.log("Platform: " + process.platform)
    this.baseCWD = this.baseCWD.replaceAll("/", path.sep);

    const baseDir = path.resolve(
      fileURLToPath(import.meta.url),
      "..",
      "..",
      "..",
    );
    let fromPath = node.range.source.normalizedPath.replaceAll("/", path.sep);

    const isLib = path.dirname(baseDir).endsWith("node_modules");

    if (
      !isLib &&
      !this.parser.sources.some((s) =>
        s.normalizedPath.startsWith("assembly/index"),
      )
    ) {
      const newPath = path.join(baseDir, "assembly", "index.ts");
      this.parser.parseFile(readFileSync(newPath).toString(), newPath, false);
    } else if (
      isLib &&
      !this.parser.sources.some((s) =>
        s.normalizedPath.startsWith("~lib/json-as/assembly/index"),
      )
    ) {
      const newPath = "~lib/json-as/assembly/index.ts";
      this.parser.parseFile(
        readFileSync(path.join(baseDir, "assembly", "index.ts")).toString(),
        newPath,
        false,
      );
    }

    // console.log("baseCWD", this.baseCWD);
    // console.log("baseDir", baseDir);

    fromPath = fromPath.startsWith("~lib")
      ? fromPath.slice(5)
      : path.join(this.baseCWD, fromPath);

    // console.log("fromPath", fromPath);

    const bsImport = this.imports.find((i) =>
      i.declarations?.find(
        (d) => d.foreignName.text == "bs" || d.name.text == "bs",
      ),
    );
    const jsonImport = this.imports.find((i) =>
      i.declarations?.find(
        (d) => d.foreignName.text == "JSON" || d.name.text == "JSON",
      ),
    );

    let baseRel = path.posix.join(
      ...path
        .relative(path.dirname(fromPath), path.join(baseDir))
        .split(path.sep),
    );

    if (baseRel.endsWith("json-as")) {
      baseRel = "json-as" + baseRel.slice(baseRel.indexOf("json-as") + 7);
    } else if (
      !baseRel.startsWith(".") &&
      !baseRel.startsWith("/") &&
      !baseRel.startsWith("json-as")
    ) {
      baseRel = "./" + baseRel;
    }

    // console.log("relPath", baseRel);

    if (!bsImport) {
      const replaceNode = Node.createImportStatement(
        [
          Node.createImportDeclaration(
            Node.createIdentifierExpression("bs", node.range, false),
            null,
            node.range,
          ),
        ],
        Node.createStringLiteralExpression(
          path.posix.join(baseRel, "lib", "as-bs"),
          node.range,
        ),
        node.range,
      );
      node.range.source.statements.unshift(replaceNode);
      if (DEBUG > 0)
        console.log(
          "Added import: " +
            toString(replaceNode) +
            " to " +
            node.range.source.normalizedPath +
            "\n",
        );
    }

    if (!jsonImport) {
      const replaceNode = Node.createImportStatement(
        [
          Node.createImportDeclaration(
            Node.createIdentifierExpression("JSON", node.range, false),
            null,
            node.range,
          ),
        ],
        Node.createStringLiteralExpression(
          path.posix.join(baseRel, "assembly", "index"),
          node.range,
        ), // Ensure POSIX-style path for 'assembly'
        node.range,
      );
      node.range.source.statements.unshift(replaceNode);
      if (DEBUG > 0)
        console.log(
          "Added import: " +
            toString(replaceNode) +
            " to " +
            node.range.source.normalizedPath +
            "\n",
        );
    }
  }

  getStores(data: string, simd: boolean = false): string[] {
    const out: string[] = [];
    const sizes = strToNum(data, simd);
    let offset = 0;
    for (const [size, num] of sizes) {
      if (size == "v128" && simd) {
        // This could be put in its own file
        const index = this.simdStatements.findIndex((v) => v.includes(num));
        const name =
          "SIMD_" + (index == -1 ? this.simdStatements.length : index);
        if (index && !this.simdStatements.includes(`const ${name} = ${num};`))
          this.simdStatements.push(`const ${name} = ${num};`);
        out.push(
          "store<v128>(bs.offset, " +
            name +
            ", " +
            offset +
            "); // " +
            data.slice(offset >> 1, (offset >> 1) + 8),
        );
        offset += 16;
      }
      if (size == "u64") {
        out.push(
          "store<u64>(bs.offset, " +
            num +
            ", " +
            offset +
            "); // " +
            data.slice(offset >> 1, (offset >> 1) + 4),
        );
        offset += 8;
      } else if (size == "u32") {
        out.push(
          "store<u32>(bs.offset, " +
            num +
            ", " +
            offset +
            "); // " +
            data.slice(offset >> 1, (offset >> 1) + 2),
        );
        offset += 4;
      } else if (size == "u16") {
        out.push(
          "store<u16>(bs.offset, " +
            num +
            ", " +
            offset +
            "); // " +
            data.slice(offset >> 1, (offset >> 1) + 1),
        );
        offset += 2;
      }
    }
    out.push("bs.offset += " + offset + ";");
    return out;
  }
  isValidType(type: string, node: ClassDeclaration): boolean {
    const validTypes = [
      "string",
      "u8",
      "i8",
      "u16",
      "i16",
      "u32",
      "i32",
      "u64",
      "i64",
      "f32",
      "f64",
      "bool",
      "boolean",
      "Date",
      "JSON.Value",
      "JSON.Obj",
      "JSON.Raw",
      "Value",
      "Obj",
      "Raw",
      ...this.schemas
        .get(this.schema.node.range.source.internalPath)
        .map((v) => v.name),
    ];

    const baseTypes = ["Array", "StaticArray", "Map", "Set", "JSON.Box", "Box"];

    if (node && node.isGeneric && node.typeParameters)
      validTypes.push(...node.typeParameters.map((v) => v.name.text));
    if (type.endsWith("| null")) {
      if (isPrimitive(type.slice(0, type.indexOf("| null")))) return false;
      return this.isValidType(type.slice(0, type.length - 7), node);
    }
    if (type.includes("<"))
      return (
        baseTypes.includes(type.slice(0, type.indexOf("<"))) &&
        this.isValidType(
          type.slice(type.indexOf("<") + 1, type.lastIndexOf(">")),
          node,
        )
      );
    if (validTypes.includes(type)) return true;
    return false;
  }
}

enum JSONMode {
  SWAR = 0,
  SIMD = 1,
  NAIVE = 2,
}

let MODE: JSONMode = JSONMode.SWAR;
export default class Transformer extends Transform {
  afterInitialize(program: Program): void | Promise<void> {
    if (program.options.hasFeature(Feature.Simd)) MODE = JSONMode.SIMD;
    if (process.env["JSON_MODE"]) {
      switch (process.env["JSON_MODE"].toLowerCase().trim()) {
        case "simd": {
          MODE = JSONMode.SIMD;
          break;
        }
        case "swar": {
          MODE = JSONMode.SWAR;
          break;
        }
        case "naive": {
          MODE = JSONMode.NAIVE;
          break;
        }
      }
    }
    program.registerConstantInteger("JSON_MODE", Type.i32, i64_new(MODE));
    if (
      process.env["JSON_CACHE"]?.trim().toLowerCase() === "true" ||
      process.env["JSON_CACHE"]?.trim().toLowerCase() === "1"
    ) {
      program.registerConstantInteger("JSON_CACHE", Type.bool, i64_one);
    }
  }

  afterParse(parser: Parser): void {
    const transformer = JSONTransform.SN;

    // Reset singleton state to prevent pollution across compilations
    // This is critical for worker pools where the same process handles multiple compilations
    transformer.schemas = new Map<string, Schema[]>();
    transformer.sources = new SourceSet();
    transformer.visitedClasses = new Set<string>();
    transformer.simdStatements = [];

    const sources = parser.sources
      .filter((source) => {
        const p = source.internalPath;
        if (
          p.startsWith("~lib/rt") ||
          p.startsWith("~lib/performance") ||
          p.startsWith("~lib/wasi_") ||
          p.startsWith("~lib/shared/")
        ) {
          return false;
        }
        return !isStdlib(source);
      })
      .sort((a, b) => {
        if (a.sourceKind >= 2 && b.sourceKind <= 1) {
          return -1;
        } else if (a.sourceKind <= 1 && b.sourceKind >= 2) {
          return 1;
        } else {
          return 0;
        }
      })
      .sort((a) => {
        if (a.sourceKind === SourceKind.UserEntry) {
          return 1;
        } else {
          return 0;
        }
      });

    transformer.baseCWD = path.join(process.cwd(), this.baseDir);
    transformer.program = this.program;
    transformer.parser = parser;
    for (const source of sources) {
      transformer.imports = [];
      transformer.currentSource = source;
      transformer.visit(source);

      if (transformer.simdStatements.length) {
        for (const simd of transformer.simdStatements)
          source.statements.unshift(SimpleParser.parseTopLevelStatement(simd));
      }
      transformer.simdStatements = [];

      if (transformer.schemas.has(source.internalPath)) {
        transformer.addImports(source);
      }
      if (source.normalizedPath == WRITE) {
        writeFileSync(
          path.join(
            process.cwd(),
            this.baseDir,
            removeExtension(source.normalizedPath) + ".tmp.ts",
          ),
          toString(source),
        );
      }
    }
  }
}

function throwError(message: string, range: Range): never {
  const err = new Error();
  err.stack = `${message}\n  at ${range.source.normalizedPath}:${range.source.lineAt(range.start)}:${range.source.columnAt()}\n`;
  throw err;
}

function indentInc(): void {
  indent += "  ";
}

function indentDec(): void {
  indent = indent.slice(0, Math.max(0, indent.length - 2));
}

function parseStringHintDecorator(
  args: Node[] | null,
  range: Range,
): StringHintMode {
  if (!args || !args.length) {
    throwError(
      '@stringmode requires one argument: "default", "noescape", "ascii", or "raw"',
      range,
    );
  }

  const first = args[0];
  if (
    first.kind !== NodeKind.Literal ||
    (first as LiteralExpression).literalKind !== LiteralKind.String
  ) {
    throwError(
      '@stringmode requires a string literal argument: "default", "noescape", "ascii", or "raw"',
      range,
    );
  }

  const mode = (first as StringLiteralExpression).value
    .toString()
    .toLowerCase();
  switch (mode) {
    case "default":
    case "escape":
    case "escaped":
      return StringHintMode.Default;
    case "noescape":
    case "no_escape":
    case "ascii":
      return StringHintMode.NoEscape;
    case "raw":
    case "verbatim":
      return StringHintMode.Raw;
    default:
      throwError(
        `Unsupported @stringmode value "${mode}". Supported: "default", "noescape", "ascii", "raw"`,
        range,
      );
  }
}
