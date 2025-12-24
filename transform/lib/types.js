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
    schemas;
    aliases;
    exports;
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
        for (let node of nodes) {
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
            for (let node of parent.members) {
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
        let names = [];
        while (typeName) {
            names.push(typeName.identifier.text);
            typeName = typeName.next;
        }
        return names.join(".");
    }
}
//# sourceMappingURL=types.js.map