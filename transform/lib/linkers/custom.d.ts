import { CallExpression, Node } from "assemblyscript/dist/assemblyscript.js";
import { Visitor } from "../visitor.js";
export declare class CustomTransform extends Visitor {
    static SN: CustomTransform;
    private modify;
    visitCallExpression(node: CallExpression): void;
    static visit(node: Node | Node[], ref?: Node | null): void;
    static hasCall(node: Node | Node[]): boolean;
}
//# sourceMappingURL=custom.d.ts.map