import { ClassDeclaration, Parser, Source, ImportStatement, Program } from "assemblyscript/dist/assemblyscript.js";
import { Transform } from "assemblyscript/dist/transform.js";
import { Visitor } from "./visitor.js";
import { Schema, Src, SourceSet } from "./types.js";
export declare class JSONTransform extends Visitor {
    static SN: JSONTransform;
    program: Program;
    baseCWD: string;
    parser: Parser;
    schemas: Map<string, Schema[]>;
    schema: Schema;
    sources: SourceSet;
    imports: ImportStatement[];
    simdStatements: string[];
    visitedClasses: Set<string>;
    visitClassDeclarationRef(node: ClassDeclaration): void;
    resolveType(type: string, source: Src, visited?: Set<string>): string;
    visitClassDeclaration(node: ClassDeclaration): void;
    getSchema(name: string): Schema | null;
    generateEmptyMethods(node: ClassDeclaration): void;
    visitImportStatement(node: ImportStatement): void;
    visitSource(node: Source): void;
    addImports(node: Source): void;
    getStores(data: string, simd?: boolean): string[];
    isValidType(type: string, node: ClassDeclaration): boolean;
}
export default class Transformer extends Transform {
    afterInitialize(program: Program): void | Promise<void>;
    afterParse(parser: Parser): void;
}
export declare function stripNull(type: string): string;
//# sourceMappingURL=index.d.ts.map