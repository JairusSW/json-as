import { Visitor } from "../visitor.js";
class ImportGetter extends Visitor {
    static SN = new ImportGetter();
    imports = [];
    visitImportStatement(node, ref) {
        this.imports.push(node);
    }
    static getImports(source) {
        ImportGetter.SN.imports = [];
        ImportGetter.SN.visit(source);
        return ImportGetter.SN.imports;
    }
}
export function getImports(source) {
    return ImportGetter.getImports(source);
}
//# sourceMappingURL=imports.js.map