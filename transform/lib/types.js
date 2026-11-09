// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { NUMERIC_TYPES } from "./scalars.js";
import { TypeAlias } from "./linkers/alias.js";
import { stripNull } from "./index.js";
import { SimpleParser, toString } from "./util.js";
import * as asc from "assemblyscript/dist/assemblyscript.js";
export const NodeKind = asc
    .NodeKind;
export function typeMeaningText(type) {
    return (type.name +
        (type.arguments.length
            ? "<" + type.arguments.map(typeMeaningText).join(", ") + ">"
            : "") +
        (type.nullable ? " | null" : ""));
}
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
    builtinDate = false;
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
            if (this.name == dep.name && dep.customReader) {
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
    ownCustomReader = false;
    ownCustomWriter = false;
    fastReader = false;
    generatedFastReader = false;
    get customReader() {
        return this.ownCustomReader || !!this.parent?.customReader;
    }
    get customWriter() {
        return this.ownCustomWriter || !!this.parent?.customWriter;
    }
    hasCustomCursorLifecycle = false;
    hasCustomReaderLifecycle = false;
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
    defaultDeclaration = null;
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
                case NodeKind.ExportDefault: {
                    const declaration = node.declaration;
                    this.defaultDeclaration = declaration;
                    this.traverse([declaration], path);
                    break;
                }
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
    getNamespaces(node) {
        return this.nodeMap.get(node) ?? [];
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
    classTypeParameters(owner) {
        const result = new Map();
        if (owner.kind === NodeKind.ClassDeclaration)
            for (const parameter of owner.typeParameters ??
                []) {
                const type = SimpleParser.parseTopLevelStatement(`type __JSON_PARAMETER = ${parameter.name.text};`).type;
                result.set(parameter.name.text, {
                    type,
                    source: this,
                    scope: "",
                    opaque: true,
                });
            }
        return result;
    }
    resolveTypeMeaning(text, scope, parser, supplied = new Map(), preserveAlias) {
        const empty = new Map();
        const parameters = new Map();
        for (const [name, argument] of supplied)
            parameters.set(name, {
                ...argument,
                parameters: argument.owner
                    ? new Map([...argument.source.classTypeParameters(argument.owner)].map(([name, value]) => [
                        name,
                        {
                            ...value,
                            parameters: empty,
                            trail: new Set(),
                        },
                    ]))
                    : empty,
                trail: new Set(),
            });
        const parse = (value) => SimpleParser.parseTopLevelStatement(`type __JSON_MEANING = ${value};`).type;
        const resolve = (use, depth = 0) => {
            const node = use.type;
            const name = node.kind === NodeKind.NamedType ? toString(node.name) : toString(node);
            const plain = () => ({
                name,
                nullable: !!node.isNullable,
                arguments: [],
                source: use.source,
                declaration: null,
            });
            if (use.opaque || depth > 128 || node.kind !== NodeKind.NamedType)
                return plain();
            const parameter = use.parameters.get(name);
            const nullable = (result) => node.isNullable && !result.nullable
                ? { ...result, nullable: true }
                : result;
            if (parameter)
                return nullable(resolve(parameter, depth + 1));
            let owner = use.source;
            let alias;
            let declaration = null;
            const parts = use.scope ? use.scope.split(".") : [];
            for (let length = parts.length; length >= 0; length--) {
                const qualified = [...parts.slice(0, length), name].join(".");
                declaration = owner.getClass(qualified) || owner.getEnum(qualified);
                alias = owner.aliases.find((candidate) => candidate.name === qualified);
                if (declaration || alias)
                    break;
            }
            if (!declaration && !alias) {
                const binding = owner.getImportedBinding(name, parser);
                if (binding) {
                    owner = binding.source;
                    alias = owner.aliases.find((candidate) => candidate.name === binding.name);
                    declaration =
                        owner.getClass(binding.name) || owner.getEnum(binding.name);
                }
            }
            const arguments_ = (node.typeArguments ?? []).map((type) => ({
                ...use,
                type,
            }));
            if (alias?.declaration && preserveAlias?.(alias, owner)) {
                return {
                    name: alias.name,
                    nullable: !!node.isNullable,
                    arguments: arguments_.map((argument) => resolve(argument, depth + 1)),
                    source: owner,
                    declaration: null,
                };
            }
            if (alias?.declaration) {
                if (use.trail.has(alias.declaration) ||
                    arguments_.length > alias.parameters.length)
                    return plain();
                const environment = new Map();
                const aliasScope = alias.name.split(".").slice(0, -1).join(".");
                const trail = new Set(use.trail).add(alias.declaration);
                for (let i = 0; i < alias.parameters.length; i++) {
                    let argument = arguments_[i];
                    if (!argument) {
                        const fallback = alias.declaration.typeParameters?.[i]?.defaultType;
                        if (!fallback)
                            return plain();
                        argument = {
                            type: fallback,
                            source: owner,
                            scope: aliasScope,
                            parameters: new Map(environment),
                            trail,
                        };
                    }
                    environment.set(alias.parameters[i], argument);
                }
                return nullable(resolve({
                    type: alias.declaration.type,
                    source: owner,
                    scope: aliasScope,
                    parameters: environment,
                    trail,
                }, depth + 1));
            }
            return {
                name: declaration ? owner.getQualifiedName(declaration) : name,
                nullable: !!node.isNullable,
                arguments: arguments_.map((argument) => resolve(argument, depth + 1)),
                source: owner,
                declaration,
            };
        };
        return resolve({
            type: parse(text),
            source: this,
            scope,
            parameters,
            trail: new Set(),
        });
    }
    resolveClass(name, owner, parser) {
        const meaning = this.resolveTypeMeaning(name, this.getQualifiedName(owner).split(".").slice(0, -1).join("."), parser, this.classTypeParameters(owner));
        return meaning.declaration?.kind === NodeKind.ClassDeclaration
            ? meaning.declaration
            : null;
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
        if (name === "default" && this.defaultDeclaration)
            return {
                source: this,
                name: this.getQualifiedName(this.defaultDeclaration),
            };
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
