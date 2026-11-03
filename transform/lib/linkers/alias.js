import { Visitor } from "../visitor.js";
import { toString, cloneNode, SimpleParser } from "../util.js";
class AliasFinder extends Visitor {
    visitTypeDeclaration(node, _ref) {
        TypeAlias.add(node.name.text, node.type, node.typeParameters);
    }
}
export class TypeAlias {
    name;
    type;
    constructor(name, type) {
        this.name = name;
        this.type = type;
    }
    parameters = [];
    getBaseType(arguments_ = []) {
        const text = typeof this.type === "string" ? this.type : this.type.getBaseType();
        if (!this.parameters.length)
            return text;
        const declaration = SimpleParser.parseTopLevelStatement(`type __JSON_ALIAS = ${text};`);
        const bindings = new Map(this.parameters.map((name, i) => [name, arguments_[i]]));
        class InstantiateAlias extends Visitor {
            visitNamedTypeNode(type) {
                const argument = bindings.get(toString(type.name));
                if (argument) {
                    const nullable = type.isNullable;
                    Object.assign(type, cloneNode(argument));
                    type.isNullable ||= nullable;
                }
                else
                    super.visitNamedTypeNode(type);
            }
        }
        new InstantiateAlias().visit(declaration.type);
        return toString(declaration.type);
    }
    static foundAliases = new Map();
    static parameters = new Map();
    static aliases = new Map();
    static add(name, type, parameters = null) {
        this.parameters.set(name, parameters?.map((parameter) => parameter.name.text) ?? []);
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
        this.parameters.clear();
        this.aliases.clear();
        const finder = new AliasFinder();
        finder.visit(source);
        for (const [name, typeStr] of this.foundAliases) {
            const alias = new TypeAlias(name, typeStr);
            alias.parameters = this.parameters.get(name) ?? [];
            this.aliases.set(name, alias);
        }
        for (const alias of this.aliases.values()) {
            if (typeof alias.type === "string" && this.aliases.has(alias.type)) {
                alias.type = this.aliases.get(alias.type);
            }
        }
        return [...this.aliases.values()];
    }
}
