import { ClassDeclaration, Expression, FieldDeclaration, Source, NamespaceDeclaration, DeclarationStatement, Parser, ImportStatement, EnumDeclaration } from "assemblyscript/dist/assemblyscript.js";
import { TypeAlias } from "./linkers/alias.js";
export declare const NodeKind: Record<string, number>;
export declare enum PropertyFlags {
    OmitNull = 0,
    OmitIf = 1,
    Raw = 2,
    Custom = 3,
    Lazy = 4,
    Optional = 5
}
export declare class Property {
    name: string;
    alias: string | null;
    type: string;
    nullable: boolean;
    value: string | null;
    flags: Map<PropertyFlags, Expression | null>;
    node: FieldDeclaration;
    byteSize: number;
    lazyInner: string | null;
    omitIfMethod: string | null;
    lazyPacked: boolean;
    lazyScalar: boolean;
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
    initializationMembers: Property[];
    parent: Schema | null;
    node: ClassDeclaration;
    needsLink: string | null;
    byteSize: number;
    deps: Schema[];
    customJsonKind: string;
    hasCustomCursorLifecycle: boolean;
    hasInternalInitializers: boolean;
    hasInitializerEffects: boolean;
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
    private exportStatements;
    private nodeMap;
    private classes;
    private enums;
    constructor(source: Source, sourceSet: SourceSet);
    private traverse;
    getQualifiedName(node: DeclarationStatement): string;
    getClass(qualifiedName: string): ClassDeclaration | null;
    getClassInContext(name: string, owner: DeclarationStatement, visited?: Set<string>): ClassDeclaration | null;
    registerAlias(alias: TypeAlias, namespaces?: NamespaceDeclaration[]): void;
    getClasses(): ClassDeclaration[];
    getEnum(qualifiedName: string): EnumDeclaration | null;
    getImportedClass(qualifiedName: string, parser: Parser, visited?: Set<string>): ClassDeclaration | null;
    resolveClass(name: string, owner: DeclarationStatement, parser: Parser, visited?: Set<string>): ClassDeclaration | null;
    getImportedBinding(name: string, parser: Parser, visited?: Set<string>): {
        source: Src;
        name: string;
    } | null;
    private getExportedBinding;
    getAvailableClass(qualifiedName: string, parser: Parser): ClassDeclaration | null;
    getImportedEnum(name: string, parser: Parser, visited?: Set<string>): EnumDeclaration | null;
    getFullPath(node: DeclarationStatement): string;
    resolveExtendsName(classDeclaration: ClassDeclaration): string;
    private qualifiedName;
    private getNamespaceOrClassName;
    private getIdentifier;
}
