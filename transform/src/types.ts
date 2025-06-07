import { ClassDeclaration, Expression, FieldDeclaration, Source } from "assemblyscript/dist/assemblyscript.js";
import { TypeAlias } from "./linkers/alias.js";
import { JSONTransform } from "./index.js";

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
  public generic: boolean = false;
  public _custom: boolean = false;
  public parent: Schema;
  set custom(value: boolean) {
    this._custom = value;
  }
  get custom(): boolean {
    if (this._custom) return true;
    if (this.parent.node.isGeneric && this.parent.node.typeParameters.some((p) => p.name.text == this.type)) {
      // console.log("Custom (Generic): " + this.name);
      this.generic = true;
      this._custom = true;
      return true;
    }

    for (const dep of this.parent.deps) {
      if (this.name == dep.name) {
        // console.log("Custom (Dependency): " + this.name);
        this._custom = true;
        return true;
      }
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
  }
}

export class Src {
  public internalPath: string;
  public schemas: Schema[];
  public aliases: TypeAlias[];
  public imports: Schema[];
  public exports: Schema[];
  constructor(source: Source) {
    this.internalPath = source.internalPath;
    this.aliases = TypeAlias.getAliases(source);
  }
}
