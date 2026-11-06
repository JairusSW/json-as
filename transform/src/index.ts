import {
  ArrayLiteralExpression,
  BinaryExpression,
  CallExpression,
  Token,
  UnaryPrefixExpression,
  UnaryPostfixExpression,
  ClassDeclaration,
  CommonFlags,
  Feature,
  FieldDeclaration,
  Expression,
  ElementAccessExpression,
  FloatLiteralExpression,
  FunctionExpression,
  IdentifierExpression,
  ImportStatement,
  IntegerLiteralExpression,
  LiteralExpression,
  LiteralKind,
  MethodDeclaration,
  NamedTypeNode,
  NamespaceDeclaration,
  NewExpression,
  Node,
  ObjectLiteralExpression,
  Parser,
  ParenthesizedExpression,
  Program,
  PropertyAccessExpression,
  Range,
  Source,
  SourceKind,
  StringLiteralExpression,
  Type,
  TypeDeclaration,
  TypeNode,
} from "assemblyscript/dist/assemblyscript.js";
import {
  SIGNED_INTEGER_TYPES,
  INTEGER_TYPES,
  FLOAT_TYPES,
  isScalarType,
} from "./scalars.js";
import { Transform } from "assemblyscript/dist/transform.js";
import { writeFileSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { CustomTransform } from "./linkers/custom.js";
import { TypeAlias, effectiveTypeArguments } from "./linkers/alias.js";
import { NodeKind } from "./types.js";
import {
  Property,
  PropertyFlags,
  Schema,
  SourceSet,
  Src,
  TypeMeaning,
  typeMeaningText,
} from "./types.js";
import {
  cloneNode,
  isStdlib,
  removeExtension,
  SimpleParser,
  toString,
} from "./util.js";
import { Visitor } from "./visitor.js";
import { specializeObjectAllocator } from "./allocation.js";
import { generateCursorParser } from "./cursor.js";
import { keyDispatch, KeyDispatch } from "./key-dispatch.js";
import {
  parseDiagnosticsFlag,
  collectOriginalMethods,
  diagnosticsRuntimeRoot,
  lowerDiagnostics,
} from "./diagnostics.js";

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

const DIAGNOSTICS = parseDiagnosticsFlag(process.env["JSON_DIAGNOSTICS"]);

const STRICT =
  process.env["JSON_STRICT"] && process.env["JSON_STRICT"] == "true";
const DEFAULT_JSON_CACHE_BYTES = 1 << 20;

/**
 * Normalize the result of computing the relative path from a source file
 * back to the json-as package root, so emitted runtime imports use the
 * bare specifier `json-as/...` instead of the install-layout-specific
 * absolute prefix.
 *
 * Layouts encountered in the wild:
 *   - flat npm:        `../../node_modules/json-as`
 *   - pnpm / yarn-pnp: `../../.pnpm/json-as@1.3.6_<hash>/node_modules/json-as`
 *   - workspaces:      `../../../some/path/node_modules/json-as`
 *
 * In every case the *trailing* `json-as` segment is the package directory.
 * Anchoring on `lastIndexOf` collapses the prefix correctly; `indexOf` had
 * a hard-to-spot bug where pnpm's store directory `json-as@<ver>_<hash>`
 * matched first and leaked into every emitted import path.
 */
export function normalizeJsonAsBaseRel(baseRel: string): string {
  if (baseRel.endsWith("json-as")) {
    return "json-as" + baseRel.slice(baseRel.lastIndexOf("json-as") + 7);
  }
  if (
    !baseRel.startsWith(".") &&
    !baseRel.startsWith("/") &&
    !baseRel.startsWith("json-as")
  ) {
    return "./" + baseRel;
  }
  return baseRel;
}

/**
 * Computes the relative specifier from a user source file's directory back to
 * the json-as package root, as a forward-slash path suitable for an emitted
 * import (then collapsed to the bare `json-as/...` specifier by
 * {@link normalizeJsonAsBaseRel} when the package root is a `json-as` dir).
 *
 * Cross-platform: `p.relative(...)` produces native separators (`\` on
 * Windows), which are split on `p.sep` and rejoined with `path.posix.sep` so
 * the emitted import is always forward-slash. Pass `path.win32` / `path.posix`
 * to exercise either platform deterministically in tests.
 *
 * Symlinks (pnpm/yarn-pnp): callers pass the realpath-resolved `packageDir`
 * (Node resolves `import.meta.url` through the symlink to the `.pnpm` store,
 * whose leaf dir is still `json-as`), so the trailing-`json-as` collapse yields
 * the bare specifier and AS resolves it through the consumer's node_modules.
 *
 * @param fromDir     Directory of the user source file (native separators).
 * @param packageDir  Resolved json-as package root (native separators).
 * @param p           Path implementation (defaults to the host platform).
 */
export function computeImportBaseRel(
  fromDir: string,
  packageDir: string,
  p: { relative(from: string, to: string): string; sep: string } = path,
): string {
  return normalizeJsonAsBaseRel(
    path.posix.join(...p.relative(fromDir, packageDir).split(p.sep)),
  );
}

function envFlagDefaultTrue(value: string | undefined): boolean {
  if (!value) return true;
  switch (value.trim().toLowerCase()) {
    case "0":
    case "false":
    case "off":
    case "no":
      return false;
    default:
      return true;
  }
}

const USE_FAST_PATH = envFlagDefaultTrue(process.env["JSON_USE_FAST_PATH"]);
const THROW_FAST_PATH = process.env["JSON_FAST_PATH_THROW"]?.trim() === "1";
const USE_DEFAULT_OBJECT_SPECIALIZATION = true;
type JSONCacheConfig = {
  enabled: boolean;
  bytes: number;
};

function parseJSONCacheConfig(value: string | undefined): JSONCacheConfig {
  if (!value) return { enabled: false, bytes: 0 };
  const raw = value.trim();
  if (!raw) return { enabled: false, bytes: 0 };

  const lower = raw.toLowerCase();
  if (
    lower === "false" ||
    lower === "off" ||
    lower === "no" ||
    lower === "none" ||
    lower === "0"
  ) {
    return { enabled: false, bytes: 0 };
  }

  if (lower === "true" || lower === "on" || lower === "yes") {
    return { enabled: true, bytes: DEFAULT_JSON_CACHE_BYTES };
  }

  const match = /^(\d+)\s*([kKmMgG]?[bB])?$/.exec(raw);
  if (!match) {
    throw new Error(
      `Invalid JSON_CACHE value '${value}'. Expected true/false or <int>[kb|mb|gb|KB|MB|GB].`,
    );
  }

  const amount = Number(match[1]);
  const suffix = match[2] || "B";
  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid JSON_CACHE value '${value}'.`);
  }

  const unit = suffix[0];
  const scale =
    unit == "k" || unit == "K"
      ? 1_000
      : unit == "m" || unit == "M"
        ? 1_000_000
        : unit == "g" || unit == "G"
          ? 1_000_000_000
          : 1;
  let bytes = amount * scale;
  if (suffix.endsWith("b")) {
    bytes = Math.ceil(bytes / 8);
  }

  if (bytes <= 0) {
    return { enabled: false, bytes: 0 };
  }

  if (bytes > 0xffff_ffff) {
    throw new Error(`JSON_CACHE value '${value}' is too large (max 4GB).`);
  }

  return { enabled: true, bytes: Math.floor(bytes) };
}

const JSON_CACHE_CONFIG = parseJSONCacheConfig(process.env["JSON_CACHE"]);
// const STRING_SCAN_SUFFIX_BOUND_LIMIT = process.env["STRING_SCAN_SUFFIX_BOUND_LIMIT"] ? parseInt(process.env["STRING_SCAN_SUFFIX_BOUND_LIMIT"]) : 1024;

function needsReferenceLoad(type: string): boolean {
  return (
    type == "ArrayBuffer" ||
    type == "Int8Array" ||
    type == "Uint8Array" ||
    type == "Uint8ClampedArray" ||
    type == "Int16Array" ||
    type == "Uint16Array" ||
    type == "Int32Array" ||
    type == "Uint32Array" ||
    type == "Int64Array" ||
    type == "Uint64Array" ||
    type == "Float32Array" ||
    type == "Float64Array"
  );
}

function isReservedPrimitive(type: string): boolean {
  return (
    type == "bool" ||
    type == "boolean" ||
    type == "i8" ||
    type == "i16" ||
    type == "i32" ||
    type == "i64" ||
    type == "isize" ||
    type == "u8" ||
    type == "u16" ||
    type == "u32" ||
    type == "u64" ||
    type == "usize" ||
    type == "f32" ||
    type == "f64"
  );
}

function syncSerializeCursor(code: string): string {
  return `bs.offset = __dst;\n${code}__dst = bs.offset;\n`;
}

function getSerializeCall(type: string, realName: string): string {
  if (isReservedPrimitive(type)) {
    return `__dst = JSON.__serializePrimitiveAt<${type}>(__dst, load<${type}>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`;
  }

  if (type.startsWith("Array<") && !type.includes("| null")) {
    return syncSerializeCursor(
      `JSON.__serializeArrayPointer<${type}>(load<usize>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`,
    );
  }

  if (
    type == "string" ||
    type == "String" ||
    type == "string | null" ||
    type == "String | null"
  ) {
    return syncSerializeCursor(
      `JSON.__serializeStringPointer(load<usize>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`,
    );
  }

  if (type == "ArrayBuffer") {
    return syncSerializeCursor(
      `JSON.__serialize<ArrayBuffer>(load<ArrayBuffer>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`,
    );
  }

  return syncSerializeCursor(
    needsReferenceLoad(type)
      ? `JSON.__serializeLazyValue<${type}>(changetype<${type}>(load<usize>(ptr, offsetof<this>(${JSON.stringify(realName)}))));\n`
      : `JSON.__serializeLazyValue<${type}>(load<${type}>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`,
  );
}

const CUSTOM_JSON_KINDS = new Set([
  "any",
  "string",
  "number",
  "object",
  "array",
  "boolean",
  "null",
  "any | null",
  "string | null",
  "number | null",
  "object | null",
  "array | null",
  "boolean | null",
]);

function parseCustomJsonKind(
  method: MethodDeclaration,
  decoratorName: string,
): string {
  const decorator = method.decorators?.find(
    (v) => (<IdentifierExpression>v.name).text.toLowerCase() == decoratorName,
  );
  if (!decorator || !decorator.args || decorator.args.length == 0) return "any";
  if (decorator.args.length > 1)
    throwError(
      `@${decoratorName} accepts at most one argument`,
      decorator.range,
    );

  const arg = decorator.args[0];
  if (
    arg.kind != NodeKind.Literal ||
    (arg as LiteralExpression).literalKind != LiteralKind.String
  ) {
    throwError(
      `@${decoratorName} argument must be a string literal like @${decoratorName}("string")`,
      arg.range,
    );
  }

  const kind = (arg as StringLiteralExpression).value;
  if (!CUSTOM_JSON_KINDS.has(kind)) {
    throwError(
      `Unsupported @${decoratorName} JSON type '${kind}'. Expected one of: any, string, number, object, array, boolean, null`,
      arg.range,
    );
  }
  return kind;
}

function addMemberToCustomBucket(
  sortedMembers: {
    string: Property[];
    number: Property[];
    boolean: Property[];
    null: Property[];
    array: Property[];
    object: Property[];
  },
  member: Property,
  kind: string,
): void {
  const isNullable = kind.endsWith(" | null");
  const baseKind = isNullable ? kind.slice(0, kind.length - 7) : kind;

  if (isNullable) sortedMembers.null.push(member);

  switch (baseKind) {
    case "string":
      sortedMembers.string.push(member);
      break;
    case "number":
      sortedMembers.number.push(member);
      break;
    case "boolean":
      sortedMembers.boolean.push(member);
      break;
    case "null":
      if (!isNullable) sortedMembers.null.push(member);
      break;
    case "array":
      sortedMembers.array.push(member);
      break;
    case "object":
      sortedMembers.object.push(member);
      break;
    default:
      sortedMembers.string.push(member);
      sortedMembers.number.push(member);
      sortedMembers.object.push(member);
      sortedMembers.array.push(member);
      sortedMembers.boolean.push(member);
      if (!isNullable) sortedMembers.null.push(member);
      break;
  }
}

export class JSONTransform extends Visitor {
  static SN: JSONTransform = new JSONTransform();

  public program!: Program;
  public baseCWD!: string;
  public parser!: Parser;
  public schemas: Map<string, Schema[]> = new Map<string, Schema[]>();
  public schema!: Schema;
  public sources: SourceSet = new SourceSet();
  public imports: ImportStatement[] = [];
  public simdStatements = new Map<Source, string[]>();

  public visitedClasses: Set<string> = new Set<string>();

  private eagerOverrides = new Set<FieldDeclaration>();
  private lazySourceFields = new Map<ClassDeclaration, string>();
  private lazySourceInstalled = new Set<ClassDeclaration>();

  private unusedMemberName(node: ClassDeclaration, stem: string): string {
    const names = new Set<string>();
    const visited = new Set<ClassDeclaration>();
    let current: ClassDeclaration | null = node;
    while (current && !visited.has(current)) {
      visited.add(current);
      for (const member of current.members) names.add(member.name.text);
      const source = this.sources.get(current.range.source);
      const parent = current.extendsType
        ? toString(current.extendsType.name)
        : "";
      current = parent
        ? source.getClassInContext(parent, current) ||
          source.getImportedClass(parent, this.parser)
        : null;
    }
    let name = stem;
    for (let suffix = 1; names.has(name); suffix++) name = stem + "_" + suffix;
    return name;
  }
  private generatedRuntimeName: string | undefined;
  private runtimeReference(): string {
    if (!this.generatedRuntimeName) {
      let name = "__JSON_Runtime";
      for (
        let suffix = 1;
        this.parser.sources.some((source) => source.text.includes(name));
        suffix++
      )
        name = "__JSON_Runtime_" + suffix;
      this.generatedRuntimeName = name;
    }
    return this.generatedRuntimeName;
  }
  private lazyRuntimeSource: Source | null | undefined;

  // Resolve aliases and import bindings to the actual JSON.Lazy declaration.
  private lazyInnerType(
    type: TypeNode | null,
    source: Src,
    scope = "",
    owner?: ClassDeclaration,
  ): string | null {
    if (!type || type.kind !== NodeKind.NamedType) return null;
    if (this.lazyRuntimeSource === undefined)
      this.lazyRuntimeSource =
        this.parser.sources.find(
          (candidate) =>
            candidate.internalPath.endsWith("/json-as/assembly/index") ||
            candidate.internalPath === process.env["JSON_AS_LIBRARY_SOURCE"],
        ) ??
        this.parser.sources.find(
          (candidate) =>
            candidate.internalPath.endsWith("assembly/index") &&
            this.sources.get(candidate).getClass("JSON.Value"),
        ) ??
        null;
    const runtime = this.lazyRuntimeSource;
    const meaning = source.resolveTypeMeaning(
      toString(type),
      scope,
      this.parser,
      owner ? source.classTypeParameters(owner) : new Map(),
      (alias) =>
        alias.name === "JSON.Lazy" &&
        alias.declaration?.range.source === runtime,
    );
    if (meaning.name !== "JSON.Lazy" || meaning.arguments.length !== 1)
      return null;
    const inner = {
      ...meaning.arguments[0],
      nullable: meaning.nullable || meaning.arguments[0].nullable,
    };
    const resolved = typeMeaningText(inner);
    // Scalars have a scope-independent spelling. For references keep the legal
    // caller-visible alias; it can hide private implementation declarations.
    return isPrimitive(stripNull(resolved)) || isString(resolved)
      ? resolved
      : toString(type) + (inner.nullable && !type.isNullable ? " | null" : "");
  }

  // Determine physical field/accessor compatibility before any class is lowered.
  prepareLazyOverrides(sources: Source[]): void {
    type Spec = {
      field: FieldDeclaration;
      owner: ClassDeclaration;
      source: Src;
      inner: string | null;
      lazy: boolean;
    };
    const specs = new Map<FieldDeclaration, Spec>();
    const parent = new Map<FieldDeclaration, FieldDeclaration>();
    const root = (field: FieldDeclaration): FieldDeclaration => {
      const next = parent.get(field)!;
      if (next === field) return field;
      const result = root(next);
      parent.set(field, result);
      return result;
    };
    const has = (
      field: FieldDeclaration | ClassDeclaration,
      name: string,
    ): boolean =>
      field.decorators?.some(
        (decorator) => (decorator.name as IdentifierExpression).text === name,
      ) ?? false;
    for (const source of sources) {
      const src = this.sources.get(source);
      for (const owner of src.getClasses()) {
        const decorated = has(owner, "json") || has(owner, "serializable");
        const mode = decorated ? classLazyMode(owner) : "none";
        const custom = owner.members.some((member) =>
          member.decorators?.some((decorator) =>
            ["serializer", "deserializer"].includes(
              (decorator.name as IdentifierExpression).text,
            ),
          ),
        );
        for (const member of owner.members) {
          if (
            member.kind !== NodeKind.FieldDeclaration ||
            member.is(CommonFlags.Static) ||
            member.is(CommonFlags.Private) ||
            member.is(CommonFlags.Protected)
          )
            continue;
          const field = member as FieldDeclaration;
          if (!field.type) continue;
          const scope = src
            .getQualifiedName(owner)
            .split(".")
            .slice(0, -1)
            .join(".");
          const inner = this.lazyInnerType(field.type, src, scope, owner);
          const auto =
            mode !== "none" &&
            !has(field, "eager") &&
            !has(field, "omit") &&
            (mode === "all" ||
              lazyAutoCost(
                this.resolveType(
                  toString(field.type),
                  src,
                  new Set(),
                  scope,
                  true,
                  owner,
                ),
                src,
                this.parser,
              ) >= LAZY_AUTO_THRESHOLD);
          specs.set(field, {
            field,
            owner,
            source: src,
            inner,
            lazy:
              decorated &&
              !custom &&
              (inner !== null || has(field, "lazy") || auto),
          });
          parent.set(field, field);
        }
      }
    }
    for (const spec of specs.values()) {
      let owner = spec.owner;
      const seen = new Set<ClassDeclaration>();
      while (owner.extendsType && !seen.has(owner)) {
        seen.add(owner);
        const src = this.sources.get(owner.range.source);
        const name = src.resolveExtendsName(owner);
        const base =
          src.getClassInContext(name, owner) ||
          src.getImportedClass(name, this.parser) ||
          src.getAvailableClass(name, this.parser);
        if (!base || isStdlib(base)) break;
        const field = base.members.find(
          (member) =>
            member.kind === NodeKind.FieldDeclaration &&
            member.name.text === spec.field.name.text,
        ) as FieldDeclaration | undefined;
        if (field && specs.has(field)) {
          parent.set(root(spec.field), root(field));
          break;
        }
        owner = base;
      }
    }
    const groups = new Map<FieldDeclaration, Spec[]>();
    for (const spec of specs.values()) {
      const key = root(spec.field);
      const group = groups.get(key) ?? [];
      group.push(spec);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      if (!group.some((spec) => spec.lazy) || !group.some((spec) => !spec.lazy))
        continue;
      for (const spec of group) {
        this.eagerOverrides.add(spec.field);
        if (spec.inner !== null) {
          const type = (
            SimpleParser.parseTopLevelStatement(
              `type __JSON_EAGER = ${spec.inner};`,
            ) as TypeDeclaration
          ).type;
          type.range = spec.field.type!.range;
          spec.field.type = type;
        }
        spec.field.decorators =
          spec.field.decorators?.filter(
            (decorator) =>
              (decorator.name as IdentifierExpression).text !== "lazy",
          ) ?? null;
      }
    }
  }

  private usesBuiltinRepresentation(
    node: ClassDeclaration,
    visited = new Set<ClassDeclaration>(),
  ): boolean {
    if (visited.has(node)) return false;
    visited.add(node);
    if (
      node.decorators?.some((decorator) =>
        ["json", "serializable"].includes(toString(decorator.name)),
      )
    )
      return false;
    const builtins = [
      "Array",
      "Map",
      "Set",
      "StaticArray",
      "ArrayBuffer",
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
      "Date",
    ];
    if (isStdlib(node) && builtins.includes(node.name.text)) return true;
    const source = this.sources.get(node.range.source);
    if (
      node.range.source.internalPath === this.lazyRuntimeSource?.internalPath &&
      ["JSON.Raw", "JSON.Value", "JSON.Obj", "JSON.Arr", "JSON.Box"].includes(
        source.getQualifiedName(node),
      )
    )
      return true;
    if (!node.extendsType) return false;
    const name = toString(node.extendsType.name);
    const parent =
      source.getClassInContext(name, node) ||
      source.getImportedClass(name, this.parser) ||
      source.getAvailableClass(name, this.parser);
    return parent
      ? this.usesBuiltinRepresentation(parent, visited)
      : builtins.includes(name);
  }

  private inheritedAliases = new Map<Property, string>();
  private inheritedAliasId = 0;

  private inheritedTypeBinding(
    member: Property,
    parent: Schema,
    child: ClassDeclaration,
  ): string {
    const owner = parent.node.range.source;
    const source = this.sources.get(owner);
    let name = this.inheritedAliases.get(member);
    const parameters = parent.node.typeParameters ?? [];
    const parameterNames = parameters.map((parameter) => parameter.name.text);
    const declarationParameters = parameters.length
      ? `<${parameters.map((parameter) => toString(parameter)).join(",")}>`
      : "";
    const useParameters = parameters.length
      ? `<${parameterNames.join(",")}>`
      : "";
    if (!name) {
      do {
        name = "__JSON_FieldType_" + this.inheritedAliasId++;
      } while (this.parser.sources.some((file) => file.text.includes(name!)));
      const scope = source
        .getQualifiedName(parent.node)
        .split(".")
        .slice(0, -1);
      let statements = owner.statements;
      let namespace: NamespaceDeclaration | null = null;
      const namespaces: NamespaceDeclaration[] = [];
      for (const part of scope) {
        namespace = statements.find(
          (statement) =>
            statement.kind === NodeKind.NamespaceDeclaration &&
            (statement as NamespaceDeclaration).name.text === part,
        ) as NamespaceDeclaration;
        namespaces.push(namespace);
        statements = namespace.members;
      }
      const addAlias = (
        local: string,
        type: string,
        into: Node[],
        ns: NamespaceDeclaration | null,
      ): void => {
        const declaration = SimpleParser.parseTopLevelStatement(
          `export type ${local}${declarationParameters} = ${type};`,
          ns,
        ) as TypeDeclaration;
        class OwnRanges extends Visitor {
          _visit(node: Node, reference: Node | null): void {
            node.range = parent.node.range;
            super._visit(node, reference);
          }
        }
        new OwnRanges().visit(declaration);
        into.push(declaration);
        const alias = new TypeAlias(
          [...scope.slice(0, ns ? scope.length : 0), local].join("."),
          type,
        );
        alias.parameters = parameterNames;
        alias.declaration = declaration;
        source.registerAlias(alias, ns ? namespaces : []);
      };
      addAlias(name, member.lazyInner || member.type, statements, namespace);
      if (scope.length) {
        const exported = name + "_Export";
        addAlias(
          exported,
          scope.join(".") + "." + name + useParameters,
          owner.statements,
          null,
        );
        name = exported;
      }
      this.inheritedAliases.set(member, name);
    }
    const target = child.range.source;
    if (
      target !== owner &&
      !target.statements.some(
        (statement) =>
          statement.kind === NodeKind.Import &&
          (statement as ImportStatement).declarations?.some(
            (item) => item.name.text === name,
          ),
      )
    ) {
      const relative = path.posix.relative(
        path.posix.dirname(target.internalPath),
        owner.internalPath,
      );
      const module = owner.internalPath.startsWith("~lib/")
        ? owner.internalPath.slice(5)
        : relative.startsWith(".")
          ? relative
          : "./" + relative;
      target.statements.unshift(
        Node.createImportStatement(
          [
            Node.createImportDeclaration(
              Node.createIdentifierExpression(name, child.range, false),
              null,
              child.range,
            ),
          ],
          Node.createStringLiteralExpression(module, child.range),
          child.range,
        ),
      );
      // The transform's source index must see imports inserted after parsing too.
      (target.statements[0] as ImportStatement).internalPath =
        owner.internalPath;
      this.sources
        .get(target)
        .imports.push(target.statements[0] as ImportStatement);
    }
    // Defaults are declared in the exporting module. Let the exported alias
    // apply them there, rather than emitting private default names here.
    const arguments_ =
      child.extendsType?.typeArguments?.map((argument) => toString(argument)) ??
      [];
    return name + (arguments_.length ? `<${arguments_.join(",")}>` : "");
  }

  private lazyMetadata = new Map<
    FieldDeclaration,
    {
      inner: string;
      valueType: string;
      omitNull: boolean;
      omitIf: Expression | null;
      valueInit?: string;
      packed?: boolean;
      scalar?: boolean;
    }
  >();

  private collectInheritedFieldMembers(
    node: ClassDeclaration,
    source: Src,
    members: FieldDeclaration[],
    visited = new Set<ClassDeclaration>(),
    throughUndecorated = false,
  ): void {
    if (!node.extendsType) return;

    const extendsName = source.resolveExtendsName(node);
    if (!extendsName) return;

    let baseDecl: ClassDeclaration | null = source.getClassInContext(
      extendsName,
      node,
    );
    let baseSource: Src | null = baseDecl ? source : null;

    if (!baseDecl) {
      const imported = source.getImportedClass(extendsName, this.parser);
      if (imported) {
        baseDecl = imported;
        baseSource = this.sources.get(imported.range.source);
      }
    }

    if (!baseDecl) {
      const available = source.getAvailableClass(extendsName, this.parser);
      if (available) {
        baseDecl = available;
        baseSource = this.sources.get(available.range.source);
      }
    }

    if (!baseDecl || !baseSource || visited.has(baseDecl)) return;
    visited.add(baseDecl);

    const isDecoratedBase = !!baseDecl.decorators?.some((decorator) => {
      const name = (<IdentifierExpression>decorator.name).text;
      return name === "json" || name === "serializable";
    });
    if (isDecoratedBase && !throughUndecorated) return;
    let decoratedSchema: Schema | undefined;
    if (isDecoratedBase) {
      if (!this.visitedClasses.has(baseSource.getFullPath(baseDecl))) {
        const previous = this.schema;
        this.visitClassDeclarationRef(baseDecl);
        this.schema = previous;
      }
      decoratedSchema = this.schemas
        .get(baseSource.internalPath)
        ?.find((schema) => schema.node === baseDecl);
    }
    const ancestors: FieldDeclaration[] = [];
    if (!isDecoratedBase)
      this.collectInheritedFieldMembers(
        baseDecl,
        baseSource,
        ancestors,
        visited,
        true,
      );
    const ownNames = new Set(
      baseDecl.members
        .filter(
          (member) =>
            member.kind === NodeKind.FieldDeclaration &&
            !member.is(CommonFlags.Static),
        )
        .map((member) => member.name.text),
    );
    const localNames = new Set(
      node.members
        .filter(
          (member) =>
            member.kind === NodeKind.FieldDeclaration &&
            !member.is(CommonFlags.Static),
        )
        .map((member) => member.name.text),
    );

    const inheritedMembers = decoratedSchema
      ? decoratedSchema.members.map((member) => member.node)
      : (baseDecl.members.filter(
          (v) =>
            v.kind === NodeKind.FieldDeclaration &&
            !v.is(CommonFlags.Static) &&
            !v.is(CommonFlags.Private) &&
            !v.is(CommonFlags.Protected) &&
            !v.decorators?.some(
              (decorator) =>
                (<IdentifierExpression>decorator.name).text === "omit",
            ),
        ) as FieldDeclaration[]);
    const arguments_ =
      effectiveTypeArguments(
        baseDecl.typeParameters,
        node.extendsType.typeArguments ?? [],
      ) ?? [];
    const bindings = new Map(
      (baseDecl.typeParameters ?? []).map((parameter, index) => [
        parameter.name.text,
        arguments_[index],
      ]),
    );
    class InstantiateInherited extends Visitor {
      visitNamedTypeNode(type: NamedTypeNode): void {
        const value = bindings.get(toString(type.name));
        if (value) {
          const nullable = type.isNullable;
          Object.assign(type, cloneNode(value));
          type.isNullable ||= nullable;
        } else super.visitNamedTypeNode(type);
      }
    }
    const instantiate = new InstantiateInherited();
    const context = new Map<
      string,
      { type: TypeNode; source: Src; scope: string; owner: ClassDeclaration }
    >();
    for (
      let index = 0;
      index < (baseDecl.typeParameters?.length ?? 0);
      index++
    ) {
      const type = arguments_[index];
      if (type)
        context.set(baseDecl.typeParameters[index].name.text, {
          type,
          source,
          owner: node,
          scope: source
            .getQualifiedName(node)
            .split(".")
            .slice(0, -1)
            .join("."),
        });
    }
    // Local declarations shadow their inherited logical fields.
    const fields = [
      ...ancestors.filter((field) => !ownNames.has(field.name.text)),
      ...inheritedMembers,
    ];
    for (let i = fields.length - 1; i >= 0; i--) {
      const original = fields[i];
      if (
        !localNames.has(original.name.text) &&
        !members.some((member) => member.name.text == original.name.text)
      ) {
        const inherited = cloneNode(original) as FieldDeclaration;
        instantiate.visit(inherited);
        const origin =
          decoratedSchema?.members.find((member) => member.node === original) ||
          this.inheritedOrigins.get(original);
        if (origin) this.inheritedOrigins.set(inherited, origin);

        const bindType = (text: string): string => {
          const meaning = baseSource!.resolveTypeMeaning(
            text,
            baseSource!
              .getQualifiedName(baseDecl!)
              .split(".")
              .slice(0, -1)
              .join("."),
            this.parser,
            context,
          );
          const reference = (value: TypeMeaning): boolean =>
            !!value.declaration || value.arguments.some(reference);
          if (!reference(meaning)) return typeMeaningText(meaning);
          const property = new Property();
          property.node = original;
          property.type = text;
          const parent = new Schema();
          parent.node = baseDecl!;
          return this.inheritedTypeBinding(property, parent, node);
        };
        inherited.type = (
          SimpleParser.parseClassMember(
            `__type: ${bindType(toString(original.type))};`,
            node,
          ) as FieldDeclaration
        ).type;
        const lazy = this.lazyMetadata.get(original);
        if (lazy)
          this.lazyMetadata.set(inherited, {
            ...lazy,
            inner: bindType(lazy.inner),
            valueType: bindType(lazy.valueType),
          });
        if (inheritedMembers.includes(original) && original.initializer) {
          let helper = this.inheritedDefaultHelpers.get(original);
          if (!helper) {
            const stem = "__JSON_DEFAULT_" + original.name.text;
            helper = this.unusedMemberName(baseDecl, stem);
            for (
              let suffix = 1;
              this.parser.sources.some((source) =>
                source.text.includes(helper!),
              );
              suffix++
            )
              helper = this.unusedMemberName(baseDecl, stem + "_" + suffix);
            baseDecl.members.push(
              SimpleParser.parseClassMember(
                `${helper}(): ${toString(original.type)} { return ${toString(original.initializer)}; }`,
                baseDecl,
              ),
            );
            this.inheritedDefaultHelpers.set(original, helper);
          }
          inherited.initializer = SimpleParser.parseExpression(
            `this.${helper}()`,
          );
        }
        members.unshift(inherited);
      }
    }
  }

  private inheritedDefaultHelpers = new Map<FieldDeclaration, string>();
  private inheritedOrigins = new Map<FieldDeclaration, Property>();

  private isCodecStringType(
    type: TypeNode | null,
    source: Src,
    scope: string,
    owner: ClassDeclaration,
  ): boolean {
    if (!type) return false;
    const meaning = source.resolveTypeMeaning(
      toString(type),
      scope,
      this.parser,
      source.classTypeParameters(owner),
    );
    return (
      !meaning.nullable &&
      ["string", "String"].includes(meaning.name) &&
      (!meaning.declaration || isStdlib(meaning.declaration))
    );
  }

  /** Resolved ancestors, including ordinary classes between generated schemas. */
  private classAncestors(node: ClassDeclaration): ClassDeclaration[] {
    const ancestors: ClassDeclaration[] = [];
    const seen = new Set<ClassDeclaration>([node]);
    while (node.extendsType) {
      const source = this.sources.get(node.range.source);
      const parent = source.resolveClass(
        source.resolveExtendsName(node),
        node,
        this.parser,
      );
      if (!parent || isStdlib(parent) || seen.has(parent)) break;
      seen.add(parent);
      ancestors.push(parent);
      node = parent;
    }
    return ancestors;
  }

  private initializerChainHasEffects(
    node: ClassDeclaration,
    seen = new Set<ClassDeclaration>(),
  ): boolean {
    if (seen.has(node)) return false;
    seen.add(node);
    if (
      node.members.some(
        (member) =>
          member.kind === NodeKind.FieldDeclaration &&
          !member.is(CommonFlags.Static) &&
          !!(member as FieldDeclaration).initializer &&
          initializerHasEffects((member as FieldDeclaration).initializer!),
      )
    )
      return true;
    if (!node.extendsType) return false;
    const source = this.sources.get(node.range.source);
    const parent =
      source.getClassInContext(source.resolveExtendsName(node), node) ||
      source.getImportedClass(source.resolveExtendsName(node), this.parser);
    return (
      !!parent &&
      !isStdlib(parent) &&
      this.initializerChainHasEffects(parent, seen)
    );
  }

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

  resolveType(
    type: string,
    source: Src,
    _visited = new Set<string>(),
    scope = "",
    preserveClassAliases = true,
    owner?: ClassDeclaration,
  ): string {
    const meaning = source.resolveTypeMeaning(
      type,
      scope,
      this.parser,
      owner ? source.classTypeParameters(owner) : undefined,
    );
    const hasDeclaration = (value: TypeMeaning): boolean =>
      !!value.declaration || value.arguments.some(hasDeclaration);
    // Public aliases remain the emitted spelling for class/enum representations;
    // their resolved identity is metadata, not a foreign identifier to re-emit.
    if (preserveClassAliases && hasDeclaration(meaning)) return type;
    return typeMeaningText(meaning);
  }

  /** Resolve a struct type reachable from `owner` for default-value codegen. */
  private getDefaultSchema(owner: Schema, type: string): Schema | null {
    const name = stripNull(type).trim();
    const matches = (schema: Schema): boolean =>
      schema.name == name ||
      schema.name.endsWith("." + name) ||
      name.endsWith("." + schema.name);

    if (matches(owner)) return owner;
    for (const dep of owner.deps) {
      if (dep && matches(dep)) return dep;
    }
    if (owner.parent && matches(owner.parent)) return owner.parent;
    return null;
  }

  /** Whether constructing an implicit nested default graph is free of
   * user-provided expressions and cursor lifecycle hooks. */
  private canDeferCursorObjectDefault(
    owner: Schema,
    type: string,
    visiting: Set<Schema> = new Set<Schema>(),
  ): boolean {
    const schema = this.getDefaultSchema(owner, type);
    if (
      !schema ||
      visiting.has(schema) ||
      schema.custom ||
      !schema.static ||
      schema.node.isGeneric ||
      this.hasCustomCursorLifecycle(schema) ||
      schema.members.some(
        (member) =>
          !!member.value ||
          member.generic ||
          member.flags.has(PropertyFlags.Lazy),
      )
    )
      return false;

    visiting.add(schema);
    for (const member of schema.members) {
      if (member.nullable) continue;
      const nested = this.getDefaultSchema(schema, member.type);
      if (
        nested &&
        !this.canDeferCursorObjectDefault(schema, member.type, visiting)
      ) {
        visiting.delete(schema);
        return false;
      }
    }
    visiting.delete(schema);
    return true;
  }

  /** Skip only defaults that cannot expose or seed shared managed storage. */
  private canDeferFastDefaults(
    schema: Schema,
    visiting = new Set<Schema>(),
  ): boolean {
    if (
      !schema.fastReader ||
      schema.hasInternalInitializers ||
      schema.hasInitializerEffects ||
      this.hasCustomCursorLifecycle(schema) ||
      visiting.has(schema)
    )
      return false;
    visiting.add(schema);
    for (const member of schema.members) {
      const init = member.node.initializer;
      if (
        init &&
        !isPrimitive(stripNull(member.type)) &&
        !(
          toString(init) === "null" ||
          (init.kind === NodeKind.Literal &&
            ((init as LiteralExpression).literalKind === LiteralKind.String ||
              toString(init) === "[]"))
        )
      ) {
        visiting.delete(schema);
        return false;
      }
      if (!init && !member.nullable) {
        const nested = this.getDefaultSchema(schema, member.type);
        if (nested && !this.canDeferFastDefaults(nested, visiting)) {
          visiting.delete(schema);
          return false;
        }
      }
    }
    visiting.delete(schema);
    return true;
  }

  private hasCustomCursorInitializer(schema: Schema): boolean {
    for (
      let current: Schema | null = schema;
      current;
      current = current.parent
    ) {
      if (
        current.hasCustomCursorLifecycle &&
        current.node.members.some(
          (member) => member.name.text == "__INITIALIZE_CURSOR",
        )
      )
        return true;
    }
    return false;
  }

  private hasCustomCursorLifecycle(schema: Schema): boolean {
    for (
      let current: Schema | null = schema;
      current;
      current = current.parent
    ) {
      if (current.hasCustomCursorLifecycle) return true;
    }
    return false;
  }

  /** Extract the element type from the normalized collection spellings we emit. */
  private getDefaultElementType(type: string): string | null {
    const value = stripNull(type).trim();
    if (value.startsWith("Array<") && value.endsWith(">"))
      return value.slice(6, -1).trim();
    if (value.startsWith("StaticArray<") && value.endsWith(">"))
      return value.slice(12, -1).trim();
    return null;
  }

  /**
   * Convert a side-effect-free field initializer into the exact compact JSON
   * spelling of its value. Unsupported expressions simply disable the
   * specialization for the containing struct.
   */
  private getDefaultExpressionJSON(
    expression: Expression,
    type: string,
    owner: Schema,
    visiting: Set<Schema>,
  ): string | null {
    if (expression.kind == NodeKind.Parenthesized) {
      return this.getDefaultExpressionJSON(
        (expression as ParenthesizedExpression).expression,
        type,
        owner,
        visiting,
      );
    }
    // A cast can change the value; decline the shortcut until conversions are evaluated.
    if (expression.kind == NodeKind.Assertion) return null;
    if (expression.kind == NodeKind.Null) return "null";
    if (expression.kind == NodeKind.True) return "true";
    if (expression.kind == NodeKind.False) return "false";

    if (expression.kind == NodeKind.Literal) {
      const literal = expression as LiteralExpression;
      if (literal.literalKind == LiteralKind.String)
        return JSON.stringify((literal as StringLiteralExpression).value);
      if (literal.literalKind == LiteralKind.Integer) {
        const value = toString(expression).trim();
        return /^\d+$/.test(value) ? value : null;
      }
      if (literal.literalKind == LiteralKind.Array) {
        const elementType = this.getDefaultElementType(type);
        if (!elementType) return null;
        const values: string[] = [];
        for (const element of (literal as ArrayLiteralExpression)
          .elementExpressions) {
          const value = this.getDefaultExpressionJSON(
            element,
            elementType,
            owner,
            visiting,
          );
          if (value == null) return null;
          values.push(value);
        }
        return "[" + values.join(",") + "]";
      }
      // Float formatting is type- and precision-sensitive (notably f32), so it
      // remains on the normal parser until it can share the runtime dtoa path.
      return null;
    }

    // Integer negation is represented as a UnaryPrefix rather than a literal.
    // Rebuilding the AST text yields the exact decimal spelling for integer
    // literals while rejecting arithmetic, identifiers, and calls.
    if (expression.kind == NodeKind.UnaryPrefix) {
      const value = toString(expression).trim();
      return /^-\d+$/.test(value) ? value : null;
    }

    if (expression.kind == NodeKind.New) {
      const value = expression as NewExpression;
      if (value.args.length != 0) return null;
      const constructed = toString(value.typeName).trim();
      if (
        constructed == "Array" ||
        constructed.startsWith("Array<") ||
        constructed == "StaticArray" ||
        constructed.startsWith("StaticArray<")
      )
        return "[]";
      const nested =
        this.getDefaultSchema(owner, type) ||
        this.getDefaultSchema(owner, constructed);
      // Constructors may override declared field defaults or execute user code.
      for (let current = nested; current; current = current.parent) {
        if (current.node.members.some((m) => m.name.text === "constructor"))
          return null;
      }
      return nested ? this.getDefaultObjectJSON(nested, visiting) : null;
    }

    return null;
  }

  private getImplicitDefaultJSON(
    member: Property,
    owner: Schema,
    visiting: Set<Schema>,
  ): string | null {
    if (member.nullable) return "null";
    const type = stripNull(member.type).trim();
    if (isBoolean(type)) return "false";
    if (
      isPrimitive(type) ||
      isEnum(type, this.sources.get(owner.node.range.source), this.parser)
    )
      return "0";
    if (isString(type)) return '""';
    if (this.getDefaultElementType(type)) return "[]";
    const nested = this.getDefaultSchema(owner, type);
    // Constructors may override declared field defaults or execute user code.
    for (let current = nested; current; current = current.parent) {
      if (current.node.members.some((m) => m.name.text === "constructor"))
        return null;
    }
    return nested ? this.getDefaultObjectJSON(nested, visiting) : null;
  }

  /** Build the compact serialized form produced by a struct's declared defaults. */
  private getDefaultObjectJSON(
    schema: Schema,
    visiting: Set<Schema> = new Set<Schema>(),
  ): string | null {
    if (
      visiting.has(schema) ||
      schema.custom ||
      !schema.static ||
      schema.node.isGeneric ||
      schema.members.some(
        (member) => member.flags.size != 0 || member.custom || member.generic,
      )
    )
      return null;

    visiting.add(schema);
    const fields: string[] = [];
    for (const member of schema.members) {
      const value = member.node.initializer
        ? this.getDefaultExpressionJSON(
            member.node.initializer,
            member.type,
            schema,
            visiting,
          )
        : this.getImplicitDefaultJSON(member, schema, visiting);
      if (value == null) {
        visiting.delete(schema);
        return null;
      }
      fields.push(JSON.stringify(member.alias ?? member.name) + ":" + value);
    }
    visiting.delete(schema);
    return "{" + fields.join(",") + "}";
  }

  /**
   * Short literals benefit from a fully unrolled compare: the expected bytes
   * become v128 immediates, so the hot path performs one source load per block
   * with no loop branch or second memory stream. Wider objects retain the
   * compact shared loop to avoid bloating generated modules.
   */
  private getDefaultMatcherSource(defaultJSON: string): string {
    const literal = JSON.stringify(defaultJSON);
    if (defaultJSON.length > 256)
      return (
        `@inline __DESERIALIZE_DEFAULT(srcStart: usize, srcEnd: usize, knownMatch: bool = false): this {\n` +
        `  if (!knownMatch && !JSON.Util.matchesLiteral(srcStart, srcEnd, ${literal})) return changetype<this>(0);\n` +
        `  return changetype<this>(JSON.__allocateObject(offsetof<this>(), idof<this>())).__INITIALIZE();\n` +
        `}`
      );

    const bytes: number[] = [];
    for (let i = 0; i < defaultJSON.length; i++) {
      const code = defaultJSON.charCodeAt(i);
      bytes.push(code & 0xff, code >>> 8);
    }

    const mismatches: string[] = [];
    let offset = 0;
    for (; offset + 16 <= bytes.length; offset += 16) {
      const lanes = bytes
        .slice(offset, offset + 16)
        .map((value) => (value < 128 ? value : value - 256))
        .join(", ");
      mismatches.push(
        `v128.xor(v128.load(srcStart, ${offset}), v128(${lanes}))`,
      );
    }

    const checks: string[] = [];
    if (mismatches.length != 0) {
      // Fold every vector comparison into one accumulator. Short default
      // objects routinely span 10-30 vectors; checking groups of four added a
      // branch and v128.any_true reduction for every 64 source bytes even
      // though an exact hit is the overwhelmingly common specialization case.
      checks.push(`  let mismatch = ${mismatches[0]};`);
      for (let i = 1; i < mismatches.length; i++)
        checks.push(`  mismatch = v128.or(mismatch, ${mismatches[i]});`);
      checks.push("  if (v128.any_true(mismatch)) return false;");
    }

    const scalar = (start: number, size: number): string => {
      let value = 0n;
      for (let i = 0; i < size; i++)
        value |= BigInt(bytes[start + i]) << BigInt(i << 3);
      return "0x" + value.toString(16);
    };
    for (; offset + 8 <= bytes.length; offset += 8)
      checks.push(
        `  if (load<u64>(srcStart, ${offset}) != ${scalar(offset, 8)}) return false;`,
      );
    for (; offset + 4 <= bytes.length; offset += 4)
      checks.push(
        `  if (load<u32>(srcStart, ${offset}) != ${scalar(offset, 4)}) return false;`,
      );
    for (; offset + 2 <= bytes.length; offset += 2)
      checks.push(
        `  if (load<u16>(srcStart, ${offset}) != ${scalar(offset, 2)}) return false;`,
      );

    return (
      `@inline __DESERIALIZE_DEFAULT(srcStart: usize, srcEnd: usize, knownMatch: bool = false): this {\n` +
      `  if (!knownMatch) {\n` +
      `    if (srcEnd - srcStart != ${bytes.length}) return changetype<this>(0);\n` +
      checks
        .join("\n")
        .replaceAll("  ", "    ")
        .replaceAll("return false;", "return changetype<this>(0);") +
      `\n  }` +
      `\n  return changetype<this>(JSON.__allocateObject(offsetof<this>(), idof<this>())).__INITIALIZE();\n}`
    );
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

    // Inner type T + backing-value type for each lowered lazy slot field,
    // consumed by the schema loop + deserialize/serialize codegen below.
    const lazyInner = new Map<
      string,
      {
        inner: string;
        valueType: string;
        omitNull: boolean;
        omitIf: Expression | null;
        valueInit?: string;
        packed?: boolean;
        scalar?: boolean;
      }
    >();

    // Class-level default: `@json({ lazy: "auto" | "all" })` defers fields without
    // an explicit marker; `@eager` opts an individual field back out.
    const lazyMode = classLazyMode(node as ClassDeclaration);

    // A whole-class custom @serializer/@deserializer takes over via
    // __SERIALIZE_CUSTOM/__DESERIALIZE_CUSTOM, bypassing the generated codegen
    // (and the lazy slots) entirely - so lazy fields can't be honored here.
    const hasCustomSerde = node.members.some(
      (m) =>
        m.kind === NodeKind.MethodDeclaration &&
        (m.decorators?.some((d) => {
          const t = (<IdentifierExpression>d.name).text.toLowerCase();
          return t === "serializer" || t === "deserializer";
        }) ??
          false),
    );

    // On-demand field lowering. Rewrite each `JSON.Lazy<T>` field into a single
    // packed `u64` range slot + traced/scalar backing value + materialized flag.
    // The range slot encodes:
    //   - 0           -> absent (field omitted from the source)
    //   - start/end   -> RANGE: (start<<32)|end pointers into the source
    // The getter materializes a range on first read and stores the parsed value
    // in `__name_val`. Ranges point into the source, kept alive by a single
    // `__src` ref set via `__SET_SRC` (called by JSON.parse). Idempotent: after
    // the rewrite the field is a `u64`, so the extends re-entry won't match it.
    let __hasLazy = false;
    let sourceField = this.lazySourceFields.get(node);
    if (!sourceField) {
      sourceField = this.unusedMemberName(node, "__src");
      this.lazySourceFields.set(node, sourceField);
    }
    // For ref (non-packed) lazy fields whose slot defaults to materialized
    // (`u64.MAX_VALUE`, i.e. the field has a declared default), __INITIALIZE must
    // also seed the `__x_val` field — otherwise an *absent* such field on the
    // JSON.parse path (which runs __INITIALIZE, not the field initializers) is
    // left with `__x_lz == MAX` but `__x_val == null`, and serialize trips
    // `null as T`. Keyed by the slot field name (`__x_lz`).
    const __lazyValInits = new Map<string, string>();
    for (let i = node.members.length - 1; i >= 0; i--) {
      const fd = node.members[i];
      if (
        fd.kind !== NodeKind.FieldDeclaration ||
        fd.is(CommonFlags.Static) ||
        fd.is(CommonFlags.Private) ||
        fd.is(CommonFlags.Protected) ||
        !(fd as FieldDeclaration).type
      )
        continue;
      if (this.eagerOverrides.has(fd as FieldDeclaration)) continue;
      const written = toString((fd as FieldDeclaration).type!).trim();
      // Two equivalent ways to mark a field on-demand:
      //   - `JSON.Lazy<T>` type wrapper (transparent alias, T preserved), or
      //   - a bare `@lazy` decorator (then the written type IS the inner type).
      // The `@lazy` field is spliced out below and replaced by the lowered
      // members, so AS never validates the decorator (it's invalid on instance
      // fields); static fields are skipped above, leaving their lazy-init intact.
      const decos = (fd as FieldDeclaration).decorators;
      const hasDeco = (name: string): boolean =>
        decos?.some((d) => (<IdentifierExpression>d.name).text === name) ??
        false;
      // `Lazy<T>` wrapper (AST-detected, alias-safe), else explicit `@lazy`,
      // else the class-level mode (with `@eager`/`@omit` opting out).
      let inner: string | null = this.lazyInnerType(
        (fd as FieldDeclaration).type,
        source,
        source.getQualifiedName(node).split(".").slice(0, -1).join("."),
        node,
      );
      if (inner === null) {
        if (hasDeco("lazy")) {
          inner = written; // explicit @lazy decorator
        } else if (
          lazyMode !== "none" &&
          !hasDeco("eager") &&
          !hasDeco("omit")
        ) {
          if (lazyMode === "all") inner = written;
          else if (
            lazyAutoCost(
              this.resolveType(
                written,
                source,
                new Set(),
                source.getQualifiedName(node).split(".").slice(0, -1).join("."),
                true,
                node,
              ),
              source,
              this.parser,
            ) >= LAZY_AUTO_THRESHOLD
          )
            inner = written;
        }
      }
      if (inner === null) continue;
      if (hasDeco("omit")) {
        // Omitted fields keep their ordinary application storage; there is no
        // wire slot to defer. Remove the instance-only lazy marker.
        (fd as FieldDeclaration).decorators =
          decos?.filter(
            (d) => (<IdentifierExpression>d.name).text !== "lazy",
          ) ?? null;
        continue;
      }

      if (hasCustomSerde)
        throwError(
          "Lazy fields (@lazy / JSON.Lazy<T> / @json({ lazy })) are not supported " +
            "on a class with a custom @serializer/@deserializer - the custom methods " +
            "bypass the generated (de)serializer, so the deferred slot is never filled. " +
            "Remove the lazy marker or the custom (de)serializer.",
          fd.range,
        );

      const fname = fd.name.text;
      let backing = "__" + fname;
      for (
        let suffix = 1;
        this.unusedMemberName(node, backing + "_lz") !== backing + "_lz" ||
        this.unusedMemberName(node, backing + "_val") !== backing + "_val";
        suffix++
      )
        backing = "__" + fname + "_" + suffix;
      const slotName = backing + "_lz";
      const alias = decos?.find(
        (d) => (<IdentifierExpression>d.name).text === "alias",
      );
      const key = alias?.args?.[0]
        ? toString(alias.args[0])
        : JSON.stringify(fname);
      const optional = hasDeco("optional") ? "@optional " : "";
      const T = inner;
      const baseT = stripNull(T);
      const storesScalar =
        isPrimitive(baseT) || isEnum(baseT, source, this.parser);
      const inferredInner =
        node.typeParameters?.some(
          (parameter) => parameter.name.text === baseT,
        ) ||
        this.resolveType(
          T,
          source,
          new Set(),
          source.getQualifiedName(node).split(".").slice(0, -1).join("."),
          false,
          node,
        ) !== T;
      const valueType =
        inferredInner || storesScalar || baseT != T ? T : `${T} | null`;
      const valueDefault = isBoolean(baseT)
        ? "false"
        : storesScalar
          ? "0"
          : "null";
      // The original field's declared default (e.g. `name: string = "x"`). Lazy
      // lowering replaces the field with a slot, so without this the default is
      // lost: a constructed (not parsed) object would serialize the type default.
      // We seed the slot in the "materialized default" state. `JSON.parse` builds
      // via `__new` (no field initializers) then fills the slots, so this only
      // affects constructed instances.
      const fdInit = (fd as FieldDeclaration).initializer;
      const fieldDefault = fdInit ? toString(fdInit) : null;
      // A non-nullable ref field with no declared default seeds `__x_val` to
      // null, and the getter's `__x_val as T` aborts on null for a non-nullable
      // T. Seed the type's default instead, mirroring eager __INITIALIZE: "" for
      // strings, a fresh instance (`new T()`) for everything else - arrays, maps,
      // sets, and structs (the last only reachable as a lazy `JSON.Lazy<T>` / `!`
      // field; an absent one now yields a default instance, not null). Nullable
      // fields and scalars keep their null/0 defaults; StaticArray is left null
      // (no nullary constructor, as the eager path also skips it).
      const refDefault =
        fieldDefault != null
          ? fieldDefault
          : inferredInner || (!storesScalar && baseT == T)
            ? `${this.runtimeReference()}.__lazyDefault<${T}>()`
            : null;
      __hasLazy = true;
      // Carry @omitnull/@omitif from the original field onto the lowered slot
      // (they can't ride the u64 slot directly - @omitnull rejects primitives -
      // so the member loop sets the flags from here).
      const omitIfDeco = decos?.find(
        (d) => (<IdentifierExpression>d.name).text === "omitif",
      );
      lazyInner.set(slotName, {
        inner: T,
        valueType,
        scalar: storesScalar,
        omitNull: hasDeco("omitnull"),
        omitIf: omitIfDeco?.args?.[0] ?? null,
      });
      // `__name_lz` (u64) packs the slot state into one word - no separate
      // materialized flag needed: a real slice range is (start<<32)|end with
      // `start` a live heap pointer, so it can never be `u64.MAX_VALUE` (that
      // would need a 4GB pointer with no body). Thus:
      //   0              -> absent/unset (return the type default)
      //   u64.MAX_VALUE  -> materialized (use `__name_val`)
      //   anything else  -> a slice range to parse on first read
      // The materialized value lives in the TRACED `__name_val` (GC keeps it
      // alive; a managed pointer in the u64 would be invisible to the GC).
      // A <=32-bit scalar value is not a pointer, so it can live directly in the
      // slot's low 32 bits - no traced __name_val field needed. State for these:
      //   0                    -> absent (type default)
      //   high32 == 0xffffffff -> materialized scalar, value bits in low32
      //   anything else        -> a slice range to parse on first read
      // (0xffffffff in high32 can't be a range - `start` is never a 4GB ptr.)
      const packScalar =
        baseT === "i8" ||
        baseT === "u8" ||
        baseT === "i16" ||
        baseT === "u16" ||
        baseT === "i32" ||
        baseT === "u32" ||
        baseT === "bool" ||
        baseT === "boolean" ||
        baseT === "f32";
      const encVal = (v: string): string =>
        baseT === "f32"
          ? `(<u64>reinterpret<u32>(${v}))`
          : `(<u64><u32>(${v}))`;
      const decSlot = (lz: string): string =>
        baseT === "f32"
          ? `reinterpret<f32>(<u32>(${lz}))`
          : `(<${T}>(<u32>(${lz})))`;
      lazyInner.get(slotName)!.packed = packScalar;
      const lowered = (
        packScalar
          ? [
              `@alias(${key}) ${optional}private ${backing}_lz: u64 = ${
                fieldDefault != null
                  ? `(((<u64>0xffffffff) << 32) | ${encVal(`<${T}>(${fieldDefault})`)})`
                  : "0"
              };`,
              `get ${fname}(): ${T} {\n` +
                `  const __lz = this.${backing}_lz;\n` +
                `  if ((__lz >>> 32) == 0xffffffff) return ${decSlot("__lz")};\n` +
                `  if (__lz != 0) {\n` + // a range -> parse once, then pack
                `    const __v = JSON.__deserializeLazy<${T}>(<usize>(__lz >>> 32), <usize>(<u32>__lz), this.${sourceField});\n` +
                `    this.${backing}_lz = ((<u64>0xffffffff) << 32) | ${encVal("__v")};\n` +
                `    return __v;\n` +
                `  }\n` +
                `  return ${valueDefault};\n}`, // absent -> default
              `set ${fname}(value: ${T}) {\n` +
                `  this.${backing}_lz = ((<u64>0xffffffff) << 32) | ${encVal("value")};\n}`,
            ]
          : [
              `@alias(${key}) ${optional}private ${backing}_lz: u64 = ${
                refDefault != null ? "u64.MAX_VALUE" : "0"
              };`,
              `private ${backing}_val: ${valueType} = ${refDefault ?? valueDefault};`,
              // Slow path goes through the shared (non-inline) JSON.__deserializeValue<T>
              // so the parser is emitted once per type, not inlined into every getter.
              `get ${fname}(): ${T} {\n` +
                `  const __lz = this.${backing}_lz;\n` +
                `  if (__lz != 0 && __lz != u64.MAX_VALUE) {\n` + // a range -> parse once
                `    this.${backing}_val = JSON.__deserializeLazy<${T}>(<usize>(__lz >>> 32), <usize>(<u32>__lz), this.${sourceField});\n` +
                `    this.${backing}_lz = u64.MAX_VALUE;\n` +
                `  }\n` + // (0 -> default, MAX -> already materialized): return __val
                `  return this.${backing}_val as ${T};\n}`,
              `set ${fname}(value: ${T}) {\n` +
                `  this.${backing}_val = value;\n` +
                `  this.${backing}_lz = u64.MAX_VALUE;\n}`,
            ]
      ).map((src) => SimpleParser.parseClassMember(src, node));
      node.members.splice(i, 1, ...lowered);
      this.lazyMetadata.set(
        lowered[0] as FieldDeclaration,
        lazyInner.get(slotName)!,
      );
      // Ref lazy field whose slot seeds to materialized (MAX) - i.e. it has an
      // effective default (a declared default, or the type default for a
      // non-nullable field). Record the matching `__x_val` initializer so
      // __INITIALIZE seeds it too (the JSON.parse path skips field
      // initializers). Packed scalars carry their default in the slot itself,
      // so they need no `_val` seed.
      if (!packScalar && refDefault != null) {
        const valueInit = `  store<${valueType}>(changetype<usize>(this), ${refDefault}, offsetof<this>(${JSON.stringify(`${backing}_val`)}));\n`;
        __lazyValInits.set(`${backing}_lz`, valueInit);
        lazyInner.get(`${backing}_lz`)!.valueInit = valueInit;
      }
    }

    const members: FieldDeclaration[] = [
      ...(node.members.filter(
        (v) =>
          v.kind === NodeKind.FieldDeclaration &&
          !v.is(CommonFlags.Static) &&
          // Lazy slot fields (`__name_lz`) are emitted `private` for
          // encapsulation but must still (de)serialize - keep them.
          (!v.is(CommonFlags.Private) ||
            this.lazyMetadata.has(v as FieldDeclaration)) &&
          !v.is(CommonFlags.Protected) &&
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
          ) &&
          !v.name.text.startsWith("__try"),
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
          ) &&
          !v.name.text.startsWith("__try"),
      ),
    ] as MethodDeclaration[];

    const schema = new Schema();
    schema.node = node;
    schema.name = source.getQualifiedName(node);
    schema.hasCustomCursorLifecycle = node.members.some((member) =>
      [
        "__INITIALIZE",
        "__INITIALIZE_CURSOR",
        "__INITIALIZE_CURSOR_FRESH",
        "__INITIALIZE_DEFAULT_FRESH",
        "__FINALIZE_CURSOR",
      ].includes(member.name.text),
    );

    if (node.extendsType) {
      this.collectInheritedFieldMembers(node, source, members);
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
          const internalSearch = source.getClassInContext(extendsName, node);
          if (
            internalSearch?.decorators?.some((decorator) =>
              ["json", "serializable"].includes(toString(decorator.name)),
            )
          ) {
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
              ?.find((s) => s.node === internalSearch);
            if (!schem)
              throw new Error(
                "Could not find schema for " +
                  internalSearch.name.text +
                  " in " +
                  internalSearch.range.source.internalPath,
              );
            schema.deps.push(schem);
            schema.parent = schem;
          } else if (!internalSearch) {
            const externalSearch = source.getImportedClass(
              extendsName,
              this.parser,
            );
            if (
              externalSearch?.decorators?.some((decorator) =>
                ["json", "serializable"].includes(toString(decorator.name)),
              )
            ) {
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
                ?.find((s) => s.node === externalSearch);
              if (!schem)
                throw new Error(
                  "Could not find schema for " +
                    externalSearch.name.text +
                    " in " +
                    externalSource.internalPath,
                );
              schema.deps.push(schem);
              schema.parent = schem;
            } else {
              const availableSearch = source.getAvailableClass(
                extendsName,
                this.parser,
              );
              if (availableSearch) {
                if (DEBUG > 0)
                  console.log(
                    "Found " +
                      availableSearch.name.text +
                      " from available sources for " +
                      source.internalPath,
                  );
                const availableSource = this.sources.get(
                  availableSearch.range.source,
                );
                if (
                  availableSearch.decorators?.some((decorator) => {
                    const name = (<IdentifierExpression>decorator.name).text;
                    return name === "json" || name === "serializable";
                  })
                ) {
                  if (
                    !this.visitedClasses.has(
                      availableSource.getFullPath(availableSearch),
                    )
                  ) {
                    this.visitClassDeclarationRef(availableSearch);
                    this.schemas
                      .get(availableSource.internalPath)
                      .push(this.schema);
                    this.visitClassDeclaration(node);
                    return;
                  }
                  const schem = this.schemas
                    .get(availableSource.internalPath)
                    ?.find((s) => s.node === availableSearch);
                  if (schem) {
                    schema.deps.push(schem);
                    schema.parent = schem;
                  }
                }
              }
            }
          }
        }
      }
      if (schema.parent?.members) {
        const parentSource = this.sources.get(schema.parent.node.range.source);
        const crossesScope =
          schema.parent.node.range.source !== node.range.source ||
          parentSource
            .getQualifiedName(schema.parent.node)
            .split(".")
            .slice(0, -1)
            .join(".") !==
            source.getQualifiedName(node).split(".").slice(0, -1).join(".");
        const parentMembers = schema.parent.initializationMembers.length
          ? schema.parent.initializationMembers
          : schema.parent.members;
        for (let i = parentMembers.length - 1; i >= 0; i--) {
          const inherited = parentMembers[i];
          // Every derived declaration shadows the base, including @omit.
          if (
            node.members.some(
              (m) =>
                m.kind === NodeKind.FieldDeclaration &&
                m.name.text === inherited.name,
            )
          )
            continue;
          if (members.some((m) => m.name.text === inherited.name)) continue;
          let declaration = inherited.node;
          const parameters = schema.parent.node.typeParameters;
          const arguments_ = effectiveTypeArguments(
            parameters,
            node.extendsType.typeArguments ?? [],
          );
          if (parameters?.length && arguments_?.length) {
            const bindings = new Map<string, NamedTypeNode>();
            for (let j = 0; j < parameters.length; j++) {
              if (arguments_[j])
                bindings.set(
                  parameters[j].name.text,
                  arguments_[j] as NamedTypeNode,
                );
            }
            const lazy = this.lazyMetadata.get(declaration);
            declaration = cloneNode(declaration) as FieldDeclaration;
            class InstantiateTypes extends Visitor {
              visitNamedTypeNode(type: NamedTypeNode): void {
                const replacement = bindings.get(toString(type.name));
                if (replacement) {
                  const nullable = type.isNullable;
                  Object.assign(type, cloneNode(replacement));
                  type.isNullable ||= nullable;
                } else super.visitNamedTypeNode(type);
              }
            }
            const instantiate = new InstantiateTypes();
            instantiate.visit(declaration);
            if (lazy) {
              const instantiateType = (type: string): string => {
                const field = SimpleParser.parseClassMember(
                  "__type: " + type + ";",
                  node,
                ) as FieldDeclaration;
                instantiate.visit(field);
                return toString(field.type);
              };
              const initializer = lazy.valueInit
                ? SimpleParser.parseStatement(lazy.valueInit)
                : null;
              if (initializer) instantiate.visit(initializer);
              const omitIf = lazy.omitIf
                ? (cloneNode(lazy.omitIf) as Expression)
                : null;
              if (omitIf) instantiate.visit(omitIf);
              this.lazyMetadata.set(declaration, {
                ...lazy,
                inner: instantiateType(lazy.inner),
                valueType: instantiateType(lazy.valueType),
                valueInit: initializer
                  ? toString(initializer) + "\n"
                  : undefined,
                omitIf,
              });
            }
          }
          const inheritedLazy = this.lazyMetadata.get(declaration);
          if (
            crossesScope &&
            inheritedLazy &&
            !isPrimitive(inheritedLazy.inner) &&
            !isString(inheritedLazy.inner)
          ) {
            declaration = cloneNode(declaration) as FieldDeclaration;
            const binding = this.inheritedTypeBinding(
              inherited,
              schema.parent,
              node,
            );
            this.lazyMetadata.set(declaration, {
              ...inheritedLazy,
              inner: binding,
              valueType:
                binding +
                (inheritedLazy.valueType.endsWith(" | null") &&
                !inheritedLazy.inner.endsWith(" | null")
                  ? " | null"
                  : ""),
            });
          }
          if (isPrimitive(inherited.type) || isString(inherited.type)) {
            const lazy = this.lazyMetadata.get(declaration);
            declaration = cloneNode(declaration) as FieldDeclaration;
            if (lazy) this.lazyMetadata.set(declaration, lazy);
            declaration.type = (
              SimpleParser.parseClassMember(
                `__type: ${inherited.type};`,
                node,
              ) as FieldDeclaration
            ).type;
          }
          if (
            crossesScope &&
            !isPrimitive(inherited.type) &&
            !isString(inherited.type)
          ) {
            declaration = cloneNode(declaration) as FieldDeclaration;
            const binding = this.inheritedTypeBinding(
              inherited,
              schema.parent,
              node,
            );
            declaration.type = (
              SimpleParser.parseClassMember(
                `__type: ${binding};`,
                node,
              ) as FieldDeclaration
            ).type;
          }
          members.unshift(declaration);
        }
      }
    }

    const getUnknownTypes = (type: string, types: string[] = []): string[] => {
      type = stripNull(type);
      type = this.resolveType(
        type,
        source,
        new Set(),
        source.getQualifiedName(node).split(".").slice(0, -1).join("."),
        true,
        node,
      );
      if (type.startsWith("Array<")) {
        return getUnknownTypes(type.slice(6, -1));
      } else if (type.startsWith("StaticArray<")) {
        return getUnknownTypes(type.slice(12, -1));
      } else if (type.startsWith("Set<")) {
        return getUnknownTypes(type.slice(4, -1));
      } else if (type.startsWith("Map<")) {
        const map = (
          SimpleParser.parseTopLevelStatement(
            `type __JSON_DEPENDENCY = ${type};`,
          ) as TypeDeclaration
        ).type as NamedTypeNode;
        return (map.typeArguments ?? []).flatMap((argument) =>
          getUnknownTypes(toString(argument)),
        );
      } else if (isString(type) || isPrimitive(type)) {
        return types;
      } else if (
        ["JSON.Box", "JSON.Obj", "JSON.Arr", "JSON.Value", "JSON.Raw"].includes(
          type,
        )
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
      const declaration =
        source.getClassInContext(type, node) ||
        source.getImportedClass(type, this.parser);
      if (declaration && this.usesBuiltinRepresentation(declaration))
        return types;
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
          const internalSearch = source.getClassInContext(unknownType, node);
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
                ?.find((s) => s.node === internalSearch);
              schema.deps.push(internalSchema);
              this.schemas
                .get(internalSearch.range.source.internalPath)
                .push(this.schema);
              this.visitClassDeclaration(node);
              return;
            }
            const schem = this.schemas
              .get(internalSearch.range.source.internalPath)
              ?.find((s) => s.node === internalSearch);
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
                  ?.find(
                    (s) =>
                      s.name == externalSource.getQualifiedName(externalSearch),
                  );
                schema.deps.push(externalSchema);
                this.schemas.get(externalSource.internalPath).push(this.schema);
                this.visitClassDeclaration(node);
                return;
              }
              const schem = this.schemas
                .get(externalSource.internalPath)
                ?.find(
                  (s) =>
                    s.name == externalSource.getQualifiedName(externalSearch),
                );
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

    for (const member of members) {
      const metadata = this.lazyMetadata.get(member);
      if (!metadata) continue;
      lazyInner.set(member.name.text, metadata);
      if (metadata.valueInit)
        __lazyValInits.set(member.name.text, metadata.valueInit);
    }
    __hasLazy = lazyInner.size > 0;
    const ancestors = this.classAncestors(node);
    const inheritsLazy = ancestors.some((ancestor) =>
      this.lazySourceInstalled.has(ancestor),
    );
    const ownsLazy = node.members.some((member) =>
      this.lazyMetadata.has(member as FieldDeclaration),
    );
    if (ownsLazy && !this.lazySourceInstalled.has(node)) {
      node.members.push(
        SimpleParser.parseClassMember(
          `protected ${sourceField}: string = "";`,
          node,
        ),
        SimpleParser.parseClassMember(
          `@inline __SET_SRC(s: string): void { ${inheritsLazy ? "super.__SET_SRC(s); " : ""}this.${sourceField} = s; }`,
          node,
        ),
      );
      this.lazySourceInstalled.add(node);
    }

    this.schemas.get(source.internalPath).push(schema);
    this.schema = schema;
    this.visitedClasses.add(fullClassPath);

    const wireNodes = new Set(members);
    const generatedBacking = (field: FieldDeclaration): boolean =>
      (__hasLazy && field.name.text === sourceField) ||
      members.some(
        (member) =>
          this.lazyMetadata.has(member) &&
          field.name.text === member.name.text.slice(0, -3) + "_val",
      );
    schema.hasInternalInitializers =
      !!schema.parent?.hasInternalInitializers ||
      ancestors.some((ancestor) =>
        ancestor.members.some(
          (field) =>
            field.kind === NodeKind.FieldDeclaration &&
            !field.is(CommonFlags.Static) &&
            !!(field as FieldDeclaration).initializer &&
            (field.is(CommonFlags.Private) ||
              field.is(CommonFlags.Protected) ||
              field.decorators?.some(
                (decorator) => toString(decorator.name) === "omit",
              )),
        ),
      ) ||
      node.members.some(
        (field) =>
          field.kind === NodeKind.FieldDeclaration &&
          !field.is(CommonFlags.Static) &&
          !wireNodes.has(field as FieldDeclaration) &&
          !generatedBacking(field as FieldDeclaration) &&
          !!(field as FieldDeclaration).initializer,
      );

    schema.hasInitializerEffects = this.initializerChainHasEffects(node);

    const effectful = (
      candidate: Schema,
      seen = new Set<Schema>(),
    ): boolean => {
      if (seen.has(candidate)) return false;
      seen.add(candidate);
      return (
        candidate.custom ||
        candidate.hasInternalInitializers ||
        candidate.hasInitializerEffects ||
        candidate.deps.some((dep) => dep && effectful(dep, seen))
      );
    };
    const requestedFastPath =
      USE_FAST_PATH && !effectful(schema) && !schema.hasInternalInitializers;

    let SERIALIZE =
      "__SERIALIZE(ptr: usize): void {\n  let __dst = bs.offset;\n";
    let INITIALIZE = "@inline __INITIALIZE(): this {\n";
    let DESERIALIZE =
      '__DESERIALIZE_SLOW<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T, __resetMissing: bool = false): usize {\n  let decodedKey: string = "";\n';
    let DESERIALIZE_FAST =
      "__DESERIALIZE_FAST<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T, __resetMissing: bool = true): usize {\n";
    const lazySourceHeader = __hasLazy
      ? "  changetype<this>(out).__SET_SRC(JSON.Util.getParseSource());\n"
      : "";
    DESERIALIZE += lazySourceHeader;
    DESERIALIZE_FAST += lazySourceHeader;
    let fastPrettyTailStart = 0;
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
      this.schema.ownCustomWriter = true;
      const serializer = serializers[0];
      const serializerJsonKind = parseCustomJsonKind(serializer, "serializer");
      this.schema.customJsonKind = serializerJsonKind;

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
      const codecScope = source
        .getQualifiedName(node)
        .split(".")
        .slice(0, -1)
        .join(".");
      const selfType = serializer.signature.parameters[0]?.type;
      const selfName = selfType
        ? this.resolveType(
            toString(selfType),
            source,
            new Set(),
            codecScope,
            false,
            node,
          )
        : "this";
      const selfDeclaration = selfType
        ? source.resolveClass(toString(selfType), node, this.parser)
        : null;
      if (selfName !== "this" && selfDeclaration !== node)
        throwError(
          `Custom serializer parameter must name this or ${this.schema.name}`,
          selfType.range,
        );
      const outputType = serializer.signature.returnType;
      if (!this.isCodecStringType(outputType, source, codecScope, node))
        throwError(
          `Custom serializer for ${this.schema.name} must return string`,
          outputType?.range || serializer.range,
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
      SERIALIZE_CUSTOM += "    bs.saveState();\n";
      SERIALIZE_CUSTOM += "    const self = changetype<this>(ptr);\n";
      SERIALIZE_CUSTOM +=
        "    const data = self." +
        serializer.name.text +
        "(" +
        (serializer.signature.parameters.length ? "self" : "") +
        ");\n";
      SERIALIZE_CUSTOM += "    bs.loadState();\n";
      SERIALIZE_CUSTOM += "    const dataSize = data.length << 1;\n";
      SERIALIZE_CUSTOM += "    bs.proposeSize(dataSize);\n";
      SERIALIZE_CUSTOM +=
        "    memory.copy(bs.offset, changetype<usize>(data), dataSize);\n";
      SERIALIZE_CUSTOM += "    bs.offset += dataSize;\n";
      SERIALIZE_CUSTOM += "  }\n";
    }

    if (deserializers.length) {
      this.schema.custom = true;
      this.schema.ownCustomReader = true;
      const deserializer = deserializers[0];
      const deserializerJsonKind = parseCustomJsonKind(
        deserializer,
        "deserializer",
      );
      if (
        this.schema.customJsonKind != "any" &&
        deserializerJsonKind != "any" &&
        this.schema.customJsonKind != deserializerJsonKind
      ) {
        throwError(
          `@serializer and @deserializer JSON types for ${this.schema.name} must match`,
          deserializer.range,
        );
      }
      if (this.schema.customJsonKind == "any")
        this.schema.customJsonKind = deserializerJsonKind;
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
      const inputType = deserializer.signature.parameters[0].type;
      const codecScope = source
        .getQualifiedName(node)
        .split(".")
        .slice(0, -1)
        .join(".");
      if (!this.isCodecStringType(inputType, source, codecScope, node))
        throwError(
          "Custom deserializer parameter must be string",
          inputType?.range || deserializer.range,
        );
      const returnType = deserializer.signature.returnType;
      const returnName = returnType
        ? this.resolveType(
            toString(returnType),
            source,
            new Set(),
            codecScope,
            false,
            node,
          )
        : "";
      const returnDeclaration = returnType
        ? source.resolveClass(toString(returnType), node, this.parser)
        : null;
      if (returnName !== "this" && returnDeclaration !== node)
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

      DESERIALIZE_CUSTOM += "  __DESERIALIZE_CUSTOM(data: string): this {\n";
      DESERIALIZE_CUSTOM +=
        "    return this." + deserializer.name.text + "(data);\n";
      DESERIALIZE_CUSTOM += "  }\n";
    }

    if (!members.length && !deserializers.length && !serializers.length) {
      this.generateEmptyMethods(node);
      return;
    }

    const defaultStringLiterals = new Map<
      string,
      { expression: string; encoded: string }
    >();

    for (const member of members) {
      if (!member.type) throwError("Fields must be strongly typed", node.range);
      let type = toString(member.type!);
      type = this.resolveType(
        type,
        source,
        new Set(),
        source.getQualifiedName(node).split(".").slice(0, -1).join("."),
        true,
        node,
      );
      const namespace = schema.name.split(".").slice(0, -1);
      for (let depth = namespace.length; depth > 0; depth--) {
        const qualified =
          namespace.slice(0, depth).join(".") + "." + stripNull(type);
        if (source.getEnum(qualified)) {
          type = qualified + (type.endsWith(" | null") ? " | null" : "");
          break;
        }
      }

      const name = member.name;
      const value = member.initializer ? toString(member.initializer!) : null;

      // if (!this.isValidType(type, node)) throwError("Invalid Type. " + type + " is not a JSON-compatible type. Either decorate it with @omit, set it to private, or remove it.", member.type.range);

      if (type.startsWith("(") && type.includes("=>")) continue;

      const mem = new Property();
      mem.parent = this.schema;
      mem.name = name.text;
      mem.type = type;
      const effectiveType = this.resolveType(
        toString(member.type),
        source,
        new Set(),
        source.getQualifiedName(node).split(".").slice(0, -1).join("."),
        false,
        node,
      );
      mem.nullable =
        member.type.isNullable || effectiveType !== stripNull(effectiveType);
      const meaning = source.resolveTypeMeaning(
        toString(member.type),
        source.getQualifiedName(node).split(".").slice(0, -1).join("."),
        this.parser,
        source.classTypeParameters(node),
      );
      const writtenDeclaration =
        source.getClassInContext(stripNull(mem.type), node) ||
        source.getImportedClass(
          stripNull(mem.type).replace(/<.*>$/, "").trim(),
          this.parser,
        ) ||
        source.getEnum(stripNull(mem.type)) ||
        source.getImportedEnum(stripNull(mem.type), this.parser);
      if (
        stripNull(effectiveType) !== stripNull(mem.type) ||
        (meaning.declaration && meaning.declaration !== writtenDeclaration)
      )
        mem.generic = true;
      const representation =
        source.getClassInContext(stripNull(mem.type), node) ||
        source.getImportedClass(stripNull(mem.type), this.parser);
      if (
        representation &&
        this.usesBuiltinRepresentation(representation) &&
        !["JSON.Raw", "JSON.Value", "JSON.Obj", "JSON.Arr"].includes(
          stripNull(mem.type),
        ) &&
        !stripNull(mem.type).startsWith("JSON.Box<")
      )
        mem.generic = true;
      mem.value = value;
      mem.node = member;
      mem.byteSize = estimatedSerializedByteSize(mem.type, source, this.parser);
      if (
        member.initializer?.kind == NodeKind.Literal &&
        (member.initializer as LiteralExpression).literalKind ==
          LiteralKind.String &&
        isString(stripNull(mem.type))
      ) {
        const literal = member.initializer as StringLiteralExpression;
        const encoded = JSON.stringify(literal.value);
        mem.byteSize = encoded.length << 1;
        defaultStringLiterals.set(mem.name, {
          expression: toString(member.initializer),
          encoded,
        });
      }
      mem.custom = !!this.getSchema(type)?.customReader;
      const lzInner = lazyInner.get(name.text);
      if (lzInner !== undefined) {
        mem.flags.set(PropertyFlags.Lazy, null);
        mem.lazyPacked = !!lzInner.packed;
        mem.lazyScalar = !!lzInner.scalar;
        mem.lazyInner = lzInner.inner; // inner type T for the deser/ser codegen
        // @omitnull/@omitif carried from the original (pre-lowering) field.
        // Must also clear `schema.static` (as the decorator handler does) - it
        // gates the optional/omit serialize path; leaving it set skips omission.
        if (lzInner.omitNull) {
          mem.flags.set(PropertyFlags.OmitNull, null);
          this.schema.static = false;
        }
        if (lzInner.omitIf) {
          mem.flags.set(PropertyFlags.OmitIf, lzInner.omitIf);
          this.schema.static = false;
        }
      }

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
            case "optional": {
              // Marks the field optional for DESERIALIZATION only: the key may
              // be absent. It feeds `hasOptionalMembers` (→ the order-tolerant
              // optional deserialize path) but deliberately does NOT clear
              // `schema.static`, so serialize keeps its straight-line path and
              // still emits the field. (Clearing static routes serialize through
              // the conditional-comma path, which @optional doesn't want.)
              mem.flags.set(PropertyFlags.Optional, null);
              break;
            }
            case "omitnull": {
              if (isPrimitive(type)) {
                throwError(
                  "@omitnull cannot be used on primitive types!",
                  member.range,
                );
              } else if (!mem.nullable) {
                throwError(
                  "@omitnull cannot be used on non-nullable types!",
                  member.range,
                );
              }
              mem.flags.set(PropertyFlags.OmitNull, null);
              this.schema.static = false;
              break;
            }
          }
        }
      }

      if (mem.flags.has(PropertyFlags.OmitIf)) {
        const inherited =
          this.inheritedOrigins.get(member) ||
          this.schema.parent?.members.find(
            (parent) => parent.name === mem.name,
          );
        if (inherited?.omitIfMethod && !node.members.includes(member)) {
          mem.omitIfMethod = inherited.omitIfMethod;
        } else {
          const expression = mem.flags.get(PropertyFlags.OmitIf)!;
          const zeroParameters =
            expression.kind === NodeKind.Function &&
            !(expression as FunctionExpression).declaration.signature.parameters
              .length;
          if (expression.kind === NodeKind.Function) {
            const signature = (expression as FunctionExpression).declaration
              .signature;
            if (signature.parameters.length)
              signature.parameters[0].type = Node.createNamedType(
                Node.createSimpleTypeName("this", node.range),
                null,
                false,
                node.range,
              );
            signature.returnType = Node.createNamedType(
              Node.createSimpleTypeName("bool", node.range),
              null,
              false,
              node.range,
            );
          }
          const rendered =
            expression.kind === NodeKind.Literal &&
            (expression as LiteralExpression).literalKind === LiteralKind.String
              ? (expression as StringLiteralExpression).value
              : toString(expression);
          const baseName = "__JSON_OMIT_" + node.name.text + "_" + mem.name;
          let helper = baseName;
          for (
            let suffix = 1;
            node.members.some((field) => field.name.text === helper);
            suffix++
          )
            helper = baseName + "_" + suffix;
          const condition = zeroParameters
            ? `(${rendered})()`
            : `${this.runtimeReference()}.__omitIf(${rendered}, this)`;
          node.members.push(
            SimpleParser.parseClassMember(
              `${helper}(): bool { ${this.runtimeReference()}.__beginOmission(); const result = ${condition}; ${this.runtimeReference()}.__endOmission(); return result; }`,
              node,
            ),
          );
          mem.omitIfMethod = helper;
        }
      }
      this.schema.members.push(mem);
    }

    // @omitnull/@omitif fields are floated to the front (serialize emits them
    // with a leading comma, and the probe deserializer is order-tolerant). This
    // only moves @omit fields - @optional fields stay in DECLARATION ORDER, which
    // the order-sensitive optional fast path requires (it matches in declaration
    // order with skips, so moving them would desync against real documents).
    const initializationMembers = this.schema.members.slice();
    this.schema.initializationMembers = initializationMembers;
    this.schema.members = sortMembers(this.schema.members);

    const hasOmitIfMembers = this.schema.members.some((v) =>
      v.flags.has(PropertyFlags.OmitIf),
    );
    const hasOmitNullMembers = this.schema.members.some((v) =>
      v.flags.has(PropertyFlags.OmitNull),
    );
    const hasExplicitOptionalMembers = this.schema.members.some((v) =>
      v.flags.has(PropertyFlags.Optional),
    );
    const hasOptionalMembers =
      hasOmitIfMembers || hasOmitNullMembers || hasExplicitOptionalMembers;
    // Lazy passthrough reserves exactly the slice bytes (unlike eager string
    // serialization, which over-reserves for quotes/escaping and leaves slack).
    // The structural key writes that follow don't `ensureSize`, so for a struct
    // with lazy fields they can overrun the buffer once a passthrough leaves it
    // nearly full. Guard each key write when any field is lazy.
    const hasLazyMembers = this.schema.members.some((v) =>
      v.flags.has(PropertyFlags.Lazy),
    );
    const supportsFastOptionalPath = requestedFastPath && hasOptionalMembers;
    const hasTypeParams =
      !!node.typeParameters && node.typeParameters.length > 0;
    // Both FAST tiers - the straight-line one and the seenAny-stateful optional
    // path - are chunked into helper methods (see chunkFastBlocks /
    // chunkFastBlocksOptional), so a wide struct no longer emits a single
    // oversized function: the fast path stays compilable at any field count.
    const useFastPath =
      requestedFastPath &&
      !hasTypeParams &&
      !this.schema.members.some((member) => member.generic) &&
      (this.schema.static || supportsFastOptionalPath);
    this.schema.fastReader = useFastPath && !DESERIALIZE_CUSTOM;
    this.schema.generatedFastReader =
      this.schema.fastReader &&
      !node.members.some((member) => member.name.text === "__DESERIALIZE_FAST");

    indent = "  ";

    if (this.schema.static == false) {
      if (
        this.schema.members.some((v) => v.flags.has(PropertyFlags.OmitNull))
      ) {
        SERIALIZE += indent + "let block: usize = 0;\n";
      }
      if (hasOptionalMembers) {
        // Conditional (@omitnull/@omitif) fields emit a LEADING comma gated on
        // this flag - set true once any field has been written - so trailing
        // omitted fields never leave a dangling comma (invalid JSON).
        SERIALIZE += indent + "let wrote = false;\n";
      }
      this.schema.byteSize += 2;
      SERIALIZE += indent + "store<u16>(__dst, 123, 0); // {\n";
      SERIALIZE += indent + "__dst += 2;\n";
    }

    const isPure = this.schema.static;
    let isRegular = isPure;
    let isFirst = true;
    // Reservations cannot span callbacks that can change later field sizes.
    const canReserveDynamicPayloads = this.schema.members.every(
      (member) =>
        isReservedPrimitive(member.type) ||
        isString(member.type) ||
        /^Array<(?:i16|u16|i32|u32|i64|u64)>$/.test(member.type),
    );
    const directStringMembers =
      this.schema.static && canReserveDynamicPayloads
        ? this.schema.members.filter(
            (member) =>
              !member.flags.has(PropertyFlags.Lazy) &&
              isString(member.type) &&
              !defaultStringLiterals.has(member.name),
          )
        : [];
    // Fold every direct string payload into the object's existing reservation.
    // Even one field removes its separate capacity check and keeps the output
    // cursor local across the field boundary without changing the total bound.
    const reserveDirectStringPayloads = directStringMembers.length >= 1;
    const wideIntegerArrayCandidates =
      this.schema.static && canReserveDynamicPayloads
        ? this.schema.members.filter((member) => {
            if (
              member.flags.has(PropertyFlags.Lazy) ||
              member.nullable ||
              !member.type.startsWith("Array<")
            )
              return false;
            const element = member.type.slice(6, -1).trim();
            return ["i16", "u16", "i32", "u32", "i64", "u64"].includes(element);
          })
        : [];
    // Folding several worst-case array bounds into one reservation can retain
    // much more capacity than serializing them at their individual boundaries.
    // A single array has the same bound as the established writer without that
    // compounding risk.
    const directWideIntegerArrays =
      wideIntegerArrayCandidates.length == 1 ? wideIntegerArrayCandidates : [];

    // Value serialization for a member. A `JSON.Lazy<T>` slot (u64) emits: the
    // raw source bytes verbatim if still a range (zero-copy passthrough), the
    // serialized T if materialized, or `null` if absent.
    const serValue = (member: Property, realName: string): string => {
      if (!member.flags.has(PropertyFlags.Lazy)) {
        const defaultString = defaultStringLiterals.get(member.name);
        if (defaultString) {
          const stores = this.getStores(
            defaultString.encoded,
            this.program.options.hasFeature(Feature.Simd),
            "__dst",
          ).join("\n");
          return (
            `{\n` +
            `  const __str = load<${member.type}>(ptr, offsetof<this>(${JSON.stringify(realName)}));\n` +
            `  if (changetype<usize>(__str) == changetype<usize>(${defaultString.expression})) {\n` +
            stores
              .split("\n")
              .map((line) => `    ${line}\n`)
              .join("") +
            `  } else {\n` +
            `    bs.offset = __dst;\n` +
            `    JSON.__serialize<${member.type}>(__str);\n` +
            `    __dst = bs.offset;\n` +
            `  }\n` +
            `}\n`
          );
        }
        if (reserveDirectStringPayloads && isString(member.type)) {
          const writer = member.nullable
            ? "__serializeNullableStringPointerReservedAt"
            : "__serializeStringPointerReservedAt";
          return `__dst = JSON.${writer}(__dst, load<usize>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`;
        }
        if (directWideIntegerArrays.includes(member)) {
          return `__dst = JSON.__serializeIntegerArrayPointerReservedAt<${member.type}>(__dst, load<usize>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`;
        }
        const resolvedType = stripNull(member.type);
        const resolvedSchema = this.getSchema(resolvedType);
        if (
          resolvedSchema &&
          !resolvedSchema.custom &&
          !member.custom &&
          !member.generic &&
          !member.nullable
        ) {
          return syncSerializeCursor(
            `JSON.__serializeObject<${member.type}>(load<${member.type}>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`,
          );
        }
        return getSerializeCall(member.type, realName);
      }
      const T = member.lazyInner!;
      const baseName = realName.slice(0, -3); // "__x_lz" -> "__x"
      const baseT = stripNull(T);
      // Packed scalar slot (see the rewrite): materialized state is
      // high32 == 0xffffffff with the value bits in low32; there is no
      // __x_val field, and an absent scalar serializes its default (not null).
      const packScalar = member.lazyPacked;
      if (packScalar) {
        const dec =
          baseT === "f32"
            ? `reinterpret<f32>(<u32>(__s))`
            : `(<${T}>(<u32>(__s)))`;
        const def = baseT === "bool" || baseT === "boolean" ? "false" : "0";
        return syncSerializeCursor(
          `{\n` +
            `  const __s = this.${realName};\n` +
            `  if ((__s >>> 32) == 0xffffffff) {\n` + // materialized scalar
            `    JSON.__serializeLazyValue<${T}>(${dec});\n` +
            `  } else if (__s != 0) {\n` + // range -> raw bytes verbatim
            `    const __hi = <usize>(__s >>> 32);\n` +
            `    const __len = (<usize>(<u32>__s)) - __hi;\n` +
            `    bs.ensureSize(<u32>__len);\n` +
            `    memory.copy(bs.offset, __hi, __len);\n` +
            `    bs.offset += __len;\n` +
            `  } else {\n` + // absent -> default scalar
            `    JSON.__serializeLazyValue<${T}>(${def});\n` +
            `  }\n` +
            `}\n`,
        );
      }
      return syncSerializeCursor(
        `{\n` +
          `  const __s = this.${realName};\n` +
          `  if (__s == u64.MAX_VALUE) {\n` + // materialized -> serialize typed value
          `    JSON.__serializeLazyValue<${T}>(this.${baseName}_val as ${T});\n` +
          `  } else if (__s != 0) {\n` + // range -> raw bytes verbatim (zero-copy)
          `    const __hi = <usize>(__s >>> 32);\n` +
          `    const __len = (<usize>(<u32>__s)) - __hi;\n` +
          `    bs.ensureSize(<u32>__len);\n` +
          `    memory.copy(bs.offset, __hi, __len);\n` +
          `    bs.offset += __len;\n` +
          `  } else {\n` + // absent
          // A 64-bit scalar (i64/u64/f64/...) defaults to 0, not null; refs to null.
          (member.lazyScalar
            ? `    JSON.__serializeLazyValue<${T}>(0);\n`
            : `    bs.ensureSize(8);\n` +
              `    store<u64>(bs.offset, 0x006c006c0075006e);\n` +
              `    bs.offset += 8;\n`) +
          `  }\n` +
          `}\n`,
      );
    };

    // Fresh checked parsing replaces present collections. Defer only implicit
    // builtin defaults, and exclude observable/user-provided initialization.
    const cursorMayDefer =
      STRICT &&
      !schema.hasInternalInitializers &&
      !DESERIALIZE_CUSTOM &&
      new Set(this.schema.members.map((member) => member.alias ?? member.name))
        .size == this.schema.members.length &&
      this.schema.members.every(
        (member) =>
          !member.value &&
          !member.generic &&
          !member.flags.has(PropertyFlags.Lazy),
      ) &&
      !this.hasCustomCursorLifecycle(this.schema);
    const initializationFragments = new Map<Property, string>();
    const cursorInitializers = new Set<Property>();
    const cursorFreshInitializers = new Set<Property>();
    const cursorDeferred: Array<{ member: Property; initialize: string }> = [];
    for (let i = 0; i < this.schema.members.length; i++) {
      const member = this.schema.members[i];
      const initializeStart = INITIALIZE.length;
      const aliasName = JSON.stringify(member.alias ?? member.name);
      const realName = member.name;

      if (member.value) {
        // Always store the declared default, including null/0/0.0/false. __new()
        // returns uninitialized memory (it does NOT zero), so any field left
        // unwritten holds garbage. The fast path reads field values in place
        // (string-buffer reuse, nullable-pointer checks) and - with @optional /
        // skip-unknown - may legitimately leave a field unwritten, so every
        // field must hold its default after __INITIALIZE.
        INITIALIZE += `  store<${member.type}>(changetype<usize>(this), ${member.value}, offsetof<this>(${JSON.stringify(member.name)}));\n`;
        // A ref lazy field's slot seeds to materialized (MAX); also seed its
        // `__x_val` so an absent field doesn't serialize `null as T`.
        const __valInit = __lazyValInits.get(member.name);
        if (__valInit) INITIALIZE += __valInit;
      } else if (member.generic && !member.nullable) {
        INITIALIZE += `  store<${member.type}>(changetype<usize>(this), ${this.runtimeReference()}.__lazyDefault<${member.type}>(), offsetof<this>(${JSON.stringify(member.name)}));\n`;
      } else if (!member.nullable) {
        if (this.getSchema(member.type)) {
          INITIALIZE += `  store<${member.type}>(changetype<usize>(this), ${this.runtimeReference()}.__cursorDefault<nonnull<${member.type}>>(), offsetof<this>(${JSON.stringify(member.name)}));\n`;
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
      } else {
        // Nullable field with no explicit default: clear to null so the
        // uninitialized __new() slot isn't read as a live pointer.
        INITIALIZE += `  store<${member.type}>(changetype<usize>(this), null, offsetof<this>(${JSON.stringify(member.name)}));\n`;
      }

      let cursorInitialize = INITIALIZE.slice(initializeStart);
      // Keep field expressions in their declaring module. Inherited helpers
      // retain private lexical bindings and generic parameters in that scope.
      const initializeField = "__JSON_INITIALIZE_FIELD_" + member.name;
      const inherited =
        !!this.inheritedOrigins.get(member.node) ||
        (this.schema.parent?.members.some(
          (parent) => parent.name === member.name,
        ) &&
          !node.members.some(
            (field) =>
              field.kind === NodeKind.FieldDeclaration &&
              field.name.text === member.name,
          ));
      if (inherited) {
        cursorInitialize = `  this.${initializeField}();\n`;
      } else if (
        !node.members.some((method) => method.name.text === initializeField)
      ) {
        node.members.push(
          SimpleParser.parseClassMember(
            `@inline ${initializeField}(): void {\n${cursorInitialize}}`,
            node,
          ),
        );
      }
      initializationFragments.set(member, cursorInitialize);
      if (
        cursorMayDefer &&
        !member.nullable &&
        (/^(Array|Map|Set)</.test(member.type) ||
          this.canDeferCursorObjectDefault(this.schema, member.type))
      ) {
        cursorDeferred.push({ member, initialize: cursorInitialize });
      } else {
        cursorInitializers.add(member);
        if (cursorMayDefer && !member.nullable && isString(member.type)) {
          // Fresh string readers never inspect the old field. Only an absent
          // field needs the implicit empty-string default at completion.
          cursorDeferred.push({ member, initialize: cursorInitialize });
        } else if (!member.nullable && !isPrimitive(member.type)) {
          // Preserve eager initialization of observable nested defaults. Null
          // and scalar zero defaults are already established by fresh clearing.
          cursorFreshInitializers.add(member);
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
        if (hasLazyMembers)
          SERIALIZE +=
            indent +
            `bs.offset = __dst; bs.ensureSize(${keyPart.length << 1}); __dst = bs.offset;\n`;
        SERIALIZE += this.getStores(keyPart, SIMD_ENABLED, "__dst")
          .map((v) => indent + v + "\n")
          .join("");
        SERIALIZE += indent + serValue(member, realName);
        if (isFirst) isFirst = false;
      } else if (isRegular && !isPure) {
        // Optional fields sort ahead of regular ones, so the first regular field
        // can't tell at compile time whether anything precedes it - gate its
        // comma on `wrote`. Later regulars always follow a field, so they keep
        // the static leading comma.
        if (isFirst && hasOptionalMembers) {
          const keyPart = aliasName + ":";
          this.schema.byteSize += 2 + (keyPart.length << 1);
          SERIALIZE +=
            indent +
            "if (wrote) { store<u16>(__dst, 44, 0); __dst += 2; } // ,\n";
          if (hasLazyMembers)
            SERIALIZE +=
              indent +
              `bs.offset = __dst; bs.ensureSize(${keyPart.length << 1}); __dst = bs.offset;\n`;
          SERIALIZE += this.getStores(keyPart, SIMD_ENABLED, "__dst")
            .map((v) => indent + v + "\n")
            .join("");
          SERIALIZE += indent + serValue(member, realName);
        } else {
          const keyPart = (isFirst ? "" : ",") + aliasName + ":";
          this.schema.byteSize += keyPart.length << 1;
          if (hasLazyMembers)
            SERIALIZE +=
              indent +
              `bs.offset = __dst; bs.ensureSize(${keyPart.length << 1}); __dst = bs.offset;\n`;
          SERIALIZE += this.getStores(keyPart, SIMD_ENABLED, "__dst")
            .map((v) => indent + v + "\n")
            .join("");
          SERIALIZE += indent + serValue(member, realName);
        }
        if (isFirst) isFirst = false;
      } else {
        let omitNullCond = "true";
        if (member.flags.has(PropertyFlags.OmitNull)) {
          if (member.flags.has(PropertyFlags.Lazy)) {
            // A lazy slot's null-ness is encoded in __x_val + __x_lz (the slot
            // state) - test it without materializing.
            const base = realName.slice(0, -3); // drop "_lz"
            omitNullCond =
              `!JSON.__lazyIsNull(` +
              `load<usize>(ptr, offsetof<this>(${JSON.stringify(base + "_val")})), ` +
              `load<u64>(ptr, offsetof<this>(${JSON.stringify(realName)})))`;
          } else {
            omitNullCond = `(block = load<usize>(ptr, offsetof<this>(${JSON.stringify(realName)}))) !== 0`;
          }
        }
        if (
          member.flags.has(PropertyFlags.OmitNull) &&
          !member.flags.has(PropertyFlags.OmitIf)
        ) {
          SERIALIZE += indent + `if (${omitNullCond}) {\n`;
          indentInc();
          const keyPart = aliasName + ":";
          this.schema.byteSize += 2 + (keyPart.length << 1);
          SERIALIZE +=
            indent +
            "if (wrote) { store<u16>(__dst, 44, 0); __dst += 2; } // ,\n";
          if (hasLazyMembers)
            SERIALIZE +=
              indent +
              `bs.offset = __dst; bs.ensureSize(${keyPart.length << 1}); __dst = bs.offset;\n`;
          SERIALIZE += this.getStores(keyPart, SIMD_ENABLED, "__dst")
            .map((v) => indent + v + "\n")
            .join("");
          SERIALIZE += indent + serValue(member, realName);
          SERIALIZE += indent + "wrote = true;\n";

          indentDec();
          this.schema.byteSize += 2;
          SERIALIZE += indent + `}\n`;
        } else if (member.flags.has(PropertyFlags.OmitIf)) {
          SERIALIZE +=
            indent +
            `bs.offset = __dst;\n` +
            indent +
            `const __emit${i} = (${omitNullCond}) && !this.${member.omitIfMethod}();\n` +
            indent +
            `__dst = bs.offset;\n` +
            indent +
            `if (__emit${i}) {\n`;
          indentInc();
          this.schema.byteSize += 2;
          SERIALIZE +=
            indent +
            "if (wrote) { store<u16>(__dst, 44, 0); __dst += 2; } // ,\n";
          SERIALIZE += this.getStores(aliasName + ":", SIMD_ENABLED, "__dst")
            .map((v) => indent + v + "\n")
            .join("");
          SERIALIZE += indent + serValue(member, realName);
          SERIALIZE += indent + "wrote = true;\n";

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
      const customDep = this.getSchema(type)?.customReader
        ? this.getSchema(type)
        : null;
      const isCustomType = member.custom || !!customDep;
      if (
        isCustomType ||
        member.generic ||
        type === "JSON.Raw" ||
        type === "JSON.Value"
      ) {
        addMemberToCustomBucket(
          sortedMembers,
          member,
          member.generic ? "any" : customDep?.customJsonKind || "any",
        );
        if (member.nullable) sortedMembers.null.push(member);
      } else {
        if (member.nullable) sortedMembers.null.push(member);
        if (isString(type) || type == "Date") sortedMembers.string.push(member);
        else if (type == "JSON.Raw") sortedMembers.object.push(member);
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
        // JSON.Arr and TypedArrays/ArrayBuffer all serialize as `[...]`, so the
        // deserializer routes them through the array (`[`) branch — they must
        // live in the array bucket, not the object bucket.
        else if (
          isArray(type) ||
          type == "JSON.Arr" ||
          type == "Arr" ||
          needsReferenceLoad(type)
        )
          sortedMembers.array.push(member);
        else sortedMembers.object.push(member);
        // else console.warn("Could not determine type " + type + " for member " + member.name + " in class " + this.schema.name);
      }
    }
    const lazyMembers = this.schema.members.filter((member) =>
      member.flags.has(PropertyFlags.Lazy),
    );
    const withLazyMembers = (members: Property[]): Property[] => {
      if (!lazyMembers.length) return members;
      const out = members.slice();
      for (const member of lazyMembers) {
        if (!out.includes(member)) out.push(member);
      }
      return out;
    };
    const slowStringMembers = withLazyMembers(sortedMembers.string);
    const slowNumberMembers = withLazyMembers(sortedMembers.number);
    const slowObjectMembers = withLazyMembers(sortedMembers.object);
    const slowArrayMembers = withLazyMembers(sortedMembers.array);
    const slowBooleanMembers = withLazyMembers(sortedMembers.boolean);
    const slowNullMembers = withLazyMembers(sortedMembers.null);

    const getComparisions = (
      data: string,
      ptr: string,
      operator: string,
    ): string[] => {
      const dataBytes = data.length << 1;
      let offset = 0;
      const output: string[] = [];
      while (offset < dataBytes) {
        const rem = dataBytes - offset;
        if (rem >= 8) {
          output.push(
            `load<u64>(${ptr}, ${offset}) ${operator} 0x${toU64(data, offset >> 1).toString(16)}`,
          );
          offset += 8;
          continue;
        }
        if (rem >= 4) {
          output.push(
            `load<u32>(${ptr}, ${offset}) ${operator} 0x${toU32(data, offset >> 1).toString(16)}`,
          );
          offset += 4;
          continue;
        }
        if (rem >= 2) {
          output.push(
            `load<u16>(${ptr}, ${offset}) ${operator} 0x${data.charCodeAt(offset >> 1).toString(16)}`,
          );
          offset += 2;
          continue;
        }
      }
      return output;
    };

    // const variables = new Set<string>();
    // const getVariable = (initializer: "let" | "const", name: string, value: string, type: string | null = null): string => {
    //   if (variables.has(name)) return name + " = " + value;
    //   variables.add(name);

    //   return initializer + " " + name + " = " + value;
    // };

    const STRING_FIELD_DESERIALIZER = "__deserializeStringField";
    const STRING_FIELD_TRUSTED_DESERIALIZER = "__deserializeStringFieldTrusted";

    // Stateless adapters use a rooted descriptor for inherited virtual dispatch.
    const getCustomDeserializeExpression = (
      type: string,
      valueStart: string,
      valueEnd: string,
    ): string =>
      `JSON.__deserializeCustom<${type}>(JSON.Util.ptrToStr(${valueStart}, ${valueEnd}))`;

    const getArrayValueType = (type: string): string | null => {
      if (!type.startsWith("Array<") && !type.startsWith("StaticArray<"))
        return null;
      return stripNull(type.slice(type.indexOf("<") + 1, -1).trim());
    };

    const decodeField = (
      type: string,
      srcPtr: string,
      outPtr: string,
      member: Property,
      keyOffset: number = 0,
      fastPath: boolean = false,
      whitespaceTier: boolean = false,
    ): string[] => {
      // const isLast = this.schema.members.indexOf(member) == this.schema.members.length - 1;
      const out: string[] = [];
      const resolvedType = stripNull(type);
      const resolvedSchema = this.getSchema(resolvedType);
      const childReader =
        whitespaceTier && resolvedSchema?.generatedFastReader
          ? "__DESERIALIZE_WHITESPACE"
          : "__DESERIALIZE_FAST";
      const fieldOffset = `offsetof<this>(${JSON.stringify(member.name)})`;
      const valuePtr = keyOffset ? `${srcPtr} + ${keyOffset}` : srcPtr;

      if (member.flags.has(PropertyFlags.Lazy)) {
        // On-demand slot: scan the value's extent (same scanner JSON.Raw and
        // containers use) but store the packed range (start<<32)|end into the
        // u64 slot - no copy.
        const lazyInner = member.lazyInner!;
        out.push("{");
        out.push(
          `  const valueStart = JSON.Util.skipWhitespace(${valuePtr}, srcEnd);`,
        );
        out.push(
          `  const valueEnd = JSON.Util.scanValueEnd<${lazyInner}>(valueStart, srcEnd);`,
        );
        out.push("  if (!valueEnd) break;");
        out.push(
          `  store<u64>(${outPtr}, ((<u64>valueStart) << 32) | (<u64>(<u32>valueEnd)), ${fieldOffset});`,
        );
        out.push(`  ${srcPtr} = valueEnd;`);
        out.push("}");
        return out;
      }

      if (INTEGER_TYPES.includes(resolvedType)) {
        const helper = SIGNED_INTEGER_TYPES.includes(resolvedType)
          ? "__deserializeIntegerField"
          : "__deserializeUnsignedField";
        out.push(
          `${srcPtr} = ${helper}<${resolvedType}>(${valuePtr}, srcEnd, ${outPtr}, ${fieldOffset});`,
        );
        out.push(`if (!${srcPtr}) break;`);
      } else if (["string", "String"].includes(resolvedType)) {
        out.push("{");
        if (member.nullable) {
          out.push(`  if (load<u64>(${valuePtr}) == 30399761348886638) {`);
          out.push(
            `    store<${member.type}>(${outPtr}, changetype<${member.type}>(0), ${fieldOffset});`,
          );
          out.push(`    ${srcPtr} = ${valuePtr} + 8;`);
          out.push("  } else {");
        }
        const declaredDefaultString = defaultStringLiterals.get(member.name);
        // An empty string is already the first-token case of the field scanner
        // (opening quote followed immediately by closing quote). A dedicated
        // bounds + u32 probe taxes every non-empty field and duplicates that
        // check, so reserve literal specialization for non-empty defaults.
        const defaultString =
          declaredDefaultString?.encoded == '""'
            ? undefined
            : declaredDefaultString;
        const stringFieldDeserializer =
          fastPath && keyOffset && !member.nullable
            ? STRING_FIELD_TRUSTED_DESERIALIZER
            : STRING_FIELD_DESERIALIZER;
        const stringValuePtr =
          stringFieldDeserializer == STRING_FIELD_TRUSTED_DESERIALIZER
            ? `${valuePtr} + 2`
            : valuePtr;
        const stringFieldCall =
          stringFieldDeserializer == STRING_FIELD_TRUSTED_DESERIALIZER
            ? stringFieldDeserializer
            : `${stringFieldDeserializer}<${member.type}>`;
        if (defaultString) {
          const encodedBytes = defaultString.encoded.length << 1;
          const comparisons = getComparisions(
            defaultString.encoded,
            valuePtr,
            "==",
          ).join(" && ");
          out.push(
            `  if (${valuePtr} + ${encodedBytes} <= srcEnd && ${comparisons}) {`,
          );
          out.push(
            `    store<${member.type}>(${outPtr}, ${defaultString.expression}, ${fieldOffset});`,
          );
          out.push(`    ${srcPtr} = ${valuePtr} + ${encodedBytes};`);
          out.push("  } else {");
          out.push(
            `    ${srcPtr} = ${stringFieldCall}(${stringValuePtr}, srcEnd, ${outPtr}, ${fieldOffset});`,
          );
          out.push("  }");
        } else {
          out.push(
            `  ${srcPtr} = ${stringFieldCall}(${stringValuePtr}, srcEnd, ${outPtr}, ${fieldOffset});`,
          );
        }
        if (member.nullable) {
          out.push("  }");
        }
        out.push("}");
        out.push(`if (JSON_STRICT && !${srcPtr}) break;`);
      } else if (resolvedType == "Date") {
        out.push("{");
        if (member.nullable) {
          out.push(`  if (load<u64>(${valuePtr}) == 30399761348886638) {`);
          out.push(
            `    store<${member.type}>(${outPtr}, changetype<${member.type}>(0), ${fieldOffset});`,
          );
          out.push(`    ${srcPtr} = ${valuePtr} + 8;`);
          out.push("  } else {");
        }
        out.push(`  if (load<u16>(${valuePtr}) != 0x22) break;`);
        out.push(`  let dateEnd = ${valuePtr} + 2;`);
        out.push(`  while (dateEnd < srcEnd) {`);
        out.push(
          "    if (load<u16>(dateEnd) == 0x22 && load<u16>(dateEnd - 2) != 0x5c) break;",
        );
        out.push("    dateEnd += 2;");
        out.push("  }");
        out.push("  if (dateEnd >= srcEnd) break;");
        out.push(
          `  store<${resolvedType}>(${outPtr}, JSON.__deserializeValue<${resolvedType}>(${valuePtr}, dateEnd + 2), ${fieldOffset});`,
        );
        out.push(`  ${srcPtr} = dateEnd + 2;`);
        if (member.nullable) {
          out.push("  }");
        }
        out.push("}");
      } else if (
        resolvedType.startsWith("JSON.Box<") ||
        resolvedType.startsWith("Box<")
      ) {
        const innerType = resolvedType
          .slice(resolvedType.indexOf("<") + 1, -1)
          .trim();
        out.push("{");
        if (member.nullable) {
          out.push(`  if (load<u64>(${valuePtr}) == 30399761348886638) {`);
          out.push(
            `    store<${member.type}>(${outPtr}, changetype<${member.type}>(0), ${fieldOffset});`,
          );
          out.push(`    ${srcPtr} = ${valuePtr} + 8;`);
          out.push("  } else {");
        }
        if (innerType == "bool" || innerType == "boolean") {
          out.push(`    if (load<u64>(${valuePtr}) == 28429475166421108) {`);
          out.push(
            `      store<${resolvedType}>(${outPtr}, changetype<${resolvedType}>(JSON.Box.from<${innerType}>(true)), ${fieldOffset});`,
          );
          out.push(`      ${srcPtr} = ${valuePtr} + 8;`);
          out.push(
            "    } else if (load<u64>(" +
              valuePtr +
              ") == 32370086184550502 && load<u16>(" +
              valuePtr +
              ", 8) == 101) {",
          );
          out.push(
            `      store<${resolvedType}>(${outPtr}, changetype<${resolvedType}>(JSON.Box.from<${innerType}>(false)), ${fieldOffset});`,
          );
          out.push(`      ${srcPtr} = ${valuePtr} + 10;`);
          out.push("    } else break;");
        } else {
          out.push(`    let boxEnd = ${valuePtr};`);
          out.push("    while (boxEnd < srcEnd) {");
          out.push("      const code = load<u16>(boxEnd);");
          out.push("      if (code == 0x2c || code == 0x7d) break;");
          out.push("      boxEnd += 2;");
          out.push("    }");
          out.push(`    if (boxEnd <= ${valuePtr}) break;`);
          out.push(
            `    store<${resolvedType}>(${outPtr}, changetype<${resolvedType}>(JSON.Box.from<${innerType}>(JSON.__deserializeValue<${innerType}>(${valuePtr}, boxEnd))), ${fieldOffset});`,
          );
          out.push(`    ${srcPtr} = boxEnd;`);
        }
        if (member.nullable) {
          out.push("  }");
        }
        out.push("}");
      } else if (resolvedType == "JSON.Raw") {
        out.push("{");
        if (member.nullable) {
          out.push(
            `if (srcEnd - ${valuePtr} >= 8 && load<u64>(${valuePtr}) == 30399761348886638) {`,
          );
          out.push(
            `store<usize>(${outPtr}, 0, ${fieldOffset}); ${srcPtr} = ${valuePtr} + 8;`,
          );
          out.push("} else {");
        }
        out.push(`  const valueStart = ${valuePtr};`);
        out.push(
          `  const valueEnd = JSON.Util.scanValueEnd<JSON.Raw>(valueStart, srcEnd);`,
        );
        out.push("  if (!valueEnd) break;");
        out.push(
          `  store<${member.type}>(${outPtr}, JSON.Raw.from(JSON.Util.ptrToStr(valueStart, valueEnd)), ${fieldOffset});`,
        );
        out.push(`  ${srcPtr} = valueEnd;`);
        if (member.nullable) out.push("}");
        out.push("}");
      } else if (isBoolean(resolvedType)) {
        out.push(`if (load<u64>(${srcPtr}) == 28429475166421108) {`);
        out.push(`  store<${resolvedType}>(${outPtr}, true, ${fieldOffset});`);
        out.push(`  ${srcPtr} += 8;`);
        out.push(
          "} else if (load<u64>(" +
            srcPtr +
            ") == 32370086184550502 && load<u16>(" +
            srcPtr +
            ", 8) == 101) {",
        );
        out.push(`  store<${resolvedType}>(${outPtr}, false, ${fieldOffset});`);
        out.push(`  ${srcPtr} += 10;`);
        out.push("} else break;");
      } else if (FLOAT_TYPES.includes(resolvedType)) {
        out.push(
          `${srcPtr} = __deserializeFloatField<${resolvedType}>(${valuePtr}, srcEnd, ${outPtr}, ${fieldOffset});`,
        );
        out.push(`if (!${srcPtr}) break;`);
      } else if (resolvedSchema?.customReader) {
        out.push("{");
        if (member.nullable) {
          out.push(`  if (load<u64>(${valuePtr}) == 30399761348886638) {`);
          out.push(
            `    store<${member.type}>(${outPtr}, changetype<${member.type}>(0), ${fieldOffset});`,
          );
          out.push(`    ${srcPtr} = ${valuePtr} + 8;`);
          out.push("  } else {");
        }
        out.push(`  const valueStart = ${valuePtr};`);
        out.push(
          `  const valueEnd = JSON.Util.scanValueEnd<${resolvedType}>(valueStart, srcEnd);`,
        );
        out.push("  if (!valueEnd) break;");
        out.push(
          `  store<${member.type}>(${outPtr}, ${getCustomDeserializeExpression(resolvedType, "valueStart", "valueEnd")}, ${fieldOffset});`,
        );
        out.push(`  ${srcPtr} = valueEnd;`);
        if (member.nullable) {
          out.push("  }");
        }
        out.push("}");
      } else if (resolvedSchema && !resolvedSchema.customReader) {
        if (fastPath && resolvedSchema.fastReader) {
          out.push("{");
          if (member.nullable) {
            out.push(`  if (load<u64>(${valuePtr}) == 30399761348886638) {`);
            out.push(
              `    store<${resolvedType}>(${outPtr}, changetype<${resolvedType}>(0), ${fieldOffset});`,
            );
            out.push(`    ${srcPtr} = ${valuePtr} + 8;`);
            out.push("  } else {");
          }
          out.push("  let __initialized = false;");
          out.push(
            `  let value = changetype<${resolvedType}>(JSON.Util.reuseCompositeBuffer(load<usize>(${outPtr}, ${fieldOffset}), ${outPtr} + ${fieldOffset}));`,
          );
          out.push(`  if (changetype<usize>(value) == 0) {`);
          out.push(
            `    value = changetype<${resolvedType}>(JSON.__allocateObject(offsetof<nonnull<${resolvedType}>>(), idof<nonnull<${resolvedType}>>()));`,
          );
          out.push(
            `    store<${resolvedType}>(${outPtr}, value, ${fieldOffset});`,
          );
          out.push(
            `    if (isManaged<${resolvedType}>()) __link(${outPtr}, changetype<usize>(value), false);`,
          );
          // A generated fast reader assigns present fields and restores omitted
          // defaults. Start with safe zeroed reference slots, rather than build
          // a default graph that this successful parse immediately replaces.
          if (this.canDeferFastDefaults(resolvedSchema)) {
            out.push(
              `    memory.fill(changetype<usize>(value), 0, offsetof<nonnull<${resolvedType}>>());`,
            );
          } else {
            out.push(
              `    changetype<nonnull<${resolvedType}>>(value).__INITIALIZE();`,
            );
            out.push("    __initialized = true;");
          }
          out.push("  }");
          // Per-class fallback: if this nested object can't be handled on the
          // fast path (out-of-order keys, an unmodeled/extra key, etc.), parse
          // just this one object via its own slow path and keep the parent on
          // the fast path - rather than failing the whole document.
          out.push(
            `  const __fe = changetype<nonnull<${resolvedType}>>(value).${childReader}<${resolvedType}>(${valuePtr}, srcEnd, value, !__initialized);`,
          );
          out.push(`  if (__fe) {`);
          out.push(`    ${srcPtr} = __fe;`);
          out.push(`  } else {`);
          out.push(
            `    const __ve = JSON.Util.scanValueEnd<${resolvedType}>(${valuePtr}, srcEnd);`,
          );
          out.push(`    if (!__ve) break;`);
          // The failed fast attempt may have written some fields already; reset
          // to defaults so the slow re-parse doesn't leave stale values in fields
          // that are absent from this object.
          out.push(
            `    changetype<nonnull<${resolvedType}>>(value).__INITIALIZE();`,
          );
          out.push(
            `    changetype<nonnull<${resolvedType}>>(value).__DESERIALIZE_SLOW<${resolvedType}>(${valuePtr}, __ve, value);`,
          );
          // Advance to the scanned object end (not the slow path's return value,
          // which may stop short of `}` and desync the parent's fast loop).
          out.push(`    ${srcPtr} = __ve;`);
          out.push(`  }`);
          if (member.nullable) {
            out.push("  }");
          }
          out.push("}");
          return out;
        }
        out.push("{");
        if (member.nullable) {
          out.push(`  if (load<u64>(${srcPtr}) == 30399761348886638) {`);
          out.push(
            `    store<${resolvedType}>(${outPtr}, changetype<${resolvedType}>(0), ${fieldOffset});`,
          );
          out.push(`    ${srcPtr} += 8;`);
          out.push("  } else {");
        }
        out.push("  let __initialized = false;");
        out.push(
          `  let value = changetype<${resolvedType}>(JSON.Util.reuseCompositeBuffer(load<usize>(${outPtr}, ${fieldOffset}), ${outPtr} + ${fieldOffset}));`,
        );
        out.push(`  if (changetype<usize>(value) == 0) {`);
        out.push(
          `    value = changetype<${resolvedType}>(JSON.__allocateObject(offsetof<nonnull<${resolvedType}>>(), idof<nonnull<${resolvedType}>>()));`,
        );
        out.push(
          `    store<${resolvedType}>(${outPtr}, value, ${fieldOffset});`,
        );
        out.push(
          `    if (isManaged<${resolvedType}>()) __link(${outPtr}, changetype<usize>(value), false);`,
        );
        out.push(
          `    changetype<nonnull<${resolvedType}>>(value).__INITIALIZE();`,
        );
        out.push("    __initialized = true;");
        out.push("  }");
        out.push(`  const valueStart = ${valuePtr};`);
        out.push(
          `  const valueEnd = JSON.Util.scanValueEnd<${resolvedType}>(valueStart, srcEnd);`,
        );
        out.push("  if (!valueEnd) break;");
        if (fastPath && resolvedSchema.fastReader) {
          out.push(
            `  ${srcPtr} = changetype<nonnull<${resolvedType}>>(value).${childReader}<${resolvedType}>(valueStart, valueEnd, value, !__initialized);`,
          );
        } else {
          out.push(
            `  ${srcPtr} = changetype<nonnull<${resolvedType}>>(value).__DESERIALIZE_SLOW<${resolvedType}>(valueStart, valueEnd, value, !__initialized);`,
          );
        }
        if (member.nullable) {
          out.push("  }");
        }
        out.push("}");
      } else if (resolvedType.startsWith("Array<")) {
        const valueType = getArrayValueType(resolvedType);
        // The raw inner type carries the per-element nullability that
        // `getArrayValueType` strips. We need it to decide whether to emit
        // an inline `null` token check inside the per-element loop below.
        const rawInner = resolvedType
          .slice(resolvedType.indexOf("<") + 1, -1)
          .trim();
        const elementNullable = stripNull(rawInner) !== rawInner;
        out.push("{");
        if (member.nullable) {
          out.push(`  if (load<u64>(${valuePtr}) == 30399761348886638) {`);
          out.push(
            `    store<${member.type}>(${outPtr}, changetype<${member.type}>(0), ${fieldOffset});`,
          );
          out.push(`    ${srcPtr} = ${valuePtr} + 8;`);
          out.push("  } else {");
        }
        if (fastPath && valueType && ["string", "String"].includes(valueType)) {
          out.push(`  if (load<u16>(${valuePtr}) != 0x5b) break;`);
          out.push(
            `  let value = changetype<${resolvedType}>(JSON.Util.reuseCompositeBuffer(load<usize>(${outPtr}, ${fieldOffset}), ${outPtr} + ${fieldOffset}));`,
          );
          out.push("  if (changetype<usize>(value) == 0) {");
          out.push(`    value = JSON.__newArray<nonnull<${resolvedType}>>();`);
          out.push(
            `    store<${resolvedType}>(${outPtr}, value, ${fieldOffset});`,
          );
          out.push(
            `    if (isManaged<${resolvedType}>()) __link(${outPtr}, changetype<usize>(value), false);`,
          );
          out.push("  }");
          out.push("  let index = 0;");
          out.push("  const reusableLength = value.length;");
          out.push("  const reusableDataStart = value.dataStart;");
          out.push(`  ${srcPtr} = ${valuePtr} + 2;`);
          out.push(
            `  ${srcPtr} = JSON.Util.skipWhitespace(${srcPtr}, srcEnd);`,
          );
          out.push(`  if (load<u16>(${srcPtr}) == 0x5d) {`);
          out.push("    if (value.length != 0) value.length = 0;");
          out.push(`    ${srcPtr} += 2;`);
          out.push("  } else while (true) {");
          out.push(
            `    ${srcPtr} = JSON.Util.skipWhitespace(${srcPtr}, srcEnd);`,
          );
          // For nullable elements we push a null reference to grow the array;
          // for non-nullable we push the interned empty string. Either way
          // the slot is overwritten by the per-element parse below.
          if (elementNullable) {
            out.push(
              `    if (index >= reusableLength) value.push(changetype<${valueType} | null>(0));`,
            );
            out.push(
              `    const slot = index < reusableLength ? reusableDataStart + ((<usize>index) << alignof<${valueType}>()) : value.dataStart + ((<usize>index) << alignof<${valueType}>());`,
            );
            // Single-u64 `null` token compare. 8 bytes = 4 UTF-16 chars.
            // Store 0 to the slot via the array's `dataStart` and skip 8
            // source bytes. No String allocation, no Box object.
            out.push(`    if (load<u64>(${srcPtr}) == 30399761348886638) {`);
            out.push("      store<usize>(slot, 0);");
            out.push(`      ${srcPtr} += 8;`);
            out.push("    } else {");
            out.push(
              `      ${srcPtr} = ${STRING_FIELD_DESERIALIZER}<${valueType}>(${srcPtr}, srcEnd, slot);`,
            );
            out.push("    }");
          } else {
            out.push('    if (index >= reusableLength) value.push("");');
            out.push(
              `    const slot = index < reusableLength ? reusableDataStart + ((<usize>index) << alignof<${valueType}>()) : value.dataStart + ((<usize>index) << alignof<${valueType}>());`,
            );
            out.push(
              `    ${srcPtr} = ${STRING_FIELD_DESERIALIZER}<${valueType}>(${srcPtr}, srcEnd, slot);`,
            );
          }
          out.push("    index++;");
          out.push(
            `    ${srcPtr} = JSON.Util.skipWhitespace(${srcPtr}, srcEnd);`,
          );
          out.push(`    const code = load<u16>(${srcPtr});`);
          out.push("    if (code == 0x2c) {");
          out.push(`      ${srcPtr} += 2;`);
          out.push("      continue;");
          out.push("    }");
          out.push("    if (code == 0x5d) {");
          out.push("      if (index != reusableLength) value.length = index;");
          out.push(`      ${srcPtr} += 2;`);
          out.push("      break;");
          out.push("    }");
          out.push("    break;");
          out.push("  }");
          if (member.nullable) {
            out.push("  }");
          }
          out.push("}");
          return out;
        }
        const valueSchema = valueType ? this.getSchema(valueType) : null;
        if (
          fastPath &&
          valueType &&
          valueSchema?.fastReader &&
          !elementNullable &&
          !valueSchema.customReader
        ) {
          out.push(`  if (load<u16>(${valuePtr}) != 0x5b) break;`);
          out.push(
            `  let value = changetype<${resolvedType}>(JSON.Util.reuseCompositeBuffer(load<usize>(${outPtr}, ${fieldOffset}), ${outPtr} + ${fieldOffset}));`,
          );
          out.push("  if (changetype<usize>(value) == 0) {");
          out.push(`    value = JSON.__newArray<nonnull<${resolvedType}>>();`);
          out.push(
            `    store<${resolvedType}>(${outPtr}, value, ${fieldOffset});`,
          );
          out.push(
            `    if (isManaged<${resolvedType}>()) __link(${outPtr}, changetype<usize>(value), false);`,
          );
          out.push("  }");
          out.push("  let index = 0;");
          // The steady-state parse reuses the same object graph. Cache the
          // original array metadata once, exactly as the SWAR array bodies do,
          // so every element avoids an Array.length load, growth branch, and
          // indexed-access helper. Once index reaches reusableLength we only
          // append, so a push-induced relocation cannot invalidate any slot we
          // still need from reusableDataStart.
          out.push("  const reusableLength = value.length;");
          out.push("  const reusableDataStart = value.dataStart;");
          out.push(
            "  const scopedOwnership = JSON.Util.hasCompositeReuseScope();",
          );
          out.push(
            "  const reusedValues = !scopedOwnership && reusableLength > 16 ? new Set<usize>() : changetype<Set<usize>>(0);",
          );
          out.push(`  ${srcPtr} = ${valuePtr} + 2;`);
          out.push(
            `  ${srcPtr} = JSON.Util.skipWhitespace(${srcPtr}, srcEnd);`,
          );
          out.push(`  if (load<u16>(${srcPtr}) == 0x5d) {`);
          out.push("    if (value.length != 0) value.length = 0;");
          out.push(`    ${srcPtr} += 2;`);
          out.push("  } else while (true) {");
          out.push("    let __itemInitialized = false;");
          out.push(`    let item: ${valueType};`);
          out.push("    if (index < reusableLength) {");
          out.push(
            `      const itemSlot = reusableDataStart + ((<usize>index) << alignof<${valueType}>());`,
          );
          out.push(`      item = load<${valueType}>(itemSlot);`);
          out.push(
            "      if (!scopedOwnership && changetype<usize>(item) != 0) {",
          );
          out.push("        const ref = changetype<usize>(item);");
          out.push("        if (changetype<usize>(reusedValues)) {");
          out.push(
            `          if (reusedValues.has(ref)) item = changetype<${valueType}>(0);`,
          );
          out.push("          else reusedValues.add(ref);");
          out.push("        } else if (index > 0) {");
          out.push("          let prior = 0;");
          out.push("          while (prior < index) {");
          out.push(
            `            if (changetype<usize>(load<${valueType}>(reusableDataStart + ((<usize>prior) << alignof<${valueType}>()))) == ref) {`,
          );
          out.push(`              item = changetype<${valueType}>(0);`);
          out.push("              break;");
          out.push("            }");
          out.push("            prior++;");
          out.push("          }");
          out.push("        }");
          out.push("      }");
          out.push(
            "      item = changetype<" +
              valueType +
              ">(JSON.Util.reuseCompositeBuffer(changetype<usize>(item), itemSlot));",
          );
          out.push("      if (changetype<usize>(item) == 0) {");
          out.push(
            `        item = changetype<${valueType}>(JSON.__allocateObject(offsetof<nonnull<${valueType}>>(), idof<nonnull<${valueType}>>()));`,
          );
          if (this.canDeferFastDefaults(valueSchema)) {
            out.push(
              `        memory.fill(changetype<usize>(item), 0, offsetof<nonnull<${valueType}>>());`,
            );
          } else {
            out.push(
              `        changetype<nonnull<${valueType}>>(item).__INITIALIZE();`,
            );
            out.push("        __itemInitialized = true;");
          }
          out.push(`        store<${valueType}>(itemSlot, item);`);
          out.push(
            "        __link(changetype<usize>(value), changetype<usize>(item), false);",
          );

          out.push("      }");
          out.push("    } else {");
          out.push(
            `      item = changetype<${valueType}>(JSON.__allocateObject(offsetof<nonnull<${valueType}>>(), idof<nonnull<${valueType}>>()));`,
          );
          if (this.canDeferFastDefaults(valueSchema)) {
            out.push(
              `      memory.fill(changetype<usize>(item), 0, offsetof<nonnull<${valueType}>>());`,
            );
          } else {
            out.push(
              `      changetype<nonnull<${valueType}>>(item).__INITIALIZE();`,
            );
            out.push("      __itemInitialized = true;");
          }
          out.push("      value.push(item);");

          out.push("    }");
          // Per-element fallback: an element the fast path can't handle parses
          // via its own slow path; the rest of the array stays on the fast path.
          out.push(`    const __es = ${srcPtr};`);
          out.push(
            `    const __ee = changetype<nonnull<${valueType}>>(item).${whitespaceTier && valueSchema.generatedFastReader ? "__DESERIALIZE_WHITESPACE" : "__DESERIALIZE_FAST"}<${valueType}>(${srcPtr}, srcEnd, item, !__itemInitialized);`,
          );
          out.push(`    if (__ee) {`);
          out.push(`      ${srcPtr} = __ee;`);
          out.push(`    } else {`);
          out.push(
            `      const __ve = JSON.Util.scanValueEnd<${valueType}>(__es, srcEnd);`,
          );
          out.push(`      if (!__ve) break;`);
          // Reset before the slow re-parse (see the nested-struct fallback).
          out.push(
            `      changetype<nonnull<${valueType}>>(item).__INITIALIZE();`,
          );
          out.push(
            `      changetype<nonnull<${valueType}>>(item).__DESERIALIZE_SLOW<${valueType}>(__es, __ve, item);`,
          );
          // Advance to the scanned element end (not the slow return).
          out.push(`      ${srcPtr} = __ve;`);
          out.push(`    }`);
          out.push("    index++;");
          out.push(
            `    ${srcPtr} = JSON.Util.skipWhitespace(${srcPtr}, srcEnd);`,
          );
          out.push(`    const code = load<u16>(${srcPtr});`);
          out.push("    if (code == 0x2c) {");
          out.push(`      ${srcPtr} += 2;`);
          out.push("      continue;");
          out.push("    }");
          out.push("    if (code == 0x5d) {");
          out.push("      if (reusableLength != index) value.length = index;");
          out.push(`      ${srcPtr} += 2;`);
          out.push("      break;");
          out.push("    }");
          out.push("    break;");
          out.push("  }");
          if (member.nullable) {
            out.push("  }");
          }
          out.push("}");
          return out;
        }
        {
          out.push(
            `  if (${valuePtr} + 4 <= srcEnd && load<u32>(${valuePtr}) == 0x005d005b) {`,
          );
          out.push(
            `    let value = changetype<${resolvedType}>(JSON.Util.reuseCompositeBuffer(load<usize>(${outPtr}, ${fieldOffset}), ${outPtr} + ${fieldOffset}));`,
          );
          out.push("    if (changetype<usize>(value) == 0) {");
          out.push(
            `      value = JSON.__emptyArray<nonnull<${resolvedType}>>();`,
          );
          out.push(
            `      store<${resolvedType}>(${outPtr}, value, ${fieldOffset});`,
          );
          out.push(
            `      if (isManaged<${resolvedType}>()) __link(${outPtr}, changetype<usize>(value), false);`,
          );
          out.push("    } else if (value.length != 0) {");
          out.push("      value.length = 0;");
          out.push("    }");
          out.push(`    ${srcPtr} = ${valuePtr} + 4;`);
          out.push("  } else {");
          out.push(
            `    ${srcPtr} = __deserializeArrayField_SWAR<nonnull<${resolvedType}>>(${valuePtr}, srcEnd, ${outPtr}, ${fieldOffset});`,
          );
          out.push(`    if (!${srcPtr}) break;`);
          out.push("  }");
        }
        if (member.nullable) {
          out.push("  }");
        }
        out.push("}");
      } else if (resolvedType.startsWith("Map<")) {
        out.push(
          `${srcPtr} = __deserializeMapField<${resolvedType}>(${srcPtr}, srcEnd, ${outPtr}, ${fieldOffset});`,
        );
        out.push(`if (!${srcPtr}) break;`);
      } else if (
        resolvedType.startsWith("Set<") ||
        resolvedType.startsWith("StaticArray<")
      ) {
        const reader = resolvedType.startsWith("Set<")
          ? "__deserializeSetField"
          : "__deserializeStaticArrayField";
        if (member.nullable) {
          out.push(
            `if (srcEnd - ${srcPtr} >= 8 && load<u64>(${srcPtr}) == 30399761348886638) {`,
          );
          out.push(`  store<usize>(${outPtr}, 0, ${fieldOffset});`);
          out.push(`  ${srcPtr} += 8;`);
          out.push("} else {");
        }
        out.push(
          `${srcPtr} = ${reader}<${resolvedType}>(${srcPtr}, srcEnd, ${outPtr}, ${fieldOffset});`,
        );
        out.push(`if (!${srcPtr}) break;`);
        if (member.nullable) out.push("}");
      } else if (
        resolvedType == "JSON.Value" ||
        resolvedType == "JSON.Obj" ||
        resolvedType == "JSON.Arr" ||
        isEnum(
          resolvedType,
          this.sources.get(this.schema.node.range.source),
          this.parser,
        )
      ) {
        // Avoid scanValueEnd in fast path; fall back to slow for complex values.
        out.push("break;");
      } else {
        // Avoid scanValueEnd in fast path; fall back to slow for complex values.
        out.push("break;");
      }
      return out;
    };

    const getDeserializer = (
      type: string,
      srcPtr: string,
      outPtr: string,
      member: Property,
      keyOffset = 0,
      fastPath = false,
      whitespaceTier = false,
    ): string[] => {
      const body = decodeField(
        type,
        srcPtr,
        outPtr,
        member,
        keyOffset,
        fastPath,
        whitespaceTier,
      );
      const schema = this.getSchema(stripNull(type));
      // Composite field helpers may publish a new reference. Link it before
      // leaving the decoder; strings and generated object allocations already
      // publish through their own barriers. Lazy slots contain source ranges.
      if (
        !member.flags.has(PropertyFlags.Lazy) &&
        !isString(stripNull(type)) &&
        (!schema || schema.customReader)
      ) {
        body.push(
          `if (isManaged<${member.type}>()) __link(${outPtr}, load<usize>(${outPtr}, offsetof<this>(${JSON.stringify(member.name)})), false);`,
        );
      }
      return body;
    };

    indent = "  ";

    // Chunked FAST deserialization. A wide struct would otherwise emit one
    // enormous __DESERIALIZE_FAST - large enough to crash the Binaryen optimizer
    // past a few hundred fields. Split the per-field blocks across helper methods
    // so every generated function stays small; the main path calls them in order
    // and bails (to tier 2 / slow) the moment one returns 0. A pointer srcStart is
    // never 0, so it doubles as the bail sentinel. Only the straight-line (no
    // optional fields) tiers are chunked; the seenAny-stateful optional tiers
    // stay inline and route wide structs to slow via the useFastPath gate.
    const FAST_CHUNK_SIZE = 32;
    const fastChunkMethods: string[] = [];
    let fastChunkId = 0;
    const chunkFastBlocks = (
      blocks: string[],
      tag: string,
      callIndent: string,
    ): string => {
      if (blocks.length <= FAST_CHUNK_SIZE) return blocks.join("");
      let calls = "";
      for (let c = 0; c < blocks.length; c += FAST_CHUNK_SIZE) {
        const name = `__DESERIALIZE_FAST_${tag}_${fastChunkId++}`;
        const body = blocks.slice(c, c + FAST_CHUNK_SIZE).join("");
        fastChunkMethods.push(
          `${name}(srcStart: usize, srcEnd: usize, dst: usize): usize {\n  do {\n${body}\n    return srcStart;\n  } while (false);\n  return 0;\n}`,
        );
        calls +=
          `${callIndent}srcStart = this.${name}(srcStart, srcEnd, dst);\n` +
          `${callIndent}if (srcStart == 0) break;\n`;
      }
      return calls;
    };
    // Same idea for the seenAny-stateful optional tiers, but seenAny has to cross
    // chunk boundaries: pass it in as a bool param and return it packed into the
    // high 32 bits of a u64 alongside srcStart (low 32). A 0 return is still the
    // bail sentinel. tier2 also needs a chunk-local `kp` scratch.
    const chunkFastBlocksOptional = (
      blocks: string[],
      _tag: string,
      _callIndent: string,
      _needsKp: boolean,
    ): string => {
      // The optional probe path is emitted as a SINGLE function. Its chunked
      // form threads `seenAny`/`kp` across helper-method boundaries and
      // miscompiles - large optional structs (e.g. a 40-field user) trapped at
      // runtime. Emitting inline is correct; compile time is not a concern.
      // (Static structs still chunk via chunkFastBlocks, which is correct.)
      return blocks.join("");
    };

    // Reset individual omissions without discarding present reusable buffers.
    // Field helpers use raw stores, so publish managed defaults with barriers.
    const resetField = (member: Property, destination: string): string => {
      const offset = `offsetof<this>(${JSON.stringify(member.name)})`;
      let body = initializationFragments.get(member)?.trim()
        ? `changetype<this>(${destination}).__JSON_INITIALIZE_FIELD_${member.name}();`
        : `store<${member.type}>(${destination}, JSON.__zero<${member.type}>(), ${offset});`;
      body += ` if (isManaged<${member.type}>()) __link(${destination}, load<usize>(${destination}, ${offset}), false);`;
      if (member.flags.has(PropertyFlags.Lazy) && !member.lazyPacked) {
        const backing = member.name.slice(0, -3) + "_val";
        if (!__lazyValInits.has(member.name)) {
          const type =
            this.lazyMetadata.get(member.node)?.valueType || member.lazyInner!;
          body += ` store<${type}>(${destination}, JSON.__zero<${type}>(), offsetof<this>(${JSON.stringify(backing)}));`;
        }
        body += ` if (isManaged<${member.lazyInner}>()) __link(${destination}, load<usize>(${destination}, offsetof<this>(${JSON.stringify(backing)})), false);`;
      }
      return `{ ${body} }`;
    };

    const missingIndex = new Map(
      initializationMembers.map((member, index) => [member, index]),
    );
    const missingDeclarations = (pad: string): string =>
      Array.from(
        { length: Math.ceil(initializationMembers.length / 64) },
        (_, group) => `${pad}let __missing${group}: u64 = 0;\n`,
      ).join("");
    const markMissing = (member: Property): string => {
      const index = missingIndex.get(member)!;
      return `__missing${index >>> 6} |= <u64>1 << ${index & 63};`;
    };
    const commitMissing = (pad: string, optionalOnly: boolean): string => {
      let body = "";
      for (let group = 0; group * 64 < initializationMembers.length; group++) {
        body += `${pad}if (__missing${group} != 0) {\n`;
        for (
          let index = group * 64;
          index < Math.min((group + 1) * 64, initializationMembers.length);
          index++
        ) {
          const member = initializationMembers[index];
          if (
            optionalOnly &&
            ![
              PropertyFlags.Optional,
              PropertyFlags.OmitIf,
              PropertyFlags.OmitNull,
            ].some((flag) => member.flags.has(flag))
          )
            continue;
          body += `${pad}  if ((__missing${group} & (<u64>1 << ${index & 63})) != 0) ${resetField(member, "dst")}\n`;
        }
        body += `${pad}}\n`;
      }
      return body;
    };

    // Tier selection is local to each invocation: always enter tier 1.
    const traceOptionalObject = false;
    const objectTraceHeader = traceOptionalObject
      ? "  const __traceToken = JSON.Util.beginObjectTrace(dst, start, " +
        JSON.stringify(this.schema.name) +
        ");\n" +
        "  const __traceActive = __traceToken != i32.MIN_VALUE;\n" +
        "  const __traceHit = __traceActive && __traceToken < 0;\n" +
        "  const __traceSlot = __traceHit ? ~__traceToken : __traceToken;\n" +
        "  const __traceMask = __traceHit ? JSON.Util.getObjectTraceMask(__traceSlot) : <u64>0;\n" +
        "  const __traceTier = __traceHit ? JSON.Util.getObjectTraceTier(__traceSlot) : <u8>0;\n" +
        "  let __tracePresent: u64 = 0;\n"
      : "";

    DESERIALIZE_FAST += indent + "const start = srcStart;\n";
    DESERIALIZE_FAST += indent + "const dst = changetype<usize>(out);\n";
    if (traceOptionalObject) {
      DESERIALIZE_FAST += objectTraceHeader;
      DESERIALIZE_FAST += indent + "if (__traceTier < 2) {\n";
      indent += "  ";
    }
    DESERIALIZE_FAST += indent + "do {\n";
    indent += "  ";

    if (supportsFastOptionalPath) {
      DESERIALIZE_FAST += missingDeclarations(indent);
      DESERIALIZE_FAST +=
        indent + "if (load<u16>(srcStart) !== 0x7b) break; // {\n";
      DESERIALIZE_FAST += indent + "srcStart += 2;\n";
      DESERIALIZE_FAST += indent + "let seenAny = false;\n\n";

      const t1opt: string[] = [];
      for (let i = 0; i < this.schema.members.length; i++) {
        const member = this.schema.members[i];
        const key = JSON.stringify(member.alias ?? member.name);

        const resolvedType = stripNull(member.type);
        const inlineStringValue = ["string", "String"].includes(resolvedType);
        const packedQuote = inlineStringValue && !member.nullable ? '"' : "";
        const firstKeySection = key + ":" + packedQuote;
        const nextKeySection = "," + key + ":" + packedQuote;
        const firstKeyOffset = firstKeySection.length << 1;
        const nextKeyOffset = nextKeySection.length << 1;
        const trustedStringValue = packedQuote.length != 0;
        const firstValueOffset = trustedStringValue
          ? firstKeyOffset - 2
          : firstKeyOffset;
        const nextValueOffset = trustedStringValue
          ? nextKeyOffset - 2
          : nextKeyOffset;
        const deserializerFirst = getDeserializer(
          member.type,
          "srcStart",
          "dst",
          member,
          inlineStringValue ? firstValueOffset : 0,
          true,
        );
        const deserializerNext = getDeserializer(
          member.type,
          "srcStart",
          "dst",
          member,
          inlineStringValue ? nextValueOffset : 0,
          true,
        );
        const isOptional =
          member.flags.has(PropertyFlags.OmitNull) ||
          member.flags.has(PropertyFlags.OmitIf) ||
          member.flags.has(PropertyFlags.Optional);
        const traceBit = `<u64>1 << ${i}`;
        const firstMismatch = getComparisions(
          firstKeySection,
          "srcStart",
          "!=",
        ).join(" || ");
        const nextMismatch = getComparisions(
          nextKeySection,
          "srcStart",
          "!=",
        ).join(" || ");
        const firstAbsent = traceOptionalObject
          ? `__traceHit ? (__traceMask & (${traceBit})) == 0 : (${firstMismatch})`
          : firstMismatch;
        const nextAbsent = traceOptionalObject
          ? `__traceHit ? (__traceMask & (${traceBit})) == 0 : (${nextMismatch})`
          : nextMismatch;

        if (!deserializerFirst.length || !deserializerNext.length) {
          t1opt.push(indent + "break;\n\n");
          continue;
        }

        let blk = indent + "if (!seenAny) {\n";
        indent += "  ";
        blk += indent + `if (${firstAbsent}) {\n`;
        indent += "  ";
        if (isOptional) {
          blk += indent + `if (__resetMissing) ${markMissing(member)}\n`;
        } else {
          blk += indent + "break;\n";
        }
        indent = indent.slice(0, -2);
        blk += indent + "} else {\n";
        indent += "  ";
        if (!inlineStringValue)
          blk += indent + `srcStart += ${firstKeyOffset};\n`;
        if (!trustedStringValue)
          blk +=
            indent +
            `if (JSON.Util.isSpace(load<u16>(${inlineStringValue ? `srcStart + ${firstValueOffset}` : "srcStart"}))) break;\n`;
        blk += indent + deserializerFirst.join("\n" + indent) + "\n";
        if (traceOptionalObject)
          blk += indent + `__tracePresent |= ${traceBit};\n`;
        blk += indent + "seenAny = true;\n";
        indent = indent.slice(0, -2);
        blk += indent + "}\n";
        indent = indent.slice(0, -2);
        blk += indent + "} else {\n";
        indent += "  ";
        blk += indent + `if (${nextAbsent}) {\n`;
        indent += "  ";
        if (isOptional) {
          blk += indent + `if (__resetMissing) ${markMissing(member)}\n`;
        } else {
          blk += indent + "break;\n";
        }
        indent = indent.slice(0, -2);
        blk += indent + "} else {\n";
        indent += "  ";
        if (!inlineStringValue)
          blk += indent + `srcStart += ${nextKeyOffset};\n`;
        if (!trustedStringValue)
          blk +=
            indent +
            `if (JSON.Util.isSpace(load<u16>(${inlineStringValue ? `srcStart + ${nextValueOffset}` : "srcStart"}))) break;\n`;
        blk += indent + deserializerNext.join("\n" + indent) + "\n";
        if (traceOptionalObject)
          blk += indent + `__tracePresent |= ${traceBit};\n`;
        indent = indent.slice(0, -2);
        blk += indent + "}\n";
        indent = indent.slice(0, -2);
        blk += indent + "}\n\n";
        t1opt.push(blk);
      }
      DESERIALIZE_FAST += chunkFastBlocksOptional(t1opt, "T1O", indent, false);
    } else {
      const t1blocks: string[] = [];
      for (let i = 0; i < this.schema.members.length; i++) {
        const member = this.schema.members[i];
        const key = JSON.stringify(member.alias ?? member.name);

        const resolvedType = stripNull(member.type);
        const inlineStringValue = ["string", "String"].includes(resolvedType);
        const trustedStringValue = inlineStringValue && !member.nullable;
        const keySection =
          (i == 0 ? "{" : ",") + key + ":" + (trustedStringValue ? '"' : "");
        let blk =
          indent +
          `if (${getComparisions(keySection, "srcStart", "!=").join(" || ")}) break;\n`;
        const keyOffset = keySection.length << 1;
        const valueOffset = trustedStringValue ? keyOffset - 2 : keyOffset;
        if (!inlineStringValue) {
          blk += indent + `srcStart += ${keyOffset};\n\n`;
        }
        const deserializer = getDeserializer(
          member.type,
          "srcStart",
          "dst",
          member,
          inlineStringValue ? valueOffset : 0,
          true,
        );
        if (!deserializer.length) {
          blk += indent + "break;\n\n";
          t1blocks.push(blk);
          continue;
        }
        // Tier 1 is the exact, no-whitespace template: the value sits at a fixed
        // offset after the colon. If whitespace follows the colon (e.g.
        // Python-style `{"k": v}`), that offset is shifted, so bail to tier 2
        // instead of feeding a misaligned pointer to the value deserializer
        // (string/float deserializers hard-fault on a non-value start).
        if (!trustedStringValue)
          blk +=
            indent +
            `if (JSON.Util.isSpace(load<u16>(${inlineStringValue ? `srcStart + ${valueOffset}` : "srcStart"}))) break;\n`;
        blk += indent + deserializer.join("\n" + indent) + "\n\n";
        t1blocks.push(blk);
      }
      DESERIALIZE_FAST += chunkFastBlocks(t1blocks, "T1", indent);
    }

    DESERIALIZE_FAST +=
      indent + "if (load<u16>(srcStart) !== 0x7d) break; // }\n";
    DESERIALIZE_FAST += indent + "srcStart += 2;\n";
    if (traceOptionalObject)
      DESERIALIZE_FAST +=
        indent +
        "if (__traceActive) JSON.Util.saveObjectTrace(__traceSlot, __tracePresent, 1);\n";
    if (supportsFastOptionalPath)
      DESERIALIZE_FAST += commitMissing(indent, true);
    DESERIALIZE_FAST += indent + "return srcStart;\n";
    indent = indent.slice(0, -2);
    DESERIALIZE_FAST += indent + "} while (false);\n\n";
    if (traceOptionalObject) {
      indent = indent.slice(0, -2);
      DESERIALIZE_FAST += indent + "}\n\n";
    }
    fastPrettyTailStart = DESERIALIZE_FAST.length;

    // ---- tier 2: whitespace-tolerant fast path ----
    // The tier-1 block above is an exact packed-byte template that assumes the
    // canonical/minified layout; any inter-token whitespace (pretty-printed
    // input) makes its packed compares miss and it `break`s to here. Rather
    // than dump the whole object to the naive scalar `__DESERIALIZE_SLOW`
    // (~5x slower), tier 2 re-matches per field with the SAME packed-u64 key
    // constants (key names are fixed) but skips whitespace between every
    // structural token. Minified input never reaches here, so tier 1 keeps its
    // peak speed.
    const tier2Desers = this.schema.members.map((member) =>
      getDeserializer(member.type, "srcStart", "dst", member, 0, true, true),
    );
    const tier2Ok = tier2Desers.every(
      (d) => d.length && !(d.length === 1 && d[0].trim() === "break;"),
    );
    if (tier2Ok && !supportsFastOptionalPath) {
      // Straight-line variant: every field is required and present in
      // declaration order. The common, fastest shape.
      const i1 = "  ";
      const i2 = "    ";
      const skip =
        i2 + "srcStart = JSON.Util.skipWhitespace(srcStart, srcEnd);\n";
      DESERIALIZE_FAST += i1 + "srcStart = start;\n";
      DESERIALIZE_FAST += i1 + "do {\n";
      DESERIALIZE_FAST += skip;
      DESERIALIZE_FAST += i2 + "if (load<u16>(srcStart) != 0x7b) break; // {\n";
      DESERIALIZE_FAST += i2 + "srcStart += 2;\n";
      const t2blocks: string[] = [];
      for (let i = 0; i < this.schema.members.length; i++) {
        const member = this.schema.members[i];
        const key = JSON.stringify(member.alias ?? member.name);
        const keyBytes = key.length << 1;
        let blk = "\n";
        blk += skip;
        blk +=
          i2 +
          `if (${getComparisions(key, "srcStart", "!=").join(" || ")}) break;\n`;
        blk += i2 + `srcStart += ${keyBytes};\n`;
        blk += skip;
        blk += i2 + "if (load<u16>(srcStart) != 0x3a) break; // :\n";
        blk += i2 + "srcStart += 2;\n";
        blk += skip;
        blk += i2 + tier2Desers[i].join("\n" + i2) + "\n";
        if (i < this.schema.members.length - 1) {
          blk += skip;
          blk += i2 + "if (load<u16>(srcStart) != 0x2c) break; // ,\n";
          blk += i2 + "srcStart += 2;\n";
        }
        t2blocks.push(blk);
      }
      DESERIALIZE_FAST += chunkFastBlocks(t2blocks, "T2", i2);
      DESERIALIZE_FAST += "\n";
      DESERIALIZE_FAST += skip;
      DESERIALIZE_FAST += i2 + "if (load<u16>(srcStart) != 0x7d) break; // }\n";
      DESERIALIZE_FAST += i2 + "srcStart += 2;\n";
      DESERIALIZE_FAST += i2 + "return srcStart;\n";
      DESERIALIZE_FAST += i1 + "} while (false);\n\n";
    } else if (tier2Ok && supportsFastOptionalPath) {
      // Probe-and-commit variant: fields may be omitted (@omitnull/@omitif) or
      // simply absent (json-as keeps the field default when a key is missing).
      // Fields are still matched in declaration order, but each is optional: we
      // probe the next key with `kp`, and only commit `srcStart` past the
      // separator + key + `:` when that field's key actually matches. A field
      // whose key isn't next is skipped without consuming input, so the
      // following field re-probes the same position (and re-consumes the comma).
      // `seenAny` tracks whether a prior field was emitted, so we know when a
      // leading comma must precede the key. Unknown/extra keys aren't handled
      // here - they leave a non-`}` token after the last field and fall to slow.
      const multi = this.schema.members.length > 1;
      const i1 = "  ";
      const i2 = "    ";
      const i3 = "      ";
      DESERIALIZE_FAST += i1 + "srcStart = start;\n";
      DESERIALIZE_FAST += i1 + "do {\n";
      DESERIALIZE_FAST += missingDeclarations(i2);
      if (traceOptionalObject) {
        DESERIALIZE_FAST += i2 + "__tracePresent = 0;\n";
        DESERIALIZE_FAST +=
          i2 +
          "const __traceSeparator = __traceHit ? JSON.Util.getObjectTraceSeparator(__traceSlot) : <usize>0;\n";
        DESERIALIZE_FAST += i2 + "let __traceCandidateSeparator: usize = 0;\n";
        DESERIALIZE_FAST += i2 + "let __traceSeparatorStart: usize = 0;\n";
        DESERIALIZE_FAST += i2 + "let __traceSeparatorSeen = false;\n";
        DESERIALIZE_FAST += i2 + "let __traceCanonicalPretty = true;\n";
      }
      DESERIALIZE_FAST +=
        i2 + "srcStart = JSON.Util.skipWhitespace(srcStart, srcEnd);\n";
      DESERIALIZE_FAST += i2 + "if (load<u16>(srcStart) != 0x7b) break; // {\n";
      DESERIALIZE_FAST += i2 + "srcStart += 2;\n";
      DESERIALIZE_FAST += i2 + "let kp: usize = 0;\n";
      if (multi) DESERIALIZE_FAST += i2 + "let seenAny = false;\n";
      const t2opt: string[] = [];
      for (let i = 0; i < this.schema.members.length; i++) {
        const member = this.schema.members[i];
        const key = JSON.stringify(member.alias ?? member.name);
        const keyBytes = key.length << 1;
        const traceBit = `<u64>1 << ${i}`;
        const keyMatches = getComparisions(key, "kp", "==").join(" && ");
        const presentCondition = traceOptionalObject
          ? `__traceHit ? (__traceMask & (${traceBit})) != 0 : (${keyMatches})`
          : keyMatches;
        let blk = "\n";
        if (traceOptionalObject) {
          blk += i2 + `if (__traceHit && (${traceBit} & __traceMask) != 0) {\n`;
          blk += i3 + "kp = srcStart;\n";
          if (multi && i > 0) {
            blk += i3 + "if (seenAny) {\n";
            blk += i3 + "  if (load<u16>(kp) != 0x2c) break; // ,\n";
            blk += i3 + "  kp += 2;\n";
            blk += i3 + "}\n";
          }
          blk += i3 + "if (__traceTier == 3) kp += __traceSeparator;\n";
          blk += i3 + "else kp = JSON.Util.skipWhitespace(kp, srcEnd);\n";
          blk += i2 + "} else if (!__traceHit) {\n";
          blk += i3 + "__traceSeparatorStart = srcStart;\n";
          blk += i3 + "kp = JSON.Util.skipWhitespace(srcStart, srcEnd);\n";
          if (multi && i > 0) {
            blk += i3 + "if (seenAny && load<u16>(kp) == 0x2c) {\n";
            blk +=
              i3 + "  if (kp != srcStart) __traceCanonicalPretty = false;\n";
            blk += i3 + "  __traceSeparatorStart = kp + 2;\n";
            blk +=
              i3 +
              "  kp = JSON.Util.skipWhitespace(__traceSeparatorStart, srcEnd);\n";
            blk += i3 + "}\n";
          }
          blk += i2 + "}\n";
        } else {
          blk += i2 + "kp = JSON.Util.skipWhitespace(srcStart, srcEnd);\n";
          // Only fields after the first can be preceded by a comma, and only
          // when something was already emitted (seenAny).
          if (multi && i > 0) {
            blk +=
              i2 +
              "if (seenAny && load<u16>(kp) == 0x2c) kp = JSON.Util.skipWhitespace(kp + 2, srcEnd);\n";
          }
        }
        blk += i2 + `if (${presentCondition}) {\n`;
        if (traceOptionalObject) {
          blk += i3 + "if (__traceHit && __traceTier == 3) {\n";
          blk += i3 + `  kp += ${keyBytes};\n`;
          blk += i3 + "  if (load<u16>(kp) != 0x3a) break; // :\n";
          blk += i3 + "  if (load<u16>(kp + 2) != 0x20) break; // space\n";
          blk += i3 + "  srcStart = kp + 4;\n";
          blk += i3 + "} else {\n";
          blk += i3 + "  if (!__traceHit) {\n";
          blk +=
            i3 +
            "    const __traceCurrentSeparator = kp - __traceSeparatorStart;\n";
          blk += i3 + "    if (__traceSeparatorSeen) {\n";
          blk +=
            i3 +
            "      if (__traceCurrentSeparator != __traceCandidateSeparator) __traceCanonicalPretty = false;\n";
          blk += i3 + "    } else {\n";
          blk +=
            i3 + "      __traceCandidateSeparator = __traceCurrentSeparator;\n";
          blk += i3 + "      __traceSeparatorSeen = true;\n";
          blk += i3 + "    }\n";
          blk += i3 + "  }\n";
          blk += i3 + `  kp += ${keyBytes};\n`;
          blk += i3 + "  const __traceKeyEnd = kp;\n";
          blk += i3 + "  kp = JSON.Util.skipWhitespace(kp, srcEnd);\n";
          blk +=
            i3 +
            "  if (!__traceHit && kp != __traceKeyEnd) __traceCanonicalPretty = false;\n";
          blk += i3 + "  if (load<u16>(kp) != 0x3a) break; // :\n";
          blk +=
            i3 + "  srcStart = JSON.Util.skipWhitespace(kp + 2, srcEnd);\n";
          blk +=
            i3 +
            "  if (!__traceHit && (load<u16>(kp + 2) != 0x20 || srcStart != kp + 4)) __traceCanonicalPretty = false;\n";
          blk += i3 + "}\n";
        } else {
          blk += i3 + `kp += ${keyBytes};\n`;
          blk +=
            i3 + "if (kp + 4 <= srcEnd && load<u32>(kp) == 0x0020003a) {\n";
          blk +=
            i3 + "  srcStart = JSON.Util.skipWhitespace(kp + 4, srcEnd);\n";
          blk += i3 + "} else {\n";
          blk += i3 + "kp = JSON.Util.skipWhitespace(kp, srcEnd);\n";
          blk += i3 + "if (load<u16>(kp) != 0x3a) break; // :\n";
          blk += i3 + "srcStart = JSON.Util.skipWhitespace(kp + 2, srcEnd);\n";
          blk += i3 + "}\n";
        }
        blk += i3 + tier2Desers[i].join("\n" + i3) + "\n";
        if (traceOptionalObject) blk += i3 + `__tracePresent |= ${traceBit};\n`;
        if (multi) blk += i3 + "seenAny = true;\n";
        blk += i2 + `} else if (__resetMissing) { ${markMissing(member)} }\n`;
        t2opt.push(blk);
      }
      DESERIALIZE_FAST += chunkFastBlocksOptional(t2opt, "T2O", i2, true);
      DESERIALIZE_FAST += "\n";
      DESERIALIZE_FAST +=
        i2 + "srcStart = JSON.Util.skipWhitespace(srcStart, srcEnd);\n";
      DESERIALIZE_FAST += i2 + "if (load<u16>(srcStart) != 0x7d) break; // }\n";
      DESERIALIZE_FAST += i2 + "srcStart += 2;\n";
      if (traceOptionalObject)
        DESERIALIZE_FAST +=
          i2 +
          "if (__traceActive) JSON.Util.saveObjectTrace(__traceSlot, __tracePresent, __traceHit ? __traceTier : (__traceCanonicalPretty && __traceSeparatorSeen ? 3 : 2), __traceHit ? __traceSeparator : __traceCandidateSeparator);\n";
      DESERIALIZE_FAST += commitMissing(i2, false);
      DESERIALIZE_FAST += i2 + "return srcStart;\n";
      DESERIALIZE_FAST += i1 + "} while (false);\n\n";
    }

    // ---- tier 3: order-independent keyed fallback ----
    // Real-world producers frequently reorder or omit fields even for ordinary
    // structs. A small generated dispatcher parses those objects in one pass
    // instead of bounds-scanning the whole value and then running the generic
    // scalar slow parser. Keep a size cap to avoid pathological code growth on
    // very wide schemas.
    const keyedUnionAlternatives = this.schema.members.filter(
      (member) =>
        member.nullable && this.getSchema(stripNull(member.type)) != null,
    ).length;
    const scalarKeyedSchema = this.schema.members.every((member) => {
      const type = stripNull(member.type);
      return (
        INTEGER_TYPES.includes(type) ||
        FLOAT_TYPES.includes(type) ||
        ["string", "String"].includes(type) ||
        isBoolean(type)
      );
    });
    const structKeyedSchema = this.schema.members.every((member) => {
      const type = stripNull(member.type);
      return (
        INTEGER_TYPES.includes(type) ||
        FLOAT_TYPES.includes(type) ||
        ["string", "String"].includes(type) ||
        isBoolean(type) ||
        this.getSchema(type) != null
      );
    });
    const hasCollectionMembers = this.schema.members.some((member) => {
      const type = stripNull(member.type);
      return (
        type.endsWith("[]") ||
        type.startsWith("Array<") ||
        type.startsWith("StaticArray<") ||
        type.startsWith("Map<") ||
        type.startsWith("Set<")
      );
    });
    const keyedFallbackEnabled =
      tier2Ok &&
      !hasLazyMembers &&
      this.schema.members.length > 0 &&
      this.schema.members.length <= 24 &&
      (keyedUnionAlternatives >= 2 ||
        (scalarKeyedSchema &&
          (this.schema.members.length <= 6 ||
            this.schema.members.length >= 12)) ||
        (structKeyedSchema && hasExplicitOptionalMembers) ||
        (hasCollectionMembers && this.schema.members.length <= 12));
    if (keyedFallbackEnabled) {
      const i1 = "  ";
      const i2 = "    ";
      const i3 = "      ";
      const keyedResets = this.schema.members.map((member) => {
        const offset = `offsetof<this>(${JSON.stringify(member.name)})`;
        if (member.value)
          return `changetype<this>(dst).__JSON_INITIALIZE_FIELD_${member.name}();`;
        if (member.nullable)
          return `store<${member.type}>(dst, null, ${offset});`;
        if (this.getSchema(member.type))
          return (
            `store<${member.type}>(dst, ` +
            `changetype<nonnull<${member.type}>>(JSON.__allocateObject(offsetof<nonnull<${member.type}>>(), idof<nonnull<${member.type}>>())).__INITIALIZE(), ${offset});`
          );
        if (["string", "String"].includes(member.type))
          return `store<${member.type}>(dst, "", ${offset});`;
        if (member.type.endsWith("[]")) {
          const element = member.type.slice(0, -2).trim();
          return `store<${member.type}>(dst, new Array<${element}>(), ${offset});`;
        }
        if (
          member.type.startsWith("Array<") ||
          member.type.startsWith("Map<") ||
          member.type.startsWith("Set<")
        )
          return `store<${member.type}>(dst, new ${member.type}(), ${offset});`;
        if (member.type.startsWith("StaticArray<")) {
          const element = member.type.slice("StaticArray<".length, -1).trim();
          return `store<${member.type}>(dst, new StaticArray<${element}>(0), ${offset});`;
        }
        return `store<${member.type}>(dst, JSON.__zero<${member.type}>(), ${offset});`;
      });
      DESERIALIZE_FAST += i1 + "srcStart = start;\n";
      DESERIALIZE_FAST += i1 + "do {\n";
      DESERIALIZE_FAST +=
        i2 + "srcStart = JSON.Util.skipWhitespace(srcStart, srcEnd);\n";
      DESERIALIZE_FAST += i2 + "if (load<u16>(srcStart) != 0x7b) break; // {\n";
      DESERIALIZE_FAST += i2 + "srcStart += 2;\n";
      DESERIALIZE_FAST += i2 + "let seen: u32 = 0;\n";
      DESERIALIZE_FAST += i2 + "let complete = false;\n";
      DESERIALIZE_FAST += i2 + "let afterComma = false;\n";
      DESERIALIZE_FAST += i2 + "while (true) {\n";
      DESERIALIZE_FAST +=
        i3 + "srcStart = JSON.Util.skipWhitespace(srcStart, srcEnd);\n";
      DESERIALIZE_FAST += i3 + "let code = load<u16>(srcStart);\n";
      DESERIALIZE_FAST += i3 + "if (code == 0x7d) {\n";
      DESERIALIZE_FAST += i3 + "  if (afterComma) break;\n";
      DESERIALIZE_FAST += i3 + "  srcStart += 2;\n";
      DESERIALIZE_FAST += i3 + "  complete = true;\n";
      DESERIALIZE_FAST += i3 + "  break;\n";
      DESERIALIZE_FAST += i3 + "}\n";
      DESERIALIZE_FAST += i3 + "if (code != 0x22) break; // opening quote\n";
      DESERIALIZE_FAST += i3 + "afterComma = false;\n";
      DESERIALIZE_FAST += i3 + "const keyStart = srcStart;\n";
      DESERIALIZE_FAST +=
        i3 +
        "const keyEnd = JSON.Util.scanValueEnd<string>(keyStart, srcEnd);\n";
      DESERIALIZE_FAST += i3 + "if (!keyEnd) break;\n";
      DESERIALIZE_FAST += i3 + "let escapedKey = false;\n";
      DESERIALIZE_FAST +=
        i3 +
        "for (let p = keyStart + 2; p < keyEnd - 2; p += 2) { if (load<u16>(p) == 92) { escapedKey = true; break; } }\n";
      DESERIALIZE_FAST += i3 + "if (escapedKey) break;\n";
      DESERIALIZE_FAST +=
        i3 + "srcStart = JSON.Util.skipWhitespace(keyEnd, srcEnd);\n";
      DESERIALIZE_FAST += i3 + "if (load<u16>(srcStart) != 0x3a) break; // :\n";
      DESERIALIZE_FAST +=
        i3 + "srcStart = JSON.Util.skipWhitespace(srcStart + 2, srcEnd);\n";
      DESERIALIZE_FAST += i3 + "const keyBytes = keyEnd - keyStart;\n";
      DESERIALIZE_FAST += i3 + "let matched = false;\n";

      const keyedMembersByBytes = new Map<number, number[]>();
      for (let i = 0; i < this.schema.members.length; i++) {
        const member = this.schema.members[i];
        const keyBytes =
          JSON.stringify(member.alias ?? member.name).length << 1;
        const group = keyedMembersByBytes.get(keyBytes);
        if (group) group.push(i);
        else keyedMembersByBytes.set(keyBytes, [i]);
      }
      DESERIALIZE_FAST += i3 + "switch (keyBytes) {\n";
      for (const [keyBytes, memberIndexes] of keyedMembersByBytes) {
        DESERIALIZE_FAST += i3 + `  case ${keyBytes}: {\n`;
        for (const i of memberIndexes) {
          const member = this.schema.members[i];
          const key = JSON.stringify(member.alias ?? member.name);
          const condition = getComparisions(key, "keyStart", "==").join(
            " &&\n" + i3 + "      ",
          );
          DESERIALIZE_FAST += i3 + `    if (!matched && (${condition})) {\n`;
          DESERIALIZE_FAST += i3 + "      matched = true;\n";
          DESERIALIZE_FAST +=
            i3 + "      " + tier2Desers[i].join("\n" + i3 + "      ") + "\n";
          DESERIALIZE_FAST += i3 + `      seen |= <u32>1 << ${i};\n`;
          DESERIALIZE_FAST += i3 + "    }\n";
        }
        DESERIALIZE_FAST += i3 + "    break;\n";
        DESERIALIZE_FAST += i3 + "  }\n";
      }
      DESERIALIZE_FAST += i3 + "}\n";

      DESERIALIZE_FAST += i3 + "if (!srcStart) break;\n";
      DESERIALIZE_FAST += i3 + "if (!matched) {\n";
      if (STRICT) {
        DESERIALIZE_FAST += i3 + "  break;\n";
      } else {
        DESERIALIZE_FAST +=
          i3 +
          "  const valueEnd = JSON.Util.scanValueEnd<usize>(srcStart, srcEnd);\n";
        DESERIALIZE_FAST += i3 + "  if (!valueEnd) break;\n";
        DESERIALIZE_FAST += i3 + "  srcStart = valueEnd;\n";
      }
      DESERIALIZE_FAST += i3 + "}\n";
      DESERIALIZE_FAST +=
        i3 + "srcStart = JSON.Util.skipWhitespace(srcStart, srcEnd);\n";
      DESERIALIZE_FAST += i3 + "code = load<u16>(srcStart);\n";
      DESERIALIZE_FAST += i3 + "if (code == 0x7d) {\n";
      DESERIALIZE_FAST += i3 + "  srcStart += 2;\n";
      DESERIALIZE_FAST += i3 + "  complete = true;\n";
      DESERIALIZE_FAST += i3 + "  break;\n";
      DESERIALIZE_FAST += i3 + "}\n";
      DESERIALIZE_FAST += i3 + "if (code != 0x2c) break; // comma\n";
      DESERIALIZE_FAST += i3 + "afterComma = true;\n";
      DESERIALIZE_FAST += i3 + "srcStart += 2;\n";
      DESERIALIZE_FAST += i2 + "}\n";
      DESERIALIZE_FAST += i2 + "if (!complete) break;\n";
      for (let i = 0; i < keyedResets.length; i++) {
        DESERIALIZE_FAST +=
          i2 + `if ((seen & (<u32>1 << ${i})) == 0) ${keyedResets[i]}\n`;
      }
      DESERIALIZE_FAST += i2 + "return srcStart;\n";
      DESERIALIZE_FAST += i1 + "} while (false);\n\n";
    }

    if (THROW_FAST_PATH) {
      DESERIALIZE_FAST +=
        indent + "const failAt = srcStart ? srcStart : start;\n";
      DESERIALIZE_FAST +=
        indent +
        "const failEnd = failAt + 160 < srcEnd ? failAt + 160 : srcEnd;\n";
      DESERIALIZE_FAST +=
        indent +
        `throw new Error("Fast path failed for ${this.schema.name} at char offset " + ((failAt - start) >> 1).toString() + " near: " + JSON.Util.ptrToStr(failAt, failEnd));`;
    } else {
      DESERIALIZE_FAST += indent + "return 0;";
    }

    indent = indent.slice(0, -2);
    DESERIALIZE_FAST += indent + "}";

    DESERIALIZE += indent + "  let keyStart: usize = 0;\n";
    DESERIALIZE += indent + "  let keyEnd: usize = 0;\n";
    DESERIALIZE += indent + "  let isKey = false;\n";
    // Most slow callers have already initialized the destination. Nested reuse
    // can instead retain present buffers and request only omitted-field resets.
    const slowSeen = new Map(
      this.schema.members.map((member, index) => [member, `__seen_${index}`]),
    );
    const slowComparison = (name: string, member: Property): string =>
      `(${getComparison(name)}) && (!__resetMissing || (${slowSeen.get(member)} = true))`;
    const slowReset =
      `if (__resetMissing) {\n` +
      initializationMembers
        .map(
          (member) =>
            `  if (!${slowSeen.get(member)}) ${resetField(member, "changetype<usize>(out)")}\n`,
        )
        .join("") +
      `}\n`;

    DESERIALIZE += [...slowSeen.values()]
      .map((name) => `  let ${name} = false;\n`)
      .join("");

    if (!STRICT || slowObjectMembers.length || slowArrayMembers.length)
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
      "  if (srcStart == srcEnd) return JSON.Util.failProductionParse();\n";
    DESERIALIZE +=
      indent +
      "  if (load<u16>(srcStart) != 123) return JSON.Util.failProductionParse();\n";
    DESERIALIZE +=
      indent +
      "  if (load<u16>(srcEnd - 2) != 125) return JSON.Util.failProductionParse();\n";
    DESERIALIZE += indent + "  const objectStart = srcStart;\n";
    DESERIALIZE += indent + "  srcStart += 2;\n\n";

    DESERIALIZE += indent + "  while (srcStart < srcEnd) {\n";
    DESERIALIZE += indent + "    let code = load<u16>(srcStart);\n";
    DESERIALIZE += indent + "    while (JSON.Util.isSpace(code)) {\n";
    DESERIALIZE += indent + "      srcStart += 2;\n";
    DESERIALIZE +=
      indent +
      "      if (srcStart >= srcEnd) return JSON.Util.failProductionParse();\n";
    DESERIALIZE += indent + "      code = load<u16>(srcStart);\n";
    DESERIALIZE += indent + "    }\n";
    // A generated object parser succeeds only when it observes its own closing
    // brace. Reaching srcEnd can mean a nested value consumed the sole `}`.
    // This branch exists only in the slow fallback; tier 1/2 already check the
    // delimiter directly at their final cursor.
    // At a member boundary the preceding non-space token tells us whether a
    // quote/comma/close is legal. This keeps comma grammar in the already-cold
    // slow fallback: no leading, doubled, or trailing commas, and no adjacent
    // members without a comma.
    DESERIALIZE +=
      indent +
      "    if (keyStart != 0 && !isKey && (code == 125 || code == 44)) return JSON.Util.failProductionParse();\n";
    DESERIALIZE += indent + "    if (keyStart == 0 && !isKey) {\n";
    DESERIALIZE += indent + "      let prev = srcStart - 2;\n";
    DESERIALIZE +=
      indent +
      "      while (prev > objectStart && JSON.Util.isSpace(load<u16>(prev))) prev -= 2;\n";
    DESERIALIZE += indent + "      const prevCode = load<u16>(prev);\n";
    DESERIALIZE += indent + "      if (code == 125) {\n";
    DESERIALIZE +=
      indent +
      "        if (prevCode == 44 || prevCode == 58) return JSON.Util.failProductionParse();\n";
    DESERIALIZE += slowReset + indent + "        return srcStart + 2;\n";
    DESERIALIZE += indent + "      }\n";
    DESERIALIZE += indent + "      if (code == 44) {\n";
    DESERIALIZE +=
      indent +
      "        if (prevCode == 123 || prevCode == 44 || prevCode == 58) return JSON.Util.failProductionParse();\n";
    DESERIALIZE += indent + "      } else if (code == 34) {\n";
    DESERIALIZE +=
      indent +
      "        if (prevCode != 123 && prevCode != 44) return JSON.Util.failProductionParse();\n";
    DESERIALIZE += indent + "      } else {\n";
    DESERIALIZE += indent + "        return JSON.Util.failProductionParse();\n";
    DESERIALIZE += indent + "      }\n";
    DESERIALIZE += indent + "    }\n";
    DESERIALIZE += indent + "    if (keyStart == 0) {\n";
    DESERIALIZE +=
      indent +
      "      if (code == 34 && JSON.Util.isUnescapedQuote(srcStart)) {\n";
    DESERIALIZE += indent + "        if (isKey) {\n";
    DESERIALIZE += indent + "          keyStart = lastIndex;\n";
    DESERIALIZE += indent + "          keyEnd = srcStart;\n";
    DESERIALIZE +=
      indent +
      "          for (let keyPtr = keyStart; keyPtr < keyEnd; keyPtr += 2) {\n";
    DESERIALIZE +=
      indent + "            if (load<u16>(keyPtr) != 92) continue;\n";
    DESERIALIZE +=
      indent +
      "            decodedKey = JSON.__deserializeValue<string>(keyStart - 2, keyEnd + 2);\n";
    DESERIALIZE +=
      indent +
      "            keyStart = changetype<usize>(decodedKey); keyEnd = keyStart + ((<usize>decodedKey.length) << 1); break;\n";
    DESERIALIZE += indent + "          }\n";
    if (DEBUG > 1)
      DESERIALIZE +=
        indent +
        '          console.log("Key: " + JSON.Util.ptrToStr(keyStart, keyEnd));\n';
    DESERIALIZE +=
      indent +
      "          do { srcStart += 2; if (srcStart >= srcEnd) return JSON.Util.failProductionParse(); code = load<u16>(srcStart); } while (JSON.Util.isSpace(code));\n";
    DESERIALIZE +=
      indent +
      "          if (code !== 58) return JSON.Util.failProductionParse();\n";
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
        const name = member.alias ?? member.name;
        const length = name.length;

        if (!groups.has(length)) {
          groups.set(length, []);
        }

        groups.get(length)!.push(member);
      }

      return [...groups.values()]
        .map((group) =>
          group.sort((a, b) => {
            const aLen = (a.alias ?? a.name).length;
            const bLen = (b.alias ?? b.name).length;
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
    //     const name = member.alias ?? member.name;
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
    //         (a.alias ?? a.name).length - (b.alias ?? b.name).length;

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
          const groupLen = (group[0].alias ?? group[0].name).length << 1;
          DESERIALIZE += "           case " + groupLen + ": {\n";
          const emitDispatch = (tree: KeyDispatch<Property>): void => {
            if ("members" in tree) {
              cb(tree.members);
            } else {
              // Use if/else, not an inner switch: the existing matcher's
              // break must still exit the outer key-length switch.
              DESERIALIZE += `if (load<u16>(keyStart, ${tree.offset << 1}) < ${tree.pivot}) {\n`;
              emitDispatch(tree.left);
              DESERIALIZE += "} else {\n";
              emitDispatch(tree.right);
              DESERIALIZE += "}\n";
            }
          };
          emitDispatch(
            keyDispatch(group, (member) => member.alias ?? member.name),
          );
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
      if (members.some((m) => (m.alias ?? m.name).length << 1 == 2)) {
        DESERIALIZE += "            const code16 = load<u16>(keyStart);\n";
      }
      if (members.some((m) => (m.alias ?? m.name).length << 1 == 4)) {
        DESERIALIZE += "            const code32 = load<u32>(keyStart);\n";
      }
      if (members.some((m) => (m.alias ?? m.name).length << 1 == 6)) {
        DESERIALIZE +=
          "            const code48 = load<u64>(keyStart) & 0x0000FFFFFFFFFFFF;\n";
      }
      if (members.some((m) => (m.alias ?? m.name).length << 1 == 8)) {
        DESERIALIZE += "            const code64 = load<u64>(keyStart);\n";
      }
      if (members.some((m) => (m.alias ?? m.name).length << 1 > 8)) {
        DESERIALIZE += toMemCDecl(
          Math.max(...members.map((m) => (m.alias ?? m.name).length << 1)),
          "            ",
        );
      }
    };

    const getLazyRangeStore = (
      member: Property,
      valueStart: string,
      valueEnd: string,
      prefix: string,
    ): string => {
      return (
        prefix +
        `store<u64>(changetype<usize>(out), ((<u64>${valueStart}) << 32) | (<u64>(<u32>${valueEnd})), offsetof<this>(${JSON.stringify(member.name)}));\n`
      );
    };

    const getSlowValueStore = (
      member: Property,
      valueStart: string,
      valueEnd: string,
      prefix: string,
    ): string => {
      if (member.flags.has(PropertyFlags.Lazy))
        return getLazyRangeStore(member, valueStart, valueEnd, prefix);
      const offset = JSON.stringify(member.name);
      const memberSchema = this.getSchema(member.type);
      if (memberSchema?.customReader) {
        return (
          prefix +
          `store<${member.type}>(changetype<usize>(out), ${getCustomDeserializeExpression(member.type, valueStart, valueEnd)}, offsetof<this>(${offset}));\n`
        );
      }
      // TypedArrays and ArrayBuffer are reference types whose JSON form is
      // `[...]`. Pass the existing field pointer as `dst` so the deserializer
      // can reuse the allocation when size matches instead of always allocating.
      if (needsReferenceLoad(member.type)) {
        return (
          prefix +
          `store<${member.type}>(changetype<usize>(out), JSON.__deserializeValue<${member.type}>(${valueStart}, ${valueEnd}, JSON.Util.reuseCompositeBuffer(load<usize>(changetype<usize>(out), offsetof<this>(${offset})), changetype<usize>(out) + offsetof<this>(${offset}))), offsetof<this>(${offset}));\n`
        );
      }
      return (
        prefix +
        `store<${member.type}>(changetype<usize>(out), JSON.__deserializeValue<${member.type}>(${valueStart}, ${valueEnd}), offsetof<this>(${offset}));\n`
      );
    };

    const getSlowBooleanStore = (
      member: Property,
      value: "true" | "false",
      valueStart: string,
      valueEnd: string,
      prefix: string,
    ): string => {
      if (member.flags.has(PropertyFlags.Lazy))
        return getLazyRangeStore(member, valueStart, valueEnd, prefix);
      if (
        member.generic ||
        this.getSchema(member.type)?.customReader ||
        stripNull(member.type) === "JSON.Raw" ||
        stripNull(member.type) === "JSON.Value"
      )
        return getSlowValueStore(member, valueStart, valueEnd, prefix);
      if (
        member.type.startsWith("JSON.Box<bool") ||
        member.type.startsWith("JSON.Box<boolean") ||
        member.type.startsWith("Box<bool") ||
        member.type.startsWith("Box<boolean")
      ) {
        return (
          prefix +
          `store<${member.type}>(changetype<usize>(out), changetype<${member.type}>(JSON.Box.from<bool>(${value})), offsetof<this>(${JSON.stringify(member.name)}));\n`
        );
      }
      return (
        prefix +
        `store<boolean>(changetype<usize>(out), ${value}, offsetof<this>(${JSON.stringify(member.name)}));\n`
      );
    };

    const getSlowNullStore = (
      member: Property,
      valueStart: string,
      valueEnd: string,
      prefix: string,
    ): string => {
      if (member.flags.has(PropertyFlags.Lazy))
        return getLazyRangeStore(member, valueStart, valueEnd, prefix);
      if (
        member.generic ||
        ((this.getSchema(member.type)?.customReader ||
          ["JSON.Raw", "JSON.Value"].includes(stripNull(member.type))) &&
          !member.nullable)
      )
        return getSlowValueStore(member, valueStart, valueEnd, prefix);
      return (
        prefix +
        `store<usize>(changetype<usize>(out), 0, offsetof<this>(${JSON.stringify(member.name)}));\n`
      );
    };

    let mbElse = "      ";
    if (!STRICT || slowStringMembers.length) {
      // generateGroups(sortedMembers.string, generateComparisons)
      DESERIALIZE += mbElse + "if (code == 34) {\n";
      DESERIALIZE += "          lastIndex = srcStart;\n";
      DESERIALIZE += "          srcStart += 2;\n";
      DESERIALIZE += "          let escaped = false;\n";
      DESERIALIZE += "          while (srcStart < srcEnd) {\n";
      DESERIALIZE += "            const code = load<u16>(srcStart);\n";
      DESERIALIZE += "            if (code == 34 && !escaped) {\n";
      if (DEBUG > 1)
        DESERIALIZE +=
          '              console.log("Value (string, ' +
          ++id +
          '): " + JSON.Util.ptrToStr(lastIndex, srcStart + 2));';
      generateGroups(
        slowStringMembers,
        (group) => {
          generateConsts(group);
          const first = group[0];
          const fName = first.alias ?? first.name;
          DESERIALIZE +=
            indent +
            "            if (" +
            (first.generic
              ? `JSON.__acceptsJsonKind<${first.type}>(1) && `
              : "") +
            slowComparison(fName, first) +
            ") { // " +
            JSON.stringify(fName) +
            "\n";
          DESERIALIZE += getSlowValueStore(
            first,
            "lastIndex",
            "srcStart + 2",
            indent + "              ",
          );
          DESERIALIZE += indent + "              srcStart += 4;\n";
          DESERIALIZE += indent + "              keyStart = 0;\n";
          DESERIALIZE += indent + "              break;\n";
          DESERIALIZE += indent + "            }";

          for (let i = 1; i < group.length; i++) {
            const mem = group[i];
            const memName = mem.alias ?? mem.name;
            DESERIALIZE +=
              indent +
              " else if (" +
              (mem.generic
                ? `JSON.__acceptsJsonKind<${mem.type}>(1) && `
                : "") +
              slowComparison(memName, mem) +
              ") { // " +
              JSON.stringify(memName) +
              "\n";
            DESERIALIZE += getSlowValueStore(
              mem,
              "lastIndex",
              "srcStart + 2",
              indent + "              ",
            );
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
      DESERIALIZE += "          escaped = code == 92 ? !escaped : false;\n";
      DESERIALIZE += "          srcStart += 2;\n";
      DESERIALIZE += "        }\n"; // Close char scan loop
      DESERIALIZE += "      }\n"; // Close first char check
      mbElse = " else ";
    }

    if (!STRICT || slowNumberMembers.length) {
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
        slowNumberMembers,
        (group) => {
          generateConsts(group);
          const first = group[0];
          const fName = first.alias ?? first.name;
          DESERIALIZE +=
            indent +
            "            if (" +
            (first.generic
              ? `JSON.__acceptsJsonKind<${first.type}>(0) && `
              : "") +
            slowComparison(fName, first) +
            ") { // " +
            JSON.stringify(fName) +
            "\n";
          DESERIALIZE += getSlowValueStore(
            first,
            "lastIndex",
            "srcStart",
            indent + "              ",
          );
          DESERIALIZE += indent + "              srcStart += 2;\n";
          DESERIALIZE += indent + "              keyStart = 0;\n";
          DESERIALIZE += indent + "              break;\n";
          DESERIALIZE += indent + "            }";

          for (let i = 1; i < group.length; i++) {
            const mem = group[i];
            const memName = mem.alias ?? mem.name;
            DESERIALIZE +=
              indent +
              " else if (" +
              (mem.generic
                ? `JSON.__acceptsJsonKind<${mem.type}>(0) && `
                : "") +
              slowComparison(memName, mem) +
              ") { // " +
              JSON.stringify(memName) +
              "\n";
            DESERIALIZE += getSlowValueStore(
              mem,
              "lastIndex",
              "srcStart",
              indent + "              ",
            );
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

    if (!STRICT || slowObjectMembers.length) {
      DESERIALIZE += mbElse + "if (code == 123) {\n";
      DESERIALIZE += "        lastIndex = srcStart;\n";
      DESERIALIZE += "        depth++;\n";
      DESERIALIZE += "        srcStart += 2;\n";
      DESERIALIZE += "        while (srcStart < srcEnd) {\n";
      DESERIALIZE += "          const code = load<u16>(srcStart);\n";
      DESERIALIZE += "          if (code == 34) {\n";
      // Quotes after an even backslash run close the string. Match the
      // top-level string scanner instead of checking only the previous code unit.
      DESERIALIZE += "            srcStart += 2;\n";
      DESERIALIZE += "            let escaped = false;\n";
      DESERIALIZE += "            while (srcStart < srcEnd) {\n";
      DESERIALIZE += "              const stringCode = load<u16>(srcStart);\n";
      DESERIALIZE += "              if (stringCode == 34 && !escaped) break;\n";
      DESERIALIZE +=
        "              escaped = stringCode == 92 ? !escaped : false;\n";
      DESERIALIZE += "              srcStart += 2;\n";
      DESERIALIZE += "            }\n";
      DESERIALIZE +=
        "            if (srcStart >= srcEnd) return JSON.Util.failProductionParse();\n";
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
        slowObjectMembers,
        (group) => {
          generateConsts(group);
          const first = group[0];
          const fName = first.alias ?? first.name;
          DESERIALIZE +=
            indent +
            "            if (" +
            (first.generic
              ? `JSON.__acceptsJsonKind<${first.type}>(5) && `
              : "") +
            slowComparison(fName, first) +
            ") { // " +
            JSON.stringify(fName) +
            "\n";
          DESERIALIZE += getSlowValueStore(
            first,
            "lastIndex",
            "srcStart",
            indent + "              ",
          );
          DESERIALIZE += indent + "              keyStart = 0;\n";
          DESERIALIZE += indent + "              break;\n";
          DESERIALIZE += indent + "            }";

          for (let i = 1; i < group.length; i++) {
            const mem = group[i];
            const memName = mem.alias ?? mem.name;
            DESERIALIZE +=
              indent +
              " else if (" +
              (mem.generic
                ? `JSON.__acceptsJsonKind<${mem.type}>(5) && `
                : "") +
              slowComparison(memName, mem) +
              ") { // " +
              JSON.stringify(memName) +
              "\n";
            DESERIALIZE += getSlowValueStore(
              mem,
              "lastIndex",
              "srcStart",
              indent + "              ",
            );
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
    if (!STRICT || slowArrayMembers.length) {
      DESERIALIZE += mbElse + "if (code == 91) {\n";
      DESERIALIZE += "        lastIndex = srcStart;\n";
      DESERIALIZE += "        depth++;\n";
      DESERIALIZE += "        srcStart += 2;\n";
      DESERIALIZE += "        while (srcStart < srcEnd) {\n";
      DESERIALIZE += "          const code = load<u16>(srcStart);\n";
      DESERIALIZE += "          if (code == 34) {\n";
      // Quotes after an even backslash run close the string. Match the
      // top-level string scanner instead of checking only the previous code unit.
      DESERIALIZE += "            srcStart += 2;\n";
      DESERIALIZE += "            let escaped = false;\n";
      DESERIALIZE += "            while (srcStart < srcEnd) {\n";
      DESERIALIZE += "              const stringCode = load<u16>(srcStart);\n";
      DESERIALIZE += "              if (stringCode == 34 && !escaped) break;\n";
      DESERIALIZE +=
        "              escaped = stringCode == 92 ? !escaped : false;\n";
      DESERIALIZE += "              srcStart += 2;\n";
      DESERIALIZE += "            }\n";
      DESERIALIZE +=
        "            if (srcStart >= srcEnd) return JSON.Util.failProductionParse();\n";
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
        slowArrayMembers,
        (group) => {
          generateConsts(group);
          const first = group[0];
          const fName = first.alias ?? first.name;
          DESERIALIZE +=
            indent +
            "            if (" +
            (first.generic
              ? `JSON.__acceptsJsonKind<${first.type}>(4) && `
              : "") +
            slowComparison(fName, first) +
            ") { // " +
            JSON.stringify(fName) +
            "\n";
          DESERIALIZE += getSlowValueStore(
            first,
            "lastIndex",
            "srcStart",
            indent + "              ",
          );
          DESERIALIZE += indent + "              keyStart = 0;\n";
          DESERIALIZE += indent + "              break;\n";
          DESERIALIZE += indent + "            }";

          for (let i = 1; i < group.length; i++) {
            const mem = group[i];
            const memName = mem.alias ?? mem.name;
            DESERIALIZE +=
              indent +
              " else if (" +
              (mem.generic
                ? `JSON.__acceptsJsonKind<${mem.type}>(4) && `
                : "") +
              slowComparison(memName, mem) +
              ") { // " +
              JSON.stringify(memName) +
              "\n";
            DESERIALIZE += getSlowValueStore(
              mem,
              "lastIndex",
              "srcStart",
              indent + "              ",
            );
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

    if (!STRICT || slowBooleanMembers.length) {
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
        slowBooleanMembers,
        (group) => {
          generateConsts(group);
          const first = group[0];
          const fName = first.alias ?? first.name;
          DESERIALIZE +=
            indent +
            "          if (" +
            (first.generic
              ? `JSON.__acceptsJsonKind<${first.type}>(2) && `
              : "") +
            slowComparison(fName, first) +
            ") { // " +
            JSON.stringify(fName) +
            "\n";
          DESERIALIZE += getSlowBooleanStore(
            first,
            "true",
            "srcStart - 8",
            "srcStart",
            indent + "            ",
          );
          DESERIALIZE += indent + "            srcStart += 2;\n";
          DESERIALIZE += indent + "            keyStart = 0;\n";
          DESERIALIZE += indent + "            break;\n";
          DESERIALIZE += indent + "          }";

          for (let i = 1; i < group.length; i++) {
            const mem = group[i];
            const memName = mem.alias ?? mem.name;
            DESERIALIZE +=
              indent +
              " else if (" +
              (mem.generic
                ? `JSON.__acceptsJsonKind<${mem.type}>(2) && `
                : "") +
              slowComparison(memName, mem) +
              ") { // " +
              JSON.stringify(memName) +
              "\n";
            DESERIALIZE += getSlowBooleanStore(
              mem,
              "true",
              "srcStart - 8",
              "srcStart",
              indent + "            ",
            );
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

      DESERIALIZE += "        {\n";
      DESERIALIZE += "          srcStart += 10;\n";
      if (DEBUG > 1)
        DESERIALIZE +=
          '              console.log("Value (bool, ' +
          ++id +
          '): " + JSON.Util.ptrToStr(lastIndex, srcStart - 10));';
      generateGroups(
        slowBooleanMembers,
        (group) => {
          generateConsts(group);

          const first = group[0];
          const fName = first.alias ?? first.name;
          DESERIALIZE +=
            indent +
            "          if (" +
            (first.generic
              ? `JSON.__acceptsJsonKind<${first.type}>(2) && `
              : "") +
            slowComparison(fName, first) +
            ") { // " +
            JSON.stringify(fName) +
            "\n";
          DESERIALIZE += getSlowBooleanStore(
            first,
            "false",
            "srcStart - 10",
            "srcStart",
            indent + "            ",
          );
          DESERIALIZE += indent + "            srcStart += 2;\n";
          DESERIALIZE += indent + "            keyStart = 0;\n";
          DESERIALIZE += indent + "            break;\n";
          DESERIALIZE += indent + "          }";

          for (let i = 1; i < group.length; i++) {
            const mem = group[i];
            const memName = mem.alias ?? mem.name;
            DESERIALIZE +=
              indent +
              " else if (" +
              (mem.generic
                ? `JSON.__acceptsJsonKind<${mem.type}>(2) && `
                : "") +
              slowComparison(memName, mem) +
              ") { // " +
              JSON.stringify(memName) +
              "\n";
            DESERIALIZE += getSlowBooleanStore(
              mem,
              "false",
              "srcStart - 10",
              "srcStart",
              indent + "            ",
            );
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

      DESERIALIZE += "        }"; // Close false branch
      DESERIALIZE += "\n      }"; // Close first char check

      mbElse = " else ";
    }

    if (!STRICT || slowNullMembers.length) {
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
        slowNullMembers,
        (group) => {
          generateConsts(group);

          const first = group[0];
          const fName = first.alias ?? first.name;
          DESERIALIZE +=
            indent +
            "          if (" +
            (first.generic
              ? `JSON.__acceptsJsonKind<${first.type}>(3) && `
              : "") +
            slowComparison(fName, first) +
            ") { // " +
            JSON.stringify(fName) +
            "\n";
          DESERIALIZE += getSlowNullStore(
            first,
            "srcStart - 8",
            "srcStart",
            indent + "            ",
          );
          DESERIALIZE += indent + "            srcStart += 2;\n";
          DESERIALIZE += indent + "            keyStart = 0;\n";
          DESERIALIZE += indent + "            break;\n";
          DESERIALIZE += indent + "          }";

          for (let i = 1; i < group.length; i++) {
            const mem = group[i];
            const memName = mem.alias ?? mem.name;
            DESERIALIZE +=
              indent +
              " else if (" +
              (mem.generic
                ? `JSON.__acceptsJsonKind<${mem.type}>(3) && `
                : "") +
              slowComparison(memName, mem) +
              ") { // " +
              JSON.stringify(memName) +
              "\n";
            DESERIALIZE += getSlowNullStore(
              mem,
              "srcStart - 8",
              "srcStart",
              indent + "            ",
            );
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
    // Scalar slow-path branches historically consume their following `}` and
    // finish exactly at srcEnd. Preserve that representation, but distinguish
    // it from a final composite that consumed the sole closing delimiter: a
    // valid composite is followed by the owner's `}` and returns above.
    DESERIALIZE +=
      `  if (srcStart == srcEnd && lastIndex != 0) {\n` +
      `    const lastCode = load<u16>(lastIndex);\n` +
      `    if (lastCode == 123 || lastCode == 91) return 0;\n` +
      `  }\n`;
    DESERIALIZE += slowReset + `  return srcStart;\n}\n`; // Close function

    indent = "  ";

    this.schema.byteSize += 2;
    SERIALIZE += indent + "store<u16>(__dst, 125, 0); // }\n";
    SERIALIZE += indent + "__dst += 2;\n";
    SERIALIZE += indent + "bs.offset = __dst;\n";
    SERIALIZE += "}";

    const directStringPayloadReserve = reserveDirectStringPayloads
      ? directStringMembers
          .map((member) => {
            const size = member.nullable
              ? "__nullableStringByteSizePointer"
              : "__stringByteSizePointer";
            return ` + JSON.${size}(load<usize>(ptr, offsetof<this>(${JSON.stringify(member.name)})))`;
          })
          .join("")
      : "";
    const directWideIntegerArrayReserve = directWideIntegerArrays
      .map(
        (member) =>
          ` + JSON.__integerArrayReservedBytes<${member.type}>(load<usize>(ptr, offsetof<this>(${JSON.stringify(member.name)})))`,
      )
      .join("");

    SERIALIZE =
      SERIALIZE.slice(0, 32) +
      indent +
      "bs.proposeSize(" +
      this.schema.byteSize +
      directStringPayloadReserve +
      directWideIntegerArrayReserve +
      ");\n" +
      SERIALIZE.slice(32);

    const orderedInitializers = (members: Set<Property>) =>
      initializationMembers
        .filter((member) => members.has(member))
        .map((member) => initializationFragments.get(member)!)
        .join("");
    this.addDeclaredInitializer(node, initializationFragments);
    INITIALIZE =
      "@inline __INITIALIZE(): this {\n" +
      "  memory.fill(changetype<usize>(this), 0, offsetof<this>());\n" +
      "  this.__JSON_INITIALIZE_FIELDS();\n";
    INITIALIZE += "  return this;\n";
    INITIALIZE += "}";

    // if (DESERIALIZE_CUSTOM) {
    //   DESERIALIZE = "__DESERIALIZE(keyStart: usize, keyEnd: usize, valStart: usize, valEnd: usize, ptr: usize): usize {\n  if (isDefined(this.__DESERIALIZE_CUSTOM) return changetype<usize>(this." + deserializers[0].name + "(changetype<switch (<u32>keyEnd - <u32>keyStart) {\n"
    // }
    if (__hasLazy && !DESERIALIZE_CUSTOM) {
      // Root JSON.parse used to retain the source after generated parsing.
      // Generated lazy entry points now do that themselves so nested values
      // are safe too; expose a marker that suppresses the duplicate root write.
      node.members.push(
        SimpleParser.parseClassMember(
          "__DESERIALIZE_RETAINS_SOURCE(): void {}",
          node,
        ),
      );
    }
    if (DEBUG > 0) {
      console.log(SERIALIZE_CUSTOM || SERIALIZE);
      console.log(INITIALIZE);
      console.log(DESERIALIZE_CUSTOM || DESERIALIZE);
    }

    const SERIALIZE_METHOD = SimpleParser.parseClassMember(
      SERIALIZE_CUSTOM || SERIALIZE,
      node,
    );
    const INITIALIZE_METHOD = SimpleParser.parseClassMember(INITIALIZE, node);
    const DESERIALIZE_CUSTOM_METHOD = DESERIALIZE_CUSTOM
      ? SimpleParser.parseClassMember(DESERIALIZE_CUSTOM, node)
      : null;
    const DESERIALIZE_SLOW_METHOD = SimpleParser.parseClassMember(
      DESERIALIZE,
      node,
    );
    const WHITESPACE_METHOD = useFastPath
      ? SimpleParser.parseClassMember(
          "__DESERIALIZE_WHITESPACE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T, __resetMissing: bool = true): usize {\n" +
            lazySourceHeader +
            "  const start = srcStart;\n  const dst = changetype<usize>(out);\n" +
            DESERIALIZE_FAST.slice(fastPrettyTailStart),
          node,
        )
      : null;
    DESERIALIZE_FAST =
      DESERIALIZE_FAST.slice(0, fastPrettyTailStart) +
      "  return this.__DESERIALIZE_WHITESPACE(start, srcEnd, out, __resetMissing);\n}";
    // Small leaf readers benefit from caller-local roots and constant field
    // offsets. Keep optional, lazy, generic and nested-object readers outlined
    // so their fallback machinery does not multiply the generated code size.
    const inlineLeafFastReader =
      schema.members.length > 0 &&
      schema.members.length <= 4 &&
      schema.members.every((member) => {
        if (
          member.generic ||
          member.custom ||
          member.flags.has(PropertyFlags.Optional) ||
          member.flags.has(PropertyFlags.Lazy)
        )
          return false;
        const type = stripNull(member.type);
        if (isPrimitive(type) || isString(type)) return true;
        const element = this.getDefaultElementType(type);
        return element != null && isPrimitive(stripNull(element));
      });
    const DESERIALIZE_FAST_METHOD = useFastPath
      ? SimpleParser.parseClassMember(
          (inlineLeafFastReader ? "@inline\n" : "") + DESERIALIZE_FAST,
          node,
        )
      : null;
    let DESERIALIZE_FAST_PRETTY_METHOD: MethodDeclaration | null = null;
    const PRETTY_SPECIALIZED_METHOD: MethodDeclaration | null = null;
    if (useFastPath) {
      DESERIALIZE_FAST_PRETTY_METHOD = SimpleParser.parseClassMember(
        "__DESERIALIZE_FAST_PRETTY<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T, __resetMissing: bool = true): usize {\n" +
          "  return this.__DESERIALIZE_FAST(srcStart, srcEnd, out, __resetMissing);\n" +
          "}",
        node,
      ) as MethodDeclaration;
    }

    const sourceFreeDeserialize =
      !DESERIALIZE_CUSTOM &&
      this.schema.members.every((member) => {
        const type = stripNull(member.type);
        return (
          !member.flags.has(PropertyFlags.Lazy) &&
          (isPrimitive(type) ||
            isString(type) ||
            type == "Date" ||
            type == "JSON.Raw" ||
            type == "Raw")
        );
      });
    const SOURCE_FREE_METHOD = sourceFreeDeserialize
      ? SimpleParser.parseClassMember(
          "__DESERIALIZE_SOURCE_FREE(): void {}",
          node,
        )
      : null;
    // A successful straight-line fast parse assigns every declared field. A
    // fresh object can therefore start zeroed instead of constructing defaults;
    // on a fast miss parseInternal initializes normally before the slow retry.
    // Optional/keyed paths are excluded because success may preserve omissions.
    const FULL_WRITE_METHOD =
      useFastPath && !supportsFastOptionalPath
        ? SimpleParser.parseClassMember(
            `__DESERIALIZE_FULL_WRITE(): u32 { return idof<${node.name.text}>(); }`,
            node,
          )
        : null;
    // Default-heavy response objects are common, and their canonical compact
    // representation is known at transform time. In SIMD builds, compare that
    // source in vector-width chunks and construct the declared default graph on
    // an exact hit. Every other spelling/value falls through to the normal fast
    // parser, so this is a specialization rather than a separate parser mode.
    const defaultObjectJSON =
      USE_DEFAULT_OBJECT_SPECIALIZATION &&
      this.program.options.hasFeature(Feature.Simd) &&
      useFastPath &&
      !supportsFastOptionalPath &&
      !DESERIALIZE_CUSTOM &&
      !node.extendsType &&
      !node.is(CommonFlags.Export) &&
      !source.getClasses().some((candidate) => {
        if (!candidate.extendsType) return false;
        const base = source.resolveExtendsName(candidate);
        return base == this.schema.name || base == node.name.text;
      })
        ? this.getDefaultObjectJSON(this.schema)
        : null;
    const DEFAULT_OBJECT_METHOD = defaultObjectJSON
      ? SimpleParser.parseClassMember(
          this.getDefaultMatcherSource(defaultObjectJSON),
          node,
        )
      : null;
    const DEFAULT_OBJECT_FACTORY_METHOD = defaultObjectJSON
      ? SimpleParser.parseClassMember(
          "@inline __DESERIALIZE_DEFAULT_NEW(): this {\n" +
            "  return changetype<this>(JSON.__allocateObject(offsetof<this>(), idof<this>())).__INITIALIZE();\n" +
            "}",
          node,
        )
      : null;

    // Emit both constructor entries on every strict class, including classes
    // that cannot use checked parsing. Derived classes must shadow a base's
    // optimized entry when their own declared defaults require ordinary init.
    if (STRICT) {
      if (
        !node.members.some(
          (member) => member.name.text == "__INITIALIZE_CURSOR_FRESH",
        )
      ) {
        const initialize = cursorMayDefer
          ? orderedInitializers(cursorFreshInitializers)
          : this.hasCustomCursorInitializer(this.schema)
            ? "  this.__INITIALIZE_CURSOR();\n"
            : "  this.__INITIALIZE();\n";
        node.members.push(
          SimpleParser.parseClassMember(
            "__INITIALIZE_CURSOR_FRESH(): this {\n" +
              initialize +
              "  return this;\n}",
            node,
          ),
        );
      }
      if (
        !node.members.some(
          (member) => member.name.text == "__INITIALIZE_DEFAULT_FRESH",
        )
      ) {
        const initialize = cursorMayDefer
          ? "  this.__INITIALIZE_CURSOR_FRESH();\n" +
            (cursorDeferred.length ? "  this.__FINALIZE_CURSOR();\n" : "")
          : "  this.__INITIALIZE();\n";
        node.members.push(
          SimpleParser.parseClassMember(
            "__INITIALIZE_DEFAULT_FRESH(): this {\n" +
              initialize +
              "  return this;\n}",
            node,
          ),
        );
      }
    }

    if (STRICT && !DESERIALIZE_CUSTOM) {
      const keys = this.schema.members.map(
        (member) => member.alias ?? member.name,
      );
      if (new Set(keys).size === keys.length) {
        if (cursorDeferred.length) {
          node.members.push(
            SimpleParser.parseClassMember(
              "__INITIALIZE_CURSOR(): this {\n" +
                "  memory.fill(changetype<usize>(this), 0, offsetof<this>());\n" +
                orderedInitializers(cursorInitializers) +
                "  return this;\n}",
              node,
            ),
          );
          const complete = cursorDeferred
            .map(({ member, initialize }) => {
              const field = `offsetof<this>(${JSON.stringify(member.name)})`;
              const value = this.canDeferCursorObjectDefault(
                this.schema,
                member.type,
              )
                ? `  store<${member.type}>(changetype<usize>(this), ${this.runtimeReference()}.__cursorDefault<${member.type}>(), ${field});\n`
                : initialize;
              return `  if (load<usize>(changetype<usize>(this), ${field}) == 0) {\n${value}    __link(changetype<usize>(this), load<usize>(changetype<usize>(this), ${field}), false);\n  }\n`;
            })
            .join("");
          node.members.push(
            SimpleParser.parseClassMember(
              "__FINALIZE_CURSOR(): void {\n" + complete + "}",
              node,
            ),
          );
        }
        const supported =
          this.schema.members
            .map(
              (member) =>
                `JSON.__cursorSupports<${member.lazyInner || member.type}>(depth + 1)`,
            )
            .join(" && ") || "true";
        node.members.push(
          SimpleParser.parseClassMember(
            `__CURSOR_SUPPORTED(depth: i32): bool { return depth < 256 && (${supported}); }`,
            node,
          ),
        );
        node.members.push(
          SimpleParser.parseClassMember(
            generateCursorParser(
              this.schema.members,
              getComparisions,
              cursorMayDefer && cursorDeferred.length > 0,
            ),
            node,
          ),
        );
      }
    }

    node.members.push(
      SimpleParser.parseClassMember(
        `__DESERIALIZE_FAST_ENABLED(): bool { return ${!DESERIALIZE_CUSTOM && useFastPath}; }`,
        node,
      ),
    );

    const serializerPure =
      !schema.custom &&
      !schema.parent?.custom &&
      !hasManualSerializer(node) &&
      schema.members.every(
        (member) =>
          !member.flags.has(PropertyFlags.OmitIf) &&
          !member.flags.has(PropertyFlags.Lazy) &&
          (isPrimitive(member.type) ||
            isString(member.type) ||
            isEnum(stripNull(member.type), source, this.parser)),
      );
    const ownType =
      node.name.text +
      (node.typeParameters?.length
        ? `<${node.typeParameters.map((parameter) => parameter.name.text).join(",")}>`
        : "");
    node.members.push(
      SimpleParser.parseClassMember(
        `__SERIALIZE_PURE_TYPE(): u32 { return ${serializerPure ? `idof<${ownType}>()` : "0"}; }`,
        node,
      ),
    );

    // Reusing final static slots is restricted to callback-free scalar models.
    const reusableScalarModel =
      !effectful(schema) &&
      !schema.hasInternalInitializers &&
      !this.hasCustomCursorLifecycle(schema) &&
      schema.members.every(
        (member) =>
          (isPrimitive(stripNull(member.type)) || isString(member.type)) &&
          (!member.node.initializer ||
            member.node.initializer.kind === NodeKind.Literal),
      );
    node.members.push(
      SimpleParser.parseClassMember(
        `__DESERIALIZE_REUSE_PURE(): bool { return ${reusableScalarModel}; }`,
        node,
      ),
    );

    if (!node.members.find((v) => v.name.text == "__SERIALIZE"))
      node.members.push(SERIALIZE_METHOD);
    if (
      INITIALIZE_METHOD &&
      !node.members.find((v) => v.name.text == "__INITIALIZE")
    )
      node.members.push(INITIALIZE_METHOD);
    if (
      DESERIALIZE_CUSTOM_METHOD &&
      !node.members.find((v) => v.name.text == "__DESERIALIZE_CUSTOM")
    )
      node.members.push(DESERIALIZE_CUSTOM_METHOD);
    if (
      !DESERIALIZE_CUSTOM &&
      DESERIALIZE_SLOW_METHOD &&
      !node.members.find((v) => v.name.text == "__DESERIALIZE_SLOW")
    )
      node.members.push(DESERIALIZE_SLOW_METHOD);
    if (
      !DESERIALIZE_CUSTOM &&
      useFastPath &&
      DESERIALIZE_FAST_METHOD &&
      !node.members.find((v) => v.name.text == "__DESERIALIZE_FAST")
    )
      node.members.push(DESERIALIZE_FAST_METHOD);
    if (!DESERIALIZE_CUSTOM && WHITESPACE_METHOD)
      node.members.push(WHITESPACE_METHOD);
    if (
      !DESERIALIZE_CUSTOM &&
      DESERIALIZE_FAST_PRETTY_METHOD &&
      !node.members.find((v) => v.name.text == "__DESERIALIZE_FAST_PRETTY")
    )
      node.members.push(DESERIALIZE_FAST_PRETTY_METHOD);
    if (
      !DESERIALIZE_CUSTOM &&
      PRETTY_SPECIALIZED_METHOD &&
      !node.members.find(
        (v) => v.name.text == "__DESERIALIZE_PRETTY_SPECIALIZED",
      )
    )
      node.members.push(PRETTY_SPECIALIZED_METHOD);
    if (
      SOURCE_FREE_METHOD &&
      !node.members.find((v) => v.name.text == "__DESERIALIZE_SOURCE_FREE")
    )
      node.members.push(SOURCE_FREE_METHOD);
    if (
      FULL_WRITE_METHOD &&
      !node.members.find((v) => v.name.text == "__DESERIALIZE_FULL_WRITE")
    )
      node.members.push(FULL_WRITE_METHOD);
    if (
      DEFAULT_OBJECT_METHOD &&
      !node.members.find((v) => v.name.text == "__DESERIALIZE_DEFAULT")
    )
      node.members.push(DEFAULT_OBJECT_METHOD);
    if (
      DEFAULT_OBJECT_FACTORY_METHOD &&
      !node.members.find((v) => v.name.text == "__DESERIALIZE_DEFAULT_NEW")
    )
      node.members.push(DEFAULT_OBJECT_FACTORY_METHOD);
    if (useFastPath && !DESERIALIZE_CUSTOM) {
      for (const chunk of fastChunkMethods) {
        const chunkMethod = SimpleParser.parseClassMember(chunk, node);
        if (!node.members.find((v) => v.name.text == chunkMethod.name.text))
          node.members.push(chunkMethod);
      }
    }
    super.visitClassDeclaration(node);
  }
  getSchema(name: string): Schema | null {
    name = stripNull(name);
    const source = this.sources.get(this.schema.node.range.source);
    const declaration = source.getClassInContext(name, this.schema.node);
    if (declaration) {
      return (
        this.schemas
          .get(source.internalPath)
          ?.find((s) => s.node === declaration) || null
      );
    }
    const imported = source.getImportedClass(name, this.parser);
    if (imported) {
      const importedSource = this.sources.get(imported.range.source);
      const schema = this.schemas
        .get(importedSource.internalPath)
        ?.find((s) => s.node === imported);
      if (schema) return schema;
    }
    const local =
      this.schemas
        .get(this.schema.node.range.source.internalPath)
        .find((s) => s.name == name) || null;
    if (local) return local;

    const exact = this.schema.deps.filter(
      (schema) => schema && schema.name == name,
    );
    if (exact.length == 1) return exact[0];

    // A short type spelling can refer to a namespaced dependency. Accept that
    // fallback only when it identifies one schema; selecting the first suffix
    // match could silently call an unrelated type's custom deserializer.
    const qualified = this.schema.deps.filter(
      (schema) => schema && schema.name.endsWith("." + name),
    );
    return qualified.length == 1 ? qualified[0] : null;
  }
  private explicitFieldInitializer(field: FieldDeclaration): string {
    if (!field.initializer) return "";
    const type = toString(field.type);
    const offset = `offsetof<this>(${JSON.stringify(field.name.text)})`;
    return (
      `  store<${type}>(changetype<usize>(this), ${toString(field.initializer)}, ${offset});\n` +
      `  if (isManaged<${type}>()) __link(changetype<usize>(this), load<usize>(changetype<usize>(this), ${offset}), false);\n`
    );
  }

  private baseInitializer(node: ClassDeclaration): boolean {
    if (!node.extendsType) return false;
    const source = this.sources.get(node.range.source);
    const name = source.resolveExtendsName(node);
    const base =
      source.getClassInContext(name, node) ||
      source.getImportedClass(name, this.parser) ||
      source.getAvailableClass(name, this.parser);
    if (!base || isStdlib(base)) return false;
    if (
      !base.members.some(
        (member) => member.name.text === "__JSON_INITIALIZE_FIELDS",
      )
    ) {
      const body =
        (this.baseInitializer(base)
          ? "  super.__JSON_INITIALIZE_FIELDS();\n"
          : "") +
        base.members
          .filter(
            (member) =>
              member.kind === NodeKind.FieldDeclaration &&
              !member.is(CommonFlags.Static),
          )
          .map((field) =>
            this.explicitFieldInitializer(field as FieldDeclaration),
          )
          .join("");
      base.members.push(
        SimpleParser.parseClassMember(
          `__JSON_INITIALIZE_FIELDS(): void {\n${body}}`,
          base,
        ),
      );
    }
    return true;
  }

  private addDeclaredInitializer(
    node: ClassDeclaration,
    fragments = new Map<Property, string>(),
  ): void {
    if (
      node.members.some(
        (member) => member.name.text === "__JSON_INITIALIZE_FIELDS",
      )
    )
      return;
    const fields = node.members.filter(
      (member) =>
        member.kind === NodeKind.FieldDeclaration &&
        !member.is(CommonFlags.Static),
    ) as FieldDeclaration[];
    const wire = new Map(
      this.schema.members.map((member) => [member.node, member]),
    );
    const backing = new Set(
      this.schema.members
        .filter((member) => member.flags.has(PropertyFlags.Lazy))
        .map((member) => member.name.slice(0, -3) + "_val"),
    );
    let body = this.baseInitializer(node)
      ? "  super.__JSON_INITIALIZE_FIELDS();\n"
      : "";
    // Undecorated bases retain their explicit defaults in their own scope;
    // implicit wire defaults still use the generated field policy.
    if (!this.schema.parent)
      for (const member of this.schema.members) {
        if (!fields.includes(member.node) && !member.node.initializer)
          body += fragments.get(member) ?? "";
      }
    for (const field of fields) {
      const member = wire.get(field);
      if (member && fragments.has(member)) {
        body += fragments.get(member)!;
        body += `  if (isManaged<${member.type}>()) __link(changetype<usize>(this), load<usize>(changetype<usize>(this), offsetof<this>(${JSON.stringify(member.name)})), false);\n`;
        const valueField = fields.find(
          (candidate) =>
            candidate.name.text === member.name.slice(0, -3) + "_val",
        );
        if (member.flags.has(PropertyFlags.Lazy) && valueField)
          body += `  if (isManaged<${toString(valueField.type)}>()) __link(changetype<usize>(this), load<usize>(changetype<usize>(this), offsetof<this>(${JSON.stringify(valueField.name.text)})), false);\n`;
      } else if (!backing.has(field.name.text))
        body += this.explicitFieldInitializer(field);
    }
    node.members.push(
      SimpleParser.parseClassMember(
        `__JSON_INITIALIZE_FIELDS(): void {\n${body}}`,
        node,
      ),
    );
  }

  generateEmptyMethods(node: ClassDeclaration): void {
    const SERIALIZE_EMPTY =
      "__SERIALIZE(ptr: usize): void {\n  bs.proposeSize(4);\n  store<u32>(bs.offset, 8192123);\n  bs.offset += 4;\n}";
    this.addDeclaredInitializer(node);
    const ownType =
      node.name.text +
      (node.typeParameters?.length
        ? `<${node.typeParameters.map((parameter) => parameter.name.text).join(",")}>`
        : "");
    node.members.push(
      SimpleParser.parseClassMember(
        `__SERIALIZE_PURE_TYPE(): u32 { return ${hasManualSerializer(node) ? "0" : `idof<${ownType}>()`}; }`,
        node,
      ),
    );
    node.members.push(
      SimpleParser.parseClassMember(
        "__DESERIALIZE_FAST_ENABLED(): bool { return false; }",
        node,
      ),
    );
    node.members.push(
      SimpleParser.parseClassMember(
        "__DESERIALIZE_REUSE_PURE(): bool { return false; }",
        node,
      ),
    );
    const INITIALIZE_EMPTY =
      "__INITIALIZE(): this {\n  memory.fill(changetype<usize>(this), 0, offsetof<this>());\n  this.__JSON_INITIALIZE_FIELDS();\n  return this;\n}";
    const DESERIALIZE_SLOW_EMPTY =
      "__DESERIALIZE_SLOW<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T, __resetMissing: bool = false): usize {\n  return srcEnd;\n}";

    if (DEBUG > 0) {
      console.log(SERIALIZE_EMPTY);
      console.log(INITIALIZE_EMPTY);
      console.log(DESERIALIZE_SLOW_EMPTY);
    }

    const SERIALIZE_METHOD_EMPTY = SimpleParser.parseClassMember(
      SERIALIZE_EMPTY,
      node,
    );
    const INITIALIZE_METHOD_EMPTY = SimpleParser.parseClassMember(
      INITIALIZE_EMPTY,
      node,
    );
    const DESERIALIZE_SLOW_METHOD_EMPTY = SimpleParser.parseClassMember(
      DESERIALIZE_SLOW_EMPTY,
      node,
    );

    if (!node.members.find((v) => v.name.text == "__SERIALIZE"))
      node.members.push(SERIALIZE_METHOD_EMPTY);
    if (
      INITIALIZE_METHOD_EMPTY &&
      !node.members.find((v) => v.name.text == "__INITIALIZE")
    )
      node.members.push(INITIALIZE_METHOD_EMPTY);
    if (!node.members.find((v) => v.name.text == "__DESERIALIZE_SLOW"))
      node.members.push(DESERIALIZE_SLOW_METHOD_EMPTY);
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

    // console.log("baseCWD", this.baseCWD);
    // console.log("baseDir", baseDir);

    fromPath = fromPath.startsWith("~lib")
      ? fromPath.slice(5)
      : path.join(this.baseCWD, fromPath);

    // console.log("fromPath", fromPath);

    const imports = node.statements.filter(
      (statement) => statement.kind === NodeKind.Import,
    ) as ImportStatement[];
    const jsonImport = imports.find((statement) =>
      statement.declarations?.some((item) => item.foreignName.text === "JSON"),
    );
    const baseRel = computeImportBaseRel(
      path.dirname(fromPath),
      path.join(baseDir),
    );

    // Imports added in afterParse must point at modules the parser already
    // loaded. Recomputing a filesystem/package path can give the same file a
    // different internal identity, especially with absolute imports or pnpm.
    const runtimeSource =
      this.parser.sources.find(
        (source) =>
          (source.internalPath === jsonImport?.internalPath ||
            source.internalPath === jsonImport?.internalPath + "/index") &&
          source.internalPath.endsWith("assembly/index"),
      ) ??
      this.parser.sources.find(
        (source) =>
          source.internalPath.endsWith("assembly/index") &&
          source.statements.some(
            (statement) =>
              statement.kind === NodeKind.NamespaceDeclaration &&
              (statement as NamespaceDeclaration).name.text === "JSON",
          ),
      );
    const runtimeRoot = runtimeSource?.internalPath.slice(
      0,
      -"assembly/index".length,
    );
    const runtimeImport = (...segments: string[]): string => {
      const subpath = segments.join("/");
      if (runtimeRoot !== undefined) {
        const target = runtimeRoot + subpath;
        const parsed = this.parser.sources.find(
          (source) =>
            source.internalPath === target ||
            source.internalPath === target + "/index",
        );
        if (parsed) {
          if (parsed.internalPath.startsWith("~lib/"))
            return parsed.internalPath.slice(5);
          // Internal module paths may start above the compiler's baseDir.
          // path.relative resolves them against cwd and loses those parents.
          const from = path.posix.dirname(node.internalPath).split("/");
          if (from[0] === ".") from.shift();
          const to = parsed.internalPath.split("/");
          let shared = 0;
          while (shared < from.length && from[shared] === to[shared]) shared++;
          const relative = [
            ...from.slice(shared).map(() => ".."),
            ...to.slice(shared),
          ].join("/");
          return relative.startsWith(".") ? relative : "./" + relative;
        }
      }
      return path.posix.join(baseRel, ...segments);
    };

    const names = new Set<string>();
    for (const statement of node.statements) {
      const declaration = statement as unknown as {
        name?: IdentifierExpression;
        declarations?: { name: IdentifierExpression }[];
      };
      if (declaration.name) names.add(declaration.name.text);
      for (const item of declaration.declarations || [])
        names.add(item.name.text);
    }
    // Namespace and local declarations can shadow a module-level import at a
    // generated method's use site. Prefer names absent from every such scope.
    const shadowed = new Set<string>();
    class CollectShadowingNames extends Visitor {
      visitIdentifierExpression(
        identifier: IdentifierExpression,
        parent: Node | null = null,
      ): void {
        if (
          parent &&
          [
            NodeKind.VariableDeclaration,
            NodeKind.FunctionDeclaration,
            NodeKind.Parameter,
            NodeKind.NamespaceDeclaration,
          ].includes(parent.kind)
        ) {
          const declaration = parent as unknown as {
            name?: IdentifierExpression;
          };
          if (declaration.name === identifier) shadowed.add(identifier.text);
        }
      }
    }
    new CollectShadowingNames().visit(node);
    for (const name of shadowed) names.add(name);
    const aliases = new Map<string, string>();
    const inject = (module: string, bindings: [string, string][]): void => {
      const declarations = bindings
        .map(([foreign, preferred]) => {
          // Keep the conventional spelling when it is free. A renamed import
          // of JSON does not provide a local JSON identifier.
          const targetPath = module.startsWith(".")
            ? path.posix.normalize(
                path.posix.join(path.posix.dirname(node.internalPath), module),
              )
            : "~lib/" + module;
          const target = this.parser.sources.find(
            (candidate) =>
              candidate.internalPath === targetPath ||
              candidate.internalPath === targetPath + "/index",
          );
          const existing = imports
            .find(
              (statement) =>
                ((target &&
                  (statement.internalPath === target.internalPath ||
                    statement.internalPath + "/index" ===
                      target.internalPath)) ||
                  (foreign === "JSON" &&
                    runtimeRoot !== undefined &&
                    statement.internalPath === runtimeRoot + "index")) &&
                statement.declarations?.some(
                  (item) =>
                    item.foreignName.text === foreign &&
                    item.name.text === preferred,
                ),
            )
            ?.declarations?.find(
              (item) =>
                item.foreignName.text === foreign &&
                item.name.text === preferred,
            );
          if (existing && !shadowed.has(preferred)) {
            if (foreign === "JSON")
              aliases.set(this.runtimeReference(), preferred);
            return null;
          }
          let local = preferred;
          for (let suffix = 0; names.has(local); suffix++)
            local = "__json_" + preferred + "_" + suffix;
          names.add(local);
          if (local !== preferred) aliases.set(preferred, local);
          if (foreign === "JSON") aliases.set(this.runtimeReference(), local);
          return Node.createImportDeclaration(
            Node.createIdentifierExpression(foreign, node.range, false),
            local === foreign
              ? null
              : Node.createIdentifierExpression(local, node.range, false),
            node.range,
          );
        })
        .filter((declaration) => declaration !== null);
      if (declarations.length)
        node.statements.unshift(
          Node.createImportStatement(
            declarations,
            Node.createStringLiteralExpression(module, node.range),
            node.range,
          ),
        );
    };
    inject(runtimeImport("lib", "as-bs"), [["bs", "bs"]]);
    inject(runtimeImport("assembly", "index"), [["JSON", "JSON"]]);
    inject(runtimeImport("assembly", "util", "atoi"), [["atoi", "atoi"]]);
    inject(
      runtimeImport("assembly", "deserialize", "swar", "array", "shared"),
      [["scanValueEnd", "scanValueEnd"]],
    );
    inject(runtimeImport("assembly", "deserialize"), [
      ["deserializeIntegerField", "__deserializeIntegerField"],
      ["deserializeUnsignedField", "__deserializeUnsignedField"],
      ["deserializeFloatField", "__deserializeFloatField"],
      ["deserializeStringField", "__deserializeStringField"],
      ["deserializeStringFieldTrusted", "__deserializeStringFieldTrusted"],
      ["deserializeArrayField_SWAR", "__deserializeArrayField_SWAR"],
      ["deserializeMapField", "__deserializeMapField"],
      ["deserializeSetField", "__deserializeSetField"],
      ["deserializeStaticArrayField", "__deserializeStaticArrayField"],
    ]);
    if (aliases.size) {
      class BindGeneratedReferences extends Visitor {
        visitIdentifierExpression(identifier: IdentifierExpression): void {
          const local = aliases.get(identifier.text);
          if (local) identifier.text = local;
        }
        visitPropertyAccessExpression(
          expression: PropertyAccessExpression,
        ): void {
          this.visit(expression.expression);
        }
        // User type names and copied initializer/predicate expressions retain
        // their own bindings. Only generated runtime method bodies are rebound.
        visitNamedTypeNode(_type: NamedTypeNode): void {}
      }
      const bind = new BindGeneratedReferences();
      for (const schema of this.schemas.get(node.internalPath) || []) {
        for (const member of schema.node.members) {
          if (member.kind === NodeKind.FieldDeclaration) {
            const runtimeName = this.runtimeReference();
            class BindFieldRuntime extends Visitor {
              visitIdentifierExpression(
                identifier: IdentifierExpression,
              ): void {
                if (identifier.text === runtimeName)
                  identifier.text = aliases.get(runtimeName)!;
              }
            }
            new BindFieldRuntime().visit(
              (member as FieldDeclaration).initializer,
            );
          }
          if (
            member.kind !== NodeKind.MethodDeclaration ||
            this.parser.sources.includes(member.range.source)
          )
            continue;
          if (
            member.name.text.includes("INITIALIZE") ||
            member.name.text.startsWith("__JSON_OMIT_")
          ) {
            const runtimeName = this.runtimeReference();
            class BindRuntimeOnly extends Visitor {
              visitIdentifierExpression(
                identifier: IdentifierExpression,
              ): void {
                if (identifier.text === runtimeName)
                  identifier.text = aliases.get(runtimeName)!;
              }
            }
            new BindRuntimeOnly().visit((member as MethodDeclaration).body);
          } else bind.visit((member as MethodDeclaration).body);
        }
      }
    }
  }

  getStores(
    data: string,
    simd: boolean = false,
    target: string = "bs.offset",
  ): string[] {
    const out: string[] = [];
    const sizes = strToNum(data, simd);
    let offset = 0;
    for (const [size, num] of sizes) {
      if (size == "v128" && simd) {
        const owner = this.schema.node.range.source;
        let statements = this.simdStatements.get(owner);
        if (!statements) this.simdStatements.set(owner, (statements = []));
        const index = statements.findIndex((v) => v.includes(num));
        const name = "SIMD_" + (index == -1 ? statements.length : index);
        if (index == -1) statements.push(`const ${name} = ${num};`);
        out.push(
          "store<v128>(" +
            target +
            ", " +
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
          "store<u64>(" +
            target +
            ", " +
            num +
            ", " +
            offset +
            "); // " +
            data.slice(offset >> 1, (offset >> 1) + 4),
        );
        offset += 8;
      } else if (size == "u32") {
        out.push(
          "store<u32>(" +
            target +
            ", " +
            num +
            ", " +
            offset +
            "); // " +
            data.slice(offset >> 1, (offset >> 1) + 2),
        );
        offset += 4;
      } else if (size == "u16") {
        out.push(
          "store<u16>(" +
            target +
            ", " +
            num +
            ", " +
            offset +
            "); // " +
            data.slice(offset >> 1, (offset >> 1) + 1),
        );
        offset += 2;
      }
    }
    out.push(target + " += " + offset + ";");
    return out;
  }
  isValidType(type: string, node: ClassDeclaration): boolean {
    const validTypes = [
      "string",
      ...INTEGER_TYPES,
      ...FLOAT_TYPES,
      "bool",
      "boolean",
      "Date",
      "JSON.Value",
      "JSON.Obj",
      "JSON.Arr",
      "JSON.Raw",
      "Value",
      "Obj",
      "Arr",
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
let MODE_TEXT = "SWAR";
const STAGES = process.env["JSON_STAGES"] !== undefined;

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
    switch (MODE) {
      case JSONMode.SWAR:
        MODE_TEXT = "SWAR";
        break;
      case JSONMode.SIMD:
        MODE_TEXT = "SIMD";
        break;
      case JSONMode.NAIVE:
        MODE_TEXT = "NAIVE";
        break;
    }
    if (STAGES)
      console.log(
        "[transform]: Finished initializing transformer in " +
          MODE_TEXT +
          " mode",
      );

    program.registerConstantInteger("JSON_MODE", Type.i32, i64_new(MODE));
    program.registerConstantInteger(
      "JSON_DIAGNOSTICS",
      Type.bool,
      DIAGNOSTICS ? i64_one : i64_zero,
    );
    program.registerConstantInteger(
      "JSON_STRICT",
      Type.bool,
      STRICT ? i64_one : i64_zero,
    );
    if (JSON_CACHE_CONFIG.enabled) {
      program.registerConstantInteger("JSON_CACHE", Type.bool, i64_one);
      program.registerConstantInteger(
        "JSON_CACHE_SIZE",
        Type.u32,
        i64_new(JSON_CACHE_CONFIG.bytes),
      );
    }
  }

  afterParse(parser: Parser): void {
    const transformer = new JSONTransform();
    const originalMethods = DIAGNOSTICS
      ? null
      : collectOriginalMethods(parser.sources);
    const runtimeRoot = DIAGNOSTICS
      ? undefined
      : diagnosticsRuntimeRoot(parser.sources);

    if (STAGES) console.log("[transform]: Walking AST and generating schemas");
    // // Reset singleton state to prevent pollution across compilations
    // // This is critical for worker pools where the same process handles multiple compilations
    // transformer.schemas = new Map<string, Schema[]>();
    // transformer.sources = new SourceSet();
    // transformer.visitedClasses = new Set<string>();
    // transformer.simdStatements = [];

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
    transformer.prepareLazyOverrides(sources);
    for (const source of sources) {
      transformer.imports = [];
      transformer.currentSource = source;
      transformer.visit(source);

      if (!DIAGNOSTICS) lowerDiagnostics(source, originalMethods!, runtimeRoot);
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

    specializeObjectAllocator(parser.sources);

    for (const [source, statements] of transformer.simdStatements) {
      for (const statement of statements)
        source.statements.unshift(
          SimpleParser.parseTopLevelStatement(statement),
        );
    }

    // AssemblyScript only wires a class's custom `__visit` GC hook when that
    // class is declared in a *library* source (see Compiler: the `__visit`
    // member is honored only when `isDeclaredInLibrary`). JSON.Value defines
    // such a hook to trace the managed reference packed into its storage word,
    // so mark json-as's own index as a library source. This is done after the
    // processing above so the transform's source ordering is unaffected; the
    // compiler reads `isLibrary` later, during compilation.
    // Installed packages have a package-qualified internal path. Direct source
    // builds (such as this repository's tests) opt in with the exact internal
    // path through JSON_AS_LIBRARY_SOURCE instead of relying on host paths.
    const configuredLibrarySource =
      process.env["JSON_AS_LIBRARY_SOURCE"]?.trim();
    for (const source of parser.sources) {
      const p = source.internalPath;
      if (
        p.endsWith("/json-as/assembly/index") ||
        (configuredLibrarySource && p === configuredLibrarySource)
      ) {
        source.sourceKind = SourceKind.Library;
      }
    }
    if (STAGES)
      console.log(
        "[transform]: Finished generating " +
          transformer.schemas.size +
          " schemas",
      );
  }
}

function toU16(data: string, offset: number = 0): number {
  return data.charCodeAt(offset + 0);
}

function toU32(data: string, offset: number = 0): number {
  return (data.charCodeAt(offset + 1) << 16) | data.charCodeAt(offset + 0);
}

function toU48(data: string, offset: number = 0): bigint {
  return (
    (BigInt(data.charCodeAt(offset + 2)) << 32n) |
    (BigInt(data.charCodeAt(offset + 1)) << 16n) |
    BigInt(data.charCodeAt(offset + 0))
  );
}

function toU64(data: string, offset: number = 0): bigint {
  return (
    (BigInt(data.charCodeAt(offset + 3)) << 48n) |
    (BigInt(data.charCodeAt(offset + 2)) << 32n) |
    (BigInt(data.charCodeAt(offset + 1)) << 16n) |
    BigInt(data.charCodeAt(offset + 0))
  );
}

function toMemCDecl(n: number, indent: string): string {
  let out = "";
  let offset = 0;
  let index = 0;
  while (n >= 8) {
    out += `${indent}const codeS${(index += 8)} = load<u64>(keyStart, ${offset});\n`;
    offset += 8;
    n -= 8;
  }

  while (n >= 4) {
    out += `${indent}const codeS${(index += 4)} = load<u32>(keyStart, ${offset});\n`;
    offset += 4;
    n -= 4;
  }

  if (n == 2)
    out += `${indent}const codeS${(index += 2)} = load<u16>(keyStart, ${offset});\n`;

  return out;
}

function toMemCCheck(data: string): string {
  let n = data.length << 1;
  let out = "";
  let offset = 0;
  let index = 0;
  while (n >= 8) {
    out += ` && codeS${(index += 8)} == ${toU64(data, offset >> 1)}`;
    offset += 8;
    n -= 8;
  }

  while (n >= 4) {
    out += ` && codeS${(index += 4)} == ${toU32(data, offset >> 1)}`;
    offset += 4;
    n -= 4;
  }

  if (n == 2) out += ` && codeS${(index += 2)} == ${toU16(data, offset >> 1)}`;

  return out.slice(4);
}

function strToNum(
  data: string,
  simd: boolean = false,
  offset: number = 0,
): string[][] {
  const out: string[][] = [];
  let n = data.length;

  while (n >= 8 && simd) {
    out.push([
      "v128",
      "i16x8(" +
        data.charCodeAt(offset + 0) +
        ", " +
        data.charCodeAt(offset + 1) +
        ", " +
        data.charCodeAt(offset + 2) +
        ", " +
        data.charCodeAt(offset + 3) +
        ", " +
        data.charCodeAt(offset + 4) +
        ", " +
        data.charCodeAt(offset + 5) +
        ", " +
        data.charCodeAt(offset + 6) +
        ", " +
        data.charCodeAt(offset + 7) +
        ")",
    ]);
    offset += 8;
    n -= 8;
  }

  while (n >= 4) {
    const value =
      (BigInt(data.charCodeAt(offset + 3)) << 48n) |
      (BigInt(data.charCodeAt(offset + 2)) << 32n) |
      (BigInt(data.charCodeAt(offset + 1)) << 16n) |
      BigInt(data.charCodeAt(offset + 0));
    out.push(["u64", value.toString()]);
    offset += 4;
    n -= 4;
  }

  while (n >= 2) {
    const value =
      (data.charCodeAt(offset + 1) << 16) | data.charCodeAt(offset + 0);
    out.push(["u32", value.toString()]);
    offset += 2;
    n -= 2;
  }

  if (n === 1) {
    const value = data.charCodeAt(offset + 0);
    out.push(["u16", value.toString()]);
  }

  return out;
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

function sizeof(type: string): number {
  if (type == "u8")
    return 6; // -127
  else if (type == "i8")
    return 8; // 255
  else if (type == "u16")
    return 10; // 65536
  else if (type == "i16")
    return 12; // -32767
  else if (type == "u32")
    return 20; // 4294967295
  else if (type == "i32")
    return 22; // -2147483647
  else if (type == "usize")
    return 40; // platform dependent, reserve conservatively like u64
  else if (type == "isize")
    return 42; // platform dependent, reserve conservatively like i64
  else if (type == "u64")
    return 40; // 18446744073709551615
  else if (type == "i64")
    return 42; // -9223372036854775808
  else if (type == "f32")
    return 34; // max dtoa length used by runtime reserve
  else if (type == "f64" || type == "number")
    return 66; // max dtoa length used by runtime reserve
  else if (type == "bool" || type == "boolean") return 10;
  else return 0;
}

// Class-level lazy mode from `@json({ lazy: "auto" | "all" | "none" })`.
type LazyMode = "none" | "auto" | "all";
function classLazyMode(node: ClassDeclaration): LazyMode {
  const dec = node.decorators?.find((d) => {
    const n = (<IdentifierExpression>d.name).text;
    return n === "json" || n === "serializable";
  });
  if (!dec || !dec.args || dec.args.length === 0) return "none";
  const arg = dec.args[0];
  if (
    arg.kind !== NodeKind.Literal ||
    (arg as LiteralExpression).literalKind !== LiteralKind.Object
  )
    return "none";
  const obj = arg as ObjectLiteralExpression;
  for (let i = 0; i < obj.names.length; i++) {
    if (obj.names[i].text !== "lazy") continue;
    const v = obj.values[i];
    if (
      v.kind === NodeKind.Literal &&
      (v as LiteralExpression).literalKind === LiteralKind.String
    ) {
      const s = (v as StringLiteralExpression).value;
      if (s === "none" || s === "auto" || s === "all") return s as LazyMode;
    }
    throwError(`@json lazy must be "none", "auto", or "all"`, v.range);
  }
  return "none";
}

// Structural parse-cost score for `lazy: "auto"`. byteSize is a buffer-prealloc
// estimate (string/array/object all ~4), so it can't separate cheap scalars
// from heavy allocating/recursive values - categorize by type instead. Fields
// at or above LAZY_AUTO_THRESHOLD are deferred; primitives/enums/Date stay eager.
const LAZY_AUTO_THRESHOLD = 10;

// One-level category cost of a type (does NOT recurse into nested structs -
// they count as a flat "heavy" 20 here, so there is no cycle risk).
function lazyTypeCost(type: string, source: Src, parser: Parser): number {
  const base = stripNull(type);
  if (isPrimitive(base) || isBoolean(base) || isEnum(base, source, parser))
    return 1;
  if (base === "Date") return 4;
  if (isString(base)) return 10;
  if (
    base === "JSON.Value" ||
    base === "Value" ||
    base === "JSON.Obj" ||
    base === "Obj" ||
    base === "JSON.Arr" ||
    base === "Arr" ||
    base === "JSON.Raw" ||
    base === "Raw"
  )
    return 15;
  return 20; // array / map / set / typed-array / buffer / nested @json struct
}

function lazyAutoCost(type: string, source: Src, parser: Parser): number {
  const direct = lazyTypeCost(type, source, parser);
  if (direct < 20) return direct; // scalar / Date / string / Value / Obj / Raw
  // direct == 20: an array/map/etc OR a nested @json struct. Refine a struct by
  // summing its direct fields' costs (one level) - a tiny all-scalar struct is
  // cheap to parse, so keep it eager. Containers and cross-source/unresolved
  // types fall back to "defer" (20).
  const decl = source.getClass(stripNull(type));
  if (!decl) return 20;
  let sum = 0;
  for (let i = 0; i < decl.members.length; i++) {
    const m = decl.members[i];
    if (m.kind !== NodeKind.FieldDeclaration) continue;
    const fd = m as FieldDeclaration;
    if (
      fd.is(CommonFlags.Static) ||
      fd.is(CommonFlags.Private) ||
      fd.is(CommonFlags.Protected) ||
      !fd.type
    )
      continue;
    sum += lazyTypeCost(toString(fd.type), source, parser);
    if (sum >= LAZY_AUTO_THRESHOLD) return sum; // already heavy enough to defer
  }
  return sum; // small struct -> low cost -> stays eager
}

function estimatedSerializedByteSize(
  type: string,
  source: Src,
  parser: Parser,
): number {
  const trimmed = type.trim();
  const baseType = stripNull(trimmed);
  const nullable = trimmed != baseType;

  let estimated = sizeof(baseType);

  if (estimated == 0) {
    if (isEnum(baseType, source, parser)) {
      // Enums serialize as numbers.
      estimated = 22;
    } else if (baseType == "Date") {
      estimated = 52; // "1970-01-01T00:00:00.000Z"
    } else if (isString(baseType)) {
      estimated = 4; // ""
    } else if (isArray(baseType) || baseType.startsWith("Map<")) {
      estimated = 4; // [] or {}
    } else if (
      baseType == "JSON.Obj" ||
      baseType == "Obj" ||
      baseType == "JSON.Arr" ||
      baseType == "Arr" ||
      baseType == "JSON.Raw" ||
      baseType == "Raw" ||
      baseType == "JSON.Value" ||
      baseType == "Value"
    ) {
      estimated = 4;
    } else if (baseType == "ArrayBuffer" || needsReferenceLoad(baseType)) {
      estimated = 4; // [] for typed/buffer values
    } else {
      // Nested @json classes and unknown managed values serialize to at least an object/value token.
      estimated = 4;
    }
  }

  if (nullable) {
    // Null literal is "null" (8 bytes in UTF-16 output buffer).
    estimated = Math.max(estimated, 8);
  }

  return estimated;
}

function hasManualSerializer(node: ClassDeclaration): boolean {
  return node.members.some((member) => member.name.text === "__SERIALIZE");
}

// Defaults may survive a layout miss. Calls, constructors and property reads
// can execute user code, so speculation must not replay their initialization.
function initializerHasEffects(expression: Expression): boolean {
  class Effects extends Visitor {
    effect = false;
    visitNewExpression(node: NewExpression): void {
      this.effect = true;
      super.visitNewExpression(node);
    }
    visitPropertyAccessExpression(node: PropertyAccessExpression): void {
      this.effect = true;
      super.visitPropertyAccessExpression(node);
    }
    visitCallExpression(node: CallExpression): void {
      if (
        ![
          "changetype",
          "reinterpret",
          "idof",
          "offsetof",
          "sizeof",
          "nameof",
        ].includes(toString(node.expression))
      )
        this.effect = true;
      super.visitCallExpression(node);
    }
    visitUnaryPrefixExpression(node: UnaryPrefixExpression): void {
      if (
        node.operator === Token.Plus_Plus ||
        node.operator === Token.Minus_Minus ||
        node.operand.kind !== NodeKind.Literal
      )
        this.effect = true;
      super.visitUnaryPrefixExpression(node);
    }
    visitUnaryPostfixExpression(node: UnaryPostfixExpression): void {
      this.effect = true;
      super.visitUnaryPostfixExpression(node);
    }
    visitElementAccessExpression(node: ElementAccessExpression): void {
      this.effect = true;
      super.visitElementAccessExpression(node);
    }
    visitBinaryExpression(node: BinaryExpression): void {
      // Nonliteral operands can invoke user-defined operators.
      if (
        node.left.kind !== NodeKind.Literal ||
        node.right.kind !== NodeKind.Literal
      )
        this.effect = true;
      if (node.operator >= Token.Equals && node.operator <= Token.Caret_Equals)
        this.effect = true;
      super.visitBinaryExpression(node);
    }
  }
  const effects = new Effects();
  effects.visit(expression);
  return effects.effect;
}

function isPrimitive(type: string): boolean {
  return isScalarType(stripNull(type).trim());
}

function isBoolean(type: string): boolean {
  return type == "bool" || type == "boolean";
}

function isString(type: string) {
  return stripNull(type) == "string" || stripNull(type) == "String";
}

function isArray(type: string): boolean {
  return (
    type.startsWith("Array<") ||
    type.startsWith("Set<") ||
    type.startsWith("StaticArray<")
  );
}

function isEnum(type: string, source: Src, parser: Parser): boolean {
  return (
    source.getEnum(type) != null || source.getImportedEnum(type, parser) != null
  );
}

export function stripNull(type: string): string {
  if (type.endsWith(" | null")) {
    return type.slice(0, type.length - 7);
  } else if (type.startsWith("null | ")) {
    return type.slice(7);
  }
  return type;
}

// Floats @omitnull/@omitif fields to the front (a stable partition). Only @omit
// fields move; @optional and plain fields keep their relative declaration order.
function sortMembers(members: Property[]): Property[] {
  return members.sort((a, b) => {
    const aMove =
      a.flags.has(PropertyFlags.OmitIf) || a.flags.has(PropertyFlags.OmitNull);
    const bMove =
      b.flags.has(PropertyFlags.OmitIf) || b.flags.has(PropertyFlags.OmitNull);

    if (aMove && !bMove) {
      return -1;
    } else if (!aMove && bMove) {
      return 1;
    } else {
      return 0;
    }
  });
}

function getComparison(data: string) {
  if (data.length == 0) return "true";
  switch (data.length << 1) {
    case 2: {
      return "code16 == " + data.charCodeAt(0);
    }
    case 4: {
      return "code32 == " + toU32(data);
    }
    case 6: {
      return "code48 == " + toU48(data);
    }
    case 8: {
      return "code64 == " + toU64(data);
    }
    default: {
      return toMemCCheck(data);
    }
  }
}
