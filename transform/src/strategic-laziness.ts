// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import {
  BinaryExpression,
  ArrayLiteralExpression,
  BlockStatement,
  CallExpression,
  ClassDeclaration,
  FunctionDeclaration,
  IdentifierExpression,
  IfStatement,
  MethodDeclaration,
  Node,
  PropertyAccessExpression,
  Source,
  TernaryExpression,
  UnaryPrefixExpression,
  UnaryPostfixExpression,
  NewExpression,
  ObjectLiteralExpression,
  Token,
  VariableDeclaration,
  NamespaceDeclaration,
  WhileStatement,
  ForStatement,
  DoStatement,
  ForOfStatement,
  SwitchStatement,
  TryStatement,
  Statement,
  CommonFlags,
  ParameterKind,
} from "assemblyscript/dist/assemblyscript.js";
import { NodeKind } from "./types.js";
import { Visitor } from "./visitor.js";

/** Synthetic branch outcomes, not measured probabilities. Each edge weighs 1/2. */
export type AccessPath = ReadonlyMap<number, boolean>;

/** Probability of the union of paths. Repeated reads on one path count once. */
export function accessProbability(paths: AccessPath[]): number {
  let budget = 4096;
  const union = (paths: AccessPath[]): number => {
    if (!paths.length) return 0;
    if (paths.some((path) => !path.size)) return 1;
    // Keep compilation bounded for enormous control-flow graphs. This lower
    // bound may retain extra laziness, but never invents a guaranteed read.
    if (--budget <= 0) return Math.max(...paths.map((path) => 2 ** -path.size));
    const branch = paths[0].keys().next().value!;
    const split = (outcome: boolean): AccessPath[] =>
      paths.flatMap((path) => {
        if (path.has(branch) && path.get(branch) !== outcome) return [];
        const next = new Map(path);
        next.delete(branch);
        return [next];
      });
    return (union(split(false)) + union(split(true))) / 2;
  };
  return union(paths);
}

export interface AccessDecision {
  probability: number;
  expectedReads: number;
  decodeCost: number;
  eagerCost: number;
  lazyCost: number;
  eager: boolean;
}

