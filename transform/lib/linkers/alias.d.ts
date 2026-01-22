import { Source, TypeNode } from "assemblyscript/dist/assemblyscript.js";
export declare class TypeAlias {
    name: string;
    type: TypeAlias | string;
    constructor(name: string, type: TypeAlias | string);
    getBaseType(type?: TypeAlias | string): string;
    static foundAliases: Map<string, string>;
    static aliases: Map<string, TypeAlias>;
    static add(name: string, type: TypeNode): void;
    static getAliases(source: Source): TypeAlias[];
}
//# sourceMappingURL=alias.d.ts.map