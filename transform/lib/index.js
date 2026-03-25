import { Node, Type } from "assemblyscript/dist/assemblyscript.js";
import { Transform } from "assemblyscript/dist/transform.js";
import { readFileSync, writeFileSync } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { CustomTransform } from "./linkers/custom.js";
import { Property, PropertyFlags, Schema, SourceSet } from "./types.js";
import { isStdlib, removeExtension, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
let indent = "  ";
let id = 0;
const WRITE = process.env["JSON_WRITE"]?.trim();
const rawValue = process.env["JSON_DEBUG"]?.trim();
const DEBUG = rawValue === "true" ? 1 : rawValue === "false" || rawValue === "" ? 0 : isNaN(Number(rawValue)) ? 0 : Number(rawValue);
const STRICT = process.env["JSON_STRICT"] && process.env["JSON_STRICT"] == "true";
const USE_FAST_PATH = process.env["JSON_USE_FAST_PATH"]?.trim() === "1";
function needsReferenceLoad(type) {
    return type == "ArrayBuffer" || type == "Int8Array" || type == "Uint8Array" || type == "Uint8ClampedArray" || type == "Int16Array" || type == "Uint16Array" || type == "Int32Array" || type == "Uint32Array" || type == "Int64Array" || type == "Uint64Array" || type == "Float32Array" || type == "Float64Array";
}
function getSerializeCall(type, realName) {
    if (type == "ArrayBuffer") {
        return `JSON.__serialize<ArrayBuffer>(load<ArrayBuffer>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`;
    }
    return needsReferenceLoad(type) ? `JSON.__serialize<${type}>(changetype<${type}>(load<usize>(ptr, offsetof<this>(${JSON.stringify(realName)}))));\n` : `JSON.__serialize<${type}>(load<${type}>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`;
}
const CUSTOM_JSON_KINDS = new Set(["any", "string", "number", "object", "array", "boolean", "null", "any | null", "string | null", "number | null", "object | null", "array | null", "boolean | null"]);
function parseCustomJsonKind(method, decoratorName) {
    const decorator = method.decorators?.find((v) => v.name.text.toLowerCase() == decoratorName);
    if (!decorator || !decorator.args || decorator.args.length == 0)
        return "any";
    if (decorator.args.length > 1)
        throwError(`@${decoratorName} accepts at most one argument`, decorator.range);
    const arg = decorator.args[0];
    if (arg.kind != 16 || arg.literalKind != 2) {
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
        const inheritedMembers = baseDecl.members.filter((v) => v.kind === 54 && !v.is(32) && !v.is(512) && !v.is(1024) && !v.decorators?.some((decorator) => decorator.name.text === "omit"));
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
            throw new Error("Class " + node.name.text + " is missing an @json or @serializable decorator in " + node.range.source.internalPath);
        this.visitClassDeclaration(node);
    }
    resolveType(type, source, visited = new Set()) {
        const stripped = stripNull(type);
        if (visited.has(stripped)) {
            return stripped;
        }
        visited.add(stripped);
        const resolvedType = source.aliases.find((v) => stripNull(v.name) === stripped)?.getBaseType();
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
        const members = [...node.members.filter((v) => v.kind === 54 && !v.is(32) && !v.is(512) && !v.is(1024) && !v.decorators?.some((decorator) => decorator.name.text === "omit"))];
        const serializers = [...node.members.filter((v) => v.kind === 58 && v.decorators && v.decorators.some((e) => e.name.text.toLowerCase() === "serializer") && !v.name.text.startsWith("__try"))];
        const deserializers = [...node.members.filter((v) => v.kind === 58 && v.decorators && v.decorators.some((e) => e.name.text.toLowerCase() === "deserializer") && !v.name.text.startsWith("__try"))];
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
                        console.log("Found " + extendsName + " in dependencies of " + source.internalPath);
                    if (!schema.deps.some((v) => v.name == depSearch.name))
                        schema.deps.push(depSearch);
                    schema.parent = depSearch;
                }
                else {
                    const internalSearch = source.getClass(extendsName);
                    if (internalSearch) {
                        if (DEBUG > 0)
                            console.log("Found " + extendsName + " internally from " + source.internalPath);
                        if (!this.visitedClasses.has(source.getFullPath(internalSearch))) {
                            this.visitClassDeclarationRef(internalSearch);
                            this.schemas.get(internalSearch.range.source.internalPath).push(this.schema);
                            this.visitClassDeclaration(node);
                            return;
                        }
                        const schem = this.schemas.get(internalSearch.range.source.internalPath)?.find((s) => s.name == extendsName);
                        if (!schem)
                            throw new Error("Could not find schema for " + internalSearch.name.text + " in " + internalSearch.range.source.internalPath);
                        schema.deps.push(schem);
                        schema.parent = schem;
                    }
                    else {
                        const externalSearch = source.getImportedClass(extendsName, this.parser);
                        if (externalSearch) {
                            if (DEBUG > 0)
                                console.log("Found " + externalSearch.name.text + " externally from " + source.internalPath);
                            const externalSource = this.sources.get(externalSearch.range.source);
                            if (!this.visitedClasses.has(externalSource.getFullPath(externalSearch))) {
                                this.visitClassDeclarationRef(externalSearch);
                                this.schemas.get(externalSource.internalPath).push(this.schema);
                                this.visitClassDeclaration(node);
                                return;
                            }
                            const schem = this.schemas.get(externalSource.internalPath)?.find((s) => s.name == extendsName);
                            if (!schem)
                                throw new Error("Could not find schema for " + externalSearch.name.text + " in " + externalSource.internalPath);
                            schema.deps.push(schem);
                            schema.parent = schem;
                        }
                        else {
                            const availableSearch = source.getAvailableClass(extendsName, this.parser);
                            if (availableSearch) {
                                if (DEBUG > 0)
                                    console.log("Found " + availableSearch.name.text + " from available sources for " + source.internalPath);
                                const availableSource = this.sources.get(availableSearch.range.source);
                                if (availableSearch.decorators?.some((decorator) => {
                                    const name = decorator.name.text;
                                    return name === "json" || name === "serializable";
                                })) {
                                    if (!this.visitedClasses.has(availableSource.getFullPath(availableSearch))) {
                                        this.visitClassDeclarationRef(availableSearch);
                                        this.schemas.get(availableSource.internalPath).push(this.schema);
                                        this.visitClassDeclaration(node);
                                        return;
                                    }
                                    const schem = this.schemas.get(availableSource.internalPath)?.find((s) => s.name == extendsName);
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
            else if (node.isGeneric && node.typeParameters.some((p) => p.name.text == type)) {
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
                        console.log("Found " + unknownType + " in dependencies of " + source.internalPath);
                    if (!schema.deps.some((v) => v.name == depSearch.name)) {
                        schema.deps.push(depSearch);
                    }
                }
                else {
                    const internalSearch = source.getClass(unknownType);
                    if (internalSearch) {
                        if (DEBUG > 0)
                            console.log("Found " + unknownType + " internally from " + source.internalPath);
                        if (!this.visitedClasses.has(source.getFullPath(internalSearch))) {
                            this.visitClassDeclarationRef(internalSearch);
                            const internalSchema = this.schemas.get(internalSearch.range.source.internalPath)?.find((s) => s.name == unknownType);
                            schema.deps.push(internalSchema);
                            this.schemas.get(internalSearch.range.source.internalPath).push(this.schema);
                            this.visitClassDeclaration(node);
                            return;
                        }
                        const schem = this.schemas.get(internalSearch.range.source.internalPath)?.find((s) => s.name == unknownType);
                        if (!schem)
                            throw new Error("Could not find schema for " + internalSearch.name.text + " in " + internalSearch.range.source.internalPath);
                        schema.deps.push(schem);
                    }
                    else {
                        const externalSearch = source.getImportedClass(unknownType, this.parser);
                        if (externalSearch) {
                            if (DEBUG > 0)
                                console.log("Found " + externalSearch.name.text + " externally from " + source.internalPath);
                            const externalSource = this.sources.get(externalSearch.range.source);
                            if (!this.visitedClasses.has(externalSource.getFullPath(externalSearch))) {
                                this.visitClassDeclarationRef(externalSearch);
                                const externalSchema = this.schemas.get(externalSource.internalPath)?.find((s) => s.name == unknownType);
                                schema.deps.push(externalSchema);
                                this.schemas.get(externalSource.internalPath).push(this.schema);
                                this.visitClassDeclaration(node);
                                return;
                            }
                            const schem = this.schemas.get(externalSource.internalPath)?.find((s) => s.name == unknownType);
                            if (!schem)
                                throw new Error("Could not find schema for " + externalSearch.name.text + " in " + externalSource.internalPath);
                            schema.deps.push(schem);
                        }
                    }
                }
            }
        }
        this.schemas.get(source.internalPath).push(schema);
        this.schema = schema;
        this.visitedClasses.add(fullClassPath);
        const codegenMode = getCodegenMode(this.program);
        const useFastPath = USE_FAST_PATH && codegenMode !== JSONMode.NAIVE;
        let SERIALIZE = "__SERIALIZE(ptr: usize): void {\n";
        let INITIALIZE = "@inline __INITIALIZE(): this {\n";
        let DESERIALIZE = "__DESERIALIZE_SLOW<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): usize {\n";
        let DESERIALIZE_FAST = "@inline __DESERIALIZE_FAST<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): usize {\n";
        let DESERIALIZE_CUSTOM = "";
        let SERIALIZE_CUSTOM = "";
        if (DEBUG > 0)
            console.log("Created schema: " + this.schema.name + " in file " + source.normalizedPath + (this.schema.deps.length ? " with dependencies:\n  " + this.schema.deps.map((v) => v.name).join("\n  ") : ""));
        if (serializers.length > 1)
            throwError("Multiple serializers detected for class " + node.name.text + " but schemas can only have one serializer!", serializers[1].range);
        if (deserializers.length > 1)
            throwError("Multiple deserializers detected for class " + node.name.text + " but schemas can only have one deserializer!", deserializers[1].range);
        if (serializers.length) {
            this.schema.custom = true;
            const serializer = serializers[0];
            const serializerJsonKind = parseCustomJsonKind(serializer, "serializer");
            const hasCall = CustomTransform.hasCall(serializer);
            this.schema.customJsonKind = serializerJsonKind;
            CustomTransform.visit(serializer);
            if (serializer.signature.parameters.length > 1)
                throwError("Found too many parameters in custom serializer for " + this.schema.name + ", but serializers can only accept one parameter of type '" + this.schema.name + "'!", serializer.signature.parameters[1].range);
            if (serializer.signature.parameters.length > 0 && serializer.signature.parameters[0].type.name.identifier.text != node.name.text && serializer.signature.parameters[0].type.name.identifier.text != "this")
                throwError("Type of parameter for custom serializer does not match! It should be 'string'either be 'this' or '" + this.schema.name + "'", serializer.signature.parameters[0].type.range);
            if (!serializer.signature.returnType || !serializer.signature.returnType.name.identifier.text.includes("string"))
                throwError("Could not find valid return type for serializer in " + this.schema.name + "!. Set the return type to type 'string' and try again", serializer.signature.returnType.range);
            if (!serializer.decorators.some((v) => v.name.text == "inline")) {
                serializer.decorators.push(Node.createDecorator(Node.createIdentifierExpression("inline", serializer.range), null, serializer.range));
            }
            SERIALIZE_CUSTOM += "  __SERIALIZE(ptr: usize): void {\n";
            if (hasCall) {
                SERIALIZE_CUSTOM += "    const savedOffset = bs.offset;\n";
                SERIALIZE_CUSTOM += "    const savedStackSize = bs.stackSize;\n";
            }
            SERIALIZE_CUSTOM += "    const self = changetype<this>(ptr);\n";
            SERIALIZE_CUSTOM += "    const data = self." + serializer.name.text + "(" + (serializer.signature.parameters.length ? "self" : "") + ");\n";
            if (hasCall) {
                SERIALIZE_CUSTOM += "    bs.offset = savedOffset;\n";
                SERIALIZE_CUSTOM += "    bs.stackSize = savedStackSize;\n";
            }
            SERIALIZE_CUSTOM += "    const dataSize = data.length << 1;\n";
            SERIALIZE_CUSTOM += "    memory.copy(bs.offset, changetype<usize>(data), dataSize);\n";
            SERIALIZE_CUSTOM += "    bs.offset += dataSize;\n";
            SERIALIZE_CUSTOM += "  }\n";
        }
        if (deserializers.length) {
            this.schema.custom = true;
            const deserializer = deserializers[0];
            const deserializerJsonKind = parseCustomJsonKind(deserializer, "deserializer");
            if (this.schema.customJsonKind != "any" && deserializerJsonKind != "any" && this.schema.customJsonKind != deserializerJsonKind) {
                throwError(`@serializer and @deserializer JSON types for ${this.schema.name} must match`, deserializer.range);
            }
            if (this.schema.customJsonKind == "any")
                this.schema.customJsonKind = deserializerJsonKind;
            if (!deserializer.signature.parameters.length)
                throwError("Could not find any parameters in custom deserializer for " + this.schema.name + ". Deserializers must have one parameter like 'deserializer(data: string): " + this.schema.name + " {}'", deserializer.range);
            if (deserializer.signature.parameters.length > 1)
                throwError("Found too many parameters in custom deserializer for " + this.schema.name + ", but deserializers can only accept one parameter of type 'string'!", deserializer.signature.parameters[1].range);
            if (deserializer.signature.parameters[0].type.name.identifier.text != "string")
                throwError("Type of parameter for custom deserializer does not match! It must be 'string'", deserializer.signature.parameters[0].type.range);
            if (!deserializer.signature.returnType || !(deserializer.signature.returnType.name.identifier.text.includes(this.schema.name) || deserializer.signature.returnType.name.identifier.text.includes("this")))
                throwError("Could not find valid return type for deserializer in " + this.schema.name + "!. Set the return type to type '" + this.schema.name + "' or 'this' and try again", deserializer.signature.returnType.range);
            if (!deserializer.decorators.some((v) => v.name.text == "inline")) {
                deserializer.decorators.push(Node.createDecorator(Node.createIdentifierExpression("inline", deserializer.range), null, deserializer.range));
            }
            DESERIALIZE_CUSTOM += "  @inline __DESERIALIZE_CUSTOM(data: string): this {\n";
            DESERIALIZE_CUSTOM += "    return inline.always(this." + deserializer.name.text + "(data));\n";
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
            mem.byteSize = sizeof(mem.type);
            mem.custom = schema.deps.some((dep) => dep?.name == stripNull(type) && dep.custom);
            this.schema.byteSize += mem.byteSize;
            if (member.decorators) {
                for (const decorator of member.decorators) {
                    const decoratorName = decorator.name.text.toLowerCase().trim();
                    switch (decoratorName) {
                        case "alias": {
                            const arg = decorator.args[0];
                            if (!arg || (arg.kind != 16 && arg.literalKind != 2 && arg.literalKind != 1 && arg.literalKind != 0))
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
        if (!this.schema.static)
            this.schema.members = sortMembers(this.schema.members);
        indent = "  ";
        if (this.schema.static == false) {
            if (this.schema.members.some((v) => v.flags.has(PropertyFlags.OmitNull))) {
                SERIALIZE += indent + "let block: usize = 0;\n";
            }
            this.schema.byteSize += 2;
            SERIALIZE += indent + "store<u16>(bs.offset, 123, 0); // {\n";
            SERIALIZE += indent + "bs.offset += 2;\n";
        }
        const isPure = this.schema.static;
        let isRegular = isPure;
        let isFirst = true;
        for (let i = 0; i < this.schema.members.length; i++) {
            const member = this.schema.members[i];
            const aliasName = JSON.stringify(member.alias || member.name);
            const realName = member.name;
            const isLast = i == this.schema.members.length - 1;
            if (!useFastPath) {
                if (member.value) {
                    if (member.value != "null" && member.value != "0" && member.value != "0.0" && member.value != "false") {
                        INITIALIZE += `  store<${member.type}>(changetype<usize>(this), ${member.value}, offsetof<this>(${JSON.stringify(member.name)}));\n`;
                    }
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
            }
            const SIMD_ENABLED = this.program.options.hasFeature(16);
            if (!isRegular && !member.flags.has(PropertyFlags.OmitIf) && !member.flags.has(PropertyFlags.OmitNull))
                isRegular = true;
            if (isRegular && isPure) {
                const keyPart = (isFirst ? "{" : ",") + aliasName + ":";
                this.schema.byteSize += keyPart.length << 1;
                SERIALIZE += this.getStores(keyPart, SIMD_ENABLED)
                    .map((v) => indent + v + "\n")
                    .join("");
                SERIALIZE += indent + getSerializeCall(member.type, realName);
                if (isFirst)
                    isFirst = false;
            }
            else if (isRegular && !isPure) {
                const keyPart = (isFirst ? "" : ",") + aliasName + ":";
                this.schema.byteSize += keyPart.length << 1;
                SERIALIZE += this.getStores(keyPart, SIMD_ENABLED)
                    .map((v) => indent + v + "\n")
                    .join("");
                SERIALIZE += indent + getSerializeCall(member.type, realName);
                if (isFirst)
                    isFirst = false;
            }
            else {
                if (member.flags.has(PropertyFlags.OmitNull)) {
                    SERIALIZE += indent + `if ((block = load<usize>(ptr, offsetof<this>(${JSON.stringify(realName)}))) !== 0) {\n`;
                    indentInc();
                    const keyPart = aliasName + ":";
                    this.schema.byteSize += keyPart.length << 1;
                    SERIALIZE += this.getStores(keyPart, SIMD_ENABLED)
                        .map((v) => indent + v + "\n")
                        .join("");
                    SERIALIZE += indent + getSerializeCall(member.type, realName);
                    if (!isLast) {
                        this.schema.byteSize += 2;
                        SERIALIZE += indent + `store<u16>(bs.offset, 44, 0); // ,\n`;
                        SERIALIZE += indent + `bs.offset += 2;\n`;
                    }
                    indentDec();
                    this.schema.byteSize += 2;
                    SERIALIZE += indent + `}\n`;
                }
                else if (member.flags.has(PropertyFlags.OmitIf)) {
                    if (member.flags.get(PropertyFlags.OmitIf).kind == 14) {
                        const arg = member.flags.get(PropertyFlags.OmitIf);
                        arg.declaration.signature.parameters[0].type = Node.createNamedType(Node.createSimpleTypeName("this", node.range), null, false, node.range);
                        arg.declaration.signature.returnType.name = Node.createSimpleTypeName("boolean", arg.declaration.signature.returnType.name.range);
                        SERIALIZE += indent + `if (!(${toString(member.flags.get(PropertyFlags.OmitIf))})(this)) {\n`;
                    }
                    else {
                        const expression = member.flags.get(PropertyFlags.OmitIf);
                        const rendered = expression.kind == 16 && expression.literalKind == 2 ? JSON.stringify(expression.value).slice(1, -1) : toString(expression);
                        SERIALIZE += indent + `if (!(${rendered})) {\n`;
                    }
                    indentInc();
                    SERIALIZE += this.getStores(aliasName + ":", SIMD_ENABLED)
                        .map((v) => indent + v + "\n")
                        .join("");
                    SERIALIZE += indent + getSerializeCall(member.type, realName);
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
            const customDep = this.schema.deps.find((dep) => dep && (dep.name == type || dep.name.endsWith("." + type)) && dep.custom);
            const isCustomType = member.custom || !!customDep;
            if (isCustomType || member.generic) {
                addMemberToCustomBucket(sortedMembers, member, member.generic ? "any" : customDep?.customJsonKind || "any");
                if (member.node.type.isNullable)
                    sortedMembers.null.push(member);
            }
            else {
                if (member.node.type.isNullable)
                    sortedMembers.null.push(member);
                if (isString(type) || type == "JSON.Raw")
                    sortedMembers.string.push(member);
                else if (isBoolean(type) || type.startsWith("JSON.Box<bool"))
                    sortedMembers.boolean.push(member);
                else if (isPrimitive(type) || type.startsWith("JSON.Box<") || isEnum(type, this.sources.get(this.schema.node.range.source), this.parser))
                    sortedMembers.number.push(member);
                else if (isArray(type))
                    sortedMembers.array.push(member);
                else
                    sortedMembers.object.push(member);
            }
        }
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
        const STRING_FIELD_DESERIALIZER = codegenMode === JSONMode.SIMD ? "deserializeStringField_SIMD" : "deserializeStringField_SWAR";
        const getArrayValueType = (type) => {
            if (type.startsWith("Array<") || type.startsWith("StaticArray<")) {
                return stripNull(type.slice(type.indexOf("<") + 1, -1).trim());
            }
            return null;
        };
        const getDeserializer = (type, srcPtr, outPtr, member, keyOffset = 0) => {
            const out = [];
            const resolvedType = stripNull(type);
            const fieldOffset = `offsetof<this>(${JSON.stringify(member.name)})`;
            const fieldPtr = `${outPtr} + offsetof<this>(${JSON.stringify(member.name)})`;
            const valuePtr = keyOffset ? `${srcPtr} + ${keyOffset}` : srcPtr;
            if (INTEGER_TYPES.includes(resolvedType)) {
                const helper = SIGNED_INTEGER_TYPES.includes(resolvedType) ? "deserializeIntegerField" : "deserializeUnsignedField";
                out.push(`${srcPtr} = ${helper}<${resolvedType}>(${valuePtr}, srcEnd, ${fieldPtr});`);
            }
            else if (["string", "String"].includes(resolvedType)) {
                out.push("{");
                if (member.node.type.isNullable) {
                    out.push(`  if (load<u64>(${valuePtr}) == 30399761348886638) {`);
                    out.push(`    store<${member.type}>(${outPtr}, changetype<${member.type}>(0), ${fieldOffset});`);
                    out.push(`    ${srcPtr} = ${valuePtr} + 8;`);
                    out.push("  } else {");
                }
                out.push(`  ${srcPtr} = ${STRING_FIELD_DESERIALIZER}<${member.type}>(${valuePtr}, srcEnd, ${fieldPtr});`);
                if (member.node.type.isNullable) {
                    out.push("  }");
                }
                out.push("}");
            }
            else if (isBoolean(resolvedType)) {
                out.push("{");
                out.push(`  if (load<u64>(${srcPtr}) == 28429475166421108) {`);
                out.push(`    store<${resolvedType}>(${outPtr}, true, ${fieldOffset});`);
                out.push(`    ${srcPtr} += 8;`);
                out.push("  } else if (load<u64>(" + srcPtr + ") == 32370086184550502 && load<u16>(" + srcPtr + ", 8) == 101) {");
                out.push(`    store<${resolvedType}>(${outPtr}, false, ${fieldOffset});`);
                out.push(`    ${srcPtr} += 10;`);
                out.push("  } else break;");
                out.push("}");
            }
            else if (FLOAT_TYPES.includes(resolvedType)) {
                out.push(`${srcPtr} = deserializeFloatField<${resolvedType}>(${valuePtr}, srcEnd, ${fieldPtr});`);
            }
            else if (this.getSchema(resolvedType)) {
                out.push("{");
                if (member.node.type.isNullable) {
                    out.push(`  if (load<u64>(${srcPtr}) == 30399761348886638) {`);
                    out.push(`    store<${resolvedType}>(${outPtr}, changetype<${resolvedType}>(0), ${fieldOffset});`);
                    out.push(`    ${srcPtr} += 8;`);
                    out.push("  } else {");
                }
                out.push(`  let value = load<${resolvedType}>(${outPtr}, ${fieldOffset});`);
                out.push("  if (changetype<usize>(value) == 0) {");
                out.push(`    value = changetype<${resolvedType}>(__new(offsetof<nonnull<${resolvedType}>>(), idof<nonnull<${resolvedType}>>()));`);
                out.push(`    store<${resolvedType}>(${outPtr}, value, ${fieldOffset});`);
                out.push("  }");
                out.push(`  ${srcPtr} = changetype<nonnull<${resolvedType}>>(value).__DESERIALIZE<${resolvedType}>(${srcPtr}, srcEnd, value);`);
                if (member.node.type.isNullable) {
                    out.push("  }");
                }
                out.push("}");
            }
            else if (resolvedType.startsWith("Array<")) {
                const valueType = getArrayValueType(resolvedType);
                if (valueType && ["string", "String"].includes(valueType)) {
                    out.push("{");
                    out.push(`  if (load<u16>(${srcPtr}) != 0x5b) break;`);
                    out.push(`  let value = load<${resolvedType}>(${outPtr}, ${fieldOffset});`);
                    out.push("  if (changetype<usize>(value) == 0) {");
                    out.push(`    value = [];`);
                    out.push(`    store<${resolvedType}>(${outPtr}, value, ${fieldOffset});`);
                    out.push("  }");
                    out.push("  let index = 0;");
                    out.push(`  ${srcPtr} += 2;`);
                    out.push(`  if (load<u16>(${srcPtr}) == 0x5d) {`);
                    out.push("    value.length = 0;");
                    out.push(`    ${srcPtr} += 2;`);
                    out.push("  } else while (true) {");
                    out.push('    if (index >= value.length) value.push("");');
                    out.push(`    ${srcPtr} = ${STRING_FIELD_DESERIALIZER}<${valueType}>(${srcPtr}, srcEnd, value.dataStart + ((<usize>index) << alignof<${valueType}>()));`);
                    out.push("    index++;");
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
                    out.push("}");
                }
                else if (valueType && this.getSchema(valueType)) {
                    out.push("{");
                    out.push(`  if (load<u16>(${srcPtr}) != 0x5b) break;`);
                    out.push(`  let value = load<${resolvedType}>(${outPtr}, ${fieldOffset});`);
                    out.push("  if (changetype<usize>(value) == 0) {");
                    out.push(`    value = [];`);
                    out.push(`    store<${resolvedType}>(${outPtr}, value, ${fieldOffset});`);
                    out.push("  }");
                    out.push("  let index = 0;");
                    out.push(`  ${srcPtr} += 2;`);
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
                    out.push("      }");
                    out.push("    } else {");
                    out.push(`      item = changetype<${valueType}>(__new(offsetof<nonnull<${valueType}>>(), idof<nonnull<${valueType}>>()));`);
                    out.push("      value.push(item);");
                    out.push("    }");
                    out.push(`    ${srcPtr} = changetype<nonnull<${valueType}>>(item).__DESERIALIZE<${valueType}>(${srcPtr}, srcEnd, item);`);
                    out.push("    index++;");
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
                    out.push("}");
                }
                else {
                    out.push(`${srcPtr} = deserializeArrayField_SWAR<${resolvedType}>(${srcPtr}, srcEnd, ${fieldPtr});`);
                    out.push(`if (!${srcPtr}) break;`);
                }
            }
            else {
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
                out.push(`  store<${resolvedType}>(${outPtr}, JSON.__deserialize<${resolvedType}>(valueStart, ${srcPtr}), ${fieldOffset});`);
                out.push("}");
            }
            return out;
        };
        indent = "  ";
        DESERIALIZE_FAST += indent + "const dst = changetype<usize>(out);\n";
        DESERIALIZE_FAST += indent + "do {\n";
        indent += "  ";
        for (let i = 0; i < this.schema.members.length; i++) {
            const member = this.schema.members[i];
            const key = JSON.stringify(member.alias || member.name);
            if (key.length <= 2)
                throw new Error("Key cannot be empty!");
            const keySection = (i == 0 ? "{" : ",") + key + ":";
            DESERIALIZE_FAST += indent + `if ( // ${keySection}\n${(indent += "  ")}${getComparisions(keySection, "srcStart", "!=").join("\n" + indent + "|| ")}\n${(indent = indent.slice(0, -2))}) break;\n`;
            const keyOffset = keySection.length << 1;
            const resolvedType = stripNull(member.type);
            const inlineStringValue = ["string", "String"].includes(resolvedType);
            if (!inlineStringValue) {
                DESERIALIZE_FAST += indent + `srcStart += ${keyOffset};\n\n`;
            }
            const deserializer = getDeserializer(member.type, "srcStart", "dst", member, inlineStringValue ? keyOffset : 0);
            if (!deserializer.length) {
                DESERIALIZE_FAST += indent + "break;\n\n";
                continue;
            }
            DESERIALIZE_FAST += indent + deserializer.join("\n" + indent) + "\n\n";
        }
        DESERIALIZE_FAST += indent + "if (load<u16>(srcStart) !== 0x7d) break; // }\n";
        DESERIALIZE_FAST += indent + "srcStart += 2;\n";
        DESERIALIZE_FAST += indent + "return srcStart;\n";
        indent = indent.slice(0, -2);
        DESERIALIZE_FAST += indent + "} while (false);\n\n";
        DESERIALIZE_FAST += indent + 'throw new Error("Failed to parse JSON ");';
        indent = indent.slice(0, -2);
        DESERIALIZE_FAST += indent + "}";
        DESERIALIZE += indent + "  let keyStart: usize = 0;\n";
        DESERIALIZE += indent + "  let keyEnd: usize = 0;\n";
        DESERIALIZE += indent + "  let isKey = false;\n";
        if (!STRICT || sortedMembers.object.length || sortedMembers.array.length)
            DESERIALIZE += indent + "  let depth: i32 = 0;\n";
        DESERIALIZE += indent + "  let lastIndex: usize = 0;\n\n";
        DESERIALIZE += indent + "  while (srcStart < srcEnd && JSON.Util.isSpace(load<u16>(srcStart))) srcStart += 2;\n";
        DESERIALIZE += indent + "  while (srcEnd > srcStart && JSON.Util.isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;\n";
        DESERIALIZE += indent + '  if (srcStart - srcEnd == 0) throw new Error("Input string had zero length or was all whitespace");\n';
        DESERIALIZE += indent + "  if (load<u16>(srcStart) != 123) throw new Error(\"Expected '{' at start of object at position \" + (srcEnd - srcStart).toString());\n";
        DESERIALIZE += indent + "  if (load<u16>(srcEnd - 2) != 125) throw new Error(\"Expected '}' at end of object at position \" + (srcEnd - srcStart).toString());\n";
        DESERIALIZE += indent + "  srcStart += 2;\n\n";
        DESERIALIZE += indent + "  while (srcStart < srcEnd) {\n";
        DESERIALIZE += indent + "    let code = load<u16>(srcStart);\n";
        DESERIALIZE += indent + "    while (JSON.Util.isSpace(code)) code = load<u16>(srcStart += 2);\n";
        DESERIALIZE += indent + "    if (keyStart == 0) {\n";
        DESERIALIZE += indent + "      if (code == 34 && load<u16>(srcStart - 2) !== 92) {\n";
        DESERIALIZE += indent + "        if (isKey) {\n";
        DESERIALIZE += indent + "          keyStart = lastIndex;\n";
        DESERIALIZE += indent + "          keyEnd = srcStart;\n";
        if (DEBUG > 1)
            DESERIALIZE += indent + '          console.log("Key: " + JSON.Util.ptrToStr(keyStart, keyEnd));\n';
        DESERIALIZE += indent + "          while (JSON.Util.isSpace((code = load<u16>((srcStart += 2))))) {}\n";
        DESERIALIZE += indent + "          if (code !== 58) throw new Error(\"Expected ':' after key at position \" + (srcEnd - srcStart).toString());\n";
        DESERIALIZE += indent + "          isKey = false;\n";
        DESERIALIZE += indent + "        } else {\n";
        DESERIALIZE += indent + "          isKey = true;\n";
        DESERIALIZE += indent + "          lastIndex = srcStart + 2;\n";
        DESERIALIZE += indent + "        }\n";
        DESERIALIZE += indent + "      }\n";
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
                    DESERIALIZE += indent + '              throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
                }
                else {
                    if (type == "string") {
                        DESERIALIZE += indent + "              srcStart += 4;\n";
                    }
                    else if (type == "boolean" || type == "null" || type == "number") {
                        DESERIALIZE += indent + "              srcStart += 2;\n";
                    }
                    DESERIALIZE += indent + "              keyStart = 0;\n";
                    if (type == "string" || type == "object" || type == "array" || type == "number")
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
                    DESERIALIZE += indent + '              throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
                }
                else {
                    if (type == "string") {
                        DESERIALIZE += indent + "              srcStart += 4;\n";
                    }
                    else if (type == "boolean" || type == "null" || type == "number") {
                        DESERIALIZE += indent + "              srcStart += 2;\n";
                    }
                    DESERIALIZE += indent + "              keyStart = 0;\n";
                    if (type == "string" || type == "object" || type == "array" || type == "number")
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
                DESERIALIZE += "            const code48 = load<u64>(keyStart) & 0x0000FFFFFFFFFFFF;\n";
            }
            if (members.some((m) => (m.alias || m.name).length << 1 == 8)) {
                DESERIALIZE += "            const code64 = load<u64>(keyStart);\n";
            }
            if (members.some((m) => (m.alias || m.name).length << 1 > 8)) {
                DESERIALIZE += toMemCDecl(Math.max(...members.map((m) => (m.alias || m.name).length << 1)), "            ");
            }
        };
        let mbElse = "      ";
        if (!STRICT || sortedMembers.string.length) {
            DESERIALIZE += mbElse + "if (code == 34) {\n";
            DESERIALIZE += "          lastIndex = srcStart;\n";
            DESERIALIZE += "          srcStart += 2;\n";
            DESERIALIZE += "          while (srcStart < srcEnd) {\n";
            DESERIALIZE += "            const code = load<u16>(srcStart);\n";
            DESERIALIZE += "            if (code == 34 && load<u16>(srcStart - 2) !== 92) {\n";
            if (DEBUG > 1)
                DESERIALIZE += '              console.log("Value (string, ' + ++id + '): " + JSON.Util.ptrToStr(lastIndex, srcStart + 2));';
            generateGroups(sortedMembers.string, (group) => {
                generateConsts(group);
                const first = group[0];
                const fName = first.alias || first.name;
                DESERIALIZE += indent + "            if (" + (first.generic ? "isString<" + first.type + ">() && " : "") + getComparison(fName) + ") { // " + fName + "\n";
                DESERIALIZE += indent + "              store<" + first.type + ">(changetype<usize>(out), JSON.__deserialize<" + first.type + ">(lastIndex, srcStart + 2), offsetof<this>(" + JSON.stringify(first.name) + "));\n";
                DESERIALIZE += indent + "              srcStart += 4;\n";
                DESERIALIZE += indent + "              keyStart = 0;\n";
                DESERIALIZE += indent + "              break;\n";
                DESERIALIZE += indent + "            }";
                for (let i = 1; i < group.length; i++) {
                    const mem = group[i];
                    const memName = mem.alias || mem.name;
                    DESERIALIZE += indent + " else if (" + (mem.generic ? "isString<" + mem.type + ">() && " : "") + getComparison(memName) + ") { // " + memName + "\n";
                    DESERIALIZE += indent + "              store<" + mem.type + ">(changetype<usize>(out), JSON.__deserialize<" + mem.type + ">(lastIndex, srcStart + 2), offsetof<this>(" + JSON.stringify(mem.name) + "));\n";
                    DESERIALIZE += indent + "              srcStart += 4;\n";
                    DESERIALIZE += indent + "              keyStart = 0;\n";
                    DESERIALIZE += indent + "              break;\n";
                    DESERIALIZE += indent + "            }";
                }
                if (STRICT) {
                    DESERIALIZE += " else {\n";
                    DESERIALIZE += indent + '              throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
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
        if (!STRICT || sortedMembers.number.length) {
            DESERIALIZE += mbElse + "if (code - 48 <= 9 || code == 45) {\n";
            DESERIALIZE += "        lastIndex = srcStart;\n";
            DESERIALIZE += "        srcStart += 2;\n";
            DESERIALIZE += "        while (srcStart < srcEnd) {\n";
            DESERIALIZE += "          const code = load<u16>(srcStart);\n";
            DESERIALIZE += "          if (code == 44 || code == 125 || JSON.Util.isSpace(code)) {\n";
            if (DEBUG > 1)
                DESERIALIZE += '              console.log("Value (number, ' + ++id + '): " + JSON.Util.ptrToStr(lastIndex, srcStart));';
            generateGroups(sortedMembers.number, (group) => {
                generateConsts(group);
                const first = group[0];
                const fName = first.alias || first.name;
                DESERIALIZE += indent + "            if (" + (first.generic ? "(isInteger<" + first.type + ">() || isFloat<" + first.type + ">()) && " : "") + getComparison(fName) + ") { // " + fName + "\n";
                DESERIALIZE += indent + "              store<" + first.type + ">(changetype<usize>(out), JSON.__deserialize<" + first.type + ">(lastIndex, srcStart), offsetof<this>(" + JSON.stringify(first.name) + "));\n";
                DESERIALIZE += indent + "              srcStart += 2;\n";
                DESERIALIZE += indent + "              keyStart = 0;\n";
                DESERIALIZE += indent + "              break;\n";
                DESERIALIZE += indent + "            }";
                for (let i = 1; i < group.length; i++) {
                    const mem = group[i];
                    const memName = mem.alias || mem.name;
                    DESERIALIZE += indent + " else if (" + (mem.generic ? "(isInteger<" + mem.type + ">() || isFloat<" + mem.type + ">()) && " : "") + getComparison(memName) + ") { // " + memName + "\n";
                    DESERIALIZE += indent + "              store<" + mem.type + ">(changetype<usize>(out), JSON.__deserialize<" + mem.type + ">(lastIndex, srcStart), offsetof<this>(" + JSON.stringify(mem.name) + "));\n";
                    DESERIALIZE += indent + "              srcStart += 2;\n";
                    DESERIALIZE += indent + "              keyStart = 0;\n";
                    DESERIALIZE += indent + "              break;\n";
                    DESERIALIZE += indent + "            }";
                }
                if (STRICT) {
                    DESERIALIZE += " else {\n";
                    DESERIALIZE += indent + '              throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
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
        if (!STRICT || sortedMembers.object.length) {
            DESERIALIZE += mbElse + "if (code == 123) {\n";
            DESERIALIZE += "        lastIndex = srcStart;\n";
            DESERIALIZE += "        depth++;\n";
            DESERIALIZE += "        srcStart += 2;\n";
            DESERIALIZE += "        while (srcStart < srcEnd) {\n";
            DESERIALIZE += "          const code = load<u16>(srcStart);\n";
            DESERIALIZE += "          if (code == 34) {\n";
            DESERIALIZE += "            srcStart += 2;\n";
            DESERIALIZE += "            while (!(load<u16>(srcStart) == 34 && load<u16>(srcStart - 2) != 92)) srcStart += 2;\n";
            DESERIALIZE += "          } else if (code == 125) {\n";
            DESERIALIZE += "            if (--depth == 0) {\n";
            DESERIALIZE += "              srcStart += 2;\n";
            if (DEBUG > 1)
                DESERIALIZE += '              console.log("Value (object, ' + ++id + '): " + JSON.Util.ptrToStr(lastIndex, srcStart));';
            indent = "  ";
            generateGroups(sortedMembers.object, (group) => {
                generateConsts(group);
                const first = group[0];
                const fName = first.alias || first.name;
                DESERIALIZE += indent + "            if (" + (first.generic ? "isDefined(out.__DESERIALIZE) &&" : "") + getComparison(fName) + ") { // " + fName + "\n";
                DESERIALIZE += indent + "              store<" + first.type + ">(changetype<usize>(out), JSON.__deserialize<" + first.type + ">(lastIndex, srcStart), offsetof<this>(" + JSON.stringify(first.name) + "));\n";
                DESERIALIZE += indent + "              keyStart = 0;\n";
                DESERIALIZE += indent + "              break;\n";
                DESERIALIZE += indent + "            }";
                for (let i = 1; i < group.length; i++) {
                    const mem = group[i];
                    const memName = mem.alias || mem.name;
                    DESERIALIZE += indent + " else if (" + (mem.generic ? "isDefined(out.__DESERIALIZE) &&" : "") + getComparison(memName) + ") { // " + memName + "\n";
                    DESERIALIZE += indent + "              store<" + mem.type + ">(changetype<usize>(out), JSON.__deserialize<" + mem.type + ">(lastIndex, srcStart), offsetof<this>(" + JSON.stringify(mem.name) + "));\n";
                    DESERIALIZE += indent + "              keyStart = 0;\n";
                    DESERIALIZE += indent + "              break;\n";
                    DESERIALIZE += indent + "            }";
                }
                if (STRICT) {
                    DESERIALIZE += " else {\n";
                    DESERIALIZE += indent + '              throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
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
        if (!STRICT || sortedMembers.array.length) {
            DESERIALIZE += mbElse + "if (code == 91) {\n";
            DESERIALIZE += "        lastIndex = srcStart;\n";
            DESERIALIZE += "        depth++;\n";
            DESERIALIZE += "        srcStart += 2;\n";
            DESERIALIZE += "        while (srcStart < srcEnd) {\n";
            DESERIALIZE += "          const code = load<u16>(srcStart);\n";
            DESERIALIZE += "          if (code == 34) {\n";
            DESERIALIZE += "            srcStart += 2;\n";
            DESERIALIZE += "            while (!(load<u16>(srcStart) == 34 && load<u16>(srcStart - 2) != 92)) srcStart += 2;\n";
            DESERIALIZE += "          } else if (code == 93) {\n";
            DESERIALIZE += "            if (--depth == 0) {\n";
            DESERIALIZE += "              srcStart += 2;\n";
            if (DEBUG > 1)
                DESERIALIZE += '              console.log("Value (object, ' + ++id + '): " + JSON.Util.ptrToStr(lastIndex, srcStart));';
            indent = "  ";
            generateGroups(sortedMembers.array, (group) => {
                generateConsts(group);
                const first = group[0];
                const fName = first.alias || first.name;
                DESERIALIZE += indent + "            if (" + (first.generic ? "isArray<" + first.type + ">() && " : "") + getComparison(fName) + ") { // " + fName + "\n";
                DESERIALIZE += indent + "              store<" + first.type + ">(changetype<usize>(out), JSON.__deserialize<" + first.type + ">(lastIndex, srcStart), offsetof<this>(" + JSON.stringify(first.name) + "));\n";
                DESERIALIZE += indent + "              keyStart = 0;\n";
                DESERIALIZE += indent + "              break;\n";
                DESERIALIZE += indent + "            }";
                for (let i = 1; i < group.length; i++) {
                    const mem = group[i];
                    const memName = mem.alias || mem.name;
                    DESERIALIZE += indent + " else if (" + (mem.generic ? "isArray" + mem.type + ">() && " : "") + getComparison(memName) + ") { // " + memName + "\n";
                    DESERIALIZE += indent + "              store<" + mem.type + ">(changetype<usize>(out), JSON.__deserialize<" + mem.type + ">(lastIndex, srcStart), offsetof<this>(" + JSON.stringify(mem.name) + "));\n";
                    DESERIALIZE += indent + "              keyStart = 0;\n";
                    DESERIALIZE += indent + "              break;\n";
                    DESERIALIZE += indent + "            }";
                }
                if (STRICT) {
                    DESERIALIZE += " else {\n";
                    DESERIALIZE += indent + '              throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
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
        if (!STRICT || sortedMembers.boolean.length) {
            DESERIALIZE += mbElse + "if (code == 116) {\n";
            DESERIALIZE += "        if (load<u64>(srcStart) == 28429475166421108) {\n";
            DESERIALIZE += "          srcStart += 8;\n";
            if (DEBUG > 1)
                DESERIALIZE += '              console.log("Value (bool, ' + ++id + '): " + JSON.Util.ptrToStr(lastIndex, srcStart - 8));';
            generateGroups(sortedMembers.boolean, (group) => {
                generateConsts(group);
                const first = group[0];
                const fName = first.alias || first.name;
                DESERIALIZE += indent + "          if (" + (first.generic ? "isBoolean<" + first.type + ">() && " : "") + getComparison(fName) + ") { // " + fName + "\n";
                DESERIALIZE += indent + "            store<boolean>(changetype<usize>(out), true, offsetof<this>(" + JSON.stringify(first.name) + "));\n";
                DESERIALIZE += indent + "            srcStart += 2;\n";
                DESERIALIZE += indent + "            keyStart = 0;\n";
                DESERIALIZE += indent + "            break;\n";
                DESERIALIZE += indent + "          }";
                for (let i = 1; i < group.length; i++) {
                    const mem = group[i];
                    const memName = mem.alias || mem.name;
                    DESERIALIZE += indent + " else if (" + (mem.generic ? "isBoolean<" + mem.type + ">() && " : "") + getComparison(memName) + ") { // " + memName + "\n";
                    DESERIALIZE += indent + "            store<boolean>(changetype<usize>(out), true, offsetof<this>(" + JSON.stringify(mem.name) + "));\n";
                    DESERIALIZE += indent + "            srcStart += 2;\n";
                    DESERIALIZE += indent + "            keyStart = 0;\n";
                    DESERIALIZE += indent + "            break;\n";
                    DESERIALIZE += indent + "          }";
                }
                if (STRICT) {
                    DESERIALIZE += " else {\n";
                    DESERIALIZE += indent + '            throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
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
            DESERIALIZE += "          throw new Error(\"Expected to find 'true' but found '\" + JSON.Util.ptrToStr(lastIndex, srcStart) + \"' instead at position \" + (srcEnd - srcStart).toString());\n";
            DESERIALIZE += "        }";
            DESERIALIZE += "\n      }";
            mbElse = " else ";
            DESERIALIZE += mbElse + "if (code == 102) {\n";
            DESERIALIZE += "        {\n";
            DESERIALIZE += "          srcStart += 10;\n";
            if (DEBUG > 1)
                DESERIALIZE += '              console.log("Value (bool, ' + ++id + '): " + JSON.Util.ptrToStr(lastIndex, srcStart - 10));';
            generateGroups(sortedMembers.boolean, (group) => {
                generateConsts(group);
                const first = group[0];
                const fName = first.alias || first.name;
                DESERIALIZE += indent + "          if (" + (first.generic ? "isBoolean<" + first.type + ">() && " : "") + getComparison(fName) + ") { // " + fName + "\n";
                DESERIALIZE += indent + "            store<boolean>(changetype<usize>(out), false, offsetof<this>(" + JSON.stringify(first.name) + "));\n";
                DESERIALIZE += indent + "            srcStart += 2;\n";
                DESERIALIZE += indent + "            keyStart = 0;\n";
                DESERIALIZE += indent + "            break;\n";
                DESERIALIZE += indent + "          }";
                for (let i = 1; i < group.length; i++) {
                    const mem = group[i];
                    const memName = mem.alias || mem.name;
                    DESERIALIZE += indent + " else if (" + (mem.generic ? "isBoolean<" + mem.type + ">() && " : "") + getComparison(memName) + ") { // " + memName + "\n";
                    DESERIALIZE += indent + "            store<boolean>(changetype<usize>(out), false, offsetof<this>(" + JSON.stringify(mem.name) + "));\n";
                    DESERIALIZE += indent + "            srcStart += 2;\n";
                    DESERIALIZE += indent + "            keyStart = 0;\n";
                    DESERIALIZE += indent + "            break;\n";
                    DESERIALIZE += indent + "          }";
                }
                if (STRICT) {
                    DESERIALIZE += " else {\n";
                    DESERIALIZE += indent + '            throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
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
        if (!STRICT || sortedMembers.null.length) {
            DESERIALIZE += mbElse + "if (code == 110) {\n";
            DESERIALIZE += "        if (load<u64>(srcStart) == 30399761348886638) {\n";
            DESERIALIZE += "          srcStart += 8;\n";
            if (DEBUG > 1)
                DESERIALIZE += '              console.log("Value (null, ' + ++id + '): " + JSON.Util.ptrToStr(lastIndex, srcStart - 8));';
            generateGroups(sortedMembers.null, (group) => {
                generateConsts(group);
                const first = group[0];
                const fName = first.alias || first.name;
                DESERIALIZE += indent + "          if (" + (first.generic ? "isNullable<" + first.type + ">() && " : "") + getComparison(fName) + ") { // " + fName + "\n";
                DESERIALIZE += indent + "            store<usize>(changetype<usize>(out), 0, offsetof<this>(" + JSON.stringify(first.name) + "));\n";
                DESERIALIZE += indent + "            srcStart += 2;\n";
                DESERIALIZE += indent + "            keyStart = 0;\n";
                DESERIALIZE += indent + "            break;\n";
                DESERIALIZE += indent + "          }";
                for (let i = 1; i < group.length; i++) {
                    const mem = group[i];
                    const memName = mem.alias || mem.name;
                    DESERIALIZE += indent + " else if (" + (mem.generic ? "isNullable<" + mem.type + ">() && " : "") + getComparison(memName) + ") { // " + memName + "\n";
                    DESERIALIZE += indent + "            store<usize>(changetype<usize>(out), 0, offsetof<this>(" + JSON.stringify(mem.name) + "));\n";
                    DESERIALIZE += indent + "            srcStart += 2;\n";
                    DESERIALIZE += indent + "            keyStart = 0;\n";
                    DESERIALIZE += indent + "            break;\n";
                    DESERIALIZE += indent + "          }";
                }
                if (STRICT) {
                    DESERIALIZE += " else {\n";
                    DESERIALIZE += indent + '            throw new Error("Unexpected key value pair in JSON object \'" + JSON.Util.ptrToStr(keyStart, keyEnd) + ":" + JSON.Util.ptrToStr(lastIndex, srcStart) + "\' at position " + (srcEnd - srcStart).toString());\n';
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
        SERIALIZE = SERIALIZE.slice(0, 32) + indent + "bs.proposeSize(" + this.schema.byteSize + ");\n" + SERIALIZE.slice(32);
        if (!useFastPath) {
            INITIALIZE += "  return this;\n";
            INITIALIZE += "}";
        }
        if (DEBUG > 0) {
            console.log(SERIALIZE_CUSTOM || SERIALIZE);
            if (!useFastPath)
                console.log(INITIALIZE);
            console.log(DESERIALIZE_CUSTOM || DESERIALIZE);
        }
        const DESERIALIZE_DIRECT = useFastPath ? DESERIALIZE_FAST.replace("@inline __DESERIALIZE_FAST<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): usize {", "@inline __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): usize {") : DESERIALIZE.replace("__DESERIALIZE_SLOW<__JSON_T>", "__DESERIALIZE<__JSON_T>");
        const SERIALIZE_METHOD = SimpleParser.parseClassMember(SERIALIZE_CUSTOM || SERIALIZE, node);
        const INITIALIZE_METHOD = !useFastPath ? SimpleParser.parseClassMember(INITIALIZE, node) : null;
        const DESERIALIZE_CUSTOM_METHOD = DESERIALIZE_CUSTOM ? SimpleParser.parseClassMember(DESERIALIZE_CUSTOM, node) : null;
        const DESERIALIZE_METHOD = DESERIALIZE_CUSTOM ? null : SimpleParser.parseClassMember(DESERIALIZE_DIRECT, node);
        const DESERIALIZE_FAST_METHOD = useFastPath ? SimpleParser.parseClassMember(DESERIALIZE_FAST, node) : null;
        if (!node.members.find((v) => v.name.text == "__SERIALIZE"))
            node.members.push(SERIALIZE_METHOD);
        if (!useFastPath && INITIALIZE_METHOD && !node.members.find((v) => v.name.text == "__INITIALIZE"))
            node.members.push(INITIALIZE_METHOD);
        if (DESERIALIZE_CUSTOM_METHOD && !node.members.find((v) => v.name.text == "__DESERIALIZE_CUSTOM"))
            node.members.push(DESERIALIZE_CUSTOM_METHOD);
        if (DESERIALIZE_METHOD && !node.members.find((v) => v.name.text == "__DESERIALIZE"))
            node.members.push(DESERIALIZE_METHOD);
        if (!DESERIALIZE_CUSTOM && useFastPath && DESERIALIZE_FAST_METHOD && !node.members.find((v) => v.name.text == "__DESERIALIZE_FAST"))
            node.members.push(DESERIALIZE_FAST_METHOD);
        super.visitClassDeclaration(node);
    }
    getSchema(name) {
        name = stripNull(name);
        return this.schemas.get(this.schema.node.range.source.internalPath).find((s) => s.name == name) || null;
    }
    generateEmptyMethods(node) {
        const SERIALIZE_EMPTY = "@inline __SERIALIZE(ptr: usize): void {\n  bs.proposeSize(4);\n  store<u32>(bs.offset, 8192123);\n  bs.offset += 4;\n}";
        const INITIALIZE_EMPTY = "@inline __INITIALIZE(): this {\n  return this;\n}";
        const DESERIALIZE_EMPTY = "@inline __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): usize {\n  return srcEnd;\n}";
        const useFastPath = USE_FAST_PATH && getCodegenMode(this.program) !== JSONMode.NAIVE;
        if (DEBUG > 0) {
            console.log(SERIALIZE_EMPTY);
            if (!useFastPath)
                console.log(INITIALIZE_EMPTY);
            console.log(DESERIALIZE_EMPTY);
        }
        const SERIALIZE_METHOD_EMPTY = SimpleParser.parseClassMember(SERIALIZE_EMPTY, node);
        const INITIALIZE_METHOD_EMPTY = !useFastPath ? SimpleParser.parseClassMember(INITIALIZE_EMPTY, node) : null;
        const DESERIALIZE_METHOD_EMPTY = SimpleParser.parseClassMember(DESERIALIZE_EMPTY, node);
        if (!node.members.find((v) => v.name.text == "__SERIALIZE"))
            node.members.push(SERIALIZE_METHOD_EMPTY);
        if (!useFastPath && INITIALIZE_METHOD_EMPTY && !node.members.find((v) => v.name.text == "__INITIALIZE"))
            node.members.push(INITIALIZE_METHOD_EMPTY);
        if (!node.members.find((v) => v.name.text == "__DESERIALIZE"))
            node.members.push(DESERIALIZE_METHOD_EMPTY);
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
        fromPath = fromPath.startsWith("~lib") ? fromPath.slice(5) : path.join(this.baseCWD, fromPath);
        const bsImport = this.imports.find((i) => i.declarations?.find((d) => d.foreignName.text == "bs" || d.name.text == "bs"));
        const jsonImport = this.imports.find((i) => i.declarations?.find((d) => d.foreignName.text == "JSON" || d.name.text == "JSON"));
        const atoiImport = this.imports.find((i) => i.declarations?.find((d) => d.foreignName.text == "atoi" || d.name.text == "atoi"));
        const deserializeIntegerFieldImport = this.imports.find((i) => i.declarations?.find((d) => d.foreignName.text == "deserializeIntegerField" || d.name.text == "deserializeIntegerField"));
        const deserializeUnsignedFieldImport = this.imports.find((i) => i.declarations?.find((d) => d.foreignName.text == "deserializeUnsignedField" || d.name.text == "deserializeUnsignedField"));
        const deserializeFloatFieldImport = this.imports.find((i) => i.declarations?.find((d) => d.foreignName.text == "deserializeFloatField" || d.name.text == "deserializeFloatField"));
        const deserializeArrayField_SWARImport = this.imports.find((i) => i.declarations?.find((d) => d.foreignName.text == "deserializeArrayField_SWAR" || d.name.text == "deserializeArrayField_SWAR"));
        const deserializeStringFieldSWARImport = this.imports.find((i) => i.declarations?.find((d) => d.foreignName.text == "deserializeStringField_SWAR" || d.name.text == "deserializeStringField_SWAR"));
        const deserializeStringFieldSIMDImport = this.imports.find((i) => i.declarations?.find((d) => d.foreignName.text == "deserializeStringField_SIMD" || d.name.text == "deserializeStringField_SIMD"));
        const sourceText = readFileSync(fromPath).toString();
        const hasLocalDeserializeIntegerField = /\bdeserializeIntegerField\b/.test(sourceText);
        const hasLocalDeserializeUnsignedField = /\bdeserializeUnsignedField\b/.test(sourceText);
        const hasLocalDeserializeFloatField = /\bdeserializeFloatField\b/.test(sourceText);
        const hasLocaldeserializeArrayField_SWAR = /\bdeserializeArrayField_SWAR\b/.test(sourceText);
        const hasLocalDeserializeStringFieldSWAR = /\bdeserializeStringField_SWAR\b/.test(sourceText);
        const hasLocalDeserializeStringFieldSIMD = /\bdeserializeStringField_SIMD\b/.test(sourceText);
        let baseRel = path.posix.join(...path.relative(path.dirname(fromPath), path.join(baseDir)).split(path.sep));
        if (baseRel.endsWith("json-as")) {
            baseRel = "json-as" + baseRel.slice(baseRel.indexOf("json-as") + 7);
        }
        else if (!baseRel.startsWith(".") && !baseRel.startsWith("/") && !baseRel.startsWith("json-as")) {
            baseRel = "./" + baseRel;
        }
        if (!bsImport) {
            const replaceNode = Node.createImportStatement([Node.createImportDeclaration(Node.createIdentifierExpression("bs", node.range, false), null, node.range)], Node.createStringLiteralExpression(path.posix.join(baseRel, "lib", "as-bs"), node.range), node.range);
            node.range.source.statements.unshift(replaceNode);
            if (DEBUG > 0)
                console.log("Added import: " + toString(replaceNode) + " to " + node.range.source.normalizedPath + "\n");
        }
        if (!jsonImport) {
            const replaceNode = Node.createImportStatement([Node.createImportDeclaration(Node.createIdentifierExpression("JSON", node.range, false), null, node.range)], Node.createStringLiteralExpression(path.posix.join(baseRel, "assembly", "index"), node.range), node.range);
            node.range.source.statements.unshift(replaceNode);
            if (DEBUG > 0)
                console.log("Added import: " + toString(replaceNode) + " to " + node.range.source.normalizedPath + "\n");
        }
        if (!atoiImport) {
            const replaceNode = Node.createImportStatement([Node.createImportDeclaration(Node.createIdentifierExpression("atoi", node.range, false), null, node.range)], Node.createStringLiteralExpression(path.posix.join(baseRel, "assembly", "util", "atoi"), node.range), node.range);
            node.range.source.statements.unshift(replaceNode);
            if (DEBUG > 0)
                console.log("Added import: " + toString(replaceNode) + " to " + node.range.source.normalizedPath + "\n");
        }
        if (!deserializeIntegerFieldImport && !hasLocalDeserializeIntegerField) {
            const replaceNode = Node.createImportStatement([Node.createImportDeclaration(Node.createIdentifierExpression("deserializeIntegerField", node.range, false), null, node.range)], Node.createStringLiteralExpression(path.posix.join(baseRel, "assembly", "deserialize", "integer"), node.range), node.range);
            node.range.source.statements.unshift(replaceNode);
            if (DEBUG > 0)
                console.log("Added import: " + toString(replaceNode) + " to " + node.range.source.normalizedPath + "\n");
        }
        if (!deserializeUnsignedFieldImport && !hasLocalDeserializeUnsignedField) {
            const replaceNode = Node.createImportStatement([Node.createImportDeclaration(Node.createIdentifierExpression("deserializeUnsignedField", node.range, false), null, node.range)], Node.createStringLiteralExpression(path.posix.join(baseRel, "assembly", "deserialize", "unsigned"), node.range), node.range);
            node.range.source.statements.unshift(replaceNode);
            if (DEBUG > 0)
                console.log("Added import: " + toString(replaceNode) + " to " + node.range.source.normalizedPath + "\n");
        }
        if (!deserializeFloatFieldImport && !hasLocalDeserializeFloatField) {
            const replaceNode = Node.createImportStatement([Node.createImportDeclaration(Node.createIdentifierExpression("deserializeFloatField", node.range, false), null, node.range)], Node.createStringLiteralExpression(path.posix.join(baseRel, "assembly", "deserialize", "float"), node.range), node.range);
            node.range.source.statements.unshift(replaceNode);
            if (DEBUG > 0)
                console.log("Added import: " + toString(replaceNode) + " to " + node.range.source.normalizedPath + "\n");
        }
        if (!deserializeArrayField_SWARImport && !hasLocaldeserializeArrayField_SWAR) {
            const replaceNode = Node.createImportStatement([Node.createImportDeclaration(Node.createIdentifierExpression("deserializeArrayField_SWAR", node.range, false), null, node.range)], Node.createStringLiteralExpression(path.posix.join(baseRel, "assembly", "deserialize", "simple", "array"), node.range), node.range);
            node.range.source.statements.unshift(replaceNode);
            if (DEBUG > 0)
                console.log("Added import: " + toString(replaceNode) + " to " + node.range.source.normalizedPath + "\n");
        }
        const codegenMode = getCodegenMode(this.program);
        if (codegenMode !== JSONMode.SIMD && !deserializeStringFieldSWARImport && !hasLocalDeserializeStringFieldSWAR) {
            const replaceNode = Node.createImportStatement([Node.createImportDeclaration(Node.createIdentifierExpression("deserializeStringField_SWAR", node.range, false), null, node.range)], Node.createStringLiteralExpression(path.posix.join(baseRel, "assembly", "deserialize", "swar", "string"), node.range), node.range);
            node.range.source.statements.unshift(replaceNode);
            if (DEBUG > 0)
                console.log("Added import: " + toString(replaceNode) + " to " + node.range.source.normalizedPath + "\n");
        }
        if (codegenMode === JSONMode.SIMD && !deserializeStringFieldSIMDImport && !hasLocalDeserializeStringFieldSIMD) {
            const replaceNode = Node.createImportStatement([Node.createImportDeclaration(Node.createIdentifierExpression("deserializeStringField_SIMD", node.range, false), null, node.range)], Node.createStringLiteralExpression(path.posix.join(baseRel, "assembly", "deserialize", "simd", "string"), node.range), node.range);
            node.range.source.statements.unshift(replaceNode);
            if (DEBUG > 0)
                console.log("Added import: " + toString(replaceNode) + " to " + node.range.source.normalizedPath + "\n");
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
                out.push("store<v128>(bs.offset, " + name + ", " + offset + "); // " + data.slice(offset >> 1, (offset >> 1) + 8));
                offset += 16;
            }
            if (size == "u64") {
                out.push("store<u64>(bs.offset, " + num + ", " + offset + "); // " + data.slice(offset >> 1, (offset >> 1) + 4));
                offset += 8;
            }
            else if (size == "u32") {
                out.push("store<u32>(bs.offset, " + num + ", " + offset + "); // " + data.slice(offset >> 1, (offset >> 1) + 2));
                offset += 4;
            }
            else if (size == "u16") {
                out.push("store<u16>(bs.offset, " + num + ", " + offset + "); // " + data.slice(offset >> 1, (offset >> 1) + 1));
                offset += 2;
            }
        }
        out.push("bs.offset += " + offset + ";");
        return out;
    }
    isValidType(type, node) {
        const validTypes = ["string", "u8", "i8", "u16", "i16", "u32", "i32", "u64", "i64", "f32", "f64", "bool", "boolean", "Date", "JSON.Value", "JSON.Obj", "JSON.Raw", "Value", "Obj", "Raw", ...this.schemas.get(this.schema.node.range.source.internalPath).map((v) => v.name)];
        const baseTypes = ["Array", "StaticArray", "Map", "Set", "JSON.Box", "Box"];
        if (node && node.isGeneric && node.typeParameters)
            validTypes.push(...node.typeParameters.map((v) => v.name.text));
        if (type.endsWith("| null")) {
            if (isPrimitive(type.slice(0, type.indexOf("| null"))))
                return false;
            return this.isValidType(type.slice(0, type.length - 7), node);
        }
        if (type.includes("<"))
            return baseTypes.includes(type.slice(0, type.indexOf("<"))) && this.isValidType(type.slice(type.indexOf("<") + 1, type.lastIndexOf(">")), node);
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
function getCodegenMode(program) {
    let mode = program.options.hasFeature(16) ? JSONMode.SIMD : JSONMode.SWAR;
    if (process.env["JSON_MODE"]) {
        switch (process.env["JSON_MODE"].toLowerCase().trim()) {
            case "simd":
                mode = JSONMode.SIMD;
                break;
            case "swar":
                mode = JSONMode.SWAR;
                break;
            case "naive":
                mode = JSONMode.NAIVE;
                break;
        }
    }
    return mode;
}
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
        program.registerConstantInteger("JSON_MODE", Type.i32, i64_new(MODE));
        if (process.env["JSON_CACHE"]?.trim().toLowerCase() === "true" || process.env["JSON_CACHE"]?.trim().toLowerCase() === "1") {
            program.registerConstantInteger("JSON_CACHE", Type.bool, i64_one);
        }
    }
    afterParse(parser) {
        const transformer = new JSONTransform();
        const sources = parser.sources
            .filter((source) => {
            const p = source.internalPath;
            if (p.startsWith("~lib/rt") || p.startsWith("~lib/performance") || p.startsWith("~lib/wasi_") || p.startsWith("~lib/shared/")) {
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
    }
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
function toU16(data, offset = 0) {
    return data.charCodeAt(offset + 0);
}
function toU32(data, offset = 0) {
    return (data.charCodeAt(offset + 1) << 16) | data.charCodeAt(offset + 0);
}
function toU48(data, offset = 0) {
    return (BigInt(data.charCodeAt(offset + 2)) << 32n) | (BigInt(data.charCodeAt(offset + 1)) << 16n) | BigInt(data.charCodeAt(offset + 0));
}
function toU64(data, offset = 0) {
    return (BigInt(data.charCodeAt(offset + 3)) << 48n) | (BigInt(data.charCodeAt(offset + 2)) << 32n) | (BigInt(data.charCodeAt(offset + 1)) << 16n) | BigInt(data.charCodeAt(offset + 0));
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
        out.push(["v128", "i16x8(" + data.charCodeAt(offset + 0) + ", " + data.charCodeAt(offset + 1) + ", " + data.charCodeAt(offset + 2) + ", " + data.charCodeAt(offset + 3) + ", " + data.charCodeAt(offset + 4) + ", " + data.charCodeAt(offset + 5) + ", " + data.charCodeAt(offset + 6) + ", " + data.charCodeAt(offset + 7) + ")"]);
        offset += 8;
        n -= 8;
    }
    while (n >= 4) {
        const value = (BigInt(data.charCodeAt(offset + 3)) << 48n) | (BigInt(data.charCodeAt(offset + 2)) << 32n) | (BigInt(data.charCodeAt(offset + 1)) << 16n) | BigInt(data.charCodeAt(offset + 0));
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
    else if (type == "u64")
        return 40;
    else if (type == "i64")
        return 40;
    else if (type == "bool" || type == "boolean")
        return 10;
    else
        return 0;
}
function isPrimitive(type) {
    const primitiveTypes = ["u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64", "f32", "f64", "bool", "boolean"];
    return primitiveTypes.some((v) => type.startsWith(v));
}
function isBoolean(type) {
    return type == "bool" || type == "boolean";
}
function isString(type) {
    return stripNull(type) == "string" || stripNull(type) == "String";
}
function isArray(type) {
    return type.startsWith("Array<") || type.startsWith("Set<") || type.startsWith("StaticArray<");
}
function isEnum(type, source, parser) {
    return source.getEnum(type) != null || source.getImportedEnum(type, parser) != null;
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
//# sourceMappingURL=index.js.map