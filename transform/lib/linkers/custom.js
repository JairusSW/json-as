import { Node } from "assemblyscript/dist/assemblyscript.js";
import { Visitor } from "../visitor.js";
export class CustomTransform extends Visitor {
    static SN = new CustomTransform();
    modify = false;
    visitCallExpression(node) {
        super.visit(node.args, node);
        if (node.expression.kind != 21)
            return;
        const expression = node.expression;
        const property = expression.property.text;
        if (property != "stringify" && property != "parse")
            return;
        if (expression.expression.kind != 6 || expression.expression.text != "JSON")
            return;
        if (this.modify) {
            expression.expression = Node.createPropertyAccessExpression(Node.createIdentifierExpression("JSON", node.expression.range), Node.createIdentifierExpression("internal", node.expression.range), node.expression.range);
        }
        this.modify = true;
    }
    static visit(node, ref = null) {
        if (!node)
            return;
        CustomTransform.SN.modify = true;
        CustomTransform.SN.visit(node, ref);
        CustomTransform.SN.modify = false;
    }
    static hasCall(node) {
        if (!node)
            return false;
        CustomTransform.SN.modify = false;
        CustomTransform.SN.visit(node);
        return CustomTransform.SN.modify;
    }
}
//# sourceMappingURL=custom.js.map