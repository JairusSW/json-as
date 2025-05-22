import { Node } from "assemblyscript/dist/assemblyscript.js";
import { Transform } from "assemblyscript/dist/transform.js";
import { Visitor } from "./visitor.js";
import { isStdlib, SimpleParser, toString } from "./util.js";
import * as path from "path";
import { fileURLToPath } from "url";
import { Property, PropertyFlags, Schema } from "./types.js";
import { getClasses, getImportedClass } from "./linker.js";
let indent = "  ";
const DEBUG = process.env["JSON_DEBUG"];
class JSONTransform extends Visitor {
    static SN = new JSONTransform();
    program;
    baseDir;
    parser;
    schemas = [];
    schema;
    sources = new Set();
    imports = [];
    topStatements = [];
    simdStatements = [];
    visitClassDeclaration(node) {
        if (!node.decorators?.length)
            return;
        if (!node.decorators.some((decorator) => {
            const name = decorator.name.text;
            return name === "json" || name === "serializable";
        }))
            return;
        this.schema = new Schema();
        this.schema.node = node;
        this.schema.name = node.name.text;
        this.schemas.push(this.schema);
        let SERIALIZE = "__SERIALIZE(ptr: usize): void {\n";
        let INITIALIZE = "@inline __INITIALIZE(): this {\n";
        let DESERIALIZE = "__DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {\n";
        let DESERIALIZE_CUSTOM = "";
        let SERIALIZE_CUSTOM = "";
        if (DEBUG)
            console.log("Created schema: " + this.schema.name + " in file " + node.range.source.normalizedPath);
        const members = [...node.members.filter((v) => v.kind === 54 && v.flags !== 32 && v.flags !== 512 && v.flags !== 1024 && !v.decorators?.some((decorator) => decorator.name.text === "omit"))];
        const serializers = [...node.members.filter((v) => v.kind === 58 && v.decorators && v.decorators.some((e) => e.name.text.toLowerCase() === "serializer"))];
        const deserializers = [...node.members.filter((v) => v.kind === 58 && v.decorators && v.decorators.some((e) => e.name.text.toLowerCase() === "deserializer"))];
        if (serializers.length > 1)
            throwError("Multiple serializers detected for class " + node.name.text + " but schemas can only have one serializer!", serializers[1].range);
        if (deserializers.length > 1)
            throwError("Multiple deserializers detected for class " + node.name.text + " but schemas can only have one deserializer!", deserializers[1].range);
        if (serializers.length) {
            this.schema.custom = true;
            const serializer = serializers[0];
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
            SERIALIZE_CUSTOM += "    const data = this." + serializer.name.text + "(" + (serializer.signature.parameters.length ? "this" : "") + ");\n";
            SERIALIZE_CUSTOM += "    const dataSize = data.length << 1;\n";
            SERIALIZE_CUSTOM += "    memory.copy(bs.offset, changetype<usize>(data), dataSize);\n";
            SERIALIZE_CUSTOM += "    bs.offset += dataSize;\n";
            SERIALIZE_CUSTOM += "  }\n";
        }
        if (deserializers.length) {
            this.schema.custom = true;
            const deserializer = deserializers[0];
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
            DESERIALIZE_CUSTOM += "  __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {\n";
            DESERIALIZE_CUSTOM += "    return inline.always(this." + deserializer.name.text + "(changetype<string>(srcStart)));\n";
            DESERIALIZE_CUSTOM += "  }\n";
        }
        if (node.extendsType) {
            const extendsName = node.extendsType?.name.identifier.text;
            this.schema.parent = this.schemas.find((v) => v.name == extendsName);
            if (!this.schema.parent) {
                const internalSearch = getClasses(node.range.source).find((v) => v.name.text == extendsName);
                if (internalSearch) {
                    if (DEBUG)
                        console.log("Found " + extendsName + " internally");
                    this.visitClassDeclaration(internalSearch);
                    this.visitClassDeclaration(node);
                    return;
                }
                const externalSearch = getImportedClass(extendsName, node.range.source, this.parser);
                if (externalSearch) {
                    if (DEBUG)
                        console.log("Found " + extendsName + " externally");
                    this.visitClassDeclaration(externalSearch);
                    this.visitClassDeclaration(node);
                    return;
                }
            }
            if (this.schema.parent?.members) {
                for (let i = this.schema.parent.members.length - 1; i >= 0; i--) {
                    const replace = this.schema.members.find((v) => v.name == this.schema.parent?.members[i]?.name);
                    if (!replace) {
                        members.unshift(this.schema.parent?.members[i].node);
                    }
                }
            }
        }
        if (!members.length) {
            this.generateEmptyMethods(node);
            return;
        }
        this.addRequiredImports(node.range.source);
        for (const member of members) {
            if (!member.type)
                throwError("Fields must be strongly typed", node.range);
            const type = toString(member.type);
            const name = member.name;
            const value = member.initializer ? toString(member.initializer) : null;
            if (type.startsWith("(") && type.includes("=>"))
                continue;
            const mem = new Property();
            mem.name = name.text;
            mem.type = type;
            mem.value = value;
            mem.node = member;
            mem.byteSize = sizeof(mem.type);
            this.schema.byteSize += mem.byteSize;
            if (member.decorators) {
                for (const decorator of member.decorators) {
                    const decoratorName = decorator.name.text.toLowerCase().trim();
                    switch (decoratorName) {
                        case "alias": {
                            const arg = decorator.args[0];
                            if (!arg || arg.kind != 16)
                                throwError("@alias must have an argument of type string or number", member.range);
                            mem.alias = arg.value.toString();
                            break;
                        }
                        case "omitif": {
                            let arg = decorator.args[0];
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
        for (const member of this.schema.members) {
            const nonNullType = member.type.replace(" | null", "");
            if (!isPrimitive(nonNullType)) {
                const schema = this.schemas.find((v) => v.name == nonNullType);
                if (schema && !this.schema.deps.includes(schema)) {
                    this.schema.deps.push(schema);
                    this.schema.byteSize += schema.byteSize;
                }
            }
        }
        let isPure = this.schema.static;
        let isRegular = isPure;
        let isFirst = true;
        for (let i = 0; i < this.schema.members.length; i++) {
            const member = this.schema.members[i];
            const aliasName = JSON.stringify(member.alias || member.name);
            const realName = member.name;
            const isLast = i == this.schema.members.length - 1;
            const nonNullType = member.type.replace(" | null", "");
            if (member.value) {
                INITIALIZE += `  this.${member.name} = ${member.value};\n`;
            }
            else if (this.schemas.find((v) => nonNullType == v.name)) {
                INITIALIZE += `  this.${member.name} = changetype<nonnull<${member.type}>>(__new(offsetof<nonnull<${member.type}>>(), idof<nonnull<${member.type}>>())).__INITIALIZE();\n`;
            }
            else if (member.type.startsWith("Array<") || member.type.startsWith("Map<")) {
                INITIALIZE += `  this.${member.name} = [];\n`;
            }
            else if (member.type == "string" || member.type == "String") {
                INITIALIZE += `  this.${member.name} = "";\n`;
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
                SERIALIZE += indent + `JSON.__serialize<${member.type}>(load<${member.type}>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`;
                if (isFirst)
                    isFirst = false;
            }
            else if (isRegular && !isPure) {
                const keyPart = (isFirst ? "" : ",") + aliasName + ":";
                this.schema.byteSize += keyPart.length << 1;
                SERIALIZE += this.getStores(keyPart, SIMD_ENABLED)
                    .map((v) => indent + v + "\n")
                    .join("");
                SERIALIZE += indent + `JSON.__serialize<${member.type}>(load<${member.type}>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`;
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
                    SERIALIZE += indent + `JSON.__serialize<${member.type}>(load<${member.type}>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`;
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
                        SERIALIZE += indent + `if (${toString(member.flags.get(PropertyFlags.OmitIf))}) {\n`;
                    }
                    indentInc();
                    SERIALIZE += this.getStores(aliasName + ":", SIMD_ENABLED)
                        .map((v) => indent + v + "\n")
                        .join("");
                    SERIALIZE += indent + `JSON.__serialize<${member.type}>(load<${member.type}>(ptr, offsetof<this>(${JSON.stringify(realName)})));\n`;
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
            if (member.type.endsWith(" | null"))
                sortedMembers.null.push(member);
            if (isString(member.type) || member.type == "JSON.Raw")
                sortedMembers.string.push(member);
            else if (isBoolean(member.type) || member.type.startsWith("JSON.Box<bool"))
                sortedMembers.boolean.push(member);
            else if (isPrimitive(member.type) || member.type.startsWith("JSON.Box<"))
                sortedMembers.number.push(member);
            else if (isArray(member.type))
                sortedMembers.array.push(member);
            else
                sortedMembers.object.push(member);
        }
        indent = "";
        let shouldGroup = false;
        DESERIALIZE += indent + "  console.log(\"data: \" + JSON.Util.ptrToStr(srcStart,srcEnd))\n";
        DESERIALIZE += indent + "  let keyStart: usize = 0;\n";
        if (shouldGroup || DEBUG)
            DESERIALIZE += indent + "  let keyEnd: usize = 0;\n";
        DESERIALIZE += indent + "  let isKey = false;\n";
        if (sortedMembers.object.length || sortedMembers.array.length)
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
        if (shouldGroup || DEBUG)
            DESERIALIZE += indent + "          keyEnd = srcStart;\n";
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
            let sorted = [];
            let len = -1;
            members
                .slice()
                .sort((a, b) => (a.alias?.length || a.name.length) - (b.alias?.length || b.name.length))
                .forEach((member) => {
                const _nameLength = member.alias?.length || member.name.length;
                if (_nameLength === len) {
                    sorted[sorted.length - 1].push(member);
                }
                else {
                    sorted.push([member]);
                    len = _nameLength;
                }
            });
            sorted = sorted.sort((a, b) => b.length - a.length);
            return sorted;
        };
        const generateComparisions = (members) => {
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
            const complex = isStruct(members[0].type) || members[0].type != "JSON.Obj" || isArray(members[0].type);
            const firstMemberName = members[0].alias || members[0].name;
            DESERIALIZE += indent + "            if (" + getComparision(firstMemberName) + ") { // " + firstMemberName + "\n";
            DESERIALIZE += indent + "              store<" + members[0].type + ">(changetype<usize>(out), JSON.__deserialize<" + members[0].type + ">(lastIndex, srcStart), offsetof<this>(" + JSON.stringify(firstMemberName) + "));\n";
            if (!complex)
                DESERIALIZE += indent + "              srcStart += 2;\n";
            DESERIALIZE += indent + "              keyStart = 0;\n";
            DESERIALIZE += indent + "              break;\n";
            DESERIALIZE += indent + "            }";
            for (let i = 1; i < members.length; i++) {
                const member = members[i];
                const memberName = member.alias || member.name;
                DESERIALIZE += indent + " else if (" + getComparision(memberName) + ") { // " + memberName + "\n";
                DESERIALIZE += indent + "              store<" + members[0].type + ">(changetype<usize>(out), JSON.__deserialize<" + members[0].type + ">(lastIndex, srcStart), offsetof<this>(" + JSON.stringify(memberName) + "));\n";
                if (isString(members[0].type))
                    DESERIALIZE += indent + "              srcStart += 4;\n";
                else if (!complex)
                    DESERIALIZE += indent + "              srcStart += 2;\n";
                DESERIALIZE += indent + "              keyStart = 0;\n";
                DESERIALIZE += indent + "              break;\n";
                DESERIALIZE += indent + "            }";
            }
            DESERIALIZE += " else {\n";
            DESERIALIZE += indent + '              throw new Error("Unexpected key in JSON object \'" + String.fromCharCode(load<u16>(srcStart)) + "\' at position " + (srcEnd - srcStart).toString());\n';
            DESERIALIZE += indent + "            }\n";
        };
        let mbElse = "      ";
        if (sortedMembers.string.length) {
            DESERIALIZE += mbElse + "if (code == 34) {\n";
            DESERIALIZE += "          lastIndex = srcStart;\n";
            DESERIALIZE += "          srcStart += 2;\n";
            DESERIALIZE += "          while (srcStart < srcEnd) {\n";
            DESERIALIZE += "            const code = load<u16>(srcStart);\n";
            DESERIALIZE += "            if (code == 34 && load<u16>(srcStart - 2) !== 92) {\n";
            DESERIALIZE += "              srcStart += 2;\n";
            DESERIALIZE += "          console.log(JSON.Util.ptrToStr(keyStart,keyEnd) + \" = \" + load<u16>(keyStart).toString() + \" val \" + JSON.Util.ptrToStr(lastIndex, srcStart));\n";
            generateComparisions(sortedMembers.string);
            DESERIALIZE += "          }\n";
            DESERIALIZE += "          srcStart += 2;\n";
            DESERIALIZE += "        }\n";
            DESERIALIZE += "      }\n";
            mbElse = " else ";
        }
        if (sortedMembers.number.length) {
            DESERIALIZE += mbElse + "if (code - 48 <= 9 || code == 45) {\n";
            DESERIALIZE += "        lastIndex = srcStart;\n";
            DESERIALIZE += "        srcStart += 2;\n";
            DESERIALIZE += "        while (srcStart < srcEnd) {\n";
            DESERIALIZE += "          const code = load<u16>(srcStart);\n";
            DESERIALIZE += "          if (code == 44 || code == 125 || JSON.Util.isSpace(code)) {\n";
            generateComparisions(sortedMembers.number);
            DESERIALIZE += "          }\n";
            DESERIALIZE += "          srcStart += 2;\n";
            DESERIALIZE += "        }\n";
            DESERIALIZE += "      }";
            mbElse = " else ";
        }
        if (sortedMembers.object.length) {
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
            indent = "  ";
            generateComparisions(sortedMembers.object);
            indent = "";
            DESERIALIZE += "            }\n";
            DESERIALIZE += "          } else if (code == 123) depth++;\n";
            DESERIALIZE += "          srcStart += 2;\n";
            DESERIALIZE += "        }\n";
            DESERIALIZE += "      }";
            mbElse = " else ";
        }
        if (sortedMembers.array.length) {
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
            indent = "  ";
            generateComparisions(sortedMembers.array);
            indent = "";
            DESERIALIZE += "            }\n";
            DESERIALIZE += "          } else if (code == 91) depth++;\n";
            DESERIALIZE += "          srcStart += 2;\n";
            DESERIALIZE += "        }\n";
            DESERIALIZE += "      }";
            mbElse = " else ";
        }
        if (sortedMembers.boolean.length) {
            DESERIALIZE += mbElse + "if (code == 116) {\n";
            DESERIALIZE += "        if (load<u64>(srcStart) == 28429475166421108) {\n";
            DESERIALIZE += "          srcStart += 8;\n";
            if (sortedMembers.boolean.some((m) => (m.alias || m.name).length << 1 == 2)) {
                DESERIALIZE += "            const code16 = load<u16>(keyStart);\n";
            }
            if (sortedMembers.boolean.some((m) => (m.alias || m.name).length << 1 == 4)) {
                DESERIALIZE += "            const code32 = load<u32>(keyStart);\n";
            }
            if (sortedMembers.boolean.some((m) => (m.alias || m.name).length << 1 == 6)) {
                DESERIALIZE += "            const code48 = load<u64>(keyStart) & 0x0000FFFFFFFFFFFF;\n";
            }
            if (sortedMembers.boolean.some((m) => (m.alias || m.name).length << 1 == 8)) {
                DESERIALIZE += "            const code64 = load<u64>(keyStart);\n";
            }
            if (sortedMembers.boolean.some((m) => (m.alias || m.name).length << 1 > 8)) {
                DESERIALIZE += toMemCDecl(Math.max(...sortedMembers.boolean.map((m) => (m.alias || m.name).length << 1)), "            ");
            }
            const firstMemberName = sortedMembers.boolean[0].alias || sortedMembers.boolean[0].name;
            DESERIALIZE += indent + "            if (" + getComparision(firstMemberName) + ") { // " + firstMemberName + "\n";
            DESERIALIZE += indent + "              store<" + sortedMembers.boolean[0].type + ">(changetype<usize>(out), true, offsetof<this>(" + JSON.stringify(sortedMembers.boolean[0].name) + "));\n";
            DESERIALIZE += indent + "              srcStart += 2;\n";
            DESERIALIZE += indent + "              keyStart = 0;\n";
            DESERIALIZE += indent + "              break;\n";
            DESERIALIZE += indent + "            }";
            for (let i = 1; i < sortedMembers.boolean.length; i++) {
                const member = sortedMembers.boolean[i];
                const memberName = member.alias || member.name;
                DESERIALIZE += indent + " else if (" + getComparision(memberName) + ") { // " + memberName + "\n";
                DESERIALIZE += indent + "            store<" + sortedMembers.boolean[0].type + ">(changetype<usize>(out), true, offsetof<this>(" + JSON.stringify(sortedMembers.boolean[0].name) + "));\n";
                DESERIALIZE += indent + "            srcStart += 2;\n";
                DESERIALIZE += indent + "            keyStart = 0;\n";
                DESERIALIZE += indent + "            break;\n";
                DESERIALIZE += indent + "          }";
            }
            DESERIALIZE += " else {\n";
            DESERIALIZE += indent + '            throw new Error("Unexpected key in JSON object \'" + String.fromCharCode(load<u16>(srcStart)) + "\' at position " + (srcEnd - srcStart).toString());\n';
            DESERIALIZE += indent + "          }\n";
            DESERIALIZE += "        }";
            mbElse = " else ";
            DESERIALIZE += " else if (load<u64>(srcStart, 2) == 28429466576093281) {\n";
            DESERIALIZE += "          srcStart += 10;\n";
            DESERIALIZE += indent + "          if (" + getComparision(firstMemberName) + ") { // " + firstMemberName + "\n";
            DESERIALIZE += indent + "            store<" + sortedMembers.boolean[0].type + ">(changetype<usize>(out), false, offsetof<this>(" + JSON.stringify(sortedMembers.boolean[0].name) + "));\n";
            DESERIALIZE += indent + "            srcStart += 2;\n";
            DESERIALIZE += indent + "            keyStart = 0;\n";
            DESERIALIZE += indent + "            break;\n";
            DESERIALIZE += indent + "          }";
            for (let i = 1; i < sortedMembers.boolean.length; i++) {
                const member = sortedMembers.boolean[i];
                const memberName = member.alias || member.name;
                DESERIALIZE += indent + " else if (" + getComparision(memberName) + ") { // " + memberName + "\n";
                DESERIALIZE += indent + "            store<" + sortedMembers.boolean[0].type + ">(changetype<usize>(out), false, offsetof<this>(" + JSON.stringify(sortedMembers.boolean[0].name) + "));\n";
                DESERIALIZE += indent + "            srcStart += 2;\n";
                DESERIALIZE += indent + "            keyStart = 0;\n";
                DESERIALIZE += indent + "            break;\n";
                DESERIALIZE += indent + "          }";
            }
            DESERIALIZE += " else {\n";
            DESERIALIZE += indent + '            throw new Error("Unexpected key in JSON object \'" + String.fromCharCode(load<u16>(srcStart)) + "\' at position " + (srcEnd - srcStart).toString());\n';
            DESERIALIZE += indent + "          }\n";
            DESERIALIZE += "        }\n";
            DESERIALIZE += "      }";
        }
        if (sortedMembers.null.length) {
            DESERIALIZE += mbElse + "if (code == 110) {\n";
            DESERIALIZE += "        if (load<u64>(srcStart) == 30399761348886638) {\n";
            DESERIALIZE += "          srcStart += 8;\n";
            if (sortedMembers.null.some((m) => (m.alias || m.name).length << 1 == 2)) {
                DESERIALIZE += "            const code16 = load<u16>(keyStart);\n";
            }
            if (sortedMembers.null.some((m) => (m.alias || m.name).length << 1 == 4)) {
                DESERIALIZE += "            const code32 = load<u32>(keyStart);\n";
            }
            if (sortedMembers.null.some((m) => (m.alias || m.name).length << 1 == 6)) {
                DESERIALIZE += "            const code48 = load<u64>(keyStart) & 0x0000FFFFFFFFFFFF;\n";
            }
            if (sortedMembers.null.some((m) => (m.alias || m.name).length << 1 == 8)) {
                DESERIALIZE += "            const code64 = load<u64>(keyStart);\n";
            }
            if (sortedMembers.null.some((m) => (m.alias || m.name).length << 1 > 8)) {
                DESERIALIZE += toMemCDecl(Math.max(...sortedMembers.null.map((m) => (m.alias || m.name).length << 1)), "            ");
            }
            const firstMemberName = sortedMembers.null[0].alias || sortedMembers.null[0].name;
            DESERIALIZE += indent + "          if (" + getComparision(firstMemberName) + ") { // " + firstMemberName + "\n";
            DESERIALIZE += indent + "            store<" + sortedMembers.null[0].type + ">(changetype<usize>(out), null, offsetof<this>(" + JSON.stringify(sortedMembers.null[0].name) + "));\n";
            DESERIALIZE += indent + "            srcStart += 2;\n";
            DESERIALIZE += indent + "            keyStart = 0;\n";
            DESERIALIZE += indent + "            break;\n";
            DESERIALIZE += indent + "          }";
            for (let i = 1; i < sortedMembers.null.length; i++) {
                const member = sortedMembers.null[i];
                const memberName = member.alias || member.name;
                DESERIALIZE += indent + " else if (" + getComparision(memberName) + ") { // " + memberName + "\n";
                DESERIALIZE += indent + "            store<" + sortedMembers.null[0].type + ">(changetype<usize>(out), null, offsetof<this>(" + JSON.stringify(sortedMembers.null[0].name) + "));\n";
                DESERIALIZE += indent + "            srcStart += 2;\n";
                DESERIALIZE += indent + "            keyStart = 0;\n";
                DESERIALIZE += indent + "            break;\n";
                DESERIALIZE += indent + "          }";
            }
            DESERIALIZE += " else {\n";
            DESERIALIZE += indent + '            throw new Error("Unexpected key in JSON object \'" + String.fromCharCode(load<u16>(srcStart)) + "\' at position " + (srcEnd - srcStart).toString());\n';
            DESERIALIZE += indent + "          }\n";
            DESERIALIZE += "        }";
            DESERIALIZE += "\n      }";
            mbElse = " else ";
        }
        DESERIALIZE += " else {\n";
        DESERIALIZE += "   srcStart += 2;\n";
        DESERIALIZE += "}\n";
        DESERIALIZE += "\n    }\n";
        indentDec();
        DESERIALIZE += `  }\n`;
        indentDec();
        DESERIALIZE += `  return out;\n}\n`;
        indent = "  ";
        this.schema.byteSize += 2;
        SERIALIZE += indent + "store<u16>(bs.offset, 125, 0); // }\n";
        SERIALIZE += indent + "bs.offset += 2;\n";
        SERIALIZE += "}";
        SERIALIZE = SERIALIZE.slice(0, 32) + indent + "bs.proposeSize(" + this.schema.byteSize + ");\n" + SERIALIZE.slice(32);
        INITIALIZE += "  return this;\n";
        INITIALIZE += "}";
        if (DEBUG) {
            console.log(SERIALIZE_CUSTOM ? SERIALIZE_CUSTOM : SERIALIZE);
            console.log(INITIALIZE);
            console.log(DESERIALIZE_CUSTOM || DESERIALIZE);
        }
        const SERIALIZE_METHOD = SimpleParser.parseClassMember(SERIALIZE_CUSTOM ? SERIALIZE_CUSTOM : SERIALIZE, node);
        const INITIALIZE_METHOD = SimpleParser.parseClassMember(INITIALIZE, node);
        const DESERIALIZE_METHOD = SimpleParser.parseClassMember(DESERIALIZE_CUSTOM || DESERIALIZE, node);
        if (!node.members.find((v) => v.name.text == "__SERIALIZE"))
            node.members.push(SERIALIZE_METHOD);
        if (!node.members.find((v) => v.name.text == "__INITIALIZE"))
            node.members.push(INITIALIZE_METHOD);
        if (!node.members.find((v) => v.name.text == "__DESERIALIZE"))
            node.members.push(DESERIALIZE_METHOD);
        super.visitClassDeclaration(node);
    }
    generateEmptyMethods(node) {
        let SERIALIZE_EMPTY = "@inline __SERIALIZE(ptr: usize): void {\n  bs.proposeSize(4);\n  store<u32>(bs.offset, 8192123);\n  bs.offset += 4;\n}";
        let INITIALIZE_EMPTY = "@inline __INITIALIZE(): this {\n  return this;\n}";
        let DESERIALIZE_EMPTY = "@inline __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {\n  return this;\n}";
        if (DEBUG) {
            console.log(SERIALIZE_EMPTY);
            console.log(INITIALIZE_EMPTY);
            console.log(DESERIALIZE_EMPTY);
        }
        const SERIALIZE_METHOD_EMPTY = SimpleParser.parseClassMember(SERIALIZE_EMPTY, node);
        const INITIALIZE_METHOD_EMPTY = SimpleParser.parseClassMember(INITIALIZE_EMPTY, node);
        const DESERIALIZE_METHOD_EMPTY = SimpleParser.parseClassMember(DESERIALIZE_EMPTY, node);
        if (!node.members.find((v) => v.name.text == "__SERIALIZE"))
            node.members.push(SERIALIZE_METHOD_EMPTY);
        if (!node.members.find((v) => v.name.text == "__INITIALIZE"))
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
    addRequiredImports(node) {
        const filePath = fileURLToPath(import.meta.url);
        const baseDir = path.resolve(filePath, "..", "..", "..");
        const nodePath = path.resolve(this.baseDir, node.range.source.normalizedPath);
        const bsImport = this.imports.find((i) => i.declarations?.find((d) => d.foreignName.text == "bs" || d.name.text == "bs"));
        const jsonImport = this.imports.find((i) => i.declarations?.find((d) => d.foreignName.text == "JSON" || d.name.text == "JSON"));
        let bsPath = path.posix.join(...path.relative(path.dirname(nodePath), path.join(baseDir, "lib", "as-bs")).split(path.sep)).replace(/^.*node_modules\/json-as/, "json-as");
        let jsonPath = path.posix.join(...path.relative(path.dirname(nodePath), path.join(baseDir, "assembly", "index.ts")).split(path.sep)).replace(/^.*node_modules\/json-as/, "json-as");
        if (!bsImport) {
            if (node.normalizedPath.startsWith("~")) {
                bsPath = "json-as/lib/as-bs";
            }
            const replaceNode = Node.createImportStatement([Node.createImportDeclaration(Node.createIdentifierExpression("bs", node.range, false), null, node.range)], Node.createStringLiteralExpression(bsPath, node.range), node.range);
            this.topStatements.push(replaceNode);
            if (DEBUG)
                console.log("Added as-bs import: " + toString(replaceNode) + "\n");
        }
        if (!jsonImport) {
            if (node.normalizedPath.startsWith("~")) {
                jsonPath = "json-as/assembly/index.ts";
            }
            const replaceNode = Node.createImportStatement([Node.createImportDeclaration(Node.createIdentifierExpression("JSON", node.range, false), null, node.range)], Node.createStringLiteralExpression(jsonPath, node.range), node.range);
            this.topStatements.push(replaceNode);
            if (DEBUG)
                console.log("Added json-as import: " + toString(replaceNode) + "\n");
        }
    }
    getStores(data, simd = false) {
        const out = [];
        const sizes = strToNum(data, simd);
        let offset = 0;
        for (const [size, num] of sizes) {
            if (size == "v128" && simd) {
                let index = this.simdStatements.findIndex((v) => v.includes(num));
                let name = "SIMD_" + (index == -1 ? this.simdStatements.length : index);
                if (index && !this.simdStatements.includes(`const ${name} = ${num};`))
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
        const validTypes = ["string", "u8", "i8", "u16", "i16", "u32", "i32", "u64", "i64", "f32", "f64", "bool", "boolean", "Date", "JSON.Value", "JSON.Obj", "JSON.Raw", "Value", "Obj", "Raw", ...this.schemas.map((v) => v.name)];
        const baseTypes = ["Array", "Map", "Set", "JSON.Box", "Box"];
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
export default class Transformer extends Transform {
    afterParse(parser) {
        const transformer = JSONTransform.SN;
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
            .sort((a, b) => {
            if (a.sourceKind === 1) {
                return 1;
            }
            else {
                return 0;
            }
        });
        transformer.baseDir = path.join(process.cwd(), this.baseDir);
        transformer.program = this.program;
        transformer.parser = parser;
        for (const source of sources) {
            transformer.imports = [];
            transformer.currentSource = source;
            transformer.visit(source);
            if (transformer.topStatements.length) {
                source.statements.unshift(...transformer.topStatements);
                transformer.topStatements = [];
            }
            if (transformer.simdStatements.length) {
                for (const simd of transformer.simdStatements)
                    source.statements.unshift(SimpleParser.parseTopLevelStatement(simd));
            }
            transformer.simdStatements = [];
        }
        const schemas = transformer.schemas;
        for (const schema of schemas) {
            if (schema.parent) {
                const parent = schemas.find((v) => v.name == schema.parent?.name);
                if (!parent)
                    throwError(`Class ${schema.name} extends its parent class ${schema.parent}, but ${schema.parent} does not include a @json or @serializable decorator!`, schema.parent.node.range);
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
    return data.charCodeAt(offset + 0).toString();
}
function toU32(data, offset = 0) {
    return ((data.charCodeAt(offset + 1) << 16) | data.charCodeAt(offset + 0)).toString();
}
function toU48(data, offset = 0) {
    return ((BigInt(data.charCodeAt(offset + 2)) << 32n) | (BigInt(data.charCodeAt(offset + 1)) << 16n) | BigInt(data.charCodeAt(offset + 0))).toString();
}
function toU64(data, offset = 0) {
    return ((BigInt(data.charCodeAt(offset + 3)) << 48n) | (BigInt(data.charCodeAt(offset + 2)) << 32n) | (BigInt(data.charCodeAt(offset + 1)) << 16n) | BigInt(data.charCodeAt(offset + 0))).toString();
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
function isStruct(type) {
    type = stripNull(type);
    return JSONTransform.SN.schemas.some((v) => v.name == type) || JSONTransform.SN.schema.name == type;
}
function isString(type) {
    return stripNull(type) == "string" || stripNull(type) == "String";
}
function isArray(type) {
    return type.startsWith("Array<");
}
function stripNull(type) {
    if (type.endsWith(" | null")) {
        return type.slice(0, type.length - 7);
    }
    return type;
}
function getComparision(data) {
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