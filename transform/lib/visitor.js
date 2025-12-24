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
            case 0:
                this.visitSource(node, ref);
                break;
            case 1:
                this.visitNamedTypeNode(node, ref);
                break;
            case 2:
                this.visitFunctionTypeNode(node, ref);
                break;
            case 3:
                this.visitTypeName(node, ref);
                break;
            case 4:
                this.visitTypeParameter(node, ref);
                break;
            case 6:
                this.visitIdentifierExpression(node, ref);
                break;
            case 7:
                this.visitAssertionExpression(node, ref);
                break;
            case 8:
                this.visitBinaryExpression(node, ref);
                break;
            case 9:
                this.visitCallExpression(node, ref);
                break;
            case 10:
                this.visitClassExpression(node, ref);
                break;
            case 11:
                this.visitCommaExpression(node, ref);
                break;
            case 12:
                this.visitElementAccessExpression(node, ref);
                break;
            case 14:
                this.visitFunctionExpression(node, ref);
                break;
            case 15:
                this.visitInstanceOfExpression(node, ref);
                break;
            case 16:
                this.visitLiteralExpression(node, ref);
                break;
            case 17:
                this.visitNewExpression(node, ref);
                break;
            case 20:
                this.visitParenthesizedExpression(node, ref);
                break;
            case 21:
                this.visitPropertyAccessExpression(node, ref);
                break;
            case 22:
                this.visitTernaryExpression(node, ref);
                break;
            case 27:
                this.visitUnaryPostfixExpression(node, ref);
                break;
            case 28:
                this.visitUnaryPrefixExpression(node, ref);
                break;
            case 30:
                this.visitBlockStatement(node, ref);
                break;
            case 31:
                this.visitBreakStatement(node, ref);
                break;
            case 32:
                this.visitContinueStatement(node, ref);
                break;
            case 33:
                this.visitDoStatement(node, ref);
                break;
            case 34:
                this.visitEmptyStatement(node, ref);
                break;
            case 35:
                this.visitExportStatement(node, ref);
                break;
            case 36:
                this.visitExportDefaultStatement(node, ref);
                break;
            case 37:
                this.visitExportImportStatement(node, ref);
                break;
            case 38:
                this.visitExpressionStatement(node, ref);
                break;
            case 39:
                this.visitForStatement(node, ref);
                break;
            case 41:
                this.visitIfStatement(node, ref);
                break;
            case 42:
                this.visitImportStatement(node, ref);
                break;
            case 43:
                this.visitReturnStatement(node, ref);
                break;
            case 44:
                this.visitSwitchStatement(node, ref);
                break;
            case 45:
                this.visitThrowStatement(node, ref);
                break;
            case 46:
                this.visitTryStatement(node, ref);
                break;
            case 47:
                this.visitVariableStatement(node, ref);
                break;
            case 49:
                this.visitWhileStatement(node, ref);
                break;
            case 51:
                this.visitClassDeclaration(node, false, ref);
                break;
            case 52:
                this.visitEnumDeclaration(node, false, ref);
                break;
            case 53:
                this.visitEnumValueDeclaration(node, ref);
                break;
            case 54:
                this.visitFieldDeclaration(node, ref);
                break;
            case 55:
                this.visitFunctionDeclaration(node, false, ref);
                break;
            case 56:
                this.visitImportDeclaration(node, ref);
                break;
            case 57:
                this.visitInterfaceDeclaration(node, false, ref);
                break;
            case 58:
                this.visitMethodDeclaration(node, ref);
                break;
            case 59:
                this.visitNamespaceDeclaration(node, false, ref);
                break;
            case 60:
                this.visitTypeDeclaration(node, ref);
                break;
            case 61:
                this.visitVariableDeclaration(node, ref);
                break;
            case 62:
                this.visitDecoratorNode(node, ref);
                break;
            case 63:
                this.visitExportMember(node, ref);
                break;
            case 64:
                this.visitSwitchCase(node, ref);
                break;
            case 65:
                this.visitIndexSignature(node, ref);
                break;
            case 18:
                this.visitNullExpression(node, ref);
                break;
            case 25: {
                this.visitTrueExpression(node, ref);
                break;
            }
            case 13: {
                this.visitFalseExpression(node, ref);
                break;
            }
            case 29: {
                this.visitCompiledExpression(node, ref);
                break;
            }
            case 26: {
                this.visitConstructorExpression(node, ref);
                break;
            }
            case 66: {
                this.visitComment(node, ref);
                break;
            }
            case 40: {
                this.visitForOfStatement(node, ref);
                break;
            }
            case 50: {
                this.visitModuleDeclaration(node, ref);
                break;
            }
            case 19: {
                this.visitOmittedExpression(node, ref);
                break;
            }
            case 5: {
                this.visitParameter(node, ref);
                break;
            }
            case 23: {
                this.visitSuperExpression(node, ref);
                break;
            }
            case 24: {
                this.visitThisExpression(node, ref);
                break;
            }
            case 48: {
                this.visitVoidStatement(node, ref);
                break;
            }
            default:
                throw new Error("Could not visit invalid type!");
        }
    }
    visitSource(node, ref = null) {
        this.currentSource = node;
        this.visit(node.statements, node);
        this.currentSource = null;
    }
    visitTypeNode(node, ref = null) { }
    visitTypeName(node, ref = null) {
        this.visit(node.identifier, node);
        this.visit(node.next, node);
    }
    visitNamedTypeNode(node, ref = null) {
        this.visit(node.name, node);
        this.visit(node.typeArguments, node);
    }
    visitFunctionTypeNode(node, ref = null) {
        this.visit(node.parameters, node);
        this.visit(node.returnType, node);
        this.visit(node.explicitThisType, node);
    }
    visitTypeParameter(node, ref = null) {
        this.visit(node.name, node);
        this.visit(node.extendsType, node);
        this.visit(node.defaultType, node);
    }
    visitIdentifierExpression(node, ref = null) { }
    visitArrayLiteralExpression(node, ref = null) {
        this.visit(node.elementExpressions, node);
    }
    visitObjectLiteralExpression(node, ref = null) {
        this.visit(node.names, node);
        this.visit(node.values, node);
    }
    visitAssertionExpression(node, ref = null) {
        this.visit(node.toType, node);
        this.visit(node.expression, node);
    }
    visitBinaryExpression(node, ref = null) {
        this.visit(node.left, node);
        this.visit(node.right, node);
    }
    visitCallExpression(node, ref = null) {
        this.visit(node.expression, node);
        this.visit(node.typeArguments, node);
        this.visit(node.args, node);
    }
    visitClassExpression(node, ref = null) {
        this.visit(node.declaration, node);
    }
    visitCommaExpression(node, ref = null) {
        this.visit(node.expressions, node);
    }
    visitElementAccessExpression(node, ref = null) {
        this.visit(node.elementExpression, node);
        this.visit(node.expression, node);
    }
    visitFunctionExpression(node, ref = null) {
        this.visit(node.declaration, node);
    }
    visitLiteralExpression(node, ref = null) {
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
    visitFloatLiteralExpression(node, ref = null) { }
    visitInstanceOfExpression(node, ref = null) {
        this.visit(node.expression, node);
        this.visit(node.isType, node);
    }
    visitIntegerLiteralExpression(node, ref = null) { }
    visitStringLiteralExpression(node, ref = null) { }
    visitTemplateLiteralExpression(node, ref = null) { }
    visitRegexpLiteralExpression(node, ref = null) { }
    visitNewExpression(node, ref = null) {
        this.visit(node.typeName, node);
        this.visit(node.typeArguments, node);
        this.visit(node.args, node);
    }
    visitParenthesizedExpression(node, ref = null) {
        this.visit(node.expression, node);
    }
    visitPropertyAccessExpression(node, ref = null) {
        this.visit(node.property, node);
        this.visit(node.expression, node);
    }
    visitTernaryExpression(node, ref = null) {
        this.visit(node.condition, node);
        this.visit(node.ifThen, node);
        this.visit(node.ifElse, node);
    }
    visitUnaryExpression(node, ref = null) {
        this.visit(node.operand, node);
    }
    visitUnaryPostfixExpression(node, ref = null) {
        this.visit(node.operand, node);
    }
    visitUnaryPrefixExpression(node, ref = null) {
        this.visit(node.operand, node);
    }
    visitSuperExpression(node, ref = null) { }
    visitFalseExpression(node, ref = null) { }
    visitTrueExpression(node, ref = null) { }
    visitThisExpression(node, ref = null) { }
    visitNullExpression(node, ref = null) { }
    visitConstructorExpression(node, ref = null) { }
    visitNodeAndTerminate(statement, ref = null) { }
    visitBlockStatement(node, ref = null) {
        this.visit(node.statements, node);
    }
    visitBreakStatement(node, ref = null) {
        this.visit(node.label, node);
    }
    visitContinueStatement(node, ref = null) {
        this.visit(node.label, node);
    }
    visitClassDeclaration(node, isDefault = false, ref = null) {
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
    visitDoStatement(node, ref = null) {
        this.visit(node.condition, node);
        this.visit(node.body, node);
    }
    visitEmptyStatement(node, ref = null) { }
    visitEnumDeclaration(node, isDefault = false, ref = null) {
        this.visit(node.name, node);
        this.visit(node.decorators, node);
        this.visit(node.values, node);
    }
    visitEnumValueDeclaration(node, ref = null) {
        this.visit(node.name, node);
        this.visit(node.initializer, node);
    }
    visitExportImportStatement(node, ref = null) {
        this.visit(node.name, node);
        this.visit(node.externalName, node);
    }
    visitExportMember(node, ref = null) {
        this.visit(node.localName, node);
        this.visit(node.exportedName, node);
    }
    visitExportStatement(node, ref = null) {
        this.visit(node.path, node);
        this.visit(node.members, node);
    }
    visitExportDefaultStatement(node, ref = null) {
        this.visit(node.declaration, node);
    }
    visitExpressionStatement(node, ref = null) {
        this.visit(node.expression, ref);
    }
    visitFieldDeclaration(node, ref = null) {
        this.visit(node.name, node);
        this.visit(node.type, node);
        this.visit(node.initializer, node);
        this.visit(node.decorators, node);
    }
    visitForStatement(node, ref = null) {
        this.visit(node.initializer, node);
        this.visit(node.condition, node);
        this.visit(node.incrementor, node);
        this.visit(node.body, node);
    }
    visitFunctionDeclaration(node, isDefault = false, ref = null) {
        this.visit(node.name, node);
        this.visit(node.decorators, node);
        this.visit(node.typeParameters, node);
        this.visit(node.signature, node);
        this.visit(node.body, node);
    }
    visitIfStatement(node, ref = null) {
        this.visit(node.condition, node);
        this.visit(node.ifTrue, node);
        this.visit(node.ifFalse, node);
    }
    visitImportDeclaration(node, ref = null) {
        this.visit(node.foreignName, node);
        this.visit(node.name, node);
        this.visit(node.decorators, node);
    }
    visitImportStatement(node, ref = null) {
        this.visit(node.namespaceName, node);
        this.visit(node.declarations, node);
    }
    visitIndexSignature(node, ref = null) {
        this.visit(node.keyType, node);
        this.visit(node.valueType, node);
    }
    visitInterfaceDeclaration(node, isDefault = false, ref = null) {
        this.visit(node.name, node);
        this.visit(node.typeParameters, node);
        this.visit(node.implementsTypes, node);
        this.visit(node.extendsType, node);
        this.visit(node.members, node);
    }
    visitMethodDeclaration(node, ref = null) {
        this.visit(node.name, node);
        this.visit(node.typeParameters, node);
        this.visit(node.signature, node);
        this.visit(node.decorators, node);
        this.visit(node.body, node);
    }
    visitNamespaceDeclaration(node, isDefault = false, ref = null) {
        this.visit(node.name, node);
        this.visit(node.decorators, node);
        this.visit(node.members, node);
    }
    visitReturnStatement(node, ref = null) {
        this.visit(node.value, node);
    }
    visitSwitchCase(node, ref = null) {
        this.visit(node.label, node);
        this.visit(node.statements, node);
    }
    visitSwitchStatement(node, ref = null) {
        this.visit(node.condition, node);
        this.visit(node.cases, node);
    }
    visitThrowStatement(node, ref = null) {
        this.visit(node.value, node);
    }
    visitTryStatement(node, ref = null) {
        this.visit(node.bodyStatements, node);
        this.visit(node.catchVariable, node);
        this.visit(node.catchStatements, node);
        this.visit(node.finallyStatements, node);
    }
    visitTypeDeclaration(node, ref = null) {
        this.visit(node.name, node);
        this.visit(node.decorators, node);
        this.visit(node.type, node);
        this.visit(node.typeParameters, node);
    }
    visitVariableDeclaration(node, ref = null) {
        this.visit(node.name, node);
        this.visit(node.type, node);
        this.visit(node.initializer, node);
    }
    visitVariableStatement(node, ref = null) {
        this.visit(node.decorators, node);
        this.visit(node.declarations, node);
    }
    visitWhileStatement(node, ref = null) {
        this.visit(node.condition, node);
        this.visit(node.body, node);
    }
    visitVoidStatement(node, ref = null) { }
    visitComment(node, ref = null) { }
    visitDecoratorNode(node, ref = null) {
        this.visit(node.name, node);
        this.visit(node.args, node);
    }
    visitParameter(node, ref = null) {
        this.visit(node.name, node);
        this.visit(node.implicitFieldDeclaration, node);
        this.visit(node.initializer, node);
        this.visit(node.type, node);
    }
    visitCompiledExpression(node, ref = null) { }
    visitForOfStatement(node, ref = null) {
        this.visit(node.body, node);
        this.visit(node.variable, node);
        this.visit(node.iterable, node);
    }
    visitModuleDeclaration(node, ref = null) { }
    visitOmittedExpression(node, ref = null) { }
}
//# sourceMappingURL=visitor.js.map