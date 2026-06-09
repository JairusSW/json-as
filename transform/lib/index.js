import { Node, Type, } from "assemblyscript/dist/assemblyscript.js";
import { Transform } from "assemblyscript/dist/transform.js";
import { writeFileSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { CustomTransform } from "./linkers/custom.js";
import { NodeKind } from "./types.js";
import { Property, PropertyFlags, Schema, SourceSet } from "./types.js";
import { isStdlib, removeExtension, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
let indent = "  ";
let id = 0;
const WRITE = process.env["JSON_WRITE"]?.trim();
const rawValue = process.env["JSON_DEBUG"]?.trim();
const DEBUG = rawValue === "true"
    ? 1
    : rawValue === "false" || rawValue === ""
        ? 0
        : isNaN(Number(rawValue))
            ? 0
            : Number(rawValue);
const STRICT = process.env["JSON_STRICT"] && process.env["JSON_STRICT"] == "true";
const DEFAULT_JSON_CACHE_BYTES = 1 << 20;
export function normalizeJsonAsBaseRel(baseRel) {
    if (baseRel.endsWith("json-as")) {
        return "json-as" + baseRel.slice(baseRel.lastIndexOf("json-as") + 7);
    }
    if (!baseRel.startsWith(".") &&
        !baseRel.startsWith("/") &&
        !baseRel.startsWith("json-as")) {
        return "./" + baseRel;
    }
    return baseRel;
}
export function computeImportBaseRel(fromDir, packageDir, p = path) {
    return normalizeJsonAsBaseRel(path.posix.join(...p.relative(fromDir, packageDir).split(p.sep)));
}
function envFlagDefaultTrue(value) {
    if (!value)
        return true;
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
function parseJSONCacheConfig(value) {
    if (!value)
        return { enabled: false, bytes: 0 };
    const raw = value.trim();
    if (!raw)
        return { enabled: false, bytes: 0 };
    const lower = raw.toLowerCase();
    if (lower === "false" ||
        lower === "off" ||
        lower === "no" ||
        lower === "none" ||
        lower === "0") {
        return { enabled: false, bytes: 0 };
    }
    if (lower === "true" || lower === "on" || lower === "yes") {
        return { enabled: true, bytes: DEFAULT_JSON_CACHE_BYTES };
    }
    const match = /^(\d+)\s*([kKmMgG]?[bB])?$/.exec(raw);
    if (!match) {
        throw new Error(`Invalid JSON_CACHE value '${value}'. Expected true/false or <int>[kb|mb|gb|KB|MB|GB].`);
    }
    const amount = Number(match[1]);
    const suffix = match[2] || "B";
    if (!Number.isFinite(amount)) {
        throw new Error(`Invalid JSON_CACHE value '${value}'.`);
    }
    const unit = suffix[0];
    const scale = unit == "k" || unit == "K"
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
function needsReferenceLoad(type) {
    return (type == "ArrayBuffer" ||
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
        type == "Float64Array");
}
function getSerializeCall(type, realName) {
    if (type == "ArrayBuffer") {
        return `JSON.__serialize<ArrayBuffer>(load<ArrayBuffer>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`;
    }
    return needsReferenceLoad(type)
        ? `JSON.__serialize<${type}>(changetype<${type}>(load<usize>(ptr, offsetof<this>(${JSON.stringify(realName)}))));\n`
        : `JSON.__serialize<${type}>(load<${type}>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`;
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
function parseCustomJsonKind(method, decoratorName) {
    const decorator = method.decorators?.find((v) => v.name.text.toLowerCase() == decoratorName);
    if (!decorator || !decorator.args || decorator.args.length == 0)
        return "any";
    if (decorator.args.length > 1)
        throwError(`@${decoratorName} accepts at most one argument`, decorator.range);
    const arg = decorator.args[0];
    if (arg.kind != NodeKind.Literal ||
        arg.literalKind != 2) {
        throwError(`@${decoratorName} argument must be a string literal like @${decoratorName}("string")`, arg.range);
    }
    const kind = arg.value;
    if (!CUSTOM_JSON_KINDS.has(kind)) {
        throwError(`Unsupported @${decoratorName} JSON type '${kind}'. Expected one of: any, string, number, object, array, boolean, null`, arg.range);
    }
    return kind;
}
function addMemberToCustomBucket(sortedMembers, member, kind) {
    const isNullable = kind.endsWith(" | null");
    const baseKind = isNullable ? kind.slice(0, kind.length - 7) : kind;
    if (isNullable)
        sortedMembers.null.push(member);
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
            if (!isNullable)
                sortedMembers.null.push(member);
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
            if (!isNullable)
                sortedMembers.null.push(member);
            break;
    }
}
export class JSONTransform extends Visitor {
    static SN = new JSONTransform();
    program;
    baseCWD;
    parser;
    schemas = new Map();
    schema;
    sources = new SourceSet();
    imports = [];
    simdStatements = [];
    visitedClasses = new Set();
    collectInheritedFieldMembers(node, source, members, visited = new Set()) {
        if (!node.extendsType)
            return;
        const extendsName = source.resolveExtendsName(node);
        if (!extendsName || visited.has(extendsName))
            return;
        visited.add(extendsName);
        let baseDecl = source.getClass(extendsName);
        let baseSource = baseDecl ? source : null;
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
        if (!baseDecl || !baseSource)
            return;
        const isDecoratedBase = !!baseDecl.decorators?.some((decorator) => {
            const name = decorator.name.text;
            return name === "json" || name === "serializable";
        });
        if (isDecoratedBase)
            return;
        this.collectInheritedFieldMembers(baseDecl, baseSource, members, visited);
        const inheritedMembers = baseDecl.members.filter((v) => v.kind === NodeKind.FieldDeclaration &&
            !v.is(32) &&
            !v.is(512) &&
            !v.is(1024) &&
            !v.decorators?.some((decorator) => decorator.name.text === "omit"));
        for (let i = inheritedMembers.length - 1; i >= 0; i--) {
            const inherited = inheritedMembers[i];
            if (!members.some((member) => member.name.text == inherited.name.text)) {
                members.unshift(inherited);
            }
        }
    }
    visitClassDeclarationRef(node) {
        if (!node.decorators?.length ||
            !node.decorators.some((decorator) => {
                const name = decorator.name.text;
                return name === "json" || name === "serializable";
            }))
            throw new Error("Class " +
                node.name.text +
                " is missing an @json or @serializable decorator in " +
                node.range.source.internalPath);
        this.visitClassDeclaration(node);
    }
    resolveType(type, source, visited = new Set()) {
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
            if (!imp.declarations)
                continue;
            for (const decl of imp.declarations) {
                if (decl.name.text === stripped) {
                    const externalSource = this.parser.sources.find((s) => s.internalPath === imp.internalPath);
                    if (externalSource) {
                        const externalSrc = this.sources.get(externalSource);
                        if (!externalSrc)
                            continue;
                        const externalAlias = externalSrc.aliases.find((a) => a.name === decl.foreignName.text);
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
    visitClassDeclaration(node) {
        if (!node.decorators?.length)
            return;
        if (!node.decorators.some((decorator) => {
            const name = decorator.name.text;
            return name === "json" || name === "serializable";
        }))
            return;
        const source = this.sources.get(node.range.source);
        const fullClassPath = source.getFullPath(node);
        if (this.visitedClasses.has(fullClassPath))
            return;
        if (!this.schemas.has(source.internalPath))
            this.schemas.set(source.internalPath, []);
        const lazyInner = new Map();
        const lazyMode = classLazyMode(node);
        const hasCustomSerde = node.members.some((m) => m.kind === NodeKind.MethodDeclaration &&
            (m.decorators?.some((d) => {
                const t = d.name.text.toLowerCase();
                return t === "serializer" || t === "deserializer";
            }) ??
                false));
        let __hasLazy = false;
        for (let i = node.members.length - 1; i >= 0; i--) {
            const fd = node.members[i];
            if (fd.kind !== NodeKind.FieldDeclaration ||
                fd.is(32) ||
                fd.is(512) ||
                fd.is(1024) ||
                !fd.type)
                continue;
            const written = toString(fd.type).trim();
            const decos = fd.decorators;
            const hasDeco = (name) => decos?.some((d) => d.name.text === name) ??
                false;
            let inner = lazyWrapperInner(fd.type);
            if (inner === null) {
                if (hasDeco("lazy")) {
                    inner = written;
                }
                else if (lazyMode !== "none" &&
                    !hasDeco("eager") &&
                    !hasDeco("omit")) {
                    if (lazyMode === "all")
                        inner = written;
                    else if (lazyAutoCost(this.resolveType(written, source), source, this.parser) >= LAZY_AUTO_THRESHOLD)
                        inner = written;
                }
            }
            if (inner === null)
                continue;
            if (hasCustomSerde)
                throwError("Lazy fields (@lazy / JSON.Lazy<T> / @json({ lazy })) are not supported " +
                    "on a class with a custom @serializer/@deserializer — the custom methods " +
                    "bypass the generated (de)serializer, so the deferred slot is never filled. " +
                    "Remove the lazy marker or the custom (de)serializer.", fd.range);
            const fname = fd.name.text;
            const key = JSON.stringify(fname);
            const T = inner;
            const baseT = stripNull(T);
            const storesScalar = isPrimitive(baseT) || isEnum(baseT, source, this.parser);
            const valueType = storesScalar || baseT != T ? T : `${T} | null`;
            const valueDefault = isBoolean(baseT)
                ? "false"
                : storesScalar
                    ? "0"
                    : "null";
            const fdInit = fd.initializer;
            const fieldDefault = fdInit ? toString(fdInit) : null;
            __hasLazy = true;
            const omitIfDeco = decos?.find((d) => d.name.text === "omitif");
            lazyInner.set("__" + fname + "_lz", {
                inner: T,
                valueType,
                omitNull: hasDeco("omitnull"),
                omitIf: omitIfDeco?.args?.[0] ?? null,
            });
            const packScalar = baseT === "i8" ||
                baseT === "u8" ||
                baseT === "i16" ||
                baseT === "u16" ||
                baseT === "i32" ||
                baseT === "u32" ||
                baseT === "bool" ||
                baseT === "boolean" ||
                baseT === "f32";
            const encVal = (v) => baseT === "f32"
                ? `(<u64>reinterpret<u32>(${v}))`
                : `(<u64><u32>(${v}))`;
            const decSlot = (lz) => baseT === "f32"
                ? `reinterpret<f32>(<u32>(${lz}))`
                : `(<${T}>(<u32>(${lz})))`;
            const lowered = (packScalar
                ? [
                    `@alias(${key}) private __${fname}_lz: u64 = ${fieldDefault != null
                        ? `(((<u64>0xffffffff) << 32) | ${encVal(`<${T}>(${fieldDefault})`)})`
                        : "0"};`,
                    `get ${fname}(): ${T} {\n` +
                        `  const __lz = this.__${fname}_lz;\n` +
                        `  if ((__lz >>> 32) == 0xffffffff) return ${decSlot("__lz")};\n` +
                        `  if (__lz != 0) {\n` +
                        `    const __v = JSON.__deserialize<${T}>(<usize>(__lz >>> 32), <usize>(<u32>__lz));\n` +
                        `    this.__${fname}_lz = ((<u64>0xffffffff) << 32) | ${encVal("__v")};\n` +
                        `    return __v;\n` +
                        `  }\n` +
                        `  return ${valueDefault};\n}`,
                    `set ${fname}(value: ${T}) {\n` +
                        `  this.__${fname}_lz = ((<u64>0xffffffff) << 32) | ${encVal("value")};\n}`,
                ]
                : [
                    `@alias(${key}) private __${fname}_lz: u64 = ${fieldDefault != null ? "u64.MAX_VALUE" : "0"};`,
                    `private __${fname}_val: ${valueType} = ${fieldDefault ?? valueDefault};`,
                    `get ${fname}(): ${T} {\n` +
                        `  const __lz = this.__${fname}_lz;\n` +
                        `  if (__lz != 0 && __lz != u64.MAX_VALUE) {\n` +
                        `    this.__${fname}_val = JSON.__deserialize<${T}>(<usize>(__lz >>> 32), <usize>(<u32>__lz));\n` +
                        `    this.__${fname}_lz = u64.MAX_VALUE;\n` +
                        `  }\n` +
                        `  return this.__${fname}_val as ${T};\n}`,
                    `set ${fname}(value: ${T}) {\n` +
                        `  this.__${fname}_val = value;\n` +
                        `  this.__${fname}_lz = u64.MAX_VALUE;\n}`,
                ]).map((src) => SimpleParser.parseClassMember(src, node));
            node.members.splice(i, 1, ...lowered);
        }
        if (__hasLazy) {
            node.members.push(SimpleParser.parseClassMember(`private __src: string = "";`, node), SimpleParser.parseClassMember(`__SET_SRC(s: string): void { this.__src = s; }`, node));
        }
        const members = [
            ...node.members.filter((v) => v.kind === NodeKind.FieldDeclaration &&
                !v.is(32) &&
                (!v.is(512) || lazyInner.has(v.name.text)) &&
                !v.is(1024) &&
                !v.decorators?.some((decorator) => decorator.name.text === "omit")),
        ];
        const serializers = [
            ...node.members.filter((v) => v.kind === NodeKind.MethodDeclaration &&
                v.decorators &&
                v.decorators.some((e) => e.name.text.toLowerCase() ===
                    "serializer") &&
                !v.name.text.startsWith("__try")),
        ];
        const deserializers = [
            ...node.members.filter((v) => v.kind === NodeKind.MethodDeclaration &&
                v.decorators &&
                v.decorators.some((e) => e.name.text.toLowerCase() ===
                    "deserializer") &&
                !v.name.text.startsWith("__try")),
        ];
        const schema = new Schema();
        schema.node = node;
        schema.name = source.getQualifiedName(node);
        if (node.extendsType) {
            this.collectInheritedFieldMembers(node, source, members);
            const extendsName = source.resolveExtendsName(node);
            if (!schema.parent) {
                const depSearch = schema.deps.find((v) => v.name == extendsName);
                if (depSearch) {
                    if (DEBUG > 0)
                        console.log("Found " +
                            extendsName +
                            " in dependencies of " +
                            source.internalPath);
                    if (!schema.deps.some((v) => v.name == depSearch.name))
                        schema.deps.push(depSearch);
                    schema.parent = depSearch;
                }
                else {
                    const internalSearch = source.getClass(extendsName);
                    if (internalSearch) {
                        if (DEBUG > 0)
                            console.log("Found " +
                                extendsName +
                                " internally from " +
                                source.internalPath);
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
                            throw new Error("Could not find schema for " +
                                internalSearch.name.text +
                                " in " +
                                internalSearch.range.source.internalPath);
                        schema.deps.push(schem);
                        schema.parent = schem;
                    }
                    else {
                        const externalSearch = source.getImportedClass(extendsName, this.parser);
                        if (externalSearch) {
                            if (DEBUG > 0)
                                console.log("Found " +
                                    externalSearch.name.text +
                                    " externally from " +
                                    source.internalPath);
                            const externalSource = this.sources.get(externalSearch.range.source);
                            if (!this.visitedClasses.has(externalSource.getFullPath(externalSearch))) {
                                this.visitClassDeclarationRef(externalSearch);
                                this.schemas.get(externalSource.internalPath).push(this.schema);
                                this.visitClassDeclaration(node);
                                return;
                            }
                            const schem = this.schemas
                                .get(externalSource.internalPath)
                                ?.find((s) => s.name == extendsName);
                            if (!schem)
                                throw new Error("Could not find schema for " +
                                    externalSearch.name.text +
                                    " in " +
                                    externalSource.internalPath);
                            schema.deps.push(schem);
                            schema.parent = schem;
                        }
                        else {
                            const availableSearch = source.getAvailableClass(extendsName, this.parser);
                            if (availableSearch) {
                                if (DEBUG > 0)
                                    console.log("Found " +
                                        availableSearch.name.text +
                                        " from available sources for " +
                                        source.internalPath);
                                const availableSource = this.sources.get(availableSearch.range.source);
                                if (availableSearch.decorators?.some((decorator) => {
                                    const name = decorator.name.text;
                                    return name === "json" || name === "serializable";
                                })) {
                                    if (!this.visitedClasses.has(availableSource.getFullPath(availableSearch))) {
                                        this.visitClassDeclarationRef(availableSearch);
                                        this.schemas
                                            .get(availableSource.internalPath)
                                            .push(this.schema);
                                        this.visitClassDeclaration(node);
                                        return;
                                    }
                                    const schem = this.schemas
                                        .get(availableSource.internalPath)
                                        ?.find((s) => s.name == extendsName);
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
                for (let i = schema.parent.members.length - 1; i >= 0; i--) {
                    const replace = schema.members.find((v) => v.name == schema.parent?.members[i]?.name);
                    if (!replace) {
                        members.unshift(schema.parent?.members[i].node);
                    }
                }
            }
        }
        const getUnknownTypes = (type, types = []) => {
            type = stripNull(type);
            type = this.resolveType(type, source);
            if (type.startsWith("Array<")) {
                return getUnknownTypes(type.slice(6, -1));
            }
            else if (type.startsWith("StaticArray<")) {
                return getUnknownTypes(type.slice(12, -1));
            }
            else if (type.startsWith("Set<")) {
                return getUnknownTypes(type.slice(4, -1));
            }
            else if (type.startsWith("Map<")) {
                const parts = type.slice(4, -1).split(",");
                return getUnknownTypes(parts[0]) || getUnknownTypes(parts[1]);
            }
            else if (isString(type) || isPrimitive(type)) {
                return types;
            }
            else if (["JSON.Box", "JSON.Obj", "JSON.Value", "JSON.Raw"].includes(type)) {
                return types;
            }
            else if (node.isGeneric &&
                node.typeParameters.some((p) => p.name.text == type)) {
                return types;
            }
            else if (type == node.name.text) {
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
                        console.log("Found " +
                            unknownType +
                            " in dependencies of " +
                            source.internalPath);
                    if (!schema.deps.some((v) => v.name == depSearch.name)) {
                        schema.deps.push(depSearch);
                    }
                }
                else {
                    const internalSearch = source.getClass(unknownType);
                    if (internalSearch) {
                        if (DEBUG > 0)
                            console.log("Found " +
                                unknownType +
                                " internally from " +
                                source.internalPath);
                        if (!this.visitedClasses.has(source.getFullPath(internalSearch))) {
                            this.visitClassDeclarationRef(internalSearch);
                            const internalSchema = this.schemas
                                .get(internalSearch.range.source.internalPath)
                                ?.find((s) => s.name == unknownType);
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
                            throw new Error("Could not find schema for " +
                                internalSearch.name.text +
                                " in " +
                                internalSearch.range.source.internalPath);
                        schema.deps.push(schem);
                    }
                    else {
                        const externalSearch = source.getImportedClass(unknownType, this.parser);
                        if (externalSearch) {
                            if (DEBUG > 0)
                                console.log("Found " +
                                    externalSearch.name.text +
                                    " externally from " +
                                    source.internalPath);
                            const externalSource = this.sources.get(externalSearch.range.source);
                            if (!this.visitedClasses.has(externalSource.getFullPath(externalSearch))) {
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
                                throw new Error("Could not find schema for " +
                                    externalSearch.name.text +
                                    " in " +
                                    externalSource.internalPath);
                            schema.deps.push(schem);
                        }
                    }
                }
            }
        }
        this.schemas.get(source.internalPath).push(schema);
        this.schema = schema;
        this.visitedClasses.add(fullClassPath);
        const requestedFastPath = USE_FAST_PATH;
        let SERIALIZE = "__SERIALIZE(ptr: usize): void {\n";
        let INITIALIZE = " __INITIALIZE(): this {\n";
        let DESERIALIZE = "__DESERIALIZE_SLOW<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): usize {\n";
        let DESERIALIZE_FAST = "__DESERIALIZE_FAST<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): usize {\n";
        let DESERIALIZE_CUSTOM = "";
        let SERIALIZE_CUSTOM = "";
        if (DEBUG > 0)
            console.log("Created schema: " +
                this.schema.name +
                " in file " +
                source.normalizedPath +
                (this.schema.deps.length
                    ? " with dependencies:\n  " +
                        this.schema.deps.map((v) => v.name).join("\n  ")
                    : ""));
        if (serializers.length > 1)
            throwError("Multiple serializers detected for class " +
                node.name.text +
                " but schemas can only have one serializer!", serializers[1].range);
        if (deserializers.length > 1)
            throwError("Multiple deserializers detected for class " +
                node.name.text +
                " but schemas can only have one deserializer!", deserializers[1].range);
        if (serializers.length) {
            this.schema.custom = true;
            const serializer = serializers[0];
            const serializerJsonKind = parseCustomJsonKind(serializer, "serializer");
            const hasCall = CustomTransform.hasCall(serializer);
            this.schema.customJsonKind = serializerJsonKind;
            CustomTransform.visit(serializer);
            if (serializer.signature.parameters.length > 1)
                throwError("Found too many parameters in custom serializer for " +
                    this.schema.name +
                    ", but serializers can only accept one parameter of type '" +
                    this.schema.name +
                    "'!", serializer.signature.parameters[1].range);
            if (serializer.signature.parameters.length > 0 &&
                serializer.signature.parameters[0].type.name.identifier
                    .text != node.name.text &&
                serializer.signature.parameters[0].type.name.identifier
                    .text != "this")
                throwError("Type of parameter for custom serializer does not match! It should be 'string'either be 'this' or '" +
                    this.schema.name +
                    "'", serializer.signature.parameters[0].type.range);
            if (!serializer.signature.returnType ||
                !(serializer.signature.returnType).name.identifier.text.includes("string"))
                throwError("Could not find valid return type for serializer in " +
                    this.schema.name +
                    "!. Set the return type to type 'string' and try again", serializer.signature.returnType.range);
            if (!serializer.decorators.some((v) => v.name.text == "inline")) {
                serializer.decorators.push(Node.createDecorator(Node.createIdentifierExpression("inline", serializer.range), null, serializer.range));
            }
            SERIALIZE_CUSTOM += "  __SERIALIZE(ptr: usize): void {\n";
            if (hasCall) {
                SERIALIZE_CUSTOM += "    const savedOffset = bs.offset;\n";
                SERIALIZE_CUSTOM += "    const savedStackSize = bs.stackSize;\n";
            }
            SERIALIZE_CUSTOM += "    const self = changetype<this>(ptr);\n";
            SERIALIZE_CUSTOM +=
                "    const data = self." +
                    serializer.name.text +
                    "(" +
                    (serializer.signature.parameters.length ? "self" : "") +
                    ");\n";
            if (hasCall) {
                SERIALIZE_CUSTOM += "    bs.offset = savedOffset;\n";
                SERIALIZE_CUSTOM += "    bs.stackSize = savedStackSize;\n";
            }
            SERIALIZE_CUSTOM += "    const dataSize = data.length << 1;\n";
            SERIALIZE_CUSTOM +=
                "    memory.copy(bs.offset, changetype<usize>(data), dataSize);\n";
            SERIALIZE_CUSTOM += "    bs.offset += dataSize;\n";
            SERIALIZE_CUSTOM += "  }\n";
        }
        if (deserializers.length) {
            this.schema.custom = true;
            const deserializer = deserializers[0];
            const deserializerJsonKind = parseCustomJsonKind(deserializer, "deserializer");
            if (this.schema.customJsonKind != "any" &&
                deserializerJsonKind != "any" &&
                this.schema.customJsonKind != deserializerJsonKind) {
                throwError(`@serializer and @deserializer JSON types for ${this.schema.name} must match`, deserializer.range);
            }
            if (this.schema.customJsonKind == "any")
                this.schema.customJsonKind = deserializerJsonKind;
            if (!deserializer.signature.parameters.length)
                throwError("Could not find any parameters in custom deserializer for " +
                    this.schema.name +
                    ". Deserializers must have one parameter like 'deserializer(data: string): " +
                    this.schema.name +
                    " {}'", deserializer.range);
            if (deserializer.signature.parameters.length > 1)
                throwError("Found too many parameters in custom deserializer for " +
                    this.schema.name +
                    ", but deserializers can only accept one parameter of type 'string'!", deserializer.signature.parameters[1].range);
            if (deserializer.signature.parameters[0].type.name
                .identifier.text != "string")
                throwError("Type of parameter for custom deserializer does not match! It must be 'string'", deserializer.signature.parameters[0].type.range);
            if (!deserializer.signature.returnType ||
                !((deserializer.signature.returnType).name.identifier.text.includes(this.schema.name) ||
                    (deserializer.signature.returnType).name.identifier.text.includes("this")))
                throwError("Could not find valid return type for deserializer in " +
                    this.schema.name +
                    "!. Set the return type to type '" +
                    this.schema.name +
                    "' or 'this' and try again", deserializer.signature.returnType.range);
            if (!deserializer.decorators.some((v) => v.name.text == "inline")) {
                deserializer.decorators.push(Node.createDecorator(Node.createIdentifierExpression("inline", deserializer.range), null, deserializer.range));
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
        for (const member of members) {
            if (!member.type)
                throwError("Fields must be strongly typed", node.range);
            let type = toString(member.type);
            type = this.resolveType(type, source);
            const name = member.name;
            const value = member.initializer ? toString(member.initializer) : null;
            if (type.startsWith("(") && type.includes("=>"))
                continue;
            const mem = new Property();
            mem.parent = this.schema;
            mem.name = name.text;
            mem.type = type;
            mem.value = value;
            mem.node = member;
            mem.byteSize = estimatedSerializedByteSize(mem.type, source, this.parser);
            mem.custom = schema.deps.some((dep) => dep?.name == stripNull(type) && dep.custom);
            const lzInner = lazyInner.get(name.text);
            if (lzInner !== undefined) {
                mem.flags.set(PropertyFlags.Lazy, null);
                mem.lazyInner = lzInner.inner;
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
                    const decoratorName = decorator.name.text
                        .toLowerCase()
                        .trim();
                    switch (decoratorName) {
                        case "alias": {
                            const arg = decorator.args[0];
                            if (!arg ||
                                (arg.kind != NodeKind.Literal &&
                                    arg.literalKind !=
                                        2 &&
                                    arg.literalKind !=
                                        1 &&
                                    arg.literalKind != 0))
                                throwError("@alias must have an argument of type string or number", member.range);
                            mem.alias = arg.value.toString();
                            break;
                        }
                        case "omitif": {
                            const arg = decorator.args[0];
                            if (!decorator.args?.length)
                                throwError("@omitif must have an argument or callback that resolves to type bool", member.range);
                            mem.flags.set(PropertyFlags.OmitIf, arg);
                            this.schema.static = false;
                            break;
                        }
                        case "optional": {
                            mem.flags.set(PropertyFlags.Optional, null);
                            break;
                        }
                        case "omitnull": {
                            if (isPrimitive(type)) {
                                throwError("@omitnull cannot be used on primitive types!", member.range);
                            }
                            else if (!member.type.isNullable) {
                                throwError("@omitnull cannot be used on non-nullable types!", member.range);
                            }
                            mem.flags.set(PropertyFlags.OmitNull, null);
                            this.schema.static = false;
                            break;
                        }
                    }
                }
            }
            this.schema.members.push(mem);
        }
        this.schema.members = sortMembers(this.schema.members);
        const hasOmitIfMembers = this.schema.members.some((v) => v.flags.has(PropertyFlags.OmitIf));
        const hasOmitNullMembers = this.schema.members.some((v) => v.flags.has(PropertyFlags.OmitNull));
        const hasExplicitOptionalMembers = this.schema.members.some((v) => v.flags.has(PropertyFlags.Optional));
        const hasOptionalMembers = hasOmitIfMembers || hasOmitNullMembers || hasExplicitOptionalMembers;
        const hasLazyMembers = this.schema.members.some((v) => v.flags.has(PropertyFlags.Lazy));
        const supportsFastOptionalPath = requestedFastPath && hasOptionalMembers;
        const hasTypeParams = !!node.typeParameters && node.typeParameters.length > 0;
        const useFastPath = requestedFastPath &&
            !hasTypeParams &&
            (this.schema.static || supportsFastOptionalPath);
        indent = "  ";
        if (this.schema.static == false) {
            if (this.schema.members.some((v) => v.flags.has(PropertyFlags.OmitNull))) {
                SERIALIZE += indent + "let block: usize = 0;\n";
            }
            if (hasOptionalMembers) {
                SERIALIZE += indent + "let wrote = false;\n";
            }
            this.schema.byteSize += 2;
            SERIALIZE += indent + "store<u16>(bs.offset, 123, 0); // {\n";
            SERIALIZE += indent + "bs.offset += 2;\n";
        }
        const isPure = this.schema.static;
        let isRegular = isPure;
        let isFirst = true;
        const serValue = (member, realName) => {
            if (!member.flags.has(PropertyFlags.Lazy))
                return getSerializeCall(member.type, realName);
            const T = member.lazyInner;
            const baseName = realName.slice(0, -3);
            const baseT = stripNull(T);
            const packScalar = baseT === "i8" ||
                baseT === "u8" ||
                baseT === "i16" ||
                baseT === "u16" ||
                baseT === "i32" ||
                baseT === "u32" ||
                baseT === "bool" ||
                baseT === "boolean" ||
                baseT === "f32";
            if (packScalar) {
                const dec = baseT === "f32"
                    ? `reinterpret<f32>(<u32>(__s))`
                    : `(<${T}>(<u32>(__s)))`;
                const def = baseT === "bool" || baseT === "boolean" ? "false" : "0";
                return (`{\n` +
                    `  const __s = this.${realName};\n` +
                    `  if ((__s >>> 32) == 0xffffffff) {\n` +
                    `    JSON.__serialize<${T}>(${dec});\n` +
                    `  } else if (__s != 0) {\n` +
                    `    const __hi = <usize>(__s >>> 32);\n` +
                    `    const __len = (<usize>(<u32>__s)) - __hi;\n` +
                    `    bs.ensureSize(<u32>__len);\n` +
                    `    memory.copy(bs.offset, __hi, __len);\n` +
                    `    bs.offset += __len;\n` +
                    `  } else {\n` +
                    `    JSON.__serialize<${T}>(${def});\n` +
                    `  }\n` +
                    `}\n`);
            }
            return (`{\n` +
                `  const __s = this.${realName};\n` +
                `  if (__s == u64.MAX_VALUE) {\n` +
                `    JSON.__serialize<${T}>(this.${baseName}_val as ${T});\n` +
                `  } else if (__s != 0) {\n` +
                `    const __hi = <usize>(__s >>> 32);\n` +
                `    const __len = (<usize>(<u32>__s)) - __hi;\n` +
                `    bs.ensureSize(<u32>__len);\n` +
                `    memory.copy(bs.offset, __hi, __len);\n` +
                `    bs.offset += __len;\n` +
                `  } else {\n` +
                (isPrimitive(baseT)
                    ? `    JSON.__serialize<${T}>(0);\n`
                    : `    bs.ensureSize(8);\n` +
                        `    store<u64>(bs.offset, 0x006c006c0075006e);\n` +
                        `    bs.offset += 8;\n`) +
                `  }\n` +
                `}\n`);
        };
        for (let i = 0; i < this.schema.members.length; i++) {
            const member = this.schema.members[i];
            const aliasName = JSON.stringify(member.alias || member.name);
            const realName = member.name;
            if (member.value) {
                INITIALIZE += `  store<${member.type}>(changetype<usize>(this), ${member.value}, offsetof<this>(${JSON.stringify(member.name)}));\n`;
            }
            else if (member.generic) {
                INITIALIZE += `  if (isManaged<nonnull<${member.type}>>() || isReference<nonnull<${member.type}>>()) {\n`;
                INITIALIZE += `    store<${member.type}>(changetype<usize>(this), changetype<nonnull<${member.type}>>(__new(offsetof<nonnull<${member.type}>>(), idof<nonnull<${member.type}>>())), offsetof<this>(${JSON.stringify(member.name)}));\n`;
                INITIALIZE += `    if (isDefined(this.${member.name}.__INITIALIZE)) changetype<nonnull<${member.type}>>(this.${member.name}).__INITIALIZE();\n`;
                INITIALIZE += `  }\n`;
            }
            else if (!member.node.type.isNullable) {
                if (this.getSchema(member.type)) {
                    INITIALIZE += `  store<${member.type}>(changetype<usize>(this), changetype<nonnull<${member.type}>>(__new(offsetof<nonnull<${member.type}>>(), idof<nonnull<${member.type}>>())).__INITIALIZE(), offsetof<this>(${JSON.stringify(member.name)}));\n`;
                }
                else if (member.type.startsWith("Array<")) {
                    INITIALIZE += `  store<${member.type}>(changetype<usize>(this), [], offsetof<this>(${JSON.stringify(member.name)}));\n`;
                }
                else if (member.type.startsWith("Map<")) {
                    INITIALIZE += `  store<${member.type}>(changetype<usize>(this), new ${member.type}(), offsetof<this>(${JSON.stringify(member.name)}));\n`;
                }
                else if (member.type.startsWith("Set<")) {
                    INITIALIZE += `  store<${member.type}>(changetype<usize>(this), new ${member.type}(), offsetof<this>(${JSON.stringify(member.name)}));\n`;
                }
                else if (member.type.startsWith("StaticArray<")) {
                }
                else if (member.type == "string" || member.type == "String") {
                    INITIALIZE += `  store<${member.type}>(changetype<usize>(this), "", offsetof<this>(${JSON.stringify(member.name)}));\n`;
                }
            }
            else {
                INITIALIZE += `  store<${member.type}>(changetype<usize>(this), null, offsetof<this>(${JSON.stringify(member.name)}));\n`;
            }
            const SIMD_ENABLED = this.program.options.hasFeature(16);
            if (!isRegular &&
                !member.flags.has(PropertyFlags.OmitIf) &&
                !member.flags.has(PropertyFlags.OmitNull))
                isRegular = true;
            if (isRegular && isPure) {
                const keyPart = (isFirst ? "{" : ",") + aliasName + ":";
                this.schema.byteSize += keyPart.length << 1;
                if (hasLazyMembers)
                    SERIALIZE += indent + `bs.ensureSize(${keyPart.length << 1});\n`;
                SERIALIZE += this.getStores(keyPart, SIMD_ENABLED)
                    .map((v) => indent + v + "\n")
                    .join("");
                SERIALIZE += indent + serValue(member, realName);
                if (isFirst)
                    isFirst = false;
            }
            else if (isRegular && !isPure) {
                if (isFirst && hasOptionalMembers) {
                    const keyPart = aliasName + ":";
                    this.schema.byteSize += 2 + (keyPart.length << 1);
                    SERIALIZE +=
                        indent +
                            "if (wrote) { store<u16>(bs.offset, 44, 0); bs.offset += 2; } // ,\n";
                    if (hasLazyMembers)
                        SERIALIZE += indent + `bs.ensureSize(${keyPart.length << 1});\n`;
                    SERIALIZE += this.getStores(keyPart, SIMD_ENABLED)
                        .map((v) => indent + v + "\n")
                        .join("");
                    SERIALIZE += indent + serValue(member, realName);
                }
                else {
                    const keyPart = (isFirst ? "" : ",") + aliasName + ":";
                    this.schema.byteSize += keyPart.length << 1;
                    if (hasLazyMembers)
                        SERIALIZE += indent + `bs.ensureSize(${keyPart.length << 1});\n`;
                    SERIALIZE += this.getStores(keyPart, SIMD_ENABLED)
                        .map((v) => indent + v + "\n")
                        .join("");
                    SERIALIZE += indent + serValue(member, realName);
                }
                if (isFirst)
                    isFirst = false;
            }
            else {
                if (member.flags.has(PropertyFlags.OmitNull)) {
                    let omitNullCond;
                    if (member.flags.has(PropertyFlags.Lazy)) {
                        const base = realName.slice(0, -3);
                        omitNullCond =
                            `!JSON.__lazyIsNull(` +
                                `load<usize>(ptr, offsetof<this>(${JSON.stringify(base + "_val")})), ` +
                                `load<u64>(ptr, offsetof<this>(${JSON.stringify(realName)})))`;
                    }
                    else {
                        omitNullCond = `(block = load<usize>(ptr, offsetof<this>(${JSON.stringify(realName)}))) !== 0`;
                    }
                    SERIALIZE += indent + `if (${omitNullCond}) {\n`;
                    indentInc();
                    const keyPart = aliasName + ":";
                    this.schema.byteSize += 2 + (keyPart.length << 1);
                    SERIALIZE +=
                        indent +
                            "if (wrote) { store<u16>(bs.offset, 44, 0); bs.offset += 2; } // ,\n";
                    if (hasLazyMembers)
                        SERIALIZE += indent + `bs.ensureSize(${keyPart.length << 1});\n`;
                    SERIALIZE += this.getStores(keyPart, SIMD_ENABLED)
                        .map((v) => indent + v + "\n")
                        .join("");
                    SERIALIZE += indent + serValue(member, realName);
                    SERIALIZE += indent + "wrote = true;\n";
                    indentDec();
                    this.schema.byteSize += 2;
                    SERIALIZE += indent + `}\n`;
                }
                else if (member.flags.has(PropertyFlags.OmitIf)) {
                    if (member.flags.get(PropertyFlags.OmitIf).kind == NodeKind.Function) {
                        const arg = member.flags.get(PropertyFlags.OmitIf);
                        arg.declaration.signature.parameters[0].type = Node.createNamedType(Node.createSimpleTypeName("this", node.range), null, false, node.range);
                        arg.declaration.signature.returnType.name =
                            Node.createSimpleTypeName("boolean", arg.declaration.signature.returnType.name
                                .range);
                        SERIALIZE +=
                            indent +
                                `if (!(${toString(member.flags.get(PropertyFlags.OmitIf))})(this)) {\n`;
                    }
                    else {
                        const expression = member.flags.get(PropertyFlags.OmitIf);
                        const rendered = expression.kind == NodeKind.Literal &&
                            expression.literalKind ==
                                2
                            ? JSON.stringify(expression.value).slice(1, -1)
                            : toString(expression);
                        SERIALIZE += indent + `if (!(${rendered})) {\n`;
                    }
                    indentInc();
                    this.schema.byteSize += 2;
                    SERIALIZE +=
                        indent +
                            "if (wrote) { store<u16>(bs.offset, 44, 0); bs.offset += 2; } // ,\n";
                    SERIALIZE += this.getStores(aliasName + ":", SIMD_ENABLED)
                        .map((v) => indent + v + "\n")
                        .join("");
                    SERIALIZE += indent + serValue(member, realName);
                    SERIALIZE += indent + "wrote = true;\n";
                    indentDec();
                    SERIALIZE += indent + `}\n`;
                }
            }
        }
        const sortedMembers = {
            string: [],
            number: [],
            boolean: [],
            null: [],
            array: [],
            object: [],
        };
        for (const member of this.schema.members) {
            const type = stripNull(member.type);
            const customDep = this.schema.deps.find((dep) => dep &&
                (dep.name == type || dep.name.endsWith("." + type)) &&
                dep.custom);
            const isCustomType = member.custom || !!customDep;
            if (isCustomType || member.generic) {
                addMemberToCustomBucket(sortedMembers, member, member.generic ? "any" : customDep?.customJsonKind || "any");
                if (member.node.type.isNullable)
                    sortedMembers.null.push(member);
            }
            else {
                if (member.node.type.isNullable)
                    sortedMembers.null.push(member);
                if (isString(type) || type == "Date")
                    sortedMembers.string.push(member);
                else if (type == "JSON.Raw")
                    sortedMembers.object.push(member);
                else if (isBoolean(type) || type.startsWith("JSON.Box<bool"))
                    sortedMembers.boolean.push(member);
                else if (isPrimitive(type) ||
                    type.startsWith("JSON.Box<") ||
                    isEnum(type, this.sources.get(this.schema.node.range.source), this.parser))
                    sortedMembers.number.push(member);
                else if (isArray(type))
                    sortedMembers.array.push(member);
                else
                    sortedMembers.object.push(member);
            }
        }
        const lazyMembers = this.schema.members.filter((member) => member.flags.has(PropertyFlags.Lazy));
        const withLazyMembers = (members) => {
            if (!lazyMembers.length)
                return members;
            const out = members.slice();
            for (const member of lazyMembers) {
                if (!out.includes(member))
                    out.push(member);
            }
            return out;
        };
        const slowStringMembers = withLazyMembers(sortedMembers.string);
        const slowNumberMembers = withLazyMembers(sortedMembers.number);
        const slowObjectMembers = withLazyMembers(sortedMembers.object);
        const slowArrayMembers = withLazyMembers(sortedMembers.array);
        const slowBooleanMembers = withLazyMembers(sortedMembers.boolean);
        const slowNullMembers = withLazyMembers(sortedMembers.null);
        const getComparisions = (data, ptr, operator) => {
            const dataBytes = data.length << 1;
            let offset = 0;
            const output = [];
            while (offset < dataBytes) {
                const rem = dataBytes - offset;
                if (rem >= 8) {
                    output.push(`load<u64>(${ptr}, ${offset}) ${operator} 0x${toU64(data, offset >> 1).toString(16)}`);
                    offset += 8;
                    continue;
                }
                if (rem >= 4) {
                    output.push(`load<u32>(${ptr}, ${offset}) ${operator} 0x${toU32(data, offset >> 1).toString(16)}`);
                    offset += 4;
                    continue;
                }
                if (rem >= 2) {
                    output.push(`load<u16>(${ptr}, ${offset}) ${operator} 0x${data.charCodeAt(offset >> 1).toString(16)}`);
                    offset += 2;
                    continue;
                }
            }
            return output;
        };
        const UNSIGNED_INTEGER_TYPES = ["u8", "u16", "u32", "u64", "usize"];
        const SIGNED_INTEGER_TYPES = ["i8", "i16", "i32", "i64", "isize"];
        const FLOAT_TYPES = ["f32", "f64"];
        const INTEGER_TYPES = [...UNSIGNED_INTEGER_TYPES, ...SIGNED_INTEGER_TYPES];
        const STRING_FIELD_DESERIALIZER = "__deserializeStringField";
        const getArrayValueType = (type) => {
            if (!type.startsWith("Array<") && !type.startsWith("StaticArray<"))
                return null;
            return stripNull(type.slice(type.indexOf("<") + 1, -1).trim());
        };
        const getDeserializer = (type, srcPtr, outPtr, member, keyOffset = 0, fastPath = false) => {
            const out = [];
            const resolvedType = stripNull(type);
            const resolvedSchema = this.getSchema(resolvedType);
            const fieldOffset = `offsetof<this>(${JSON.stringify(member.name)})`;
            const valuePtr = keyOffset ? `${srcPtr} + ${keyOffset}` : srcPtr;
            if (member.flags.has(PropertyFlags.Lazy)) {
                const lazyInner = member.lazyInner;
                out.push("{");
                out.push(`  const valueStart = JSON.Util.skipWhitespace(${valuePtr}, srcEnd);`);
                out.push(`  const valueEnd = JSON.Util.scanValueEnd<${lazyInner}>(valueStart, srcEnd);`);
                out.push("  if (!valueEnd) break;");
                out.push(`  store<u64>(${outPtr}, ((<u64>valueStart) << 32) | (<u64>(<u32>valueEnd)), ${fieldOffset});`);
                out.push(`  ${srcPtr} = valueEnd;`);
                out.push("}");
                return out;
            }
            if (INTEGER_TYPES.includes(resolvedType)) {
                const helper = SIGNED_INTEGER_TYPES.includes(resolvedType)
                    ? "__deserializeIntegerField"
                    : "__deserializeUnsignedField";
                out.push(`${srcPtr} = ${helper}<${resolvedType}>(${valuePtr}, srcEnd, ${outPtr}, ${fieldOffset});`);
            }
            else if (["string", "String"].includes(resolvedType)) {
                out.push("{");
                if (member.node.type.isNullable) {
                    out.push(`  if (load<u64>(${valuePtr}) == 30399761348886638) {`);
                    out.push(`    store<${member.type}>(${outPtr}, changetype<${member.type}>(0), ${fieldOffset});`);
                    out.push(`    ${srcPtr} = ${valuePtr} + 8;`);
                    out.push("  } else {");
                }
                out.push(`  ${srcPtr} = ${STRING_FIELD_DESERIALIZER}<${member.type}>(${valuePtr}, srcEnd, ${outPtr}, ${fieldOffset});`);
                if (member.node.type.isNullable) {
                    out.push("  }");
                }
                out.push("}");
            }
            else if (resolvedType == "Date") {
                out.push("{");
                if (member.node.type.isNullable) {
                    out.push(`  if (load<u64>(${valuePtr}) == 30399761348886638) {`);
                    out.push(`    store<${member.type}>(${outPtr}, changetype<${member.type}>(0), ${fieldOffset});`);
                    out.push(`    ${srcPtr} = ${valuePtr} + 8;`);
                    out.push("  } else {");
                }
                out.push(`  if (load<u16>(${valuePtr}) != 0x22) break;`);
                out.push(`  let dateEnd = ${valuePtr} + 2;`);
                out.push(`  while (dateEnd < srcEnd) {`);
                out.push("    if (load<u16>(dateEnd) == 0x22 && load<u16>(dateEnd - 2) != 0x5c) break;");
                out.push("    dateEnd += 2;");
                out.push("  }");
                out.push("  if (dateEnd >= srcEnd) break;");
                out.push(`  store<${resolvedType}>(${outPtr}, JSON.__deserialize<${resolvedType}>(${valuePtr}, dateEnd + 2), ${fieldOffset});`);
                out.push(`  ${srcPtr} = dateEnd + 2;`);
                if (member.node.type.isNullable) {
                    out.push("  }");
                }
                out.push("}");
            }
            else if (resolvedType.startsWith("JSON.Box<") ||
                resolvedType.startsWith("Box<")) {
                const innerType = resolvedType
                    .slice(resolvedType.indexOf("<") + 1, -1)
                    .trim();
                out.push("{");
                if (member.node.type.isNullable) {
                    out.push(`  if (load<u64>(${valuePtr}) == 30399761348886638) {`);
                    out.push(`    store<${member.type}>(${outPtr}, changetype<${member.type}>(0), ${fieldOffset});`);
                    out.push(`    ${srcPtr} = ${valuePtr} + 8;`);
                    out.push("  } else {");
                }
                if (innerType == "bool" || innerType == "boolean") {
                    out.push(`    if (load<u64>(${valuePtr}) == 28429475166421108) {`);
                    out.push(`      store<${resolvedType}>(${outPtr}, changetype<${resolvedType}>(JSON.Box.from<${innerType}>(true)), ${fieldOffset});`);
                    out.push(`      ${srcPtr} = ${valuePtr} + 8;`);
                    out.push("    } else if (load<u64>(" +
                        valuePtr +
                        ") == 32370086184550502 && load<u16>(" +
                        valuePtr +
                        ", 8) == 101) {");
                    out.push(`      store<${resolvedType}>(${outPtr}, changetype<${resolvedType}>(JSON.Box.from<${innerType}>(false)), ${fieldOffset});`);
                    out.push(`      ${srcPtr} = ${valuePtr} + 10;`);
                    out.push("    } else break;");
                }
                else {
                    out.push(`    let boxEnd = ${valuePtr};`);
                    out.push("    while (boxEnd < srcEnd) {");
                    out.push("      const code = load<u16>(boxEnd);");
                    out.push("      if (code == 0x2c || code == 0x7d) break;");
                    out.push("      boxEnd += 2;");
                    out.push("    }");
                    out.push(`    if (boxEnd <= ${valuePtr}) break;`);
                    out.push(`    store<${resolvedType}>(${outPtr}, changetype<${resolvedType}>(JSON.Box.from<${innerType}>(JSON.__deserialize<${innerType}>(${valuePtr}, boxEnd))), ${fieldOffset});`);
                    out.push(`    ${srcPtr} = boxEnd;`);
                }
                if (member.node.type.isNullable) {
                    out.push("  }");
                }
                out.push("}");
            }
            else if (resolvedType == "JSON.Raw") {
                out.push("{");
                out.push(`  const valueStart = ${srcPtr};`);
                out.push("  let depth: i32 = 0;");
                out.push("  let inString = false;");
                out.push(`  while (${srcPtr} < srcEnd) {`);
                out.push(`    const code = load<u16>(${srcPtr});`);
                out.push("    if (inString) {");
                out.push(`      if (code == 0x22 && load<u16>(${srcPtr} - 2) != 0x5c) inString = false;`);
                out.push(`      ${srcPtr} += 2;`);
                out.push("      continue;");
                out.push("    }");
                out.push("    if (code == 0x22) {");
                out.push("      inString = true;");
                out.push(`      ${srcPtr} += 2;`);
                out.push("      continue;");
                out.push("    }");
                out.push("    if (code == 0x7b || code == 0x5b) {");
                out.push("      depth++;");
                out.push(`      ${srcPtr} += 2;`);
                out.push("      continue;");
                out.push("    }");
                out.push("    if (code == 0x7d || code == 0x5d) {");
                out.push("      if (depth == 0) break;");
                out.push("      depth--;");
                out.push(`      ${srcPtr} += 2;`);
                out.push("      continue;");
                out.push("    }");
                out.push("    if (code == 0x2c && depth == 0) break;");
                out.push(`    ${srcPtr} += 2;`);
                out.push("  }");
                out.push(`  if (inString || depth != 0 || ${srcPtr} <= valueStart) break;`);
                out.push(`  store<${member.type}>(${outPtr}, JSON.Raw.from(JSON.Util.ptrToStr(valueStart, ${srcPtr})), ${fieldOffset});`);
                out.push("}");
            }
            else if (isBoolean(resolvedType)) {
                out.push(`if (load<u64>(${srcPtr}) == 28429475166421108) {`);
                out.push(`  store<${resolvedType}>(${outPtr}, true, ${fieldOffset});`);
                out.push(`  ${srcPtr} += 8;`);
                out.push("} else if (load<u64>(" +
                    srcPtr +
                    ") == 32370086184550502 && load<u16>(" +
                    srcPtr +
                    ", 8) == 101) {");
                out.push(`  store<${resolvedType}>(${outPtr}, false, ${fieldOffset});`);
                out.push(`  ${srcPtr} += 10;`);
                out.push("} else break;");
            }
            else if (FLOAT_TYPES.includes(resolvedType)) {
                out.push(`${srcPtr} = __deserializeFloatField<${resolvedType}>(${valuePtr}, srcEnd, ${outPtr}, ${fieldOffset});`);
            }
            else if (resolvedSchema && !resolvedSchema.custom) {
                if (fastPath) {
                    out.push("{");
                    if (member.node.type.isNullable) {
                        out.push(`  if (load<u64>(${valuePtr}) == 30399761348886638) {`);
                        out.push(`    store<${resolvedType}>(${outPtr}, changetype<${resolvedType}>(0), ${fieldOffset});`);
                        out.push(`    ${srcPtr} = ${valuePtr} + 8;`);
                        out.push("  } else {");
                    }
                    out.push(`  let value = load<${resolvedType}>(${outPtr}, ${fieldOffset});`);
                    out.push(`  if (changetype<usize>(value) == 0) {`);
                    out.push(`    value = changetype<${resolvedType}>(__new(offsetof<nonnull<${resolvedType}>>(), idof<nonnull<${resolvedType}>>()));`);
                    out.push(`    store<${resolvedType}>(${outPtr}, value, ${fieldOffset});`);
                    out.push(`    changetype<nonnull<${resolvedType}>>(value).__INITIALIZE();`);
                    out.push("  }");
                    out.push(`  const __fe = changetype<nonnull<${resolvedType}>>(value).__DESERIALIZE_FAST<${resolvedType}>(${valuePtr}, srcEnd, value);`);
                    out.push(`  if (__fe) {`);
                    out.push(`    ${srcPtr} = __fe;`);
                    out.push(`  } else {`);
                    out.push(`    const __ve = JSON.Util.scanValueEnd<${resolvedType}>(${valuePtr}, srcEnd);`);
                    out.push(`    if (!__ve) break;`);
                    out.push(`    changetype<nonnull<${resolvedType}>>(value).__INITIALIZE();`);
                    out.push(`    changetype<nonnull<${resolvedType}>>(value).__DESERIALIZE_SLOW<${resolvedType}>(${valuePtr}, __ve, value);`);
                    out.push(`    ${srcPtr} = __ve;`);
                    out.push(`  }`);
                    if (member.node.type.isNullable) {
                        out.push("  }");
                    }
                    out.push("}");
                    return out;
                }
                out.push("{");
                if (member.node.type.isNullable) {
                    out.push(`  if (load<u64>(${srcPtr}) == 30399761348886638) {`);
                    out.push(`    store<${resolvedType}>(${outPtr}, changetype<${resolvedType}>(0), ${fieldOffset});`);
                    out.push(`    ${srcPtr} += 8;`);
                    out.push("  } else {");
                }
                out.push(`  let value = load<${resolvedType}>(${outPtr}, ${fieldOffset});`);
                out.push(`  if (changetype<usize>(value) == 0) {`);
                out.push(`    value = changetype<${resolvedType}>(__new(offsetof<nonnull<${resolvedType}>>(), idof<nonnull<${resolvedType}>>()));`);
                out.push(`    store<${resolvedType}>(${outPtr}, value, ${fieldOffset});`);
                out.push("  }");
                out.push(`  const valueStart = ${valuePtr};`);
                out.push(`  const valueEnd = JSON.Util.scanValueEnd<${resolvedType}>(valueStart, srcEnd);`);
                out.push("  if (!valueEnd) break;");
                if (fastPath) {
                    out.push(`  ${srcPtr} = changetype<nonnull<${resolvedType}>>(value).__DESERIALIZE_FAST<${resolvedType}>(valueStart, valueEnd, value);`);
                }
                else {
                    out.push(`  ${srcPtr} = changetype<nonnull<${resolvedType}>>(value).__DESERIALIZE_SLOW<${resolvedType}>(valueStart, valueEnd, value);`);
                }
                if (member.node.type.isNullable) {
                    out.push("  }");
                }
                out.push("}");
            }
            else if (resolvedType.startsWith("Array<")) {
                const valueType = getArrayValueType(resolvedType);
                const rawInner = resolvedType
                    .slice(resolvedType.indexOf("<") + 1, -1)
                    .trim();
                const elementNullable = stripNull(rawInner) !== rawInner;
                out.push("{");
                if (member.node.type.isNullable) {
                    out.push(`  if (load<u64>(${valuePtr}) == 30399761348886638) {`);
                    out.push(`    store<${member.type}>(${outPtr}, changetype<${member.type}>(0), ${fieldOffset});`);
                    out.push(`    ${srcPtr} = ${valuePtr} + 8;`);
                    out.push("  } else {");
                }
                if (fastPath && valueType && ["string", "String"].includes(valueType)) {
                    out.push(`  if (load<u16>(${valuePtr}) != 0x5b) break;`);
                    out.push(`  let value = load<${resolvedType}>(${outPtr}, ${fieldOffset});`);
                    out.push("  if (changetype<usize>(value) == 0) {");
                    out.push(`    value = instantiate<nonnull<${resolvedType}>>();`);
                    out.push(`    store<${resolvedType}>(${outPtr}, value, ${fieldOffset});`);
                    out.push("  }");
                    out.push("  let index = 0;");
                    out.push(`  ${srcPtr} = ${valuePtr} + 2;`);
                    out.push(`  ${srcPtr} = JSON.Util.skipWhitespace(${srcPtr}, srcEnd);`);
                    out.push(`  if (load<u16>(${srcPtr}) == 0x5d) {`);
                    out.push("    value.length = 0;");
                    out.push(`    ${srcPtr} += 2;`);
                    out.push("  } else while (true) {");
                    out.push(`    ${srcPtr} = JSON.Util.skipWhitespace(${srcPtr}, srcEnd);`);
                    if (elementNullable) {
                        out.push(`    if (index >= value.length) value.push(changetype<${valueType} | null>(0));`);
                        out.push(`    if (load<u64>(${srcPtr}) == 30399761348886638) {`);
                        out.push(`      store<usize>(value.dataStart + ((<usize>index) << alignof<${valueType}>()), 0);`);
                        out.push(`      ${srcPtr} += 8;`);
                        out.push("    } else {");
                        out.push(`      ${srcPtr} = ${STRING_FIELD_DESERIALIZER}<${valueType}>(${srcPtr}, srcEnd, value.dataStart + ((<usize>index) << alignof<${valueType}>()));`);
                        out.push("    }");
                    }
                    else {
                        out.push('    if (index >= value.length) value.push("");');
                        out.push(`    ${srcPtr} = ${STRING_FIELD_DESERIALIZER}<${valueType}>(${srcPtr}, srcEnd, value.dataStart + ((<usize>index) << alignof<${valueType}>()));`);
                    }
                    out.push("    index++;");
                    out.push(`    ${srcPtr} = JSON.Util.skipWhitespace(${srcPtr}, srcEnd);`);
                    out.push(`    const code = load<u16>(${srcPtr});`);
                    out.push("    if (code == 0x2c) {");
                    out.push(`      ${srcPtr} += 2;`);
                    out.push("      continue;");
                    out.push("    }");
                    out.push("    if (code == 0x5d) {");
                    out.push("      value.length = index;");
                    out.push(`      ${srcPtr} += 2;`);
                    out.push("      break;");
                    out.push("    }");
                    out.push("    break;");
                    out.push("  }");
                    if (member.node.type.isNullable) {
                        out.push("  }");
                    }
                    out.push("}");
                    return out;
                }
                const valueSchema = valueType ? this.getSchema(valueType) : null;
                if (fastPath && valueType && valueSchema && !valueSchema.custom) {
                    out.push(`  if (load<u16>(${valuePtr}) != 0x5b) break;`);
                    out.push(`  let value = load<${resolvedType}>(${outPtr}, ${fieldOffset});`);
                    out.push("  if (changetype<usize>(value) == 0) {");
                    out.push(`    value = instantiate<nonnull<${resolvedType}>>();`);
                    out.push(`    store<${resolvedType}>(${outPtr}, value, ${fieldOffset});`);
                    out.push("  }");
                    out.push("  let index = 0;");
                    out.push(`  ${srcPtr} = ${valuePtr} + 2;`);
                    out.push(`  ${srcPtr} = JSON.Util.skipWhitespace(${srcPtr}, srcEnd);`);
                    out.push(`  if (load<u16>(${srcPtr}) == 0x5d) {`);
                    out.push("    value.length = 0;");
                    out.push(`    ${srcPtr} += 2;`);
                    out.push("  } else while (true) {");
                    out.push(`    let item: ${valueType};`);
                    out.push("    if (index < value.length) {");
                    out.push("      item = unchecked(value[index]);");
                    out.push("      if (changetype<usize>(item) == 0) {");
                    out.push(`        item = changetype<${valueType}>(__new(offsetof<nonnull<${valueType}>>(), idof<nonnull<${valueType}>>()));`);
                    out.push("        unchecked((value[index] = item));");
                    out.push(`        changetype<nonnull<${valueType}>>(item).__INITIALIZE();`);
                    out.push("      }");
                    out.push("    } else {");
                    out.push(`      item = changetype<${valueType}>(__new(offsetof<nonnull<${valueType}>>(), idof<nonnull<${valueType}>>()));`);
                    out.push("      value.push(item);");
                    out.push(`      changetype<nonnull<${valueType}>>(item).__INITIALIZE();`);
                    out.push("    }");
                    out.push(`    const __es = ${srcPtr};`);
                    out.push(`    const __ee = changetype<nonnull<${valueType}>>(item).__DESERIALIZE_FAST<${valueType}>(${srcPtr}, srcEnd, item);`);
                    out.push(`    if (__ee) {`);
                    out.push(`      ${srcPtr} = __ee;`);
                    out.push(`    } else {`);
                    out.push(`      const __ve = JSON.Util.scanValueEnd<${valueType}>(__es, srcEnd);`);
                    out.push(`      if (!__ve) break;`);
                    out.push(`      changetype<nonnull<${valueType}>>(item).__INITIALIZE();`);
                    out.push(`      changetype<nonnull<${valueType}>>(item).__DESERIALIZE_SLOW<${valueType}>(__es, __ve, item);`);
                    out.push(`      ${srcPtr} = __ve;`);
                    out.push(`    }`);
                    out.push("    index++;");
                    out.push(`    ${srcPtr} = JSON.Util.skipWhitespace(${srcPtr}, srcEnd);`);
                    out.push(`    const code = load<u16>(${srcPtr});`);
                    out.push("    if (code == 0x2c) {");
                    out.push(`      ${srcPtr} += 2;`);
                    out.push("      continue;");
                    out.push("    }");
                    out.push("    if (code == 0x5d) {");
                    out.push("      value.length = index;");
                    out.push(`      ${srcPtr} += 2;`);
                    out.push("      break;");
                    out.push("    }");
                    out.push("    break;");
                    out.push("  }");
                    if (member.node.type.isNullable) {
                        out.push("  }");
                    }
                    out.push("}");
                    return out;
                }
                out.push(`  ${srcPtr} = __deserializeArrayField_SWAR<nonnull<${resolvedType}>>(${valuePtr}, srcEnd, ${outPtr}, ${fieldOffset});`);
                out.push(`  if (!${srcPtr}) break;`);
                if (member.node.type.isNullable) {
                    out.push("  }");
                }
                out.push("}");
            }
            else if (resolvedType.startsWith("Map<")) {
                out.push(`${srcPtr} = __deserializeMapField<${resolvedType}>(${srcPtr}, srcEnd, ${outPtr}, ${fieldOffset});`);
                out.push(`if (!${srcPtr}) break;`);
            }
            else if (resolvedType.startsWith("Set<")) {
                out.push(`${srcPtr} = __deserializeSetField<${resolvedType}>(${srcPtr}, srcEnd, ${outPtr}, ${fieldOffset});`);
                out.push(`if (!${srcPtr}) break;`);
            }
            else if (resolvedType.startsWith("StaticArray<")) {
                out.push(`${srcPtr} = __deserializeStaticArrayField<${resolvedType}>(${srcPtr}, srcEnd, ${outPtr}, ${fieldOffset});`);
                out.push(`if (!${srcPtr}) break;`);
            }
            else if (resolvedType == "JSON.Value" ||
                resolvedType == "JSON.Obj" ||
                isEnum(resolvedType, this.sources.get(this.schema.node.range.source), this.parser)) {
                out.push("break;");
            }
            else {
                out.push("break;");
            }
            return out;
        };
        indent = "  ";
        const FAST_CHUNK_SIZE = 32;
        const fastChunkMethods = [];
        let fastChunkId = 0;
        const chunkFastBlocks = (blocks, tag, callIndent) => {
            if (blocks.length <= FAST_CHUNK_SIZE)
                return blocks.join("");
            let calls = "";
            for (let c = 0; c < blocks.length; c += FAST_CHUNK_SIZE) {
                const name = `__DESERIALIZE_FAST_${tag}_${fastChunkId++}`;
                const body = blocks
                    .slice(c, c + FAST_CHUNK_SIZE)
                    .join("")
                    .replace(/\bbreak;/g, "return 0;");
                fastChunkMethods.push(`${name}(srcStart: usize, srcEnd: usize, dst: usize): usize {\n${body}\n  return srcStart;\n}`);
                calls +=
                    `${callIndent}srcStart = this.${name}(srcStart, srcEnd, dst);\n` +
                        `${callIndent}if (srcStart == 0) break;\n`;
            }
            return calls;
        };
        const chunkFastBlocksOptional = (blocks, _tag, _callIndent, _needsKp) => {
            return blocks.join("");
        };
        DESERIALIZE_FAST += indent + "const start = srcStart;\n";
        DESERIALIZE_FAST += indent + "const dst = changetype<usize>(out);\n";
        DESERIALIZE_FAST += indent + "do {\n";
        indent += "  ";
        if (supportsFastOptionalPath) {
            DESERIALIZE_FAST +=
                indent + "if (load<u16>(srcStart) !== 0x7b) break; // {\n";
            DESERIALIZE_FAST += indent + "srcStart += 2;\n";
            DESERIALIZE_FAST += indent + "let seenAny = false;\n\n";
            const t1opt = [];
            for (let i = 0; i < this.schema.members.length; i++) {
                const member = this.schema.members[i];
                const key = JSON.stringify(member.alias || member.name);
                if (key.length <= 2)
                    throw new Error("Key cannot be empty!");
                const firstKeySection = key + ":";
                const nextKeySection = "," + key + ":";
                const firstKeyOffset = firstKeySection.length << 1;
                const nextKeyOffset = nextKeySection.length << 1;
                const resolvedType = stripNull(member.type);
                const inlineStringValue = ["string", "String"].includes(resolvedType);
                const deserializerFirst = getDeserializer(member.type, "srcStart", "dst", member, inlineStringValue ? firstKeyOffset : 0, true);
                const deserializerNext = getDeserializer(member.type, "srcStart", "dst", member, inlineStringValue ? nextKeyOffset : 0, true);
                const isOptional = member.flags.has(PropertyFlags.OmitNull) ||
                    member.flags.has(PropertyFlags.OmitIf);
                if (!deserializerFirst.length || !deserializerNext.length) {
                    t1opt.push(indent + "break;\n\n");
                    continue;
                }
                let blk = indent + "if (!seenAny) {\n";
                indent += "  ";
                blk +=
                    indent +
                        `if ( // ${firstKeySection}\n${(indent += "  ")}${getComparisions(firstKeySection, "srcStart", "!=").join("\n" + indent + "|| ")}\n${(indent = indent.slice(0, -2))}) {\n`;
                indent += "  ";
                if (isOptional) {
                    blk += indent + "// optional @omitnull field omitted\n";
                }
                else {
                    blk += indent + "break;\n";
                }
                indent = indent.slice(0, -2);
                blk += indent + "} else {\n";
                indent += "  ";
                if (!inlineStringValue)
                    blk += indent + `srcStart += ${firstKeyOffset};\n`;
                blk +=
                    indent +
                        `if (JSON.Util.isSpace(load<u16>(${inlineStringValue ? `srcStart + ${firstKeyOffset}` : "srcStart"}))) break;\n`;
                blk += indent + deserializerFirst.join("\n" + indent) + "\n";
                blk += indent + "seenAny = true;\n";
                indent = indent.slice(0, -2);
                blk += indent + "}\n";
                indent = indent.slice(0, -2);
                blk += indent + "} else {\n";
                indent += "  ";
                blk +=
                    indent +
                        `if ( // ${nextKeySection}\n${(indent += "  ")}${getComparisions(nextKeySection, "srcStart", "!=").join("\n" + indent + "|| ")}\n${(indent = indent.slice(0, -2))}) {\n`;
                indent += "  ";
                if (isOptional) {
                    blk += indent + "// optional @omitnull field omitted\n";
                }
                else {
                    blk += indent + "break;\n";
                }
                indent = indent.slice(0, -2);
                blk += indent + "} else {\n";
                indent += "  ";
                if (!inlineStringValue)
                    blk += indent + `srcStart += ${nextKeyOffset};\n`;
                blk +=
                    indent +
                        `if (JSON.Util.isSpace(load<u16>(${inlineStringValue ? `srcStart + ${nextKeyOffset}` : "srcStart"}))) break;\n`;
                blk += indent + deserializerNext.join("\n" + indent) + "\n";
                indent = indent.slice(0, -2);
                blk += indent + "}\n";
                indent = indent.slice(0, -2);
                blk += indent + "}\n\n";
                t1opt.push(blk);
            }
            DESERIALIZE_FAST += chunkFastBlocksOptional(t1opt, "T1O", indent, false);
        }
        else {
            const t1blocks = [];
            for (let i = 0; i < this.schema.members.length; i++) {
                const member = this.schema.members[i];
                const key = JSON.stringify(member.alias || member.name);
                if (key.length <= 2)
                    throw new Error("Key cannot be empty!");
                const keySection = (i == 0 ? "{" : ",") + key + ":";
                let blk = indent +
                    `if ( // ${keySection}\n${(indent += "  ")}${getComparisions(keySection, "srcStart", "!=").join("\n" + indent + "|| ")}\n${(indent = indent.slice(0, -2))}) break;\n`;
                const keyOffset = keySection.length << 1;
                const resolvedType = stripNull(member.type);
                const inlineStringValue = ["string", "String"].includes(resolvedType);
                if (!inlineStringValue) {
                    blk += indent + `srcStart += ${keyOffset};\n\n`;
                }
                const deserializer = getDeserializer(member.type, "srcStart", "dst", member, inlineStringValue ? keyOffset : 0, true);
                if (!deserializer.length) {
                    blk += indent + "break;\n\n";
                    t1blocks.push(blk);
                    continue;
                }
                blk +=
                    indent +
                        `if (JSON.Util.isSpace(load<u16>(${inlineStringValue ? `srcStart + ${keyOffset}` : "srcStart"}))) break;\n`;
                blk += indent + deserializer.join("\n" + indent) + "\n\n";
                t1blocks.push(blk);
            }
            DESERIALIZE_FAST += chunkFastBlocks(t1blocks, "T1", indent);
        }
        DESERIALIZE_FAST +=
            indent + "if (load<u16>(srcStart) !== 0x7d) break; // }\n";
        DESERIALIZE_FAST += indent + "srcStart += 2;\n";
        DESERIALIZE_FAST += indent + "return srcStart;\n";
        indent = indent.slice(0, -2);
        DESERIALIZE_FAST += indent + "} while (false);\n\n";
        const tier2Desers = this.schema.members.map((member) => getDeserializer(member.type, "srcStart", "dst", member, 0, true));
        const tier2Ok = tier2Desers.every((d) => d.length && !(d.length === 1 && d[0].trim() === "break;"));
        if (tier2Ok && !supportsFastOptionalPath) {
            const i1 = "  ";
            const i2 = "    ";
            const skip = i2 + "srcStart = JSON.Util.skipWhitespace(srcStart, srcEnd);\n";
            DESERIALIZE_FAST += i1 + "srcStart = start;\n";
            DESERIALIZE_FAST += i1 + "do {\n";
            DESERIALIZE_FAST += skip;
            DESERIALIZE_FAST += i2 + "if (load<u16>(srcStart) != 0x7b) break; // {\n";
            DESERIALIZE_FAST += i2 + "srcStart += 2;\n";
            const t2blocks = [];
            for (let i = 0; i < this.schema.members.length; i++) {
                const member = this.schema.members[i];
                const key = JSON.stringify(member.alias || member.name);
                const keyBytes = key.length << 1;
                let blk = "\n";
                blk += skip;
                blk +=
                    i2 +
                        `if ( // ${key}\n${i2}  ` +
                        getComparisions(key, "srcStart", "!=").join("\n" + i2 + "  || ") +
                        `\n${i2}) break;\n`;
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
        }
        else if (tier2Ok && supportsFastOptionalPath) {
            const multi = this.schema.members.length > 1;
            const i1 = "  ";
            const i2 = "    ";
            const i3 = "      ";
            DESERIALIZE_FAST += i1 + "srcStart = start;\n";
            DESERIALIZE_FAST += i1 + "do {\n";
            DESERIALIZE_FAST +=
                i2 + "srcStart = JSON.Util.skipWhitespace(srcStart, srcEnd);\n";
            DESERIALIZE_FAST += i2 + "if (load<u16>(srcStart) != 0x7b) break; // {\n";
            DESERIALIZE_FAST += i2 + "srcStart += 2;\n";
            DESERIALIZE_FAST += i2 + "let kp: usize = 0;\n";
            if (multi)
                DESERIALIZE_FAST += i2 + "let seenAny = false;\n";
            const t2opt = [];
            for (let i = 0; i < this.schema.members.length; i++) {
                const member = this.schema.members[i];
                const key = JSON.stringify(member.alias || member.name);
                const keyBytes = key.length << 1;
                let blk = "\n";
                blk += i2 + "kp = JSON.Util.skipWhitespace(srcStart, srcEnd);\n";
                if (multi && i > 0) {
                    blk +=
                        i2 +
                            "if (seenAny && load<u16>(kp) == 0x2c) kp = JSON.Util.skipWhitespace(kp + 2, srcEnd);\n";
                }
                blk +=
                    i2 +
                        `if ( // ${key}\n${i2}  ` +
                        getComparisions(key, "kp", "==").join("\n" + i2 + "  && ") +
                        `\n${i2}) {\n`;
                blk += i3 + `kp += ${keyBytes};\n`;
                blk += i3 + "kp = JSON.Util.skipWhitespace(kp, srcEnd);\n";
                blk += i3 + "if (load<u16>(kp) != 0x3a) break; // :\n";
                blk += i3 + "srcStart = JSON.Util.skipWhitespace(kp + 2, srcEnd);\n";
                blk += i3 + tier2Desers[i].join("\n" + i3) + "\n";
                if (multi)
                    blk += i3 + "seenAny = true;\n";
                blk += i2 + "}\n";
                t2opt.push(blk);
            }
            DESERIALIZE_FAST += chunkFastBlocksOptional(t2opt, "T2O", i2, true);
            DESERIALIZE_FAST += "\n";
            DESERIALIZE_FAST +=
                i2 + "srcStart = JSON.Util.skipWhitespace(srcStart, srcEnd);\n";
            DESERIALIZE_FAST += i2 + "if (load<u16>(srcStart) != 0x7d) break; // }\n";
            DESERIALIZE_FAST += i2 + "srcStart += 2;\n";
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
        }
        else {
            DESERIALIZE_FAST += indent + "return 0;";
        }
        indent = indent.slice(0, -2);
        DESERIALIZE_FAST += indent + "}";
        DESERIALIZE += indent + "  let keyStart: usize = 0;\n";
        DESERIALIZE += indent + "  let keyEnd: usize = 0;\n";
        DESERIALIZE += indent + "  let isKey = false;\n";
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
        if (STRICT)
            DESERIALIZE +=
                indent +
                    '      else if (!isKey && code != 44 && code != 125) throw new Error("Expected \'\\"\' to start key in JSON object at position " + (srcEnd - srcStart).toString());\n';
        DESERIALIZE += indent + "      srcStart += 2;\n";
        DESERIALIZE += indent + "    } else {\n";
        const groupMembers = (members) => {
            const groups = new Map();
            for (const member of members) {
                const name = member.alias || member.name;
                const length = name.length;
                if (!groups.has(length)) {
                    groups.set(length, []);
                }
                groups.get(length).push(member);
            }
            return [...groups.values()]
                .map((group) => group.sort((a, b) => {
                const aLen = (a.alias || a.name).length;
                const bLen = (b.alias || b.name).length;
                return aLen - bLen;
            }))
                .sort((a, b) => b.length - a.length);
        };
        const generateGroups = (members, cb, type) => {
            if (!members.length) {
                if (STRICT) {
                    DESERIALIZE +=
                        indent +
                            '              throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
                }
                else {
                    if (type == "string") {
                        DESERIALIZE += indent + "              srcStart += 4;\n";
                    }
                    else if (type == "boolean" || type == "null" || type == "number") {
                        DESERIALIZE += indent + "              srcStart += 2;\n";
                    }
                    DESERIALIZE += indent + "              keyStart = 0;\n";
                    if (type == "string" ||
                        type == "object" ||
                        type == "array" ||
                        type == "number")
                        DESERIALIZE += indent + "              break;\n";
                }
            }
            else {
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
                }
                else {
                    if (type == "string") {
                        DESERIALIZE += indent + "              srcStart += 4;\n";
                    }
                    else if (type == "boolean" || type == "null" || type == "number") {
                        DESERIALIZE += indent + "              srcStart += 2;\n";
                    }
                    DESERIALIZE += indent + "              keyStart = 0;\n";
                    if (type == "string" ||
                        type == "object" ||
                        type == "array" ||
                        type == "number")
                        DESERIALIZE += indent + "              break;\n";
                }
                DESERIALIZE += "        }\n";
                DESERIALIZE += "    }\n";
                if (type != "null" && type != "boolean")
                    DESERIALIZE += "  break;\n";
            }
        };
        const generateConsts = (members) => {
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
                DESERIALIZE += toMemCDecl(Math.max(...members.map((m) => (m.alias || m.name).length << 1)), "            ");
            }
        };
        const getLazyRangeStore = (member, valueStart, valueEnd, prefix) => {
            return (prefix +
                `store<u64>(changetype<usize>(out), ((<u64>${valueStart}) << 32) | (<u64>(<u32>${valueEnd})), offsetof<this>(${JSON.stringify(member.name)}));\n`);
        };
        const getSlowValueStore = (member, valueStart, valueEnd, prefix) => {
            if (member.flags.has(PropertyFlags.Lazy))
                return getLazyRangeStore(member, valueStart, valueEnd, prefix);
            return (prefix +
                `store<${member.type}>(changetype<usize>(out), JSON.__deserialize<${member.type}>(${valueStart}, ${valueEnd}), offsetof<this>(${JSON.stringify(member.name)}));\n`);
        };
        const getSlowBooleanStore = (member, value, valueStart, valueEnd, prefix) => {
            if (member.flags.has(PropertyFlags.Lazy))
                return getLazyRangeStore(member, valueStart, valueEnd, prefix);
            if (member.type.startsWith("JSON.Box<bool") ||
                member.type.startsWith("JSON.Box<boolean") ||
                member.type.startsWith("Box<bool") ||
                member.type.startsWith("Box<boolean")) {
                return (prefix +
                    `store<${member.type}>(changetype<usize>(out), changetype<${member.type}>(JSON.Box.from<bool>(${value})), offsetof<this>(${JSON.stringify(member.name)}));\n`);
            }
            return (prefix +
                `store<boolean>(changetype<usize>(out), ${value}, offsetof<this>(${JSON.stringify(member.name)}));\n`);
        };
        const getSlowNullStore = (member, valueStart, valueEnd, prefix) => {
            if (member.flags.has(PropertyFlags.Lazy))
                return getLazyRangeStore(member, valueStart, valueEnd, prefix);
            return (prefix +
                `store<usize>(changetype<usize>(out), 0, offsetof<this>(${JSON.stringify(member.name)}));\n`);
        };
        let mbElse = "      ";
        if (!STRICT || slowStringMembers.length) {
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
            generateGroups(slowStringMembers, (group) => {
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
                DESERIALIZE += getSlowValueStore(first, "lastIndex", "srcStart + 2", indent + "              ");
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
                    DESERIALIZE += getSlowValueStore(mem, "lastIndex", "srcStart + 2", indent + "              ");
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
                }
                else {
                    DESERIALIZE += " else {\n";
                    DESERIALIZE += indent + "              srcStart += 4;\n";
                    DESERIALIZE += indent + "              keyStart = 0;\n";
                    DESERIALIZE += indent + "              break;\n";
                    DESERIALIZE += indent + "            }\n";
                }
            }, "string");
            DESERIALIZE += "          }\n";
            DESERIALIZE += "          srcStart += 2;\n";
            DESERIALIZE += "        }\n";
            DESERIALIZE += "      }\n";
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
            generateGroups(slowNumberMembers, (group) => {
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
                DESERIALIZE += getSlowValueStore(first, "lastIndex", "srcStart", indent + "              ");
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
                    DESERIALIZE += getSlowValueStore(mem, "lastIndex", "srcStart", indent + "              ");
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
                }
                else {
                    DESERIALIZE += " else {\n";
                    DESERIALIZE += indent + "              srcStart += 2;\n";
                    DESERIALIZE += indent + "              keyStart = 0;\n";
                    DESERIALIZE += indent + "              break;\n";
                    DESERIALIZE += indent + "            }\n";
                }
            }, "number");
            DESERIALIZE += "          }\n";
            DESERIALIZE += "          srcStart += 2;\n";
            DESERIALIZE += "        }\n";
            DESERIALIZE += "      }";
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
            generateGroups(slowObjectMembers, (group) => {
                generateConsts(group);
                const first = group[0];
                const fName = first.alias || first.name;
                DESERIALIZE +=
                    indent +
                        "            if (" +
                        getComparison(fName) +
                        ") { // " +
                        fName +
                        "\n";
                DESERIALIZE += getSlowValueStore(first, "lastIndex", "srcStart", indent + "              ");
                DESERIALIZE += indent + "              keyStart = 0;\n";
                DESERIALIZE += indent + "              break;\n";
                DESERIALIZE += indent + "            }";
                for (let i = 1; i < group.length; i++) {
                    const mem = group[i];
                    const memName = mem.alias || mem.name;
                    DESERIALIZE +=
                        indent +
                            " else if (" +
                            getComparison(memName) +
                            ") { // " +
                            memName +
                            "\n";
                    DESERIALIZE += getSlowValueStore(mem, "lastIndex", "srcStart", indent + "              ");
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
                }
                else {
                    DESERIALIZE += " else {\n";
                    DESERIALIZE += indent + "              keyStart = 0;\n";
                    DESERIALIZE += indent + "              break;\n";
                    DESERIALIZE += indent + "            }\n";
                }
            }, "object");
            indent = "";
            DESERIALIZE += "            }\n";
            DESERIALIZE += "          } else if (code == 123) depth++;\n";
            DESERIALIZE += "          srcStart += 2;\n";
            DESERIALIZE += "        }\n";
            DESERIALIZE += "      }";
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
            generateGroups(slowArrayMembers, (group) => {
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
                DESERIALIZE += getSlowValueStore(first, "lastIndex", "srcStart", indent + "              ");
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
                    DESERIALIZE += getSlowValueStore(mem, "lastIndex", "srcStart", indent + "              ");
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
                }
                else {
                    DESERIALIZE += " else {\n";
                    DESERIALIZE += indent + "              keyStart = 0;\n";
                    DESERIALIZE += indent + "              break;\n";
                    DESERIALIZE += indent + "            }\n";
                }
            }, "array");
            indent = "";
            DESERIALIZE += "            }\n";
            DESERIALIZE += "          } else if (code == 91) depth++;\n";
            DESERIALIZE += "          srcStart += 2;\n";
            DESERIALIZE += "        }\n";
            DESERIALIZE += "      }";
            mbElse = " else ";
        }
        if (!STRICT || slowBooleanMembers.length) {
            DESERIALIZE += mbElse + "if (code == 116) {\n";
            DESERIALIZE +=
                "        if (load<u64>(srcStart) == 28429475166421108) {\n";
            DESERIALIZE += "          srcStart += 8;\n";
            if (DEBUG > 1)
                DESERIALIZE +=
                    '              console.log("Value (bool, ' +
                        ++id +
                        '): " + JSON.Util.ptrToStr(lastIndex, srcStart - 8));';
            generateGroups(slowBooleanMembers, (group) => {
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
                DESERIALIZE += getSlowBooleanStore(first, "true", "srcStart - 8", "srcStart", indent + "            ");
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
                    DESERIALIZE += getSlowBooleanStore(mem, "true", "srcStart - 8", "srcStart", indent + "            ");
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
                }
                else {
                    DESERIALIZE += " else { \n";
                    DESERIALIZE += indent + "              srcStart += 2;\n";
                    DESERIALIZE += indent + "              keyStart = 0;\n";
                    DESERIALIZE += indent + "              break;\n";
                    DESERIALIZE += indent + "            }\n";
                }
            }, "boolean");
            DESERIALIZE += "        }";
            DESERIALIZE += " else {\n";
            DESERIALIZE +=
                "          throw new Error(\"Expected to find 'true' but found '\" + JSON.Util.ptrToStr(lastIndex, srcStart) + \"' instead at position \" + (srcEnd - srcStart).toString());\n";
            DESERIALIZE += "        }";
            DESERIALIZE += "\n      }";
            mbElse = " else ";
            DESERIALIZE += mbElse + "if (code == 102) {\n";
            DESERIALIZE += "        {\n";
            DESERIALIZE += "          srcStart += 10;\n";
            if (DEBUG > 1)
                DESERIALIZE +=
                    '              console.log("Value (bool, ' +
                        ++id +
                        '): " + JSON.Util.ptrToStr(lastIndex, srcStart - 10));';
            generateGroups(slowBooleanMembers, (group) => {
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
                DESERIALIZE += getSlowBooleanStore(first, "false", "srcStart - 10", "srcStart", indent + "            ");
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
                    DESERIALIZE += getSlowBooleanStore(mem, "false", "srcStart - 10", "srcStart", indent + "            ");
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
                }
                else {
                    DESERIALIZE += " else { \n";
                    DESERIALIZE += indent + "              srcStart += 2;\n";
                    DESERIALIZE += indent + "              keyStart = 0;\n";
                    DESERIALIZE += indent + "              break;\n";
                    DESERIALIZE += indent + "            }\n";
                }
            }, "boolean");
            DESERIALIZE += "        }";
            DESERIALIZE += "\n      }";
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
            generateGroups(slowNullMembers, (group) => {
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
                DESERIALIZE += getSlowNullStore(first, "srcStart - 8", "srcStart", indent + "            ");
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
                    DESERIALIZE += getSlowNullStore(mem, "srcStart - 8", "srcStart", indent + "            ");
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
                }
                else {
                    DESERIALIZE += " else { \n";
                    DESERIALIZE += indent + "              srcStart += 2;\n";
                    DESERIALIZE += indent + "              keyStart = 0;\n";
                    DESERIALIZE += indent + "              break;\n";
                    DESERIALIZE += indent + "            }\n";
                }
            }, "null");
            DESERIALIZE += "        }";
            DESERIALIZE += "\n      }";
            mbElse = " else ";
        }
        DESERIALIZE += " else {\n";
        DESERIALIZE += "   srcStart += 2;\n";
        DESERIALIZE += "   keyStart = 0;\n";
        DESERIALIZE += "}\n";
        DESERIALIZE += "\n    }\n";
        indentDec();
        DESERIALIZE += `  }\n`;
        indentDec();
        DESERIALIZE += `  return srcStart;\n}\n`;
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
        if (DEBUG > 0) {
            console.log(SERIALIZE_CUSTOM || SERIALIZE);
            console.log(INITIALIZE);
            console.log(DESERIALIZE_CUSTOM || DESERIALIZE);
        }
        const WIDE_STRUCT_FIELD_LIMIT = 32;
        if (this.schema.members.length > WIDE_STRUCT_FIELD_LIMIT) {
            INITIALIZE = INITIALIZE.replace(/^@inline /, "");
            DESERIALIZE_FAST = DESERIALIZE_FAST.replace(/^@inline /, "");
        }
        const SERIALIZE_METHOD = SimpleParser.parseClassMember(SERIALIZE_CUSTOM || SERIALIZE, node);
        const INITIALIZE_METHOD = SimpleParser.parseClassMember(INITIALIZE, node);
        const DESERIALIZE_CUSTOM_METHOD = DESERIALIZE_CUSTOM
            ? SimpleParser.parseClassMember(DESERIALIZE_CUSTOM, node)
            : null;
        const DESERIALIZE_SLOW_METHOD = SimpleParser.parseClassMember(DESERIALIZE, node);
        const DESERIALIZE_FAST_METHOD = useFastPath
            ? SimpleParser.parseClassMember(DESERIALIZE_FAST, node)
            : null;
        if (!node.members.find((v) => v.name.text == "__SERIALIZE"))
            node.members.push(SERIALIZE_METHOD);
        if (INITIALIZE_METHOD &&
            !node.members.find((v) => v.name.text == "__INITIALIZE"))
            node.members.push(INITIALIZE_METHOD);
        if (DESERIALIZE_CUSTOM_METHOD &&
            !node.members.find((v) => v.name.text == "__DESERIALIZE_CUSTOM"))
            node.members.push(DESERIALIZE_CUSTOM_METHOD);
        if (!DESERIALIZE_CUSTOM &&
            DESERIALIZE_SLOW_METHOD &&
            !node.members.find((v) => v.name.text == "__DESERIALIZE_SLOW"))
            node.members.push(DESERIALIZE_SLOW_METHOD);
        if (!DESERIALIZE_CUSTOM &&
            useFastPath &&
            DESERIALIZE_FAST_METHOD &&
            !node.members.find((v) => v.name.text == "__DESERIALIZE_FAST"))
            node.members.push(DESERIALIZE_FAST_METHOD);
        if (useFastPath && !DESERIALIZE_CUSTOM) {
            for (const chunk of fastChunkMethods) {
                const chunkMethod = SimpleParser.parseClassMember(chunk, node);
                if (!node.members.find((v) => v.name.text == chunkMethod.name.text))
                    node.members.push(chunkMethod);
            }
        }
        super.visitClassDeclaration(node);
    }
    getSchema(name) {
        name = stripNull(name);
        return (this.schemas
            .get(this.schema.node.range.source.internalPath)
            .find((s) => s.name == name) || null);
    }
    generateEmptyMethods(node) {
        const SERIALIZE_EMPTY = "__SERIALIZE(ptr: usize): void {\n  bs.proposeSize(4);\n  store<u32>(bs.offset, 8192123);\n  bs.offset += 4;\n}";
        const INITIALIZE_EMPTY = "__INITIALIZE(): this {\n  return this;\n}";
        const DESERIALIZE_SLOW_EMPTY = "__DESERIALIZE_SLOW<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): usize {\n  return srcEnd;\n}";
        if (DEBUG > 0) {
            console.log(SERIALIZE_EMPTY);
            console.log(INITIALIZE_EMPTY);
            console.log(DESERIALIZE_SLOW_EMPTY);
        }
        const SERIALIZE_METHOD_EMPTY = SimpleParser.parseClassMember(SERIALIZE_EMPTY, node);
        const INITIALIZE_METHOD_EMPTY = SimpleParser.parseClassMember(INITIALIZE_EMPTY, node);
        const DESERIALIZE_SLOW_METHOD_EMPTY = SimpleParser.parseClassMember(DESERIALIZE_SLOW_EMPTY, node);
        if (!node.members.find((v) => v.name.text == "__SERIALIZE"))
            node.members.push(SERIALIZE_METHOD_EMPTY);
        if (INITIALIZE_METHOD_EMPTY &&
            !node.members.find((v) => v.name.text == "__INITIALIZE"))
            node.members.push(INITIALIZE_METHOD_EMPTY);
        if (!node.members.find((v) => v.name.text == "__DESERIALIZE_SLOW"))
            node.members.push(DESERIALIZE_SLOW_METHOD_EMPTY);
    }
    visitImportStatement(node) {
        super.visitImportStatement(node);
        this.imports.push(node);
    }
    visitSource(node) {
        this.imports = [];
        super.visitSource(node);
    }
    addImports(node) {
        this.baseCWD = this.baseCWD.replaceAll("/", path.sep);
        const baseDir = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..");
        let fromPath = node.range.source.normalizedPath.replaceAll("/", path.sep);
        fromPath = fromPath.startsWith("~lib")
            ? fromPath.slice(5)
            : path.join(this.baseCWD, fromPath);
        const bsImport = this.imports.find((i) => i.declarations?.find((d) => d.foreignName.text == "bs" || d.name.text == "bs"));
        const jsonImport = this.imports.find((i) => i.declarations?.find((d) => d.foreignName.text == "JSON" || d.name.text == "JSON"));
        const atoiImport = this.imports.find((i) => i.declarations?.find((d) => d.foreignName.text == "atoi" || d.name.text == "atoi"));
        const scanValueEndImport = this.imports.find((i) => i.declarations?.find((d) => d.foreignName.text == "scanValueEnd" || d.name.text == "scanValueEnd"));
        const fieldHelpersImport = this.imports.find((i) => i.declarations?.find((d) => d.name.text == "__deserializeStringField"));
        const sourceText = node.text;
        const hasLocalScanValueEnd = /\bscanValueEnd\b/.test(sourceText);
        const baseRel = computeImportBaseRel(path.dirname(fromPath), path.join(baseDir));
        if (!bsImport) {
            const replaceNode = Node.createImportStatement([
                Node.createImportDeclaration(Node.createIdentifierExpression("bs", node.range, false), null, node.range),
            ], Node.createStringLiteralExpression(path.posix.join(baseRel, "lib", "as-bs"), node.range), node.range);
            node.range.source.statements.unshift(replaceNode);
            if (DEBUG > 0)
                console.log("Added import: " +
                    toString(replaceNode) +
                    " to " +
                    node.range.source.normalizedPath +
                    "\n");
        }
        if (!jsonImport) {
            const replaceNode = Node.createImportStatement([
                Node.createImportDeclaration(Node.createIdentifierExpression("JSON", node.range, false), null, node.range),
            ], Node.createStringLiteralExpression(path.posix.join(baseRel, "assembly", "index"), node.range), node.range);
            node.range.source.statements.unshift(replaceNode);
            if (DEBUG > 0)
                console.log("Added import: " +
                    toString(replaceNode) +
                    " to " +
                    node.range.source.normalizedPath +
                    "\n");
        }
        if (!atoiImport) {
            const replaceNode = Node.createImportStatement([
                Node.createImportDeclaration(Node.createIdentifierExpression("atoi", node.range, false), null, node.range),
            ], Node.createStringLiteralExpression(path.posix.join(baseRel, "assembly", "util", "atoi"), node.range), node.range);
            node.range.source.statements.unshift(replaceNode);
            if (DEBUG > 0)
                console.log("Added import: " +
                    toString(replaceNode) +
                    " to " +
                    node.range.source.normalizedPath +
                    "\n");
        }
        if (!scanValueEndImport && !hasLocalScanValueEnd) {
            const replaceNode = Node.createImportStatement([
                Node.createImportDeclaration(Node.createIdentifierExpression("scanValueEnd", node.range, false), null, node.range),
            ], Node.createStringLiteralExpression(path.posix.join(baseRel, "assembly", "deserialize", "swar", "array", "shared"), node.range), node.range);
            node.range.source.statements.unshift(replaceNode);
            if (DEBUG > 0)
                console.log("Added import: " +
                    toString(replaceNode) +
                    " to " +
                    node.range.source.normalizedPath +
                    "\n");
        }
        if (!fieldHelpersImport) {
            const fieldHelper = (real, alias) => Node.createImportDeclaration(Node.createIdentifierExpression(real, node.range, false), Node.createIdentifierExpression(alias, node.range, false), node.range);
            const replaceNode = Node.createImportStatement([
                fieldHelper("deserializeIntegerField", "__deserializeIntegerField"),
                fieldHelper("deserializeUnsignedField", "__deserializeUnsignedField"),
                fieldHelper("deserializeFloatField", "__deserializeFloatField"),
                fieldHelper("deserializeStringField", "__deserializeStringField"),
                fieldHelper("deserializeArrayField_SWAR", "__deserializeArrayField_SWAR"),
                fieldHelper("deserializeMapField", "__deserializeMapField"),
                fieldHelper("deserializeSetField", "__deserializeSetField"),
                fieldHelper("deserializeStaticArrayField", "__deserializeStaticArrayField"),
            ], Node.createStringLiteralExpression(path.posix.join(baseRel, "assembly", "deserialize"), node.range), node.range);
            node.range.source.statements.unshift(replaceNode);
            if (DEBUG > 0)
                console.log("Added import: " +
                    toString(replaceNode) +
                    " to " +
                    node.range.source.normalizedPath +
                    "\n");
        }
    }
    getStores(data, simd = false) {
        const out = [];
        const sizes = strToNum(data, simd);
        let offset = 0;
        for (const [size, num] of sizes) {
            if (size == "v128" && simd) {
                const index = this.simdStatements.findIndex((v) => v.includes(num));
                const name = "SIMD_" + (index == -1 ? this.simdStatements.length : index);
                if (index == -1)
                    this.simdStatements.push(`const ${name} = ${num};`);
                out.push("store<v128>(bs.offset, " +
                    name +
                    ", " +
                    offset +
                    "); // " +
                    data.slice(offset >> 1, (offset >> 1) + 8));
                offset += 16;
            }
            if (size == "u64") {
                out.push("store<u64>(bs.offset, " +
                    num +
                    ", " +
                    offset +
                    "); // " +
                    data.slice(offset >> 1, (offset >> 1) + 4));
                offset += 8;
            }
            else if (size == "u32") {
                out.push("store<u32>(bs.offset, " +
                    num +
                    ", " +
                    offset +
                    "); // " +
                    data.slice(offset >> 1, (offset >> 1) + 2));
                offset += 4;
            }
            else if (size == "u16") {
                out.push("store<u16>(bs.offset, " +
                    num +
                    ", " +
                    offset +
                    "); // " +
                    data.slice(offset >> 1, (offset >> 1) + 1));
                offset += 2;
            }
        }
        out.push("bs.offset += " + offset + ";");
        return out;
    }
    isValidType(type, node) {
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
            if (isPrimitive(type.slice(0, type.indexOf("| null"))))
                return false;
            return this.isValidType(type.slice(0, type.length - 7), node);
        }
        if (type.includes("<"))
            return (baseTypes.includes(type.slice(0, type.indexOf("<"))) &&
                this.isValidType(type.slice(type.indexOf("<") + 1, type.lastIndexOf(">")), node));
        if (validTypes.includes(type))
            return true;
        return false;
    }
}
var JSONMode;
(function (JSONMode) {
    JSONMode[JSONMode["SWAR"] = 0] = "SWAR";
    JSONMode[JSONMode["SIMD"] = 1] = "SIMD";
    JSONMode[JSONMode["NAIVE"] = 2] = "NAIVE";
})(JSONMode || (JSONMode = {}));
let MODE = JSONMode.SWAR;
let MODE_TEXT = "SWAR";
const STAGES = process.env["JSON_STAGES"] !== undefined;
export default class Transformer extends Transform {
    afterInitialize(program) {
        if (program.options.hasFeature(16))
            MODE = JSONMode.SIMD;
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
            console.log("[transform]: Finished initializing transformer in " +
                MODE_TEXT +
                " mode");
        program.registerConstantInteger("JSON_MODE", Type.i32, i64_new(MODE));
        if (JSON_CACHE_CONFIG.enabled) {
            program.registerConstantInteger("JSON_CACHE", Type.bool, i64_one);
            program.registerConstantInteger("JSON_CACHE_SIZE", Type.u32, i64_new(JSON_CACHE_CONFIG.bytes));
        }
    }
    afterParse(parser) {
        const transformer = new JSONTransform();
        if (STAGES)
            console.log("[transform]: Walking AST and generating schemas");
        const sources = parser.sources
            .filter((source) => {
            const p = source.internalPath;
            if (p.startsWith("~lib/rt") ||
                p.startsWith("~lib/performance") ||
                p.startsWith("~lib/wasi_") ||
                p.startsWith("~lib/shared/")) {
                return false;
            }
            return !isStdlib(source);
        })
            .sort((a, b) => {
            if (a.sourceKind >= 2 && b.sourceKind <= 1) {
                return -1;
            }
            else if (a.sourceKind <= 1 && b.sourceKind >= 2) {
                return 1;
            }
            else {
                return 0;
            }
        })
            .sort((a) => {
            if (a.sourceKind === 1) {
                return 1;
            }
            else {
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
                writeFileSync(path.join(process.cwd(), this.baseDir, removeExtension(source.normalizedPath) + ".tmp.ts"), toString(source));
            }
        }
        for (const source of parser.sources) {
            const p = source.internalPath;
            if (p === "assembly/index" || p.endsWith("/json-as/assembly/index")) {
                source.sourceKind = 2;
            }
        }
        if (STAGES)
            console.log("[transform]: Finished generating " +
                transformer.schemas.size +
                " schemas");
    }
}
function toU16(data, offset = 0) {
    return data.charCodeAt(offset + 0);
}
function toU32(data, offset = 0) {
    return (data.charCodeAt(offset + 1) << 16) | data.charCodeAt(offset + 0);
}
function toU48(data, offset = 0) {
    return ((BigInt(data.charCodeAt(offset + 2)) << 32n) |
        (BigInt(data.charCodeAt(offset + 1)) << 16n) |
        BigInt(data.charCodeAt(offset + 0)));
}
function toU64(data, offset = 0) {
    return ((BigInt(data.charCodeAt(offset + 3)) << 48n) |
        (BigInt(data.charCodeAt(offset + 2)) << 32n) |
        (BigInt(data.charCodeAt(offset + 1)) << 16n) |
        BigInt(data.charCodeAt(offset + 0)));
}
function toMemCDecl(n, indent) {
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
    if (n == 1)
        out += `${indent}const codeS${(index += 1)} = load<u16>(keyStart, ${offset});\n`;
    return out;
}
function toMemCCheck(data) {
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
    if (n == 1)
        out += ` && codeS${(index += 1)} == ${toU16(data, offset >> 1)}`;
    return out.slice(4);
}
function strToNum(data, simd = false, offset = 0) {
    const out = [];
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
        const value = (BigInt(data.charCodeAt(offset + 3)) << 48n) |
            (BigInt(data.charCodeAt(offset + 2)) << 32n) |
            (BigInt(data.charCodeAt(offset + 1)) << 16n) |
            BigInt(data.charCodeAt(offset + 0));
        out.push(["u64", value.toString()]);
        offset += 4;
        n -= 4;
    }
    while (n >= 2) {
        const value = (data.charCodeAt(offset + 1) << 16) | data.charCodeAt(offset + 0);
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
function throwError(message, range) {
    const err = new Error();
    err.stack = `${message}\n  at ${range.source.normalizedPath}:${range.source.lineAt(range.start)}:${range.source.columnAt()}\n`;
    throw err;
}
function indentInc() {
    indent += "  ";
}
function indentDec() {
    indent = indent.slice(0, Math.max(0, indent.length - 2));
}
function sizeof(type) {
    if (type == "u8")
        return 6;
    else if (type == "i8")
        return 8;
    else if (type == "u16")
        return 10;
    else if (type == "i16")
        return 12;
    else if (type == "u32")
        return 20;
    else if (type == "i32")
        return 22;
    else if (type == "usize")
        return 40;
    else if (type == "isize")
        return 42;
    else if (type == "u64")
        return 40;
    else if (type == "i64")
        return 42;
    else if (type == "f32")
        return 34;
    else if (type == "f64")
        return 66;
    else if (type == "bool" || type == "boolean")
        return 10;
    else
        return 0;
}
function classLazyMode(node) {
    const dec = node.decorators?.find((d) => {
        const n = d.name.text;
        return n === "json" || n === "serializable";
    });
    if (!dec || !dec.args || dec.args.length === 0)
        return "none";
    const arg = dec.args[0];
    if (arg.kind !== NodeKind.Literal ||
        arg.literalKind !== 6)
        return "none";
    const obj = arg;
    for (let i = 0; i < obj.names.length; i++) {
        if (obj.names[i].text !== "lazy")
            continue;
        const v = obj.values[i];
        if (v.kind === NodeKind.Literal &&
            v.literalKind === 2) {
            const s = v.value;
            if (s === "none" || s === "auto" || s === "all")
                return s;
        }
        throwError(`@json lazy must be "none", "auto", or "all"`, v.range);
    }
    return "none";
}
const LAZY_AUTO_THRESHOLD = 10;
function lazyTypeCost(type, source, parser) {
    const base = stripNull(type);
    if (isPrimitive(base) || isBoolean(base) || isEnum(base, source, parser))
        return 1;
    if (base === "Date")
        return 4;
    if (isString(base))
        return 10;
    if (base === "JSON.Value" ||
        base === "Value" ||
        base === "JSON.Obj" ||
        base === "Obj" ||
        base === "JSON.Raw" ||
        base === "Raw")
        return 15;
    return 20;
}
function lazyAutoCost(type, source, parser) {
    const direct = lazyTypeCost(type, source, parser);
    if (direct < 20)
        return direct;
    const decl = source.getClass(stripNull(type));
    if (!decl)
        return 20;
    let sum = 0;
    for (let i = 0; i < decl.members.length; i++) {
        const m = decl.members[i];
        if (m.kind !== NodeKind.FieldDeclaration)
            continue;
        const fd = m;
        if (fd.is(32) ||
            fd.is(512) ||
            fd.is(1024) ||
            !fd.type)
            continue;
        sum += lazyTypeCost(toString(fd.type), source, parser);
        if (sum >= LAZY_AUTO_THRESHOLD)
            return sum;
    }
    return sum;
}
function lazyWrapperInner(typeNode) {
    if (!typeNode || typeNode.kind !== NodeKind.NamedType)
        return null;
    const named = typeNode;
    let seg = named.name;
    while (seg.next)
        seg = seg.next;
    if (seg.identifier.text !== "Lazy")
        return null;
    if (!named.typeArguments || named.typeArguments.length !== 1)
        return null;
    let inner = toString(named.typeArguments[0]).trim();
    if (named.isNullable && !inner.endsWith("null"))
        inner += " | null";
    return inner;
}
function estimatedSerializedByteSize(type, source, parser) {
    const trimmed = type.trim();
    const baseType = stripNull(trimmed);
    const nullable = trimmed != baseType;
    let estimated = sizeof(baseType);
    if (estimated == 0) {
        if (isEnum(baseType, source, parser)) {
            estimated = 22;
        }
        else if (baseType == "Date") {
            estimated = 52;
        }
        else if (isString(baseType)) {
            estimated = 4;
        }
        else if (isArray(baseType) || baseType.startsWith("Map<")) {
            estimated = 4;
        }
        else if (baseType == "JSON.Obj" ||
            baseType == "Obj" ||
            baseType == "JSON.Raw" ||
            baseType == "Raw" ||
            baseType == "JSON.Value" ||
            baseType == "Value") {
            estimated = 4;
        }
        else if (baseType == "ArrayBuffer" || needsReferenceLoad(baseType)) {
            estimated = 4;
        }
        else {
            estimated = 4;
        }
    }
    if (nullable) {
        estimated = Math.max(estimated, 8);
    }
    return estimated;
}
function isPrimitive(type) {
    const primitiveTypes = [
        "u8",
        "u16",
        "u32",
        "u64",
        "i8",
        "i16",
        "i32",
        "i64",
        "f32",
        "f64",
        "bool",
        "boolean",
    ];
    return primitiveTypes.some((v) => type.startsWith(v));
}
function isBoolean(type) {
    return type == "bool" || type == "boolean";
}
function isString(type) {
    return stripNull(type) == "string" || stripNull(type) == "String";
}
function isArray(type) {
    return (type.startsWith("Array<") ||
        type.startsWith("Set<") ||
        type.startsWith("StaticArray<"));
}
function isEnum(type, source, parser) {
    return (source.getEnum(type) != null || source.getImportedEnum(type, parser) != null);
}
export function stripNull(type) {
    if (type.endsWith(" | null")) {
        return type.slice(0, type.length - 7);
    }
    else if (type.startsWith("null | ")) {
        return type.slice(7);
    }
    return type;
}
function sortMembers(members) {
    return members.sort((a, b) => {
        const aMove = a.flags.has(PropertyFlags.OmitIf) || a.flags.has(PropertyFlags.OmitNull);
        const bMove = b.flags.has(PropertyFlags.OmitIf) || b.flags.has(PropertyFlags.OmitNull);
        if (aMove && !bMove) {
            return -1;
        }
        else if (!aMove && bMove) {
            return 1;
        }
        else {
            return 0;
        }
    });
}
function getComparison(data) {
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
