import { Visitor } from "../visitor.js";
import { getImports } from "./imports.js";
export function getImportedClass(name, source, parser) {
    for (const stmt of getImports(source)) {
        const externalSource = parser.sources.filter((src) => src.internalPath != source.internalPath).find((src) => src.internalPath == stmt.internalPath);
        if (!externalSource)
            continue;
        const classDeclaration = ClassGetter.getClass(name, externalSource);
        if (!classDeclaration)
            continue;
        if (!(classDeclaration.flags & 2))
            continue;
        return classDeclaration;
    }
    return null;
}
class ClassGetter extends Visitor {
    static SN = new ClassGetter();
    classes = [];
    visitClassDeclaration(node) {
        this.classes.push(node);
    }
    static getClass(name, source) {
        return ClassGetter.getClasses(source).find((c) => c.name.text == name) || null;
    }
    static getClasses(source) {
        return source.statements.filter((stmt) => stmt.kind == 51);
    }
}
export function getClasses(source) {
    return ClassGetter.getClasses(source);
}
export function getClass(name, source) {
    return ClassGetter.getClass(name, source);
}
//# sourceMappingURL=classes.js.map