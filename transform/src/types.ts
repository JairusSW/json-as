// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { NUMERIC_TYPES } from "./scalars.js";
import {
  ClassDeclaration,
  Expression,
  FieldDeclaration,
  Source,
  Node,
  NamespaceDeclaration,
  DeclarationStatement,
  TypeName,
  Parser,
  ImportStatement,
  CommonFlags,
  EnumDeclaration,
  ExportStatement,
  ExportDefaultStatement,
} from "assemblyscript/dist/assemblyscript.js";
import { TypeAlias } from "./linkers/alias.js";
import { stripNull } from "./index.js";
import { SimpleParser, toString } from "./util.js";

import * as asc from "assemblyscript/dist/assemblyscript.js";
export const NodeKind = (asc as unknown as { NodeKind: Record<string, number> })
  .NodeKind;

export interface TypeArgumentContext {
  type: asc.TypeNode;
  source: Src;
  scope: string;
  owner?: DeclarationStatement;
  opaque?: boolean;
}

export interface TypeMeaning {
  name: string;
  nullable: boolean;
  arguments: TypeMeaning[];
  source: Src;
  declaration: ClassDeclaration | EnumDeclaration | null;
}

export function typeMeaningText(type: TypeMeaning): string {
  return (
    type.name +
    (type.arguments.length
      ? "<" + type.arguments.map(typeMeaningText).join(", ") + ">"
      : "") +
    (type.nullable ? " | null" : "")
  );
}

export enum PropertyFlags {
  OmitNull,
  OmitIf,
  Raw,
  Custom,
  Lazy,
  Optional,
}

export class Property {
  public name: string = "";
  public alias: string | null = null;
  public type: string = "";
  public nullable: boolean = false;
  // Built-in dispatch follows the resolved declaration, not a user model's name.
  public builtinDate: boolean = false;
  public value: string | null = null;
  public flags: Map<PropertyFlags, Expression | null> = new Map<
    PropertyFlags,
    Expression | null
  >();
  public node!: FieldDeclaration;
  public byteSize: number = 0;
  // For `JSON.Lazy<T>` slot members: the inner type T, used by the
  // deserialize (range store) and serialize (raw emit / materialized) codegen.
  public lazyInner: string | null = null;
  public lazyProperty: string | null = null;
  public omitIfMethod: string | null = null;
  public lazyPacked: boolean = false;
  public lazyScalar: boolean = false;
  // Generic lazy fields may be instantiated with an array type.
  public lazyMaybeArray: boolean = false;
  public _generic: boolean = false;
  public _custom: boolean = false;
  public parent: Schema;
  set custom(value: boolean) {
    this._custom = value;
  }
  get custom(): boolean {
    if (this._custom) return true;
    if (
      this.parent.node.isGeneric &&
      this.parent.node.typeParameters.some((p) => p.name.text == this.type)
    ) {
      // console.log("Custom (Generic): " + this.name);
      // this._generic = true;
      this._custom = true;
      return true;
    }

    for (const dep of this.parent.deps) {
      if (this.name == dep.name && dep.customReader) {
        // console.log("Custom (Dependency): " + this.name);
        this._custom = true;
        return true;
      }
    }
    return false;
  }
  set generic(value: boolean) {
    this._generic = value;
  }
  get generic(): boolean {
    if (this._generic) return true;
    if (
      this.parent.node.isGeneric &&
      this.parent.node.typeParameters.some(
        (p) => p.name.text == stripNull(this.type),
      )
    ) {
      // console.log("Generic: " + this.name);
      this._generic = true;
      return true;
    }
    return false;
  }
}

export class Schema {
  public static: boolean = true;
  public name: string = "";
  public members: Property[] = [];
  // Preserve declaration order independently of serialization's omission sort.
  public initializationMembers: Property[] = [];
  public parent: Schema | null = null;
  public node!: ClassDeclaration;
  public needsLink: string | null = null;
  public byteSize: number = 0;
  public deps: Schema[] = [];
  public customJsonKind: string = "any";
  // Directional dispatch capabilities; `custom` remains combined effect metadata.
  public ownCustomReader: boolean = false;
  public ownCustomWriter: boolean = false;
  public fastReader: boolean = false;
  public generatedFastReader: boolean = false;
  get customReader(): boolean {
    return this.ownCustomReader || !!this.parent?.customReader;
  }
  get customWriter(): boolean {
    return this.ownCustomWriter || !!this.parent?.customWriter;
  }
  public hasCustomCursorLifecycle: boolean = false;
  public hasCustomReaderLifecycle: boolean = false;
  public hasInternalInitializers: boolean = false;
  public hasInitializerEffects: boolean = false;
  private _custom: boolean = false;

