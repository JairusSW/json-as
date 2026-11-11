// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { Node, } from "assemblyscript/dist/assemblyscript.js";
import { NodeKind } from "./types.js";
import { Visitor } from "./visitor.js";
export function accessProbability(paths) {
    let budget = 4096;
    const union = (paths) => {
        if (!paths.length)
            return 0;
        if (paths.some((path) => !path.size))
            return 1;
        if (--budget <= 0)
            return Math.max(...paths.map((path) => 2 ** -path.size));
        const branch = paths[0].keys().next().value;
        const split = (outcome) => paths.flatMap((path) => {
            if (path.has(branch) && path.get(branch) !== outcome)
                return [];
            const next = new Map(path);
            next.delete(branch);
            return [next];
        });
        return (union(split(false)) + union(split(true))) / 2;
    };
    return union(paths);
}
export function materializationDecision(paths, decodeCost, origin = [new Map()]) {
    const reach = accessProbability(origin);
    const probability = reach ? Math.min(1, accessProbability(paths) / reach) : 0;
    const expectedReads = reach
        ? paths.reduce((sum, path) => sum + 2 ** -path.size, 0) / reach
        : 0;
    const eagerCost = decodeCost + expectedReads * 0.25;
    const lazyCost = probability * (decodeCost + 4) + expectedReads * 0.5;
    return {
        probability,
        expectedReads,
        decodeCost,
        eagerCost,
        lazyCost,
        eager: probability === 1 || lazyCost > eagerCost,
    };
}
export class StrategicAccessAnalysis extends Visitor {
    resolveParse;
    resolveChild;
    conservativeEscapes;
    sites = [];
    scopes = [];
    paths = [new Map()];
    exits = [];
    branch = 0;
    terminated = false;
    namespace = [];
    thisSite = null;
    callableNamespaces = new WeakMap();
    declarations = new WeakMap();
    captures = new WeakMap();
    expanding = new Set();
    byCall = new WeakMap();
    constructor(resolveParse, resolveChild = () => null, conservativeEscapes = false) {
        super();
        this.resolveParse = resolveParse;
        this.resolveChild = resolveChild;
        this.conservativeEscapes = conservativeEscapes;
    }
    binding(name) {
        for (let i = this.scopes.length - 1; i >= 0; i--)
            if (this.scopes[i].has(name))
                return this.scopes[i].get(name);
        return null;
    }
    shadowed = (name) => this.scopes.some((scope) => scope.has(name));
    names(statements) {
        const names = new Map();
        for (let node of statements) {
            if (node.kind === NodeKind.ExportDefault)
                node = node.declaration;
            if (node.kind === NodeKind.Variable) {
                for (const declaration of node.declarations)
                    names.set(declaration.name.text, null);
            }
            else if ([
                NodeKind.ClassDeclaration,
                NodeKind.FunctionDeclaration,
                NodeKind.EnumDeclaration,
                NodeKind.NamespaceDeclaration,
            ].includes(node.kind)) {
                const name = node.name;
                if (name?.text)
                    names.set(name.text, null);
            }
        }
        return names;
    }
    visitSource(node) {
        const saved = [
            this.scopes,
            this.paths,
            this.terminated,
            this.thisSite,
            this.namespace,
        ];
        this.scopes = [this.names(node.statements)];
        this.registerFunctions(node.statements, this.scopes[0]);
        this.paths = [new Map()];
        this.thisSite = null;
        this.terminated = false;
        super.visitSource(node);
        [this.scopes, this.paths, this.terminated, this.thisSite, this.namespace] =
            saved;
    }
    origin(node) {
        if (!node)
            return null;
        if (node.kind === NodeKind.This)
            return this.thisSite;
        if (node.kind === NodeKind.Identifier)
            return this.binding(node.text);
        if (node.kind === NodeKind.PropertyAccess) {
            const property = node;
            const parent = this.origin(property.expression);
            if (!parent || parent.call.args.length !== 1)
                return null;
            const name = property.property.text;
            const existing = parent.children.get(name);
            if (existing)
                return existing;
            const declaration = this.resolveChild(parent.declaration, name);
            if (!declaration)
                return null;
            const child = {
                call: parent.call,
                source: parent.source,
                declaration,
                origin: parent.origin,
                accesses: new Map(),
                writes: new Set(),
                escaped: false,
                children: new Map(),
            };
            parent.children.set(name, child);
            return child;
        }
        if (node.kind === NodeKind.Parenthesized ||
            node.kind === NodeKind.Assertion)
            return this.origin(node.expression);
        if (node.kind === NodeKind.Ternary) {
            const expression = node;
            const known = this.conditionValue(expression.condition);
            return known === null
                ? null
                : this.origin(known ? expression.ifThen : expression.ifElse);
        }
        if (node.kind === NodeKind.Call) {
            const call = node;
            if (this.expanding.size)
                return null;
            const existing = this.byCall.get(call);
            if (existing)
                return existing;
            const declaration = this.resolveParse(call, this.shadowed, this.namespace.join("."));
            if (!declaration)
                return null;
            const site = {
                call,
                source: call.range.source,
                declaration,
                origin: this.paths,
                accesses: new Map(),
                writes: new Set(),
                escaped: false,
                children: new Map(),
            };
            this.sites.push(site);
            this.byCall.set(call, site);
            return site;
        }
        return null;
    }
    read(node) {
        const site = this.origin(node.expression);
        if (!site)
            return;
        const name = node.property.text;
        const paths = site.accesses.get(name) ?? [];
        for (const current of this.paths) {
            for (const origin of site.origin) {
                if ([...origin].some(([branch, outcome]) => current.has(branch) && current.get(branch) !== outcome))
                    continue;
                paths.push(new Map([...origin, ...current]));
            }
        }
        site.accesses.set(name, paths);
    }
    visitPropertyAccessExpression(node) {
        this.read(node);
        super.visitPropertyAccessExpression(node);
    }
    visitVariableDeclaration(node) {
        const site = this.origin(node.initializer);
        this.visit(node.initializer);
        this.scopes.at(-1)?.set(node.name.text, site);
    }
    visitBlockStatement(node) {
        const scope = this.names(node.statements);
        this.scopes.push(scope);
        this.registerFunctions(node.statements, scope);
        for (const statement of node.statements) {
            if (this.terminated)
                break;
            this.visit(statement);
        }
        this.scopes.pop();
    }
    registerFunctions(statements, scope) {
        const declarations = new Map();
        for (let statement of statements) {
            if (statement.kind === NodeKind.Expression) {
                const expression = statement
                    .expression;
                if (expression.kind === NodeKind.Function)
                    statement = expression.declaration;
            }
            if (statement.kind !== NodeKind.FunctionDeclaration)
                continue;
            const fn = statement;
            if (!fn.name?.text)
                continue;
            scope.set(fn.name.text, null);
            declarations.set(fn.name.text, fn);
            this.captures.set(fn, [...this.scopes]);
            this.callableNamespaces.set(fn, [...this.namespace]);
        }
        this.declarations.set(scope, declarations);
    }
    visitCallExpression(node) {
        super.visitCallExpression(node);
        let fn;
        let receiver = null;
        if (node.expression.kind === NodeKind.Identifier) {
            const name = node.expression.text;
            for (let i = this.scopes.length - 1; i >= 0; i--) {
                if (!this.scopes[i].has(name))
                    continue;
                fn = this.declarations.get(this.scopes[i])?.get(name);
                break;
            }
        }
        else if (node.expression.kind === NodeKind.PropertyAccess) {
            const method = node.expression;
            receiver = this.origin(method.expression);
            if (receiver && receiver.call.args.length === 1) {
                fn = receiver.declaration.members.find((member) => member.kind === NodeKind.MethodDeclaration &&
                    member.name.text === method.property.text);
            }
        }
        const args = node.args.map((arg) => this.origin(arg));
        if (!fn?.body || this.expanding.has(fn) || this.expanding.size >= 8) {
            const intrinsic = node.expression.kind === NodeKind.Identifier && [
                "unchecked", "idof", "offsetof", "sizeof", "nameof",
                "isDefined", "isReference", "isManaged", "isInteger", "isFloat",
                "isString", "isBoolean", "isNullable",
                ...(!this.conservativeEscapes ? ["changetype", "reinterpret"] : []),
            ].includes(node.expression.text);
            if (!intrinsic) {
                if (receiver)
                    receiver.escaped = true;
                for (const arg of args)
                    if (arg)
                        arg.escaped = true;
            }
            return;
        }
        if (!receiver && !args.some(Boolean))
            return;
        const saved = [
            this.scopes,
            this.paths,
            this.terminated,
            this.thisSite,
            this.namespace,
        ];
        this.scopes = [
            ...(this.captures.get(fn) || []),
            new Map(fn.signature.parameters.map((p, i) => [
                p.name.text,
                args[i] || null,
            ])),
        ];
        this.thisSite = receiver;
        this.namespace = this.callableNamespaces.get(fn) || [];
        this.terminated = false;
        this.expanding.add(fn);
        this.visit(fn.body);
        this.expanding.delete(fn);
        [this.scopes, this.paths, this.terminated, this.thisSite, this.namespace] =
            saved;
    }
    callable(node) {
        const binding = (name) => this.binding(name);
        class MarkCaptures extends Visitor {
            visitIdentifierExpression(identifier) {
                const site = binding(identifier.text);
                if (site)
                    site.escaped = true;
            }
        }
        if (this.conservativeEscapes && node.body)
            new MarkCaptures().visit(node.body);
        const saved = [
            this.scopes,
            this.paths,
            this.terminated,
            this.thisSite,
            this.namespace,
        ];
        this.scopes = [
            ...this.scopes.map((scope) => {
                const copy = new Map([...scope.keys()].map((name) => [
                    name,
                    null,
                ]));
                this.declarations.set(copy, this.declarations.get(scope) || new Map());
                return copy;
            }),
            new Map(node.signature.parameters.map((p) => [
                p.name.text,
                null,
            ])),
        ];
        this.paths = [new Map()];
        this.thisSite = null;
        this.terminated = false;
        this.visit(node.body);
        [this.scopes, this.paths, this.terminated, this.thisSite, this.namespace] =
            saved;
    }
    visitNamespaceDeclaration(node) {
        this.namespace.push(node.name.text);
        const scope = this.names(node.members);
        this.scopes.push(scope);
        this.registerFunctions(node.members, scope);
        super.visitNamespaceDeclaration(node);
        this.scopes.pop();
        this.namespace.pop();
    }
    visitFunctionDeclaration(node) {
        this.callable(node);
    }
    visitMethodDeclaration(node) {
        this.captures.set(node, [...this.scopes]);
        this.callableNamespaces.set(node, [...this.namespace]);
        this.callable(node);
    }
    visitReturnStatement(node) {
        const value = node.value;
        if (this.conservativeEscapes) {
            const site = this.origin(value);
            if (site)
                site.escaped = true;
        }
        this.visit(value);
        this.paths = [];
        this.terminated = true;
    }
    visitThrowStatement(node) {
        const value = node.value;
        if (this.conservativeEscapes) {
            const site = this.origin(value);
            if (site)
                site.escaped = true;
        }
        this.visit(value);
        this.paths = [];
        this.terminated = true;
    }
    visitBreakStatement() {
        this.exits.at(-1)?.breaks.push(...this.paths);
        this.paths = [];
        this.terminated = true;
    }
    visitContinueStatement() {
        [...this.exits]
            .reverse()
            .find((exit) => exit.loop)
            ?.continues.push(...this.paths);
        this.paths = [];
        this.terminated = true;
    }
    fork(node, branch, outcome) {
        const saved = this.paths;
        this.paths = saved.map((path) => new Map(path).set(branch, outcome));
        this.terminated = false;
        this.visit(node);
        const remaining = this.paths;
        this.paths = saved;
        return remaining;
    }
    merge(paths) {
        const result = [];
        for (let path of paths) {
            if (result.some((existing) => [...existing].every(([key, value]) => path.get(key) === value)))
                continue;
            let joined = true;
            while (joined) {
                joined = false;
                for (let i = 0; i < result.length; i++) {
                    const existing = result[i];
                    if (existing.size !== path.size)
                        continue;
                    const differences = [...path].filter(([key, value]) => existing.get(key) !== value);
                    if (differences.length !== 1 || !existing.has(differences[0][0]))
                        continue;
                    const copy = new Map(path);
                    copy.delete(differences[0][0]);
                    path = copy;
                    result.splice(i, 1);
                    joined = true;
                    break;
                }
            }
            result.push(path);
        }
        return result;
    }
    conditionValue(node) {
        if (node.kind === NodeKind.True)
            return true;
        if (node.kind === NodeKind.False)
            return false;
        if (node.kind === NodeKind.Parenthesized ||
            node.kind === NodeKind.Assertion)
            return this.conditionValue(node.expression);
        if (node.kind === NodeKind.UnaryPrefix) {
            const expression = node;
            if (expression.operator === 95) {
                const value = this.conditionValue(expression.operand);
                return value === null ? null : !value;
            }
        }
        if (node.kind === NodeKind.Binary) {
            const expression = node;
            const left = this.conditionValue(expression.left);
            const right = this.conditionValue(expression.right);
            if (expression.operator === 97)
                return left === false || right === false
                    ? false
                    : left === true
                        ? right
                        : null;
            if (expression.operator === 98)
                return left === true || right === true
                    ? true
                    : left === false
                        ? right
                        : null;
        }
        if (node.kind === NodeKind.Ternary) {
            const expression = node;
            const known = this.conditionValue(expression.condition);
            if (known !== null)
                return this.conditionValue(known ? expression.ifThen : expression.ifElse);
        }
        return null;
    }
    visitIfStatement(node) {
        this.visit(node.condition);
        const known = this.conditionValue(node.condition);
        if (known !== null) {
            this.visit(known ? node.ifTrue : node.ifFalse);
            return;
        }
        const branch = this.branch++;
        const left = this.fork(node.ifTrue, branch, true);
        const right = this.fork(node.ifFalse, branch, false);
        this.paths = this.merge([...left, ...right]);
        this.terminated = !this.paths.length;
    }
    visitTernaryExpression(node) {
        this.visit(node.condition);
        const known = this.conditionValue(node.condition);
        if (known !== null) {
            this.visit(known ? node.ifThen : node.ifElse);
            return;
        }
        const branch = this.branch++;
        const left = this.fork(node.ifThen, branch, true);
        const right = this.fork(node.ifElse, branch, false);
        this.paths = this.merge([...left, ...right]);
        this.terminated = !this.paths.length;
    }
    visitNewExpression(node) {
        super.visitNewExpression(node);
        for (const argument of node.args) {
            const site = this.origin(argument);
            if (site)
                site.escaped = true;
        }
    }
    visitArrayLiteralExpression(node) {
        if (this.conservativeEscapes)
            for (const element of node.elementExpressions) {
                const site = this.origin(element);
                if (site)
                    site.escaped = true;
            }
        super.visitArrayLiteralExpression(node);
    }
    visitObjectLiteralExpression(node) {
        if (this.conservativeEscapes)
            for (const value of node.values) {
                const site = this.origin(value);
                if (site)
                    site.escaped = true;
            }
        super.visitObjectLiteralExpression(node);
    }
    recordWrite(target) {
        if (target.kind === NodeKind.PropertyAccess) {
            const property = target;
            const owner = this.origin(property.expression);
            if (owner)
                owner.writes.add(property.property.text);
        }
    }
    visitUnaryPrefixExpression(node) {
        if (node.operator === 87 || node.operator === 88)
            this.recordWrite(node.operand);
        super.visitUnaryPrefixExpression(node);
    }
    visitUnaryPostfixExpression(node) {
        if (node.operator === 87 || node.operator === 88)
            this.recordWrite(node.operand);
        super.visitUnaryPostfixExpression(node);
    }
    visitBinaryExpression(node) {
        if (node.operator >= 101 && node.operator <= 113)
            this.recordWrite(node.left);
        if (node.operator === 101) {
            const site = this.origin(node.right);
            this.visit(node.right);
            if (node.left.kind === NodeKind.Identifier) {
                const name = node.left.text;
                const sameContext = site &&
                    site.origin.length === this.paths.length &&
                    site.origin.every((origin) => this.paths.some((path) => path.size === origin.size &&
                        [...origin].every(([key, value]) => path.get(key) === value)));
                const assigned = accessProbability(this.paths) === 1 || sameContext ? site : null;
                let found = false;
                for (let i = this.scopes.length - 1; i >= 0; i--)
                    if (this.scopes[i].has(name)) {
                        found = true;
                        if (this.conservativeEscapes && (i === 0 || !assigned)) {
                            if (site)
                                site.escaped = true;
                            const previous = this.scopes[i].get(name);
                            if (previous)
                                previous.escaped = true;
                        }
                        this.scopes[i].set(name, assigned);
                        break;
                    }
                if (this.conservativeEscapes && !found && site)
                    site.escaped = true;
            }
            else if (node.left.kind === NodeKind.PropertyAccess) {
                if (this.conservativeEscapes && site)
                    site.escaped = true;
                this.visit(node.left.expression);
            }
            else {
                if (this.conservativeEscapes && site)
                    site.escaped = true;
                this.visit(node.left);
            }
            return;
        }
        this.visit(node.left);
        if (node.operator === 97 ||
            node.operator === 98) {
            const known = this.conditionValue(node.left);
            if (known !== null) {
                if (known === (node.operator === 97))
                    this.visit(node.right);
                return;
            }
            const saved = this.paths;
            let left = node.left;
            while (left.kind === NodeKind.Binary &&
                left.operator === node.operator) {
                const branch = this.branch++;
                this.paths = this.paths.map((path) => new Map(path).set(branch, true));
                left = left.left;
            }
            this.fork(node.right, this.branch++, true);
            this.paths = saved;
            this.terminated = false;
        }
        else
            this.visit(node.right);
    }
    loop(node, incrementor = null, mandatory = false, infinite = false) {
        const before = this.paths;
        const branch = this.branch++;
        const exit = {
            breaks: [],
            continues: [],
            loop: true,
        };
        this.exits.push(exit);
        let remaining;
        if (mandatory) {
            this.visit(node);
            remaining = this.paths;
        }
        else
            remaining = this.fork(node, branch, true);
        this.paths = this.merge([...remaining, ...exit.continues]);
        this.terminated = !this.paths.length;
        this.visit(incrementor);
        this.exits.pop();
        this.paths = this.merge([
            ...(infinite ? [] : this.paths),
            ...exit.breaks,
            ...(mandatory
                ? []
                : before.map((path) => new Map(path).set(branch, false))),
        ]);
        this.terminated = !this.paths.length;
    }
    visitWhileStatement(node) {
        this.visit(node.condition);
        const known = this.conditionValue(node.condition);
        if (known !== false)
            this.loop(node.body, null, known === true, known === true);
    }
    visitForStatement(node) {
        this.scopes.push(new Map());
        this.visit(node.initializer);
        this.visit(node.condition);
        const known = node.condition ? this.conditionValue(node.condition) : true;
        if (known !== false)
            this.loop(node.body, node.incrementor, known === true, known === true);
        this.scopes.pop();
    }
    visitDoStatement(node) {
        this.loop(node.body, node.condition, true, this.conditionValue(node.condition) === true);
    }
    visitForOfStatement(node) {
        this.scopes.push(new Map());
        this.visit(node.variable);
        this.visit(node.iterable);
        this.loop(node.body);
        this.scopes.pop();
    }
    visitSwitchStatement(node) {
        this.visit(node.condition);
        let unmatched = this.paths;
        let fallthrough = [];
        const selections = [];
        let defaultIndex = -1;
        for (let i = 0; i < node.cases.length; i++) {
            const arm = node.cases[i];
            if (!arm.label) {
                defaultIndex = i;
                selections.push([]);
                continue;
            }
            this.paths = unmatched;
            this.visit(arm.label);
            const branch = this.branch++;
            selections.push(unmatched.map((path) => new Map(path).set(branch, true)));
            unmatched = unmatched.map((path) => new Map(path).set(branch, false));
        }
        if (defaultIndex >= 0) {
            selections[defaultIndex] = unmatched;
            unmatched = [];
        }
        const exit = {
            breaks: [],
            continues: [],
            loop: false,
        };
        this.exits.push(exit);
        for (let i = 0; i < node.cases.length; i++) {
            this.paths = this.merge([...selections[i], ...fallthrough]);
            this.terminated = !this.paths.length;
            this.visit(Node.createBlockStatement(node.cases[i].statements, node.cases[i].range));
            fallthrough = this.paths;
        }
        this.exits.pop();
        this.paths = this.merge([...unmatched, ...fallthrough, ...exit.breaks]);
        this.terminated = !this.paths.length;
    }
    visitTryStatement(node) {
        const before = this.paths;
        const branch = this.branch++;
        const block = (statements) => statements ? Node.createBlockStatement(statements, node.range) : null;
        const body = this.fork(block(node.bodyStatements), branch, true);
        this.scopes.push(new Map(node.catchVariable ? [[node.catchVariable.text, null]] : []));
        const caught = node.catchStatements
            ? this.fork(block(node.catchStatements), branch, false)
            : [];
        this.scopes.pop();
        const remaining = this.merge([...body, ...caught]);
        this.paths = before;
        this.terminated = false;
        this.visit(block(node.finallyStatements));
        this.paths = this.paths.length ? remaining : [];
        this.terminated = !this.paths.length;
    }
}
