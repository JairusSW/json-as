import { NUMERIC_TYPES } from "./scalars.js";
import { TypeAlias } from "./linkers/alias.js";
import { stripNull } from "./index.js";
import { SimpleParser, toString } from "./util.js";
import * as asc from "assemblyscript/dist/assemblyscript.js";
export const NodeKind = asc
    .NodeKind;
export var PropertyFlags;
(function (PropertyFlags) {
    PropertyFlags[PropertyFlags["OmitNull"] = 0] = "OmitNull";
    PropertyFlags[PropertyFlags["OmitIf"] = 1] = "OmitIf";
    PropertyFlags[PropertyFlags["Raw"] = 2] = "Raw";
    PropertyFlags[PropertyFlags["Custom"] = 3] = "Custom";
    PropertyFlags[PropertyFlags["Lazy"] = 4] = "Lazy";
    PropertyFlags[PropertyFlags["Optional"] = 5] = "Optional";
})(PropertyFlags || (PropertyFlags = {}));
export class Property {
    name = "";
    alias = null;
    type = "";
    nullable = false;
    value = null;
    flags = new Map();
    node;
    byteSize = 0;
    lazyInner = null;
    omitIfMethod = null;
    lazyPacked = false;
    lazyScalar = false;
    _generic = false;
    _custom = false;
    parent;
    set custom(value) {
        this._custom = value;
    }
    get custom() {
        if (this._custom)
            return true;
        if (this.parent.node.isGeneric &&
            this.parent.node.typeParameters.some((p) => p.name.text == this.type)) {
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
        if (this.parent.node.isGeneric &&
            this.parent.node.typeParameters.some((p) => p.name.text == stripNull(this.type))) {
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
    initializationMembers = [];
    parent = null;
    node;
    needsLink = null;
    byteSize = 0;
    deps = [];
    customJsonKind = "any";
    hasCustomCursorLifecycle = false;
    hasInternalInitializers = false;
    hasInitializerEffects = false;
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
        const requiredMembers = this.members.filter((member) => !member.flags.has(PropertyFlags.OmitIf) &&
            !member.flags.has(PropertyFlags.OmitNull));
        if (!requiredMembers.length)
            return 4;
        let minChars = 2;
        for (let i = 0; i < requiredMembers.length; i++) {
            const member = requiredMembers[i];
            const key = member.alias ?? member.name;
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
            if (genericStart !== -1 &&
                genericEnd !== -1 &&
                genericEnd > genericStart) {
                return this.getTypeMinChars(type.slice(genericStart + 1, genericEnd), visited);
            }
        }
        if (type.startsWith("Array<") ||
            type.startsWith("StaticArray<") ||
            type.startsWith("Set<"))
            return 2;
        if (type.startsWith("Map<"))
            return 2;
        if (type == "string" ||
            type == "String" ||
            type == "JSON.Raw" ||
            type == "Raw")
            return 2;
        if (type == "Date")
            return 26;
        if (type == "bool" || type == "boolean")
            return 4;
        if (Schema.isNumericType(type))
            return 1;
        if (type == "JSON.Obj" || type == "Obj")
            return 2;
        if (type == "JSON.Arr" || type == "Arr")
            return 2;
        if (type == "JSON.Value" || type == "Value")
            return 1;
        const dep = this.deps.find((schema) => schema.name === type || schema.name.endsWith("." + type));
        if (dep)
            return dep.getMinLength(visited) >> 1;
        if (this.parent &&
            (this.parent.name === type || this.parent.name.endsWith("." + type))) {
            return this.parent.getMinLength(visited) >> 1;
        }
        return 1;
    }
    static isNumericType(type) {
        return NUMERIC_TYPES.includes(type);
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
    exportStatements = [];
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
                case NodeKind.NamespaceDeclaration:
                    const namespaceDeclaration = node;
                    this.traverse(namespaceDeclaration.members, [
                        ...path,
                        namespaceDeclaration,
                    ]);
                    break;
                case NodeKind.ClassDeclaration:
                    const classDeclaration = node;
                    this.classes[this.qualifiedName(classDeclaration, path)] =
                        classDeclaration;
                    break;
                case NodeKind.EnumDeclaration:
                    const enumDeclaration = node;
                    this.enums[this.qualifiedName(enumDeclaration, path)] =
                        enumDeclaration;
                    break;
                case NodeKind.Export:
                    this.exportStatements.push(node);
                    break;
                case NodeKind.Import:
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
    getClassInContext(name, owner, visited = new Set()) {
        name = stripNull(name).replace(/<.*>$/, "").trim();
        const path = this.getQualifiedName(owner).split(".").slice(0, -1);
        for (let depth = path.length; depth >= 0; depth--) {
            const qualified = [...path.slice(0, depth), name].join(".");
            const declaration = this.getClass(qualified);
            if (declaration)
                return declaration;
            const alias = this.aliases.find((candidate) => candidate.name === qualified);
            if (alias?.declaration && !visited.has(alias.name)) {
                visited.add(alias.name);
                const target = this.getClassInContext(stripNull(alias.getBaseType()), alias.declaration, visited);
                if (target)
                    return target;
            }
        }
        return null;
    }
    registerAlias(alias, namespaces = []) {
        this.aliases.push(alias);
        if (alias.declaration)
            this.nodeMap.set(alias.declaration, namespaces);
    }
    getClasses() {
        return Object.values(this.classes);
    }
    getEnum(qualifiedName) {
        return this.enums[qualifiedName] || null;
    }
    getImportedClass(qualifiedName, parser, visited = new Set()) {
        const binding = this.getImportedBinding(qualifiedName, parser);
        if (!binding)
            return null;
        const identity = binding.source.internalPath + ":class:" + binding.name;
        if (visited.has(identity))
            return null;
        visited.add(identity);
        const direct = binding.source.getClass(binding.name);
        if (direct)
            return direct;
        const alias = binding.source.aliases.find((item) => item.name === binding.name);
        if (alias?.declaration) {
            const target = stripNull(alias.getBaseType());
            return (binding.source.getClassInContext(target, alias.declaration) ||
                binding.source.getImportedClass(target.replace(/<.*>$/, ""), parser, visited));
        }
        return null;
    }
    resolveClass(name, owner, parser, visited = new Set()) {
        const written = stripNull(name).trim();
        const named = SimpleParser.parseTopLevelStatement(`type __JSON_CLASS = ${written};`).type;
        const arguments_ = named.typeArguments ?? [];
        name = toString(named.name);
        const suppliedClass = (alias) => {
            const parameter = alias.parameters.indexOf(stripNull(typeof alias.type === "string" ? alias.type : ""));
            return parameter >= 0 && arguments_[parameter]
                ? this.resolveClass(toString(arguments_[parameter]), owner, parser, visited)
                : null;
        };
        const scope = this.getQualifiedName(owner).split(".").slice(0, -1);
        for (let depth = scope.length; depth >= 0; depth--) {
            const qualified = [...scope.slice(0, depth), name].join(".");
            const direct = this.getClass(qualified);
            if (direct)
                return direct;
            const alias = this.aliases.find((candidate) => candidate.name === qualified);
            if (alias?.declaration) {
                const identity = this.internalPath + ":codec:" + qualified;
                if (visited.has(identity))
                    return null;
                visited.add(identity);
                const supplied = suppliedClass(alias);
                if (supplied)
                    return supplied;
                return this.resolveClass(alias.getBaseType(arguments_), alias.declaration, parser, visited);
            }
        }
        const binding = this.getImportedBinding(name, parser);
        if (!binding)
            return null;
        const direct = binding.source.getClass(binding.name);
        if (direct)
            return direct;
        const alias = binding.source.aliases.find((candidate) => candidate.name === binding.name);
        if (!alias?.declaration)
            return null;
        const identity = binding.source.internalPath + ":codec:" + binding.name;
        if (visited.has(identity))
            return null;
        visited.add(identity);
        const supplied = suppliedClass(alias);
        if (supplied)
            return supplied;
        return binding.source.resolveClass(alias.getBaseType(arguments_), alias.declaration, parser, visited);
    }
    getImportedBinding(name, parser, visited = new Set()) {
        const parts = name.split(".");
        for (const statement of this.imports) {
            const declaration = statement.declarations?.find((item) => item.name.text === parts[0]);
            const namespace = statement.namespaceName?.text === parts[0];
            if (!declaration && !namespace)
                continue;
            const external = parser.sources.find((source) => source.internalPath === statement.internalPath ||
                source.internalPath === statement.internalPath + "/index");
            if (!external)
                continue;
            const target = declaration
                ? [declaration.foreignName.text, ...parts.slice(1)].join(".")
                : parts.slice(1).join(".");
            const result = this.sourceSet
                .get(external)
                .getExportedBinding(target, parser, visited);
            if (result)
                return result;
        }
        return null;
    }
    getExportedBinding(name, parser, visited) {
        const identity = this.internalPath + ":export:" + name;
        if (visited.has(identity))
            return null;
        visited.add(identity);
        const direct = this.getClass(name) ||
            this.getEnum(name) ||
            this.aliases.find((item) => item.name === name)?.declaration;
        if (direct && direct.flags & 2)
            return { source: this, name };
        for (const statement of this.exportStatements) {
            const member = statement.members?.find((item) => name === item.exportedName.text ||
                name.startsWith(item.exportedName.text + "."));
            if (statement.members && !member)
                continue;
            const local = member
                ? member.localName.text + name.slice(member.exportedName.text.length)
                : name;
            if (statement.path) {
                const external = parser.sources.find((source) => source.internalPath === statement.internalPath ||
                    source.internalPath === statement.internalPath + "/index");
                if (!external)
                    continue;
                const result = this.sourceSet
                    .get(external)
                    .getExportedBinding(local, parser, visited);
                if (result)
                    return result;
            }
            else {
                if (this.getClass(local) ||
                    this.getEnum(local) ||
                    this.aliases.some((item) => item.name === local))
                    return { source: this, name: local };
                const result = this.getImportedBinding(local, parser, visited);
                if (result)
                    return result;
            }
        }
        return null;
    }
    getAvailableClass(qualifiedName, parser) {
        for (const externalSource of parser.sources) {
            if (externalSource.internalPath == this.internalPath)
                continue;
            const source = this.sourceSet.get(externalSource);
            const classDeclaration = source.getClass(qualifiedName);
            if (classDeclaration &&
                (classDeclaration.flags & 2 ||
                    externalSource.internalPath.startsWith("~lib/"))) {
                return classDeclaration;
            }
        }
        return null;
    }
    getImportedEnum(name, parser, visited = new Set()) {
        const binding = this.getImportedBinding(name, parser);
        if (!binding)
            return null;
        const identity = binding.source.internalPath + ":enum:" + binding.name;
        if (visited.has(identity))
            return null;
        visited.add(identity);
        const direct = binding.source.getEnum(binding.name);
        if (direct)
            return direct;
        const alias = binding.source.aliases.find((item) => item.name === binding.name);
        if (!alias)
            return null;
        const target = stripNull(alias.getBaseType());
        return (binding.source.getEnum(target) ||
            binding.source.getImportedEnum(target, parser, visited));
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
        return parents?.length
            ? parents.map((p) => p.name.text).join(".") + "." + node.name.text
            : node.name.text;
    }
    getNamespaceOrClassName(node) {
        switch (node.kind) {
            case NodeKind.NamespaceDeclaration:
                return node.name.text;
            case NodeKind.ClassDeclaration:
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
