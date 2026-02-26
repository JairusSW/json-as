import { TypeAlias } from "./linkers/alias.js";
import { stripNull } from "./index.js";
export var PropertyFlags;
(function (PropertyFlags) {
    PropertyFlags[PropertyFlags["OmitNull"] = 0] = "OmitNull";
    PropertyFlags[PropertyFlags["OmitIf"] = 1] = "OmitIf";
    PropertyFlags[PropertyFlags["Raw"] = 2] = "Raw";
    PropertyFlags[PropertyFlags["Custom"] = 3] = "Custom";
})(PropertyFlags || (PropertyFlags = {}));
export class Property {
    name = "";
    alias = null;
    type = "";
    value = null;
    flags = new Map();
    node;
    byteSize = 0;
    _generic = false;
    _custom = false;
    parent;
    set custom(value) {
        this._custom = value;
    }
    get custom() {
        if (this._custom)
            return true;
        if (this.parent.node.isGeneric && this.parent.node.typeParameters.some((p) => p.name.text == this.type)) {
            this._custom = true;
            return true;
        }
        for (const dep of this.parent.deps) {
            if (this.name == dep.name && dep.custom) {
                this._custom = true;
                return true;
            }
        }
        return false;
    }
    set generic(value) {
        this._generic = value;
    }
    get generic() {
        if (this._generic)
            return true;
        if (this.parent.node.isGeneric && this.parent.node.typeParameters.some((p) => p.name.text == stripNull(this.type))) {
            this._generic = true;
            return true;
        }
        return false;
    }
}
export class Schema {
    static = true;
    name = "";
    members = [];
    parent = null;
    node;
    needsLink = null;
    byteSize = 0;
    deps = [];
    _custom = false;
    set custom(value) {
        this._custom = value;
    }
    get custom() {
        if (this._custom)
            return true;
        if (this.parent)
            return this.parent.custom;
        return false;
    }
    getMinLength(visited = new Set()) {
        if (visited.has(this.name))
            return 4;
        visited.add(this.name);
        const requiredMembers = this.members.filter((member) => !member.flags.has(PropertyFlags.OmitIf) && !member.flags.has(PropertyFlags.OmitNull));
        if (!requiredMembers.length)
            return 4;
        let minChars = 2;
        for (let i = 0; i < requiredMembers.length; i++) {
            const member = requiredMembers[i];
            const key = member.alias || member.name;
            if (i > 0)
                minChars += 1;
            minChars += key.length + 3;
            minChars += this.getTypeMinChars(member.type, visited);
        }
        return minChars << 1;
    }
    getTypeMinChars(type, visited) {
        const trimmed = type.trim();
        const baseType = stripNull(trimmed);
        const nullable = trimmed !== baseType;
        let min = this.getNonNullableTypeMinChars(baseType, visited);
        if (nullable)
            min = Math.min(min, 4);
        return min;
    }
    getNonNullableTypeMinChars(type, visited) {
        if (type.startsWith("JSON.Box<") || type.startsWith("Box<")) {
            const genericStart = type.indexOf("<");
            const genericEnd = type.lastIndexOf(">");
            if (genericStart !== -1 && genericEnd !== -1 && genericEnd > genericStart) {
                return this.getTypeMinChars(type.slice(genericStart + 1, genericEnd), visited);
            }
        }
        if (type.startsWith("Array<") || type.startsWith("StaticArray<") || type.startsWith("Set<"))
            return 2;
        if (type.startsWith("Map<"))
            return 2;
        if (type == "string" || type == "String" || type == "JSON.Raw" || type == "Raw")
            return 2;
        if (type == "Date")
            return 26;
        if (type == "bool" || type == "boolean")
            return 4;
        if (Schema.isNumericType(type))
            return 1;
        if (type == "JSON.Obj" || type == "Obj")
            return 2;
        if (type == "JSON.Value" || type == "Value")
            return 1;
        const dep = this.deps.find((schema) => schema.name === type || schema.name.endsWith("." + type));
        if (dep)
            return dep.getMinLength(visited) >> 1;
        if (this.parent && (this.parent.name === type || this.parent.name.endsWith("." + type))) {
            return this.parent.getMinLength(visited) >> 1;
        }
        return 1;
    }
    static isNumericType(type) {
        return ["u8", "u16", "u32", "u64", "usize", "i8", "i16", "i32", "i64", "isize", "f32", "f64"].includes(type);
    }
}
export class SourceSet {
    sources = {};
    get(source) {
        let src = this.sources[source.internalPath];
        if (!src) {
            src = new Src(source, this);
            this.sources[source.internalPath] = src;
        }
        return src;
    }
}
export class Src {
    sourceSet;
    internalPath;
    normalizedPath;
    schemas = [];
    aliases;
    exports = [];
    imports = [];
    nodeMap = new Map();
    classes = {};
    enums = {};
    constructor(source, sourceSet) {
        this.sourceSet = sourceSet;
        this.internalPath = source.internalPath;
        this.normalizedPath = source.normalizedPath;
        this.aliases = TypeAlias.getAliases(source);
        this.traverse(source.statements, []);
    }
    traverse(nodes, path) {
        for (const node of nodes) {
            switch (node.kind) {
                case 59:
                    const namespaceDeclaration = node;
                    this.traverse(namespaceDeclaration.members, [...path, namespaceDeclaration]);
                    break;
                case 51:
                    const classDeclaration = node;
                    this.classes[this.qualifiedName(classDeclaration, path)] = classDeclaration;
                    break;
                case 52:
                    const enumDeclaration = node;
                    this.enums[this.qualifiedName(enumDeclaration, path)] = enumDeclaration;
                    break;
                case 42:
                    const importStatement = node;
                    this.imports.push(importStatement);
                    break;
            }
            this.nodeMap.set(node, path);
        }
    }
    getQualifiedName(node) {
        return this.qualifiedName(node, this.nodeMap.get(node));
    }
    getClass(qualifiedName) {
        return this.classes[qualifiedName] || null;
    }
    getEnum(qualifiedName) {
        return this.enums[qualifiedName] || null;
    }
    getImportedClass(qualifiedName, parser) {
        for (const stmt of this.imports) {
            const externalSource = parser.sources.filter((src) => src.internalPath != this.internalPath).find((src) => src.internalPath == stmt.internalPath);
            if (!externalSource)
                continue;
            const source = this.sourceSet.get(externalSource);
            const classDeclaration = source.getClass(qualifiedName);
            if (classDeclaration && classDeclaration.flags & 2) {
                return classDeclaration;
            }
        }
        return null;
    }
    getImportedEnum(qualifiedName, parser) {
        for (const stmt of this.imports) {
            const externalSource = parser.sources.filter((src) => src.internalPath != this.internalPath).find((src) => src.internalPath == stmt.internalPath);
            if (!externalSource)
                continue;
            const source = this.sourceSet.get(externalSource);
            const enumDeclaration = source.getEnum(qualifiedName);
            if (enumDeclaration && enumDeclaration.flags & 2) {
                return enumDeclaration;
            }
        }
        return null;
    }
    getFullPath(node) {
        return this.internalPath + "/" + this.getQualifiedName(node);
    }
    resolveExtendsName(classDeclaration) {
        const parents = this.nodeMap.get(classDeclaration);
        if (!classDeclaration.extendsType || !parents) {
            return "";
        }
        const name = classDeclaration.extendsType.name.identifier.text;
        const extendsName = this.getIdentifier(classDeclaration.extendsType.name);
        for (let i = parents.length - 1; i >= 0; i--) {
            const parent = parents[i];
            for (const node of parent.members) {
                if (name == this.getNamespaceOrClassName(node)) {
                    return (parents
                        .slice(0, i + 1)
                        .map((p) => p.name.text)
                        .join(".") +
                        "." +
                        extendsName);
                }
            }
        }
        return extendsName;
    }
    qualifiedName(node, parents) {
        return parents?.length ? parents.map((p) => p.name.text).join(".") + "." + node.name.text : node.name.text;
    }
    getNamespaceOrClassName(node) {
        switch (node.kind) {
            case 59:
                return node.name.text;
            case 51:
                return node.name.text;
        }
        return "";
    }
    getIdentifier(typeName) {
        const names = [];
        while (typeName) {
            names.push(typeName.identifier.text);
            typeName = typeName.next;
        }
        return names.join(".");
    }
}
//# sourceMappingURL=types.js.map