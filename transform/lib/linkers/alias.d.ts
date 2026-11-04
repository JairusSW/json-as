import { Source, TypeDeclaration, TypeNode, TypeParameterNode } from "assemblyscript/dist/assemblyscript.js";
export declare function effectiveTypeArguments(parameters: TypeParameterNode[] | null, supplied?: TypeNode[]): TypeNode[] | null;
export declare class TypeAlias {
    name: string;
    type: TypeAlias | string;
    constructor(name: string, type: TypeAlias | string);
    parameters: string[];
    declaration: TypeDeclaration | null;
    arguments(supplied?: TypeNode[]): TypeNode[] | null;
    getBaseType(arguments_?: TypeNode[]): string;
    static foundAliases: Map<string, string>;
    static parameters: Map<string, string[]>;
    static declarations: Map<string, TypeDeclaration>;
    static aliases: Map<string, TypeAlias>;
    static add(name: string, type: TypeNode, parameters?: TypeParameterNode[] | null, declaration?: TypeDeclaration | null): void;
    static getAliases(source: Source): TypeAlias[];
}
