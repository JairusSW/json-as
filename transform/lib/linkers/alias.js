// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { Visitor } from "../visitor.js";
import { toString, cloneNode, SimpleParser } from "../util.js";
export function effectiveTypeArguments(parameters, supplied = []) {
    if (supplied.length > (parameters?.length ?? 0))
        return null;
    const result = supplied.map((argument) => cloneNode(argument));
    const bindings = new Map();
    class Substitute extends Visitor {
        visitNamedTypeNode(type) {
            const value = bindings.get(toString(type.name));
            if (value) {
                const nullable = type.isNullable;
                Object.assign(type, cloneNode(value));
                type.isNullable ||= nullable;
            }
            else
                super.visitNamedTypeNode(type);
        }
    }
    const substitute = new Substitute();
    for (let i = 0; i < (parameters?.length ?? 0); i++) {
        const parameter = parameters[i];
        if (!result[i]) {
            if (!parameter.defaultType)
                return null;
            const value = cloneNode(parameter.defaultType);
            substitute.visit(value);
            result.push(value);
        }
        bindings.set(parameter.name.text, result[i]);
    }
    return result;
}
class AliasFinder extends Visitor {
    namespace = [];
    visitFunctionDeclaration(_node) { }
    visitMethodDeclaration(_node) { }
    visitFunctionExpression(_node) { }
    visitBlockStatement(_node) { }
    visitNamespaceDeclaration(node) {
        this.namespace.push(node.name.text);
        super.visitNamespaceDeclaration(node);
        this.namespace.pop();
    }
    visitTypeDeclaration(node, _ref) {
        TypeAlias.add([...this.namespace, node.name.text].join("."), node.type, node.typeParameters, node);
    }
}
export class TypeAlias {
    name;
    type;
    constructor(name, type) {
        this.name = name;
        this.type = type;
    }
    parameters = [];
    declaration = null;
    arguments(supplied = []) {
        return this.declaration
            ? effectiveTypeArguments(this.declaration.typeParameters, supplied)
            : supplied.length === this.parameters.length
                ? supplied
                : null;
    }
    getBaseType(arguments_ = []) {
        arguments_ = this.arguments(arguments_) ?? arguments_;
        const text = typeof this.type === "string" ? this.type : this.type.getBaseType();
        if (!this.parameters.length)
            return text;
        const declaration = SimpleParser.parseTopLevelStatement(`type __JSON_ALIAS = ${text};`);
        const bindings = new Map(this.parameters.map((name, i) => [name, arguments_[i]]));
        class InstantiateAlias extends Visitor {
            visitNamedTypeNode(type) {
                const argument = bindings.get(toString(type.name));
                if (argument) {
                    const nullable = type.isNullable;
                    Object.assign(type, cloneNode(argument));
                    type.isNullable ||= nullable;
                }
                else
                    super.visitNamedTypeNode(type);
            }
        }
        new InstantiateAlias().visit(declaration.type);
        return toString(declaration.type);
    }
    static foundAliases = new Map();
    static parameters = new Map();
    static declarations = new Map();
    static aliases = new Map();
    static add(name, type, parameters = null, declaration = null) {
        if (declaration)
            this.declarations.set(name, declaration);
        this.parameters.set(name, parameters?.map((parameter) => parameter.name.text) ?? []);
        if (!TypeAlias.foundAliases.has(name)) {
            TypeAlias.foundAliases.set(name, toString(type));
        }
        else {
            const existingType = TypeAlias.foundAliases.get(name);
            if (existingType !== toString(type)) {
                throw new Error(`Type alias conflict for ${name}: "${existingType}" vs "${toString(type)}"`);
            }
        }
    }
    static getAliases(source) {
        this.foundAliases.clear();
        this.parameters.clear();
        this.declarations.clear();
        this.aliases.clear();
        const finder = new AliasFinder();
        finder.visit(source);
        for (const [name, typeStr] of this.foundAliases) {
            const alias = new TypeAlias(name, typeStr);
            alias.parameters = this.parameters.get(name) ?? [];
            alias.declaration = this.declarations.get(name) ?? null;
            this.aliases.set(name, alias);
        }
        return [...this.aliases.values()];
    }
}