  set custom(value: boolean) {
    this._custom = value;
  }
  get custom(): boolean {
    if (this._custom) return true;
    if (this.parent) return this.parent.custom;
    return false;
  }

  getMinLength(visited: Set<string> = new Set<string>()): number {
    if (visited.has(this.name)) return 4;
    visited.add(this.name);

    const requiredMembers = this.members.filter(
      (member) =>
        !member.flags.has(PropertyFlags.OmitIf) &&
        !member.flags.has(PropertyFlags.OmitNull),
    );
    if (!requiredMembers.length) return 4;

    let minChars = 2; // {}

    for (let i = 0; i < requiredMembers.length; i++) {
      const member = requiredMembers[i];
      const key = member.alias ?? member.name;

      if (i > 0) minChars += 1; // ,
      minChars += key.length + 3; // "key":
      minChars += this.getTypeMinChars(member.type, visited);
    }

    return minChars << 1;
  }

  private getTypeMinChars(type: string, visited: Set<string>): number {
    const trimmed = type.trim();
    const baseType = stripNull(trimmed);
    const nullable = trimmed !== baseType;

    let min = this.getNonNullableTypeMinChars(baseType, visited);
    if (nullable) min = Math.min(min, 4); // null
    return min;
  }

  private getNonNullableTypeMinChars(
    type: string,
    visited: Set<string>,
  ): number {
    if (type.startsWith("JSON.Box<") || type.startsWith("Box<")) {
      const genericStart = type.indexOf("<");
      const genericEnd = type.lastIndexOf(">");
      if (
        genericStart !== -1 &&
        genericEnd !== -1 &&
        genericEnd > genericStart
      ) {
        return this.getTypeMinChars(
          type.slice(genericStart + 1, genericEnd),
          visited,
        );
      }
    }

    if (
      type.startsWith("Array<") ||
      type.startsWith("StaticArray<") ||
      type.startsWith("Set<")
    )
      return 2; // []
    if (type.startsWith("Map<")) return 2; // {}

    if (
      type == "string" ||
      type == "String" ||
      type == "JSON.Raw" ||
      type == "Raw"
    )
      return 2; // ""
    if (type == "Date") return 26; // "1970-01-01T00:00:00.000Z"
    if (type == "bool" || type == "boolean") return 4; // true
    if (Schema.isNumericType(type)) return 1; // 0
    if (type == "JSON.Obj" || type == "Obj") return 2; // {}
    if (type == "JSON.Arr" || type == "Arr") return 2; // []
    if (type == "JSON.Value" || type == "Value") return 1; // 0

    const dep = this.deps.find(
      (schema) => schema.name === type || schema.name.endsWith("." + type),
    );
    if (dep) return dep.getMinLength(visited) >> 1;

    if (
      this.parent &&
      (this.parent.name === type || this.parent.name.endsWith("." + type))
    ) {
      return this.parent.getMinLength(visited) >> 1;
    }

    return 1;
  }

  private static isNumericType(type: string): boolean {
    return NUMERIC_TYPES.includes(type);
  }
}

export class SourceSet {
  private sources: Record<string, Src> = {};

  /**
   * Get a stored source from the set, or create a new one and store it if it
   * didn't exist.
   * @param source AssemblyScript Source
   * @returns Source object
   */
  get(source: Source): Src {
    let src = this.sources[source.internalPath];
    if (!src) {
      src = new Src(source, this);
      this.sources[source.internalPath] = src;
    }
    return src;
  }
}

export class Src {
  public internalPath: string;
  public normalizedPath: string;
  public schemas: Schema[] = [];
  public aliases: TypeAlias[];
  public exports: Schema[] = [];
  public imports: ImportStatement[] = [];
  private exportStatements: ExportStatement[] = [];
  private defaultDeclaration: DeclarationStatement | null = null;
  private nodeMap: Map<Node, NamespaceDeclaration[]> = new Map<
    Node,
    NamespaceDeclaration[]
  >();
  private classes: Record<string, ClassDeclaration> = {};
  private enums: Record<string, EnumDeclaration> = {};

