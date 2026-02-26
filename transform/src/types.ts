import { ClassDeclaration, Expression, FieldDeclaration, Source, NodeKind, Node, NamespaceDeclaration, DeclarationStatement, TypeName, Parser, ImportStatement, CommonFlags, EnumDeclaration } from "assemblyscript/dist/assemblyscript.js";
import { TypeAlias } from "./linkers/alias.js";
import { stripNull } from "./index.js";

export enum PropertyFlags {
  OmitNull,
  OmitIf,
  Raw,
  Custom,
}

export class Property {
  public name: string = "";
  public alias: string | null = null;
  public type: string = "";
  public value: string | null = null;
  public flags: Map<PropertyFlags, Expression | null> = new Map<PropertyFlags, Expression | null>();
  public node!: FieldDeclaration;
  public byteSize: number = 0;
  public _generic: boolean = false;
  public _custom: boolean = false;
  public parent: Schema;
  set custom(value: boolean) {
    this._custom = value;
  }
  get custom(): boolean {
    if (this._custom) return true;
    if (this.parent.node.isGeneric && this.parent.node.typeParameters.some((p) => p.name.text == this.type)) {
      // console.log("Custom (Generic): " + this.name);
      // this._generic = true;
      this._custom = true;
      return true;
    }

    for (const dep of this.parent.deps) {
      if (this.name == dep.name && dep.custom) {
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
    if (this.parent.node.isGeneric && this.parent.node.typeParameters.some((p) => p.name.text == stripNull(this.type))) {
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
  public parent: Schema | null = null;
  public node!: ClassDeclaration;
  public needsLink: string | null = null;
  public byteSize: number = 0;
  public deps: Schema[] = [];
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

    const requiredMembers = this.members.filter((member) => !member.flags.has(PropertyFlags.OmitIf) && !member.flags.has(PropertyFlags.OmitNull));
    if (!requiredMembers.length) return 4;

    let minChars = 2; // {}

    for (let i = 0; i < requiredMembers.length; i++) {
      const member = requiredMembers[i];
      const key = member.alias || member.name;

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

  private getNonNullableTypeMinChars(type: string, visited: Set<string>): number {
    if (type.startsWith("JSON.Box<") || type.startsWith("Box<")) {
      const genericStart = type.indexOf("<");
      const genericEnd = type.lastIndexOf(">");
      if (genericStart !== -1 && genericEnd !== -1 && genericEnd > genericStart) {
        return this.getTypeMinChars(type.slice(genericStart + 1, genericEnd), visited);
      }
    }

    if (type.startsWith("Array<") || type.startsWith("StaticArray<") || type.startsWith("Set<")) return 2; // []
    if (type.startsWith("Map<")) return 2; // {}

    if (type == "string" || type == "String" || type == "JSON.Raw" || type == "Raw") return 2; // ""
    if (type == "Date") return 26; // "1970-01-01T00:00:00.000Z"
    if (type == "bool" || type == "boolean") return 4; // true
    if (Schema.isNumericType(type)) return 1; // 0
    if (type == "JSON.Obj" || type == "Obj") return 2; // {}
    if (type == "JSON.Value" || type == "Value") return 1; // 0

    const dep = this.deps.find((schema) => schema.name === type || schema.name.endsWith("." + type));
    if (dep) return dep.getMinLength(visited) >> 1;

    if (this.parent && (this.parent.name === type || this.parent.name.endsWith("." + type))) {
      return this.parent.getMinLength(visited) >> 1;
    }

    return 1;
  }

  private static isNumericType(type: string): boolean {
    return ["u8", "u16", "u32", "u64", "usize", "i8", "i16", "i32", "i64", "isize", "f32", "f64"].includes(type);
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
  private nodeMap: Map<Node, NamespaceDeclaration[]> = new Map<Node, NamespaceDeclaration[]>();
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
          this.traverse(namespaceDeclaration.members, [...path, namespaceDeclaration]);
          break;
        case NodeKind.ClassDeclaration:
          // eslint-disable-next-line no-case-declarations
          const classDeclaration = node as ClassDeclaration;
          this.classes[this.qualifiedName(classDeclaration, path)] = classDeclaration;
          break;
        case NodeKind.EnumDeclaration:
          // eslint-disable-next-line no-case-declarations
          const enumDeclaration = node as EnumDeclaration;
          this.enums[this.qualifiedName(enumDeclaration, path)] = enumDeclaration;
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
  getImportedClass(qualifiedName: string, parser: Parser): ClassDeclaration | null {
    for (const stmt of this.imports) {
      const externalSource = parser.sources.filter((src) => src.internalPath != this.internalPath).find((src) => src.internalPath == stmt.internalPath);
      if (!externalSource) continue;

      const source = this.sourceSet.get(externalSource);
      const classDeclaration = source.getClass(qualifiedName);
      if (classDeclaration && classDeclaration.flags & CommonFlags.Export) {
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
  getImportedEnum(qualifiedName: string, parser: Parser): EnumDeclaration | null {
    for (const stmt of this.imports) {
      const externalSource = parser.sources.filter((src) => src.internalPath != this.internalPath).find((src) => src.internalPath == stmt.internalPath);
      if (!externalSource) continue;

      const source = this.sourceSet.get(externalSource);
      const enumDeclaration = source.getEnum(qualifiedName);
      if (enumDeclaration && enumDeclaration.flags & CommonFlags.Export) {
        return enumDeclaration;
      }
    }
    return null;
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
  private qualifiedName(node: DeclarationStatement, parents: NamespaceDeclaration[]): string {
    return parents?.length ? parents.map((p) => p.name.text).join(".") + "." + node.name.text : node.name.text;
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
