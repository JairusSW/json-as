import { CallExpression, IdentifierExpression, Node, NodeKind, PropertyAccessExpression } from "assemblyscript/dist/assemblyscript.js";
import { Visitor } from "../visitor.js";

export class CustomTransform extends Visitor {
  static SN: CustomTransform = new CustomTransform();
  private modify: boolean = false;
  visitCallExpression(node: CallExpression) {
    super.visit(node.args, node);
    if (node.expression.kind != NodeKind.PropertyAccess || (node.expression as PropertyAccessExpression).property.text != "stringify") return;
    if ((node.expression as PropertyAccessExpression).expression.kind != NodeKind.Identifier || ((node.expression as PropertyAccessExpression).expression as IdentifierExpression).text != "JSON") return;

    if (this.modify) {
      (node.expression as PropertyAccessExpression).expression = Node.createPropertyAccessExpression(Node.createIdentifierExpression("JSON", node.expression.range), Node.createIdentifierExpression("internal", node.expression.range), node.expression.range);
    }
    this.modify = true;

    // console.log(toString(node));
    // console.log(SimpleParser.parseStatement("JSON.internal.stringify").expression.expression)
  }
  static visit(node: Node | Node[], ref: Node | null = null): void {
    if (!node) return;
    CustomTransform.SN.modify = true;
    CustomTransform.SN.visit(node, ref);
    CustomTransform.SN.modify = false;
  }
  static hasCall(node: Node | Node[]): boolean {
    if (!node) return false;
    CustomTransform.SN.modify = false;
    CustomTransform.SN.visit(node);
    return CustomTransform.SN.modify;
  }
}
