import { Node, Source, TypeDeclaration, TypeNode } from "assemblyscript/dist/assemblyscript.js";
import { Visitor } from "../visitor.js";
import { toString } from "../util.js";

class AliasFinder extends Visitor {
  visitTypeDeclaration(node: TypeDeclaration, ref?: Node | null): void {
    TypeAlias.add(node.name.text, node.type);
  }
}

export class TypeAlias {
  public name: string;
  public type: TypeAlias | string;

  constructor(name: string, type: TypeAlias | string) {
    this.name = name;
    this.type = type;
  }

  getBaseType(type: TypeAlias | string = this.type): string {
    if (typeof type === "string") return type;
    return this.getBaseType(type.type);
  }

  static foundAliases: Map<string, string> = new Map<string, string>();
  static aliases: Map<string, TypeAlias> = new Map<string, TypeAlias>();

  static add(name: string, type: TypeNode): void {
    if (!TypeAlias.foundAliases.has(name)) {
      TypeAlias.foundAliases.set(name, toString(type));
    } else {
      const existingType = TypeAlias.foundAliases.get(name);
      if (existingType !== toString(type)) {
        throw new Error(`Type alias conflict for ${name}: "${existingType}" vs "${toString(type)}"`);
      }
    }
  }

  static getAliases(source: Source): TypeAlias[] {
    this.foundAliases.clear();
    this.aliases.clear();

    const finder = new AliasFinder();
    finder.visit(source);

    for (const [name, typeStr] of this.foundAliases) {
      this.aliases.set(name, new TypeAlias(name, typeStr));
    }

    for (const alias of this.aliases.values()) {
      if (typeof alias.type === "string" && this.aliases.has(alias.type)) {
        alias.type = this.aliases.get(alias.type)!;
      }
    }

    return [...this.aliases.values()];
  }
}
