import { Source, Expression, Statement, NamespaceDeclaration, ClassDeclaration, DeclarationStatement, Range, Node } from "assemblyscript/dist/assemblyscript.js";
export declare class SimpleParser {
    private static get parser();
    private static getTokenizer;
    static parseExpression(s: string): Expression;
    static parseStatement(s: string, topLevel?: boolean): Statement;
    static parseTopLevelStatement(s: string, namespace?: NamespaceDeclaration | null): Statement;
    static parseClassMember(s: string, _class: ClassDeclaration): DeclarationStatement;
}
export declare function isStdlib(s: Source | {
    range: Range;
}): boolean;
export declare function toString(node: Node): string;
export declare function replaceRef(node: Node, replacement: Node | Node[], ref: Node | Node[] | null): void;
export declare function cloneNode(input: Node | Node[] | null, seen?: WeakMap<object, any>, path?: string): Node | Node[] | null;
export declare function stripExpr(node: Node): Node;
export declare function removeExtension(filePath: string): string;
//# sourceMappingURL=util.d.ts.map