  constructor(
    source: Source,
    private sourceSet: SourceSet,
  ) {
    this.internalPath = source.internalPath;
    this.normalizedPath = source.normalizedPath;
    this.aliases = TypeAlias.getAliases(source);
    this.traverse(source.statements, []);
  }

  /**
   * Traverse source nodes and finds all classes and imports, and which namespaces they exist under.
   * @param nodes Nodes to traverse.
   * @param path The current path of namespace declarations leading to the nodes.
   */
  private traverse(nodes: Node[], path: NamespaceDeclaration[]) {
    for (const node of nodes) {
      switch (node.kind) {
        case NodeKind.NamespaceDeclaration:
          // eslint-disable-next-line no-case-declarations
          const namespaceDeclaration = node as NamespaceDeclaration;
          this.traverse(namespaceDeclaration.members, [
            ...path,
            namespaceDeclaration,
          ]);
          break;
        case NodeKind.ExportDefault: {
          const declaration = (node as ExportDefaultStatement).declaration;
          this.defaultDeclaration = declaration;
          this.traverse([declaration], path);
          break;
        }
        case NodeKind.ClassDeclaration:
          // eslint-disable-next-line no-case-declarations
          const classDeclaration = node as ClassDeclaration;
          this.classes[this.qualifiedName(classDeclaration, path)] =
            classDeclaration;
          break;
        case NodeKind.EnumDeclaration:
          // eslint-disable-next-line no-case-declarations
          const enumDeclaration = node as EnumDeclaration;
          this.enums[this.qualifiedName(enumDeclaration, path)] =
            enumDeclaration;
          break;
        case NodeKind.Export:
          this.exportStatements.push(node as ExportStatement);
          break;
        case NodeKind.Import:
          // eslint-disable-next-line no-case-declarations
          const importStatement = node as ImportStatement;
          this.imports.push(importStatement);
          break;
      }
      this.nodeMap.set(node, path);
    }
  }

  getNamespaces(node: DeclarationStatement): NamespaceDeclaration[] {
    return this.nodeMap.get(node) ?? [];
  }

  getImportedLocalNames(): string[] {
    const names = new Set<string>();
    for (const statement of this.imports) {
      if (statement.namespaceName) names.add(statement.namespaceName.text);
      for (const declaration of statement.declarations || [])
        names.add(declaration.name.text);
    }
    return [...names];
  }

  hasNamespaceImports(): boolean {
    return this.imports.some((statement) => !!statement.namespaceName);
  }

  /**
   * Get the qualified name (eg. "Namespace.BaseObject") for a class.
   * @param node Class declaration.
   * @returns Qualified name
   */
  getQualifiedName(node: DeclarationStatement): string {
    return this.qualifiedName(node, this.nodeMap.get(node));
  }

  /**
   * Get a class declaration by its qualified name.
   * @param qualifiedName Qualified named (eg. "Namespace.BaseObject")
   * @returns Class declaration or null if not found.
   */
  getClass(qualifiedName: string): ClassDeclaration | null {
    return this.classes[qualifiedName] || null;
  }

  getClassInContext(
    name: string,
    owner: DeclarationStatement,
    visited = new Set<string>(),
  ): ClassDeclaration | null {
    // Generic arguments belong to the type use, not the declaration identity.
    name = stripNull(name).replace(/<.*>$/, "").trim();
    const path = this.getQualifiedName(owner).split(".").slice(0, -1);
    for (let depth = path.length; depth >= 0; depth--) {
      const qualified = [...path.slice(0, depth), name].join(".");
      const declaration = this.getClass(qualified);
      if (declaration) return declaration;
      const alias = this.aliases.find(
        (candidate) => candidate.name === qualified,
      );
      if (alias?.declaration && !visited.has(alias.name)) {
        visited.add(alias.name);
        const target = this.getClassInContext(
          stripNull(alias.getBaseType()),
          alias.declaration,
          visited,
        );
        if (target) return target;
      }
    }
    return null;
  }

  registerAlias(
    alias: TypeAlias,
    namespaces: NamespaceDeclaration[] = [],
  ): void {
    this.aliases.push(alias);
    if (alias.declaration) this.nodeMap.set(alias.declaration, namespaces);
  }