/** Relative work units, deliberately inspectable rather than CPU-time claims. */
export function materializationDecision(
  paths: AccessPath[],
  decodeCost: number,
  origin: AccessPath[] = [new Map()],
): AccessDecision {
  const reach = accessProbability(origin);
  const probability = reach ? Math.min(1, accessProbability(paths) / reach) : 0;
  const expectedReads = reach
    ? paths.reduce((sum, path) => sum + 2 ** -path.size, 0) / reach
    : 0;
  // A deferred first read dispatches and decodes its saved range. Subsequent
  // reads still test the lazy slot; eager parsing avoids the first-read work.
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

export interface StrategicSite {
  call: CallExpression;
  source: Source;
  declaration: ClassDeclaration;
  origin: AccessPath[];
  accesses: Map<string, AccessPath[]>;
  writes: Set<string>;
  escaped: boolean;
  children: Map<string, StrategicSite>;
}

type Callable = FunctionDeclaration | MethodDeclaration;

/** Analyze original application ASTs before lazy lowering introduces getters. */
export class StrategicAccessAnalysis extends Visitor {
  private pathLimitReached = false;
  private callableSiteStart = 0;
  readonly sites: StrategicSite[] = [];
  private scopes: Map<string, StrategicSite | null>[] = [];
  private paths: AccessPath[] = [new Map()];
  private exits: {
    breaks: AccessPath[];
    continues: AccessPath[];
    loop: boolean;
  }[] = [];
  private branch = 0;
  private terminated = false;
  private namespace: string[] = [];
  private callableDepth = 0;
  private callableScopeStart = 0;
  private varBindings = new Set<string>();
  private varBindingCache = new WeakMap<Node, Set<string>>();
  private thisSite: StrategicSite | null = null;
  private callableNamespaces = new WeakMap<Callable, string[]>();
  private declarations = new WeakMap<
    Map<string, StrategicSite | null>,
    Map<string, FunctionDeclaration>
  >();
  private captures = new WeakMap<
    Callable,
    Map<string, StrategicSite | null>[]
  >();
  private expanding = new Set<Callable>();
  private byCall = new WeakMap<CallExpression, StrategicSite>();

  constructor(
    private resolveParse: (
      call: CallExpression,
      shadowed: (name: string) => boolean,
      scope: string,
    ) => ClassDeclaration | null,
    private resolveChild: (
      owner: ClassDeclaration,
      property: string,
    ) => ClassDeclaration | null = () => null,
    private conservativeEscapes = false,
  ) {
    super();
  }

  private binding(name: string): StrategicSite | null {
    for (let i = this.scopes.length - 1; i >= 0; i--)
      if (this.scopes[i].has(name)) return this.scopes[i].get(name)!;
    return null;
  }

  private shadowed = (name: string): boolean =>
    this.scopes.some((scope) => scope.has(name));

  private names(statements: Node[]): Map<string, StrategicSite | null> {
    const names = new Map<string, StrategicSite | null>();
    for (let node of statements) {
      if (node.kind === NodeKind.ExportDefault)
        node = (node as unknown as { declaration: Node }).declaration;
      if (node.kind === NodeKind.Variable) {
        for (const declaration of (
          node as unknown as { declarations: VariableDeclaration[] }
        ).declarations)
          names.set(declaration.name.text, null);
      } else if (
        [
          NodeKind.ClassDeclaration,
          NodeKind.FunctionDeclaration,
          NodeKind.EnumDeclaration,
          NodeKind.NamespaceDeclaration,
        ].includes(node.kind)
      ) {
        const name = (node as unknown as { name: IdentifierExpression }).name;
        if (name?.text) names.set(name.text, null);
      }
    }
    return names;
  }

  visitSource(node: Source): void {
    const saved = [
      this.scopes,
      this.paths,
      this.terminated,
      this.thisSite,
      this.namespace,
      this.pathLimitReached,
    ] as const;
    this.scopes = [this.names(node.statements)];
    this.registerFunctions(node.statements, this.scopes[0]);
    this.paths = [new Map()];
    this.pathLimitReached = false;
    this.thisSite = null;
    this.terminated = false;
    super.visitSource(node);
    [this.scopes, this.paths, this.terminated, this.thisSite, this.namespace, this.pathLimitReached] =
      saved;
  }

  private origin(node: Node | null): StrategicSite | null {
    if (!node) return null;
    if (node.kind === NodeKind.This) return this.thisSite;
    if (node.kind === NodeKind.Identifier)
      return this.binding((node as IdentifierExpression).text);
    if (node.kind === NodeKind.PropertyAccess) {
      const property = node as PropertyAccessExpression;
      const parent = this.origin(property.expression);
      // Reused destinations can contain a more-derived object supplied by the
      // caller, so its field and virtual-method bindings are not statically exact.
      if (!parent || parent.call.args.length !== 1) return null;
      const name = property.property.text;
      const existing = parent.children.get(name);
      if (existing) return existing;
      const declaration = this.resolveChild(parent.declaration, name);
      if (!declaration) return null;
      const child: StrategicSite = {
        call: parent.call,
        source: parent.source,
        declaration,
        origin: parent.origin,
        accesses: new Map(),
        writes: new Set(),
        escaped: parent.escaped || this.pathLimitReached,
        children: new Map(),
      };
      parent.children.set(name, child);
      return child;
    }
    if (
      node.kind === NodeKind.Parenthesized ||
      node.kind === NodeKind.Assertion
    )
      return this.origin((node as unknown as { expression: Node }).expression);
    if (node.kind === NodeKind.Ternary) {
      const expression = node as TernaryExpression;
      const known = this.conditionValue(expression.condition);
      return known === null
        ? null
        : this.origin(known ? expression.ifThen : expression.ifElse);
    }
    if (node.kind === NodeKind.Call) {
      const call = node as CallExpression;
      // A helper's own parse sites are analyzed in its declaration, once.
      // Inlining access summaries here is only for the caller's existing
      // objects; otherwise each helper call would inflate its local profiles.
      if (this.expanding.size) return null;
      const existing = this.byCall.get(call);
      if (existing) return existing;
      const declaration = this.resolveParse(
        call,
        this.shadowed,
        this.namespace.join("."),
      );
      if (!declaration) return null;
      const site: StrategicSite = {
        call,
        source: call.range.source,
        declaration,
        origin: this.paths,
        accesses: new Map(),
        writes: new Set(),
        escaped: this.pathLimitReached,
        children: new Map(),
      };
      this.sites.push(site);
      this.byCall.set(call, site);
      return site;
    }
    return null;
  }

  private read(node: PropertyAccessExpression): void {
    const site = this.origin(node.expression);
    if (!site) return;
    const name = node.property.text;
    const paths = site.accesses.get(name) ?? [];
    for (const current of this.paths) {
      // Intersect with the execution contexts that created this parse result.
      for (const origin of site.origin) {
        if (
          [...origin].some(
            ([branch, outcome]) =>
              current.has(branch) && current.get(branch) !== outcome,
          )
        )
          continue;
        paths.push(new Map([...origin, ...current]));
      }
    }
    site.accesses.set(name, paths);
  }

  visitPropertyAccessExpression(node: PropertyAccessExpression): void {
    this.read(node);
    super.visitPropertyAccessExpression(node);
  }

  visitIdentifierExpression(node: IdentifierExpression, parent: Node | null = null): void {
    if (!this.conservativeEscapes) return;
    const site = this.binding(node.text);
    if (!site) return;
    // The explicit handlers below track direct field reads, simple aliases and
    // call arguments. Any other use can hide a reference from the analysis.
    if (parent?.kind === NodeKind.PropertyAccess &&
        (parent as PropertyAccessExpression).expression === node) return;
    if (parent?.kind === NodeKind.VariableDeclaration &&
        (parent as VariableDeclaration).initializer === node) return;
    if (parent?.kind === NodeKind.Call &&
        (parent as CallExpression).args.includes(node)) return;
    site.escaped = true;
  }

  visitVariableDeclaration(node: VariableDeclaration): void {
    const site = this.origin(node.initializer);
    this.visit(node.initializer, node);
    // Module and namespace variables may be read by declarations visited
    // earlier or by other modules, beyond this local access analysis.
    if (this.conservativeEscapes && site &&
        (this.callableDepth === 0 || !node.isAny(CommonFlags.Const | CommonFlags.Let)))
      site.escaped = true;
    this.scopes.at(-1)?.set(node.name.text, site);
  }

  visitBlockStatement(node: BlockStatement): void {
    // Predeclare names to respect lexical shadowing even before initialization.
    const scope = this.names(node.statements);
    this.scopes.push(scope);
    this.registerFunctions(node.statements, scope);
    for (const statement of node.statements) {
      if (this.terminated) break;
      this.visit(statement);
    }
    this.scopes.pop();
  }

  private registerFunctions(
    statements: Node[],
    scope: Map<string, StrategicSite | null>,
  ): void {
    const declarations = new Map<string, FunctionDeclaration>();
    for (let statement of statements) {
      // AssemblyScript represents a block-local named function as an
      // expression statement wrapping a FunctionExpression.
      if (statement.kind === NodeKind.Expression) {
        const expression = (statement as unknown as { expression: Node })
          .expression;
        if (expression.kind === NodeKind.Function)
          statement = (
            expression as unknown as { declaration: FunctionDeclaration }
          ).declaration;
      }
      if (statement.kind !== NodeKind.FunctionDeclaration) continue;
      const fn = statement as FunctionDeclaration;
      if (!fn.name?.text) continue;
      scope.set(fn.name.text, null);
      declarations.set(fn.name.text, fn);
      this.captures.set(fn, [...this.scopes]);
      this.callableNamespaces.set(fn, [...this.namespace]);
    }
    this.declarations.set(scope, declarations);
  }

  private collectVarBindings(body: Node | null): Set<string> {
    if (body) {
      const cached = this.varBindingCache.get(body);
      if (cached) return cached;
    }
    const names = new Set<string>();
    class Collector extends Visitor {
      visitVariableDeclaration(node: VariableDeclaration): void {
        if (!node.isAny(CommonFlags.Const | CommonFlags.Let)) names.add(node.name.text);
        super.visitVariableDeclaration(node);
      }
    }
    if (body) new Collector().visit(body);
    if (body) this.varBindingCache.set(body, names);
    return names;
  }

  visitCallExpression(node: CallExpression): void {
    this.visit(node.expression, node);
    this.visit(node.typeArguments, node);
    let fn: Callable | undefined;
    let receiver: StrategicSite | null = null;
    if (node.expression.kind === NodeKind.Identifier) {
      const name = (node.expression as IdentifierExpression).text;
      for (let i = this.scopes.length - 1; i >= 0; i--) {
        if (!this.scopes[i].has(name)) continue;
        fn = this.declarations.get(this.scopes[i])?.get(name);
        break;
      }
    } else if (node.expression.kind === NodeKind.PropertyAccess) {
      const method = node.expression as PropertyAccessExpression;
      receiver = this.origin(method.expression);
      // A reusable destination may have a more-derived runtime method. Only
      // inline a fresh model whose concrete declaration is known at this site.
      if (receiver && receiver.call.args.length === 1) {
        fn = receiver.declaration.members.find(
          (member) =>
            member.kind === NodeKind.MethodDeclaration &&
            member.name.text === method.property.text,
        ) as MethodDeclaration | undefined;
      }
    }
    const args: (StrategicSite | null)[] = [];
    for (const arg of node.args) {
      const before = this.origin(arg);
      this.visit(arg, node);
      const site = before || this.origin(arg);
      args.push(site);
      // An assignment expression returns its new binding, which may be used
      // by the callee even though the expression itself has no tracked origin.
      if (!site && arg.kind === NodeKind.Binary && (arg as BinaryExpression).operator === Token.Equals) {
        const assigned = this.origin((arg as BinaryExpression).left);
        if (assigned) assigned.escaped = true;
      }
    }
    if (fn?.signature.parameters.some((parameter) => parameter.parameterKind === ParameterKind.Rest)) {
      if (receiver) receiver.escaped = true;
      for (const arg of args) if (arg) arg.escaped = true;
      return;
    }
    if (!fn?.body || this.expanding.has(fn) || this.expanding.size >= 8) {
      const intrinsic = !this.conservativeEscapes && node.expression.kind === NodeKind.Identifier && [
        "idof", "offsetof", "sizeof", "nameof",
        "isDefined", "isReference", "isManaged", "isInteger", "isFloat",
        "isString", "isBoolean", "isNullable",
        "unchecked", "changetype", "reinterpret",
      ].includes((node.expression as IdentifierExpression).text);
      if (!intrinsic) {
        if (receiver) receiver.escaped = true;
        for (const arg of args) if (arg) arg.escaped = true;
      }
      return;
    }
    if (!receiver && !args.some(Boolean)) return;
    // A default argument can read an earlier argument before the function
    // body runs. Until those expressions are modeled, retain the full value.
    if (this.conservativeEscapes && fn.signature.parameters.slice(node.args.length).some((p) => p.initializer)) {
      if (receiver) receiver.escaped = true;
      for (const arg of args) if (arg) arg.escaped = true;
    }
    const saved = [
      this.scopes,
      this.paths,
      this.terminated,
      this.thisSite,
      this.namespace,
      this.callableScopeStart,
      this.varBindings,
    ] as const;
    this.scopes = [
      ...(this.captures.get(fn) || []),
      new Map(
        fn.signature.parameters.map((p, i): [string, StrategicSite | null] => [
          p.name.text,
          args[i] || null,
        ]),
      ),
    ];
    this.thisSite = receiver;
    this.callableScopeStart = this.scopes.length - 1;
    this.varBindings = this.conservativeEscapes ? this.collectVarBindings(fn.body) : new Set();
    this.namespace = this.callableNamespaces.get(fn) || [];
    this.terminated = false;
    this.expanding.add(fn);
    this.visit(fn.body);
    this.expanding.delete(fn);
    [this.scopes, this.paths, this.terminated, this.thisSite, this.namespace, this.callableScopeStart, this.varBindings] =
      saved;
  }

  private callable(node: FunctionDeclaration | MethodDeclaration): void {
    // A closure is not an unconditional call. Do not attribute its captured
    // reads to an enclosing parse; analyze its own parse sites independently.
    // Captured objects may be observed after this analysis loses track of the
    // closure. Fail closed even when a nested binding has the same spelling.
    const binding = (name: string): StrategicSite | null => this.binding(name);
    class MarkCaptures extends Visitor {
      visitIdentifierExpression(identifier: IdentifierExpression): void {
        const site = binding(identifier.text);
        if (site) site.escaped = true;
      }
    }
    if (this.conservativeEscapes && node.body) new MarkCaptures().visit(node.body);
    const saved = [
      this.scopes,
      this.paths,
      this.terminated,
      this.thisSite,
      this.namespace,
      this.callableScopeStart,
      this.varBindings,
      this.pathLimitReached,
      this.callableSiteStart,
    ] as const;
    this.scopes = [
      ...this.scopes.map((scope) => {
        const copy = new Map(
          [...scope.keys()].map((name): [string, StrategicSite | null] => [
            name,
            null,
          ]),
        );
        this.declarations.set(copy, this.declarations.get(scope) || new Map());
        return copy;
      }),
      new Map(
        node.signature.parameters.map((p): [string, StrategicSite | null] => [
          p.name.text,
          null,
        ]),
      ),
    ];
    this.paths = [new Map()];
    this.pathLimitReached = false;
    this.callableSiteStart = this.sites.length;
    this.callableScopeStart = this.scopes.length - 1;
    this.varBindings = this.conservativeEscapes ? this.collectVarBindings(node.body) : new Set();
    this.thisSite = null;
    this.terminated = false;
    this.callableDepth++;
    this.visit(node.body);
    this.callableDepth--;
    [this.scopes, this.paths, this.terminated, this.thisSite, this.namespace, this.callableScopeStart, this.varBindings, this.pathLimitReached, this.callableSiteStart] =
      saved;
  }

  visitNamespaceDeclaration(node: NamespaceDeclaration): void {
    this.namespace.push(node.name.text);
    const scope = this.names(node.members);
    this.scopes.push(scope);
    this.registerFunctions(node.members, scope);
    super.visitNamespaceDeclaration(node);
    this.scopes.pop();
    this.namespace.pop();
  }

  visitFunctionDeclaration(node: FunctionDeclaration): void {
    this.callable(node);
  }
  visitMethodDeclaration(node: MethodDeclaration): void {
    this.captures.set(node, [...this.scopes]);
    this.callableNamespaces.set(node, [...this.namespace]);
    this.callable(node);
  }

  visitReturnStatement(node: Node): void {
    const value = (node as unknown as { value: Node }).value;
    if (this.conservativeEscapes) {
      const site = this.origin(value);
      if (site) site.escaped = true;
    }
    this.visit(value);
    this.paths = [];
    this.terminated = true;
  }
  visitThrowStatement(node: Node): void {
    const value = (node as unknown as { value: Node }).value;
    if (this.conservativeEscapes) {
      const site = this.origin(value);
      if (site) site.escaped = true;
    }
    this.visit(value);
    this.paths = [];
    this.terminated = true;
  }
  visitBreakStatement(): void {
    this.exits.at(-1)?.breaks.push(...this.paths);
    this.paths = [];
    this.terminated = true;
  }
  visitContinueStatement(): void {
    [...this.exits]
      .reverse()
      .find((exit) => exit.loop)
      ?.continues.push(...this.paths);
    this.paths = [];
    this.terminated = true;
  }

  private fork(
    node: Node | null,
    branch: number,
    outcome: boolean,
  ): AccessPath[] {
    const saved = this.paths;
    this.paths = this.pathLimitReached ? saved : saved.map((path) => new Map(path).set(branch, outcome));
    this.terminated = false;
    this.visit(node);
    const remaining = this.paths;
    this.paths = saved;
    return remaining;
  }

  private merge(paths: AccessPath[]): AccessPath[] {
    // A bounded fallback is safer than enumerating exponentially many paths.
    // Existing and subsequent sites in this source must retain all fields.
    if (paths.length > 128 || this.pathLimitReached) {
      this.pathLimitReached = true;
      const escape = (site: StrategicSite): void => {
        site.escaped = true;
        for (const child of site.children.values()) escape(child);
      };
      for (const site of this.sites.slice(this.callableSiteStart)) escape(site);
      for (const scope of this.scopes) for (const site of scope.values()) if (site) escape(site);
      return paths.length ? [new Map()] : [];
    }
    const result: AccessPath[] = [];
    for (let path of paths) {
      if (
        result.some((existing) =>
          [...existing].every(([key, value]) => path.get(key) === value),
        )
      )
        continue;
      let joined = true;
      while (joined) {
        joined = false;
        for (let i = 0; i < result.length; i++) {
          const existing = result[i];
          if (existing.size !== path.size) continue;
          const differences = [...path].filter(
            ([key, value]) => existing.get(key) !== value,
          );
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

  private conditionValue(node: Node): boolean | null {
    if (node.kind === NodeKind.True) return true;
    if (node.kind === NodeKind.False) return false;
    if (
      node.kind === NodeKind.Parenthesized ||
      node.kind === NodeKind.Assertion
    )
      return this.conditionValue(
        (node as unknown as { expression: Node }).expression,
      );
    if (node.kind === NodeKind.UnaryPrefix) {
      const expression = node as UnaryPrefixExpression;
      if (expression.operator === Token.Exclamation) {
        const value = this.conditionValue(expression.operand);
        return value === null ? null : !value;
      }
    }
    if (node.kind === NodeKind.Binary) {
      const expression = node as BinaryExpression;
      const left = this.conditionValue(expression.left);
      const right = this.conditionValue(expression.right);
      if (expression.operator === Token.Ampersand_Ampersand)
        return left === false || right === false
          ? false
          : left === true
            ? right
            : null;
      if (expression.operator === Token.Bar_Bar)
        return left === true || right === true
          ? true
          : left === false
            ? right
            : null;
    }
    if (node.kind === NodeKind.Ternary) {
      const expression = node as TernaryExpression;
      const known = this.conditionValue(expression.condition);
      if (known !== null)
        return this.conditionValue(
          known ? expression.ifThen : expression.ifElse,
        );
    }
    return null;
  }

  visitIfStatement(node: IfStatement): void {
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

  visitTernaryExpression(node: TernaryExpression): void {
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

  visitNewExpression(node: NewExpression): void {
    super.visitNewExpression(node);
    for (const argument of node.args) {
      const site = this.origin(argument);
      if (site) site.escaped = true;
    }
  }

  visitArrayLiteralExpression(node: ArrayLiteralExpression): void {
    if (this.conservativeEscapes)
      for (const element of node.elementExpressions) {
        const site = this.origin(element);
        if (site) site.escaped = true;
      }
    super.visitArrayLiteralExpression(node);
  }

  visitObjectLiteralExpression(node: ObjectLiteralExpression): void {
    if (this.conservativeEscapes)
      for (const value of node.values) {
        const site = this.origin(value);
        if (site) site.escaped = true;
      }
    super.visitObjectLiteralExpression(node);
  }

  private recordWrite(target: Node): void {
    if (target.kind === NodeKind.PropertyAccess) {
      const property = target as PropertyAccessExpression;
      const owner = this.origin(property.expression);
      if (owner) owner.writes.add(property.property.text);
    }
  }

  visitUnaryPrefixExpression(node: UnaryPrefixExpression): void {
    if (node.operator === Token.Plus_Plus || node.operator === Token.Minus_Minus)
      this.recordWrite(node.operand);
    super.visitUnaryPrefixExpression(node);
  }

  visitUnaryPostfixExpression(node: UnaryPostfixExpression): void {
    if (node.operator === Token.Plus_Plus || node.operator === Token.Minus_Minus)
      this.recordWrite(node.operand);
    super.visitUnaryPostfixExpression(node);
  }

  visitBinaryExpression(node: BinaryExpression): void {
    if (node.operator >= Token.Equals && node.operator <= Token.Caret_Equals)
      this.recordWrite(node.left);
    if (node.operator === Token.Equals) {
      const site = this.origin(node.right);
      this.visit(node.right);
      if (node.left.kind === NodeKind.Identifier) {
        const name = (node.left as IdentifierExpression).text;
        // An existing object assigned on one branch is not the binding's value
        // on the other branch. Keep such mutable aliases opaque unless this
        // assignment creates the parse result in the same execution context.
        const sameContext =
          site &&
          site.origin.length === this.paths.length &&
          site.origin.every((origin) =>
            this.paths.some(
              (path) =>
                path.size === origin.size &&
                [...origin].every(([key, value]) => path.get(key) === value),
            ),
          );
        const inLoop = this.exits.some((exit) => exit.loop);
        const assigned =
          !(this.conservativeEscapes && inLoop) &&
          (accessProbability(this.paths) === 1 || (!this.conservativeEscapes && sameContext)) ? site : null;
        let found = false;
        for (let i = this.scopes.length - 1; i >= 0; i--)
          if (this.scopes[i].has(name)) {
            found = true;
            if (this.conservativeEscapes && (this.callableDepth === 0 || i < this.callableScopeStart || this.varBindings.has(name) || !assigned)) {
              if (site) site.escaped = true;
              const previous = this.scopes[i].get(name);
              if (previous) previous.escaped = true;
            }
            this.scopes[i].set(name, assigned);
            break;
          }
        if (this.conservativeEscapes && !found && site) site.escaped = true;
      } else if (node.left.kind === NodeKind.PropertyAccess) {
        // Storing an object in another object can expose it beyond the
        // locally tracked bindings, even when the destination is known.
        if (this.conservativeEscapes && site) site.escaped = true;
        // A write of x is not a read of x; a write of x.y does read x.
        this.visit((node.left as PropertyAccessExpression).expression);
      } else {
        if (this.conservativeEscapes && site) site.escaped = true;
        this.visit(node.left);
      }
      return;
    }
    this.visit(node.left);
    if (
      node.operator === Token.Ampersand_Ampersand ||
      node.operator === Token.Bar_Bar
    ) {
      const known = this.conditionValue(node.left);
      if (known !== null) {
        if (known === (node.operator === Token.Ampersand_Ampersand))
          this.visit(node.right);
        return;
      }
      const saved = this.paths;
      let left = node.left;
      // a && b && value.x is left-associative in the AST, but reaching x
      // still requires both short-circuit gates, just like a && (b && x).
      while (
        left.kind === NodeKind.Binary &&
        (left as BinaryExpression).operator === node.operator
      ) {
        const branch = this.branch++;
        this.paths = this.paths.map((path) => new Map(path).set(branch, true));
        left = (left as BinaryExpression).left;
      }
      this.fork(node.right, this.branch++, true);
      this.paths = saved;
      this.terminated = false;
    } else this.visit(node.right);
  }

  private loop(
    node: Node,
    incrementor: Node | null = null,
    mandatory = false,
    infinite = false,
  ): void {
    const before = this.paths;
    const branch = this.branch++;
    const exit = {
      breaks: [] as AccessPath[],
      continues: [] as AccessPath[],
      loop: true,
    };
    this.exits.push(exit);
    let remaining: AccessPath[];
    if (mandatory) {
      this.visit(node);
      remaining = this.paths;
    } else remaining = this.fork(node, branch, true);
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

  visitWhileStatement(node: WhileStatement): void {
    this.visit(node.condition);
    const known = this.conditionValue(node.condition);
    if (known !== false)
      this.loop(node.body, null, known === true, known === true);
  }
  visitForStatement(node: ForStatement): void {
    this.scopes.push(new Map());
    this.visit(node.initializer);
    this.visit(node.condition);
    const known = node.condition ? this.conditionValue(node.condition) : true;
    if (known !== false)
      this.loop(node.body, node.incrementor, known === true, known === true);
    this.scopes.pop();
  }
  visitDoStatement(node: DoStatement): void {
    this.loop(
      node.body,
      node.condition,
      true,
      this.conditionValue(node.condition) === true,
    );
  }

  visitForOfStatement(node: ForOfStatement): void {
    this.scopes.push(new Map());
    this.visit(node.variable);
    this.visit(node.iterable);
    this.loop(node.body);
    this.scopes.pop();
  }

  visitSwitchStatement(node: SwitchStatement): void {
    this.visit(node.condition);
    let unmatched = this.paths;
    let fallthrough: AccessPath[] = [];
    const selections: AccessPath[][] = [];
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
      breaks: [] as AccessPath[],
      continues: [] as AccessPath[],
      loop: false,
    };
    this.exits.push(exit);
    for (let i = 0; i < node.cases.length; i++) {
      this.paths = this.merge([...selections[i], ...fallthrough]);
      this.terminated = !this.paths.length;
      this.visit(
        Node.createBlockStatement(
          node.cases[i].statements,
          node.cases[i].range,
        ),
      );
      fallthrough = this.paths;
    }
    this.exits.pop();
    this.paths = this.merge([...unmatched, ...fallthrough, ...exit.breaks]);
    this.terminated = !this.paths.length;
  }

  visitTryStatement(node: TryStatement): void {
    const before = this.paths;
    const branch = this.branch++;
    const block = (statements: Statement[] | null): Node | null =>
      statements ? Node.createBlockStatement(statements, node.range) : null;
    const body = this.fork(block(node.bodyStatements), branch, true);
    this.scopes.push(
      new Map(node.catchVariable ? [[node.catchVariable.text, null]] : []),
    );
    const caught = node.catchStatements
      ? this.fork(block(node.catchStatements), branch, false)
      : [];
    this.scopes.pop();
    const remaining = this.merge([...body, ...caught]);
    // finally executes for returning/throwing paths too. Attribute its reads to
    // the original contexts, then restore only paths that can continue.
    this.paths = before;
    this.terminated = false;
    this.visit(block(node.finallyStatements));
    this.paths = this.paths.length ? remaining : [];
    this.terminated = !this.paths.length;
  }
}
