import { Node, } from "assemblyscript/dist/assemblyscript.js";
import { NodeKind } from "../types.js";
import { Visitor } from "../visitor.js";
export class CustomTransform extends Visitor {
    runtimeReceiver;
    scopes = [];
    constructor(runtimeReceiver) {
        super();
        this.runtimeReceiver = runtimeReceiver;
    }
    names(nodes) {
        const names = new Set();
        for (let node of nodes) {
            if (node.kind === NodeKind.ExportDefault)
                node = node.declaration;
            if (node.kind === NodeKind.Variable) {
                for (const declaration of node.declarations)
                    names.add(declaration.name.text);
            }
            else {
                const name = node.name;
                if (name)
                    names.add(name.text);
            }
        }
        return names;
    }
    visitBlockStatement(node) {
        this.scopes.push(this.names(node.statements));
        super.visitBlockStatement(node);
        this.scopes.pop();
    }
    visitForStatement(node) {
        this.scopes.push(this.names(node.initializer ? [node.initializer] : []));
        super.visitForStatement(node);
        this.scopes.pop();
    }
    visitForOfStatement(node) {
        this.scopes.push(this.names([node.variable]));
        super.visitForOfStatement(node);
        this.scopes.pop();
    }
    visitTryStatement(node) {
        for (const [statements, variable] of [
            [node.bodyStatements, null],
            [node.catchStatements, node.catchVariable],
            [node.finallyStatements, null],
        ]) {
            if (!statements)
                continue;
            const scope = this.names(statements);
            if (variable)
                scope.add(variable.text);
            this.scopes.push(scope);
            this.visit(statements, node);
            this.scopes.pop();
        }
    }
    callable(node) {
        this.scopes.push(new Set(node.signature.parameters.map((p) => p.name.text)));
        this.visit(node.body, node);
        this.scopes.pop();
    }
    visitMethodDeclaration(node) {
        this.callable(node);
    }
    visitFunctionDeclaration(node) {
        this.callable(node);
    }
    visitFunctionExpression(node) {
        this.visit(node.declaration, node);
    }
    visitCallExpression(node) {
        super.visitCallExpression(node);
        if (node.expression.kind !== NodeKind.PropertyAccess)
            return;
        const expression = node.expression;
        if (!["stringify", "parse"].includes(expression.property.text))
            return;
        const receiver = expression.expression;
        if (receiver.kind !== NodeKind.Identifier)
            return;
        const name = receiver.text;
        if (this.scopes.some((scope) => scope.has(name)) ||
            !this.runtimeReceiver(name))
            return;
        expression.expression = Node.createPropertyAccessExpression(receiver, Node.createIdentifierExpression("internal", node.expression.range), node.expression.range);
    }
    static visit(node, runtimeReceiver, scopes) {
        const visitor = new CustomTransform(runtimeReceiver);
        visitor.scopes = scopes.map((nodes) => visitor.names(nodes));
        visitor.visit(node);
    }
}
