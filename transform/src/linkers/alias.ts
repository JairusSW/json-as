import {
  Node,
  Source,
  TypeDeclaration,
  TypeNode,
  TypeParameterNode,
  NamedTypeNode,
  NamespaceDeclaration,
  FunctionDeclaration,
  MethodDeclaration,
  FunctionExpression,
  BlockStatement,
} from "assemblyscript/dist/assemblyscript.js";
import { Visitor } from "../visitor.js";
import { toString, cloneNode, SimpleParser } from "../util.js";

export function effectiveTypeArguments(
  parameters: TypeParameterNode[] | null,
  supplied: TypeNode[] = [],
): TypeNode[] | null {
  if (supplied.length > (parameters?.length ?? 0)) return null;
  const result = supplied.map((argument) => cloneNode(argument) as TypeNode);
  const bindings = new Map<string, TypeNode>();
  class Substitute extends Visitor {
    visitNamedTypeNode(type: NamedTypeNode): void {
      const value = bindings.get(toString(type.name));
      if (value) {
        const nullable = type.isNullable;
        Object.assign(type, cloneNode(value));
        type.isNullable ||= nullable;
      } else super.visitNamedTypeNode(type);
    }
  }
  const substitute = new Substitute();
  for (let i = 0; i < (parameters?.length ?? 0); i++) {
    const parameter = parameters![i];
    if (!result[i]) {
      if (!parameter.defaultType) return null;
      const value = cloneNode(parameter.defaultType) as TypeNode;
      substitute.visit(value);
      result.push(value);
    }
    bindings.set(parameter.name.text, result[i]);
  }
  return result;
}

class AliasFinder extends Visitor {
  private namespace: string[] = [];
  // Schema aliases are module/namespace declarations, never function locals.
  visitFunctionDeclaration(_node: FunctionDeclaration): void {}
  visitMethodDeclaration(_node: MethodDeclaration): void {}
  visitFunctionExpression(_node: FunctionExpression): void {}
  visitBlockStatement(_node: BlockStatement): void {}
  visitNamespaceDeclaration(node: NamespaceDeclaration): void {
    this.namespace.push(node.name.text);
    super.visitNamespaceDeclaration(node);
    this.namespace.pop();
  }
  visitTypeDeclaration(node: TypeDeclaration, _ref?: Node | null): void {
    TypeAlias.add(
      [...this.namespace, node.name.text].join("."),
      node.type,
      node.typeParameters,
      node,
    );
  }
}

export class TypeAlias {
  public name: string;
  public type: TypeAlias | string;

  constructor(name: string, type: TypeAlias | string) {
    this.name = name;
    this.type = type;
  }

  public parameters: string[] = [];
  public declaration: TypeDeclaration | null = null;

  arguments(supplied: TypeNode[] = []): TypeNode[] | null {
    return this.declaration
      ? effectiveTypeArguments(this.declaration.typeParameters, supplied)
      : supplied.length === this.parameters.length
        ? supplied
        : null;
  }

  getBaseType(arguments_: TypeNode[] = []): string {
    arguments_ = this.arguments(arguments_) ?? arguments_;
    const text =
      typeof this.type === "string" ? this.type : this.type.getBaseType();
    if (!this.parameters.length) return text;
    const declaration = SimpleParser.parseTopLevelStatement(
      `type __JSON_ALIAS = ${text};`,
    ) as TypeDeclaration;
    const bindings = new Map(
      this.parameters.map((name, i) => [name, arguments_[i]]),
    );
    class InstantiateAlias extends Visitor {
      visitNamedTypeNode(type: NamedTypeNode): void {
        const argument = bindings.get(toString(type.name));
        if (argument) {
          const nullable = type.isNullable;
          Object.assign(type, cloneNode(argument));
          type.isNullable ||= nullable;
        } else super.visitNamedTypeNode(type);
      }
    }
    new InstantiateAlias().visit(declaration.type);
    return toString(declaration.type);
  }

  static foundAliases: Map<string, string> = new Map<string, string>();
  static parameters = new Map<string, string[]>();
  static declarations = new Map<string, TypeDeclaration>();
  static aliases: Map<string, TypeAlias> = new Map<string, TypeAlias>();

  static add(
    name: string,
    type: TypeNode,
    parameters: TypeParameterNode[] | null = null,
    declaration: TypeDeclaration | null = null,
  ): void {
    if (declaration) this.declarations.set(name, declaration);
    this.parameters.set(
      name,
      parameters?.map((parameter) => parameter.name.text) ?? [],
    );
    if (!TypeAlias.foundAliases.has(name)) {
      TypeAlias.foundAliases.set(name, toString(type));
    } else {
      const existingType = TypeAlias.foundAliases.get(name);
      if (existingType !== toString(type)) {
        throw new Error(
          `Type alias conflict for ${name}: "${existingType}" vs "${toString(type)}"`,
        );
      }
    }
  }

  static getAliases(source: Source): TypeAlias[] {
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

    // Keep alias bodies in source form. Their lexical namespace and bound type
    // parameters are resolved at the use site before following another alias.

    return [...this.aliases.values()];
  }
}
