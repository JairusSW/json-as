import { NodeKind } from "./types.js";
export class Visitor {
    currentSource = null;
    visit(node, ref = null) {
        if (node == null)
            return;
        if (node instanceof Array) {
            for (const n of node) {
                this._visit(n, ref);
            }
        }
        else {
            this._visit(node, ref);
        }
    }
    _visit(node, ref) {
        switch (node.kind) {
            case NodeKind.Source:
                this.visitSource(node, ref);
                break;
            case NodeKind.NamedType:
                this.visitNamedTypeNode(node, ref);
                break;
            case NodeKind.FunctionType:
                this.visitFunctionTypeNode(node, ref);
                break;
            case NodeKind.TypeName:
                this.visitTypeName(node, ref);
                break;
            case NodeKind.TypeParameter:
                this.visitTypeParameter(node, ref);
                break;
            case NodeKind.Identifier:
                this.visitIdentifierExpression(node, ref);
                break;
            case NodeKind.Assertion:
                this.visitAssertionExpression(node, ref);
                break;
            case NodeKind.Binary:
                this.visitBinaryExpression(node, ref);
                break;
            case NodeKind.Call:
                this.visitCallExpression(node, ref);
                break;
            case NodeKind.Class:
                this.visitClassExpression(node, ref);
                break;
            case NodeKind.Comma:
                this.visitCommaExpression(node, ref);
                break;
            case NodeKind.ElementAccess:
                this.visitElementAccessExpression(node, ref);
                break;
            case NodeKind.Function:
                this.visitFunctionExpression(node, ref);
                break;
            case NodeKind.InstanceOf:
                this.visitInstanceOfExpression(node, ref);
                break;
            case NodeKind.Literal:
                this.visitLiteralExpression(node, ref);
                break;
            case NodeKind.New:
                this.visitNewExpression(node, ref);
                break;
            case NodeKind.Parenthesized:
                this.visitParenthesizedExpression(node, ref);
                break;
            case NodeKind.PropertyAccess:
                this.visitPropertyAccessExpression(node, ref);
                break;
            case NodeKind.Ternary:
                this.visitTernaryExpression(node, ref);
                break;
            case NodeKind.UnaryPostfix:
                this.visitUnaryPostfixExpression(node, ref);
                break;
            case NodeKind.UnaryPrefix:
                this.visitUnaryPrefixExpression(node, ref);
                break;
            case NodeKind.Block:
                this.visitBlockStatement(node, ref);
                break;
            case NodeKind.Break:
                this.visitBreakStatement(node, ref);
                break;
            case NodeKind.Continue:
                this.visitContinueStatement(node, ref);
                break;
            case NodeKind.Do:
                this.visitDoStatement(node, ref);
                break;
            case NodeKind.Empty:
                this.visitEmptyStatement(node, ref);
                break;
            case NodeKind.Export:
                this.visitExportStatement(node, ref);
                break;
            case NodeKind.ExportDefault:
                this.visitExportDefaultStatement(node, ref);
                break;
            case NodeKind.ExportImport:
                this.visitExportImportStatement(node, ref);
                break;
            case NodeKind.Expression:
                this.visitExpressionStatement(node, ref);
                break;
            case NodeKind.For:
                this.visitForStatement(node, ref);
                break;
            case NodeKind.If:
                this.visitIfStatement(node, ref);
                break;
            case NodeKind.Import:
                this.visitImportStatement(node, ref);
                break;
            case NodeKind.Return:
                this.visitReturnStatement(node, ref);
                break;
            case NodeKind.Switch:
                this.visitSwitchStatement(node, ref);
                break;
            case NodeKind.Throw:
                this.visitThrowStatement(node, ref);
                break;
            case NodeKind.Try:
                this.visitTryStatement(node, ref);
                break;
            case NodeKind.Variable:
                this.visitVariableStatement(node, ref);
                break;
            case NodeKind.While:
                this.visitWhileStatement(node, ref);
                break;
            case NodeKind.ClassDeclaration:
                this.visitClassDeclaration(node, false, ref);
                break;
            case NodeKind.EnumDeclaration:
                this.visitEnumDeclaration(node, false, ref);
                break;
            case NodeKind.EnumValueDeclaration:
                this.visitEnumValueDeclaration(node, ref);
                break;
            case NodeKind.FieldDeclaration:
                this.visitFieldDeclaration(node, ref);
                break;
            case NodeKind.FunctionDeclaration:
                this.visitFunctionDeclaration(node, false, ref);
                break;
            case NodeKind.ImportDeclaration:
                this.visitImportDeclaration(node, ref);
                break;
            case NodeKind.InterfaceDeclaration:
                this.visitInterfaceDeclaration(node, false, ref);
                break;
            case NodeKind.MethodDeclaration:
                this.visitMethodDeclaration(node, ref);
                break;
            case NodeKind.NamespaceDeclaration:
                this.visitNamespaceDeclaration(node, false, ref);
                break;
            case NodeKind.TypeDeclaration:
                this.visitTypeDeclaration(node, ref);
                break;
            case NodeKind.VariableDeclaration:
                this.visitVariableDeclaration(node, ref);
                break;
            case NodeKind.Decorator:
                this.visitDecoratorNode(node, ref);
                break;
            case NodeKind.ExportMember:
                this.visitExportMember(node, ref);
                break;
            case NodeKind.SwitchCase:
                this.visitSwitchCase(node, ref);
                break;
            case NodeKind.IndexSignature:
                this.visitIndexSignature(node, ref);
                break;
            case NodeKind.Null:
                this.visitNullExpression(node, ref);
                break;
            case NodeKind.True: {
                this.visitTrueExpression(node, ref);
                break;
            }
            case NodeKind.False: {
                this.visitFalseExpression(node, ref);
                break;
            }
            case NodeKind.Compiled: {
                this.visitCompiledExpression(node, ref);
                break;
            }
            case NodeKind.Constructor: {
                this.visitConstructorExpression(node, ref);
                break;
            }
            case NodeKind.Comment: {
                this.visitComment(node, ref);
                break;
            }
            case NodeKind.ForOf: {
                this.visitForOfStatement(node, ref);
                break;
            }
            case NodeKind.Module: {
                this.visitModuleDeclaration(node, ref);
                break;
            }
            case NodeKind.Omitted: {
                this.visitOmittedExpression(node, ref);
                break;
            }
            case NodeKind.Parameter: {
                this.visitParameter(node, ref);
                break;
            }
            case NodeKind.Super: {
                this.visitSuperExpression(node, ref);
                break;
            }
            case NodeKind.This: {
                this.visitThisExpression(node, ref);
                break;
            }
            case NodeKind.Void: {
                this.visitVoidStatement(node, ref);
                break;
            }
            default:
                throw new Error("Could not visit invalid type!");
        }
    }
    visitSource(node, _ref = null) {
        this.currentSource = node;
        this.visit(node.statements, node);
        this.currentSource = null;
    }
    visitTypeNode(_node, _ref = null) { }
    visitTypeName(node, _ref = null) {
        this.visit(node.identifier, node);
        this.visit(node.next, node);
    }
    visitNamedTypeNode(node, _ref = null) {
        this.visit(node.name, node);
        this.visit(node.typeArguments, node);
    }
    visitFunctionTypeNode(node, _ref = null) {
        this.visit(node.parameters, node);
        this.visit(node.returnType, node);
        this.visit(node.explicitThisType, node);
    }
    visitTypeParameter(node, _ref = null) {
        this.visit(node.name, node);
        this.visit(node.extendsType, node);
        this.visit(node.defaultType, node);
    }
    visitIdentifierExpression(_node, _ref = null) { }
    visitArrayLiteralExpression(node, _ref = null) {
        this.visit(node.elementExpressions, node);
    }
    visitObjectLiteralExpression(node, _ref = null) {
        this.visit(node.names, node);
        this.visit(node.values, node);
    }
    visitAssertionExpression(node, _ref = null) {
        this.visit(node.toType, node);
        this.visit(node.expression, node);
    }
    visitBinaryExpression(node, _ref = null) {
        this.visit(node.left, node);
        this.visit(node.right, node);
    }
    visitCallExpression(node, _ref = null) {
        this.visit(node.expression, node);
        this.visit(node.typeArguments, node);
        this.visit(node.args, node);
    }
    visitClassExpression(node, _ref = null) {
        this.visit(node.declaration, node);
    }
    visitCommaExpression(node, _ref = null) {
        this.visit(node.expressions, node);
    }
    visitElementAccessExpression(node, _ref = null) {
        this.visit(node.elementExpression, node);
        this.visit(node.expression, node);
    }
    visitFunctionExpression(node, _ref = null) {
        this.visit(node.declaration, node);
    }
    visitLiteralExpression(node, _ref = null) {
        switch (node.literalKind) {
            case 0:
                this.visitFloatLiteralExpression(node);
                break;
            case 1:
                this.visitIntegerLiteralExpression(node);
                break;
            case 2:
                this.visitStringLiteralExpression(node);
                break;
            case 3:
                this.visitTemplateLiteralExpression(node);
                break;
            case 4:
                this.visitRegexpLiteralExpression(node);
                break;
            case 5:
                this.visitArrayLiteralExpression(node);
                break;
            case 6:
                this.visitObjectLiteralExpression(node);
                break;
            default:
                throw new Error("Invalid LiteralKind at visitLiteralExpression(): " + node.literalKind);
        }
    }
    visitFloatLiteralExpression(_node, _ref = null) { }
    visitInstanceOfExpression(node, _ref = null) {
        this.visit(node.expression, node);
        this.visit(node.isType, node);
    }
    visitIntegerLiteralExpression(_node, _ref = null) { }
    visitStringLiteralExpression(_node, _ref = null) { }
    visitTemplateLiteralExpression(_node, _ref = null) { }
    visitRegexpLiteralExpression(_node, _ref = null) { }
    visitNewExpression(node, _ref = null) {
        this.visit(node.typeName, node);
        this.visit(node.typeArguments, node);
        this.visit(node.args, node);
    }
    visitParenthesizedExpression(node, _ref = null) {
        this.visit(node.expression, node);
    }
    visitPropertyAccessExpression(node, _ref = null) {
        this.visit(node.property, node);
        this.visit(node.expression, node);
    }
    visitTernaryExpression(node, _ref = null) {
        this.visit(node.condition, node);
        this.visit(node.ifThen, node);
        this.visit(node.ifElse, node);
    }
    visitUnaryExpression(node, _ref = null) {
        this.visit(node.operand, node);
    }
    visitUnaryPostfixExpression(node, _ref = null) {
        this.visit(node.operand, node);
    }
    visitUnaryPrefixExpression(node, _ref = null) {
        this.visit(node.operand, node);
    }
    visitSuperExpression(_node, _ref = null) { }
    visitFalseExpression(_node, _ref = null) { }
    visitTrueExpression(_node, _ref = null) { }
    visitThisExpression(_node, _ref = null) { }
    visitNullExpression(_node, _ref = null) { }
    visitConstructorExpression(_node, _ref = null) { }
    visitNodeAndTerminate(_statement, _ref = null) { }
    visitBlockStatement(node, _ref = null) {
        this.visit(node.statements, node);
    }
    visitBreakStatement(node, _ref = null) {
        this.visit(node.label, node);
    }
    visitContinueStatement(node, _ref = null) {
        this.visit(node.label, node);
    }
    visitClassDeclaration(node, _isDefault = false, _ref = null) {
        this.visit(node.name, node);
        this.visit(node.decorators, node);
        if (node.isGeneric ? node.typeParameters != null : node.typeParameters == null) {
            this.visit(node.typeParameters, node);
            this.visit(node.extendsType, node);
            this.visit(node.implementsTypes, node);
            this.visit(node.members, node);
        }
        else {
            throw new Error("Expected to type parameters to match class declaration, but found type mismatch instead!");
        }
    }
    visitDoStatement(node, _ref = null) {
        this.visit(node.condition, node);
        this.visit(node.body, node);
    }
    visitEmptyStatement(_node, _ref = null) { }
    visitEnumDeclaration(node, _isDefault = false, _ref = null) {
        this.visit(node.name, node);
        this.visit(node.decorators, node);
        this.visit(node.values, node);
    }
    visitEnumValueDeclaration(node, _ref = null) {
        this.visit(node.name, node);
        this.visit(node.initializer, node);
    }
    visitExportImportStatement(node, _ref = null) {
        this.visit(node.name, node);
        this.visit(node.externalName, node);
    }
    visitExportMember(node, _ref = null) {
        this.visit(node.localName, node);
        this.visit(node.exportedName, node);
    }
    visitExportStatement(node, _ref = null) {
        this.visit(node.path, node);
        this.visit(node.members, node);
    }
    visitExportDefaultStatement(node, _ref = null) {
        this.visit(node.declaration, node);
    }
    visitExpressionStatement(node, ref = null) {
        this.visit(node.expression, ref);
    }
    visitFieldDeclaration(node, _ref = null) {
        this.visit(node.name, node);
        this.visit(node.type, node);
        this.visit(node.initializer, node);
        this.visit(node.decorators, node);
    }
    visitForStatement(node, _ref = null) {
        this.visit(node.initializer, node);
        this.visit(node.condition, node);
        this.visit(node.incrementor, node);
        this.visit(node.body, node);
    }
    visitFunctionDeclaration(node, _isDefault = false, _ref = null) {
        this.visit(node.name, node);
        this.visit(node.decorators, node);
        this.visit(node.typeParameters, node);
        this.visit(node.signature, node);
        this.visit(node.body, node);
    }
    visitIfStatement(node, _ref = null) {
        this.visit(node.condition, node);
        this.visit(node.ifTrue, node);
        this.visit(node.ifFalse, node);
    }
    visitImportDeclaration(node, _ref = null) {
        this.visit(node.foreignName, node);
        this.visit(node.name, node);
        this.visit(node.decorators, node);
    }
    visitImportStatement(node, _ref = null) {
        this.visit(node.namespaceName, node);
        this.visit(node.declarations, node);
    }
    visitIndexSignature(node, _ref = null) {
        this.visit(node.keyType, node);
        this.visit(node.valueType, node);
    }
    visitInterfaceDeclaration(node, _isDefault = false, _ref = null) {
        this.visit(node.name, node);
        this.visit(node.typeParameters, node);
        this.visit(node.implementsTypes, node);
        this.visit(node.extendsType, node);
        this.visit(node.members, node);
    }
    visitMethodDeclaration(node, _ref = null) {
        this.visit(node.name, node);
        this.visit(node.typeParameters, node);
        this.visit(node.signature, node);
        this.visit(node.decorators, node);
        this.visit(node.body, node);
    }
    visitNamespaceDeclaration(node, _isDefault = false, _ref = null) {
        this.visit(node.name, node);
        this.visit(node.decorators, node);
        this.visit(node.members, node);
    }
    visitReturnStatement(node, _ref = null) {
        this.visit(node.value, node);
    }
    visitSwitchCase(node, _ref = null) {
        this.visit(node.label, node);
        this.visit(node.statements, node);
    }
    visitSwitchStatement(node, _ref = null) {
        this.visit(node.condition, node);
        this.visit(node.cases, node);
    }
    visitThrowStatement(node, _ref = null) {
        this.visit(node.value, node);
    }
    visitTryStatement(node, _ref = null) {
        this.visit(node.bodyStatements, node);
        this.visit(node.catchVariable, node);
        this.visit(node.catchStatements, node);
        this.visit(node.finallyStatements, node);
    }
    visitTypeDeclaration(node, _ref = null) {
        this.visit(node.name, node);
        this.visit(node.decorators, node);
        this.visit(node.type, node);
        this.visit(node.typeParameters, node);
    }
    visitVariableDeclaration(node, _ref = null) {
        this.visit(node.name, node);
        this.visit(node.type, node);
        this.visit(node.initializer, node);
    }
    visitVariableStatement(node, _ref = null) {
        this.visit(node.decorators, node);
        this.visit(node.declarations, node);
    }
    visitWhileStatement(node, _ref = null) {
        this.visit(node.condition, node);
        this.visit(node.body, node);
    }
    visitVoidStatement(_node, _ref = null) { }
    visitComment(_node, _ref = null) { }
    visitDecoratorNode(node, _ref = null) {
        this.visit(node.name, node);
        this.visit(node.args, node);
    }
    visitParameter(node, _ref = null) {
        this.visit(node.name, node);
        this.visit(node.implicitFieldDeclaration, node);
        this.visit(node.initializer, node);
        this.visit(node.type, node);
    }
    visitCompiledExpression(_node, _ref = null) { }
    visitForOfStatement(node, _ref = null) {
        this.visit(node.body, node);
        this.visit(node.variable, node);
        this.visit(node.iterable, node);
    }
    visitModuleDeclaration(_node, _ref = null) { }
    visitOmittedExpression(_node, _ref = null) { }
}
//# sourceMappingURL=visitor.js.map