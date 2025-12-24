import { Visitor } from "../visitor.js";
import { toString } from "../util.js";
class AliasFinder extends Visitor {
    visitTypeDeclaration(node, ref) {
        TypeAlias.add(node.name.text, node.type);
    }
}
export class TypeAlias {
    name;
    type;
    constructor(name, type) {
        this.name = name;
        this.type = type;
    }
    getBaseType(type = this.type) {
        if (typeof type === "string")
            return type;
        return this.getBaseType(type.type);
    }
    static foundAliases = new Map();
    static aliases = new Map();
    static add(name, type) {
        if (!TypeAlias.foundAliases.has(name)) {
            TypeAlias.foundAliases.set(name, toString(type));
        }
        else {
            const existingType = TypeAlias.foundAliases.get(name);
            if (existingType !== toString(type)) {
                throw new Error(`Type alias conflict for ${name}: "${existingType}" vs "${toString(type)}"`);
            }
        }
    }
    static getAliases(source) {
        this.foundAliases.clear();
        this.aliases.clear();
        const finder = new AliasFinder();
        finder.visit(source);
        for (const [name, typeStr] of this.foundAliases) {
            this.aliases.set(name, new TypeAlias(name, typeStr));
        }
        for (const alias of this.aliases.values()) {
            if (typeof alias.type === "string" && this.aliases.has(alias.type)) {
                alias.type = this.aliases.get(alias.type);
            }
        }
        return [...this.aliases.values()];
    }
}
//# sourceMappingURL=alias.js.map