import { ImportStatement, Node, Source } from "assemblyscript/dist/assemblyscript.js";
import { Visitor } from "../visitor.js";

class ImportGetter extends Visitor {
  static SN: ImportGetter = new ImportGetter();

  private imports: ImportStatement[] = [];

  visitImportStatement(node: ImportStatement, ref?: Node | null): void {
    this.imports.push(node);
  }

  static getImports(source: Source): ImportStatement[] {
    ImportGetter.SN.imports = [];
    ImportGetter.SN.visit(source);
    return ImportGetter.SN.imports;
  }
}

export function getImports(source: Source): ImportStatement[] {
  return ImportGetter.getImports(source);
}
