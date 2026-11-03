import { Source, TypeNode, TypeParameterNode } from "assemblyscript/dist/assemblyscript.js";
export declare class TypeAlias {
    name: string;
    type: TypeAlias | string;
    constructor(name: string, type: TypeAlias | string);
    parameters: string[];
    getBaseType(arguments_?: TypeNode[]): string;
    static foundAliases: Map<string, string>;
    static parameters: Map<string, string[]>;
    static aliases: Map<string, TypeAlias>;
    static add(name: string, type: TypeNode, parameters?: TypeParameterNode[] | null): void;
    static getAliases(source: Source): TypeAlias[];
}