  /** Classes declared in this source, including namespaced declarations. */
  getClasses(): ClassDeclaration[] {
    return Object.values(this.classes);
  }

  /**
   * Get an enum declaration by its qualified name.
   * @param qualifiedName Qualified name (eg. "Namespace.MyEnum")
   * @returns Enum declaration or null if not found.
   */
  getEnum(qualifiedName: string): EnumDeclaration | null {
    return this.enums[qualifiedName] || null;
  }

  /**
   * Get imported class from other sources in the parser.
   * @param qualifiedName Qualified name of class.
   * @param parser AssemblyScript parser.
   * @returns Class declaration or null if not found.
   */
  getImportedClass(
    qualifiedName: string,
    parser: Parser,
    visited = new Set<string>(),
  ): ClassDeclaration | null {
    const binding = this.getImportedBinding(qualifiedName, parser);
    if (!binding) return null;
    const identity = binding.source.internalPath + ":class:" + binding.name;
    if (visited.has(identity)) return null;
    visited.add(identity);
    const direct = binding.source.getClass(binding.name);
    if (direct) return direct;
    const alias = binding.source.aliases.find(
      (item) => item.name === binding.name,
    );
    if (alias?.declaration) {
      const target = stripNull(alias.getBaseType());
      return (
        binding.source.getClassInContext(target, alias.declaration) ||
        binding.source.getImportedClass(
          target.replace(/<.*>$/, ""),
          parser,
          visited,
        )
      );
    }
    return null;
  }

  classTypeParameters(
    owner: DeclarationStatement,
  ): Map<string, TypeArgumentContext> {
    const result = new Map<string, TypeArgumentContext>();
    if (owner.kind === NodeKind.ClassDeclaration)
      for (const parameter of (owner as ClassDeclaration).typeParameters ??
        []) {
        const type = (
          SimpleParser.parseTopLevelStatement(
            `type __JSON_PARAMETER = ${parameter.name.text};`,
          ) as asc.TypeDeclaration
        ).type;
        result.set(parameter.name.text, {
          type,
          source: this,
          scope: "",
          opaque: true,
        });
      }
    return result;
  }

  /** Resolve alias definitions and supplied arguments in their own scopes. */
  resolveTypeMeaning(
    text: string,
    scope: string,
    parser: Parser,
    supplied = new Map<string, TypeArgumentContext>(),
    preserveAlias?: (alias: TypeAlias, source: Src) => boolean,
  ): TypeMeaning {
    type Use = {
      type: asc.TypeNode;
      source: Src;
      scope: string;
      parameters: Map<string, Use>;
      trail: Set<asc.TypeDeclaration>;
      opaque?: boolean;
    };
    const empty = new Map<string, Use>();
    const parameters = new Map<string, Use>();
    for (const [name, argument] of supplied)
      parameters.set(name, {
        ...argument,
        parameters: argument.owner
          ? new Map(
              [...argument.source.classTypeParameters(argument.owner)].map(
                ([name, value]) => [
                  name,
                  {
                    ...value,
                    parameters: empty,
                    trail: new Set<asc.TypeDeclaration>(),
                  },
                ],
              ),
            )
          : empty,
        trail: new Set(),
      });
    const parse = (value: string): asc.TypeNode =>
      (
        SimpleParser.parseTopLevelStatement(
          `type __JSON_MEANING = ${value};`,
        ) as asc.TypeDeclaration
      ).type;
    const resolve = (use: Use, depth = 0): TypeMeaning => {
      const node = use.type as asc.NamedTypeNode;
      const name =
        node.kind === NodeKind.NamedType ? toString(node.name) : toString(node);
      const plain = (): TypeMeaning => ({
        name,
        nullable: !!node.isNullable,
        arguments: [],
        source: use.source,
        declaration: null,
      });
      if (use.opaque || depth > 128 || node.kind !== NodeKind.NamedType)
        return plain();
      const parameter = use.parameters.get(name);
      const nullable = (result: TypeMeaning): TypeMeaning =>
        node.isNullable && !result.nullable
          ? { ...result, nullable: true }
          : result;
      // A supplied expression carries the trail from before its receiving alias
      // was expanded. Identity<Identity<Token>> is finite, not a definition cycle.
      if (parameter) return nullable(resolve(parameter, depth + 1));
      let owner = use.source;
      let alias: TypeAlias | undefined;
      let declaration: ClassDeclaration | EnumDeclaration | null = null;
      const parts = use.scope ? use.scope.split(".") : [];
      for (let length = parts.length; length >= 0; length--) {
        const qualified = [...parts.slice(0, length), name].join(".");
        declaration = owner.getClass(qualified) || owner.getEnum(qualified);
        alias = owner.aliases.find((candidate) => candidate.name === qualified);
        if (declaration || alias) break;
      }
      if (!declaration && !alias) {
        const binding = owner.getImportedBinding(name, parser);
        if (binding) {
          owner = binding.source;
          alias = owner.aliases.find(
            (candidate) => candidate.name === binding.name,
          );
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
        if (
          use.trail.has(alias.declaration) ||
          arguments_.length > alias.parameters.length
        )
          return plain();
        const environment = new Map<string, Use>();
        const aliasScope = alias.name.split(".").slice(0, -1).join(".");
        const trail = new Set(use.trail).add(alias.declaration);
        for (let i = 0; i < alias.parameters.length; i++) {
          let argument = arguments_[i];
          if (!argument) {
            const fallback = alias.declaration.typeParameters?.[i]?.defaultType;
            if (!fallback) return plain();
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
        return nullable(
          resolve(
            {
              type: alias.declaration.type,
              source: owner,
              scope: aliasScope,
              parameters: environment,
              trail,
            },
            depth + 1,
          ),
        );
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

  resolveClass(
    name: string,
    owner: DeclarationStatement,
    parser: Parser,
  ): ClassDeclaration | null {
    const meaning = this.resolveTypeMeaning(
      name,
      this.getQualifiedName(owner).split(".").slice(0, -1).join("."),
      parser,
      this.classTypeParameters(owner),
    );
    return meaning.declaration?.kind === NodeKind.ClassDeclaration
      ? (meaning.declaration as ClassDeclaration)
      : null;
  }

  /** Follow a local import binding to its actual exported declaration. */
  getImportedBinding(
    name: string,
    parser: Parser,
    visited = new Set<string>(),
  ): { source: Src; name: string } | null {
    const parts = name.split(".");
    for (const statement of this.imports) {
      const declaration = statement.declarations?.find(
        (item) => item.name.text === parts[0],
      );
      const namespace = statement.namespaceName?.text === parts[0];
      if (!declaration && !namespace) continue;
      const external = parser.sources.find(
        (source) =>
          source.internalPath === statement.internalPath ||
          source.internalPath === statement.internalPath + "/index",
      );
      if (!external) continue;
      const target = declaration
        ? [declaration.foreignName.text, ...parts.slice(1)].join(".")
        : parts.slice(1).join(".");
      const result = this.sourceSet
        .get(external)
        .getExportedBinding(target, parser, visited);
      if (result) return result;
    }
    return null;
  }

  private getExportedBinding(
    name: string,
    parser: Parser,
    visited: Set<string>,
  ): { source: Src; name: string } | null {
    if (name === "default" && this.defaultDeclaration)
      return {
        source: this,
        name: this.getQualifiedName(this.defaultDeclaration),
      };
    const identity = this.internalPath + ":export:" + name;
    if (visited.has(identity)) return null;
    visited.add(identity);
    const direct =
      this.getClass(name) ||
      this.getEnum(name) ||
      this.aliases.find((item) => item.name === name)?.declaration;
    if (direct && direct.flags & CommonFlags.Export)
      return { source: this, name };
    for (const statement of this.exportStatements) {
      const member = statement.members?.find(
        (item) =>
          name === item.exportedName.text ||
          name.startsWith(item.exportedName.text + "."),
      );
      if (statement.members && !member) continue;
      const local = member
        ? member.localName.text + name.slice(member.exportedName.text.length)
        : name;
      if (statement.path) {
        const external = parser.sources.find(
          (source) =>
            source.internalPath === statement.internalPath ||
            source.internalPath === statement.internalPath + "/index",
        );
        if (!external) continue;
        const result = this.sourceSet
          .get(external)
          .getExportedBinding(local, parser, visited);
        if (result) return result;
      } else {
        if (
          this.getClass(local) ||
          this.getEnum(local) ||
          this.aliases.some((item) => item.name === local)
        )
          return { source: this, name: local };
        const result = this.getImportedBinding(local, parser, visited);
        if (result) return result;
      }
    }
    return null;
  }

  /**
   * Get any visible class from parser sources, including stdlib and sources provided via --lib.
   * @param qualifiedName Qualified name of class.
   * @param parser AssemblyScript parser.
   * @returns Class declaration or null if not found.
   */
  getAvailableClass(
    qualifiedName: string,
    parser: Parser,
  ): ClassDeclaration | null {
    for (const externalSource of parser.sources) {
      if (externalSource.internalPath == this.internalPath) continue;
      const source = this.sourceSet.get(externalSource);
      const classDeclaration = source.getClass(qualifiedName);
      if (
        classDeclaration &&
        (classDeclaration.flags & CommonFlags.Export ||
          externalSource.internalPath.startsWith("~lib/"))
      ) {
        return classDeclaration;
      }
    }
    return null;
  }

  /**
   * Get imported enum from other sources in the parser.
   * @param qualifiedName Qualified name of enum.
   * @param parser AssemblyScript parser.
   * @returns Enum declaration or null if not found.
   */
  getImportedEnum(
    name: string,
    parser: Parser,
    visited = new Set<string>(),
  ): EnumDeclaration | null {
    const binding = this.getImportedBinding(name, parser);
    if (!binding) return null;
    const identity = binding.source.internalPath + ":enum:" + binding.name;
    if (visited.has(identity)) return null;
    visited.add(identity);
    const direct = binding.source.getEnum(binding.name);
    if (direct) return direct;
    const alias = binding.source.aliases.find(
      (item) => item.name === binding.name,
    );
    if (!alias) return null;
    const target = stripNull(alias.getBaseType());
    return (
      binding.source.getEnum(target) ||
      binding.source.getImportedEnum(target, parser, visited)
    );
  }

  /**
   * Gets a unique path string to the node by combining the internalPath with
   * the qualified name of the node.
   * @param node DeclarationStatement
   */
  getFullPath(node: DeclarationStatement): string {
    return this.internalPath + "/" + this.getQualifiedName(node);
  }

  /**
   * Resolved the qualified name of the extended class for a class
   * declaration.
   * @param classDeclaration Class declaration that extends another class.
   * @returns Qualified name of the extended class, or empty string if not extending any class.
   */
  resolveExtendsName(classDeclaration: ClassDeclaration): string {
    const parents = this.nodeMap.get(classDeclaration);
    if (!classDeclaration.extendsType || !parents) {
      return "";
    }

    const name = classDeclaration.extendsType.name.identifier.text;
    const extendsName = this.getIdentifier(classDeclaration.extendsType.name);

    // Reverse walk to find first class or namespace that matches the first part
    // of type name.
    for (let i = parents.length - 1; i >= 0; i--) {
      const parent = parents[i];
      for (const node of parent.members) {
        if (name == this.getNamespaceOrClassName(node)) {
          // Add namespace path to the extendsName.
          return (
            parents
              .slice(0, i + 1)
              .map((p) => p.name.text)
              .join(".") +
            "." +
            extendsName
          );
        }
      }
    }
    // No matching class or namespace found. Just use the extendsName.
    return extendsName;
  }

  /**
   * Get the qualified name (eg "Namespace.BaseObject") of a class.
   * @param node Class declaration.
   * @param parents Array of namespace parents.
   * @returns Qualified name
   */
  private qualifiedName(
    node: DeclarationStatement,
    parents: NamespaceDeclaration[],
  ): string {
    return parents?.length
      ? parents.map((p) => p.name.text).join(".") + "." + node.name.text
      : node.name.text;
  }

  /**
   * Checks if the node is either a namespace or class, and returns the simple
   * name of the node.
   * @param node Node to check
   * @returns Name of namespace or class, or empty string if other type of node.
   */
  private getNamespaceOrClassName(node: Node): string {
    switch (node.kind) {
      case NodeKind.NamespaceDeclaration:
        return (node as DeclarationStatement).name.text;
      case NodeKind.ClassDeclaration:
        return (node as DeclarationStatement).name.text;
    }
    return "";
  }

  /**
   * Get the full name (eg. "Namespace.Base") of a type name such as an
   * extendedType.
   * @param typeName Type name
   * @returns Full name
   */
  private getIdentifier(typeName: TypeName): string {
    const names = [];
    while (typeName) {
      names.push(typeName.identifier.text);
      typeName = typeName.next;
    }
    return names.join(".");
  }
}
