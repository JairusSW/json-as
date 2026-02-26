import { ClassDeclaration, Expression, FieldDeclaration, Source, DeclarationStatement, Parser, ImportStatement, EnumDeclaration } from "assemblyscript/dist/assemblyscript.js";
import { TypeAlias } from "./linkers/alias.js";
export declare enum PropertyFlags {
    OmitNull = 0,
    OmitIf = 1,
    Raw = 2,
    Custom = 3
}
export declare class Property {
    name: string;
    alias: string | null;
    type: string;
    value: string | null;
    flags: Map<PropertyFlags, Expression | null>;
    node: FieldDeclaration;
    byteSize: number;
    _generic: boolean;
    _custom: boolean;
    parent: Schema;
    set custom(value: boolean);
    get custom(): boolean;
    set generic(value: boolean);
    get generic(): boolean;
}
export declare class Schema {
    static: boolean;
    name: string;
    members: Property[];
    parent: Schema | null;
    node: ClassDeclaration;
    needsLink: string | null;
    byteSize: number;
    deps: Schema[];
    private _custom;
    set custom(value: boolean);
    get custom(): boolean;
    getMinLength(visited?: Set<string>): number;
    private getTypeMinChars;
    private getNonNullableTypeMinChars;
    private static isNumericType;
}
export declare class SourceSet {
    private sources;
    get(source: Source): Src;
}
export declare class Src {
    private sourceSet;
    internalPath: string;
    normalizedPath: string;
    schemas: Schema[];
    aliases: TypeAlias[];
    exports: Schema[];
    imports: ImportStatement[];
    private nodeMap;
    private classes;
    private enums;
    constructor(source: Source, sourceSet: SourceSet);
    private traverse;
    getQualifiedName(node: DeclarationStatement): string;
    getClass(qualifiedName: string): ClassDeclaration | null;
    getEnum(qualifiedName: string): EnumDeclaration | null;
    getImportedClass(qualifiedName: string, parser: Parser): ClassDeclaration | null;
    getImportedEnum(qualifiedName: string, parser: Parser): EnumDeclaration | null;
    getFullPath(node: DeclarationStatement): string;
    resolveExtendsName(classDeclaration: ClassDeclaration): string;
    private qualifiedName;
    private getNamespaceOrClassName;
    private getIdentifier;
}
//# sourceMappingURL=types.d.ts.map