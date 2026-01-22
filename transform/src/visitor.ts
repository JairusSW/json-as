import { ArrayLiteralExpression, AssertionExpression, BinaryExpression, CallExpression, ElementAccessExpression, FloatLiteralExpression, FunctionTypeNode, IdentifierExpression, NamedTypeNode, Node, ObjectLiteralExpression, Source, TypeParameterNode, BlockStatement, BreakStatement, ClassDeclaration, ClassExpression, CommaExpression, ContinueStatement, DecoratorNode, DoStatement, EmptyStatement, EnumDeclaration, EnumValueDeclaration, ExportDefaultStatement, ExportImportStatement, ExportMember, ExportStatement, ExpressionStatement, FieldDeclaration, ForStatement, FunctionDeclaration, FunctionExpression, IfStatement, ImportDeclaration, ImportStatement, IndexSignatureNode, InstanceOfExpression, IntegerLiteralExpression, InterfaceDeclaration, LiteralExpression, MethodDeclaration, NamespaceDeclaration, NewExpression, ParameterNode, ParenthesizedExpression, PropertyAccessExpression, RegexpLiteralExpression, ReturnStatement, StringLiteralExpression, SwitchCase, SwitchStatement, TemplateLiteralExpression, TernaryExpression, ThrowStatement, TryStatement, TypeDeclaration, TypeName, UnaryPostfixExpression, UnaryPrefixExpression, VariableDeclaration, VariableStatement, WhileStatement, NodeKind, TypeNode, LiteralKind, UnaryExpression, SuperExpression, FalseExpression, TrueExpression, ThisExpression, NullExpression, ConstructorExpression, Statement, VoidStatement, CompiledExpression, CommentNode, OmittedExpression, ForOfStatement, ModuleDeclaration } from "assemblyscript/dist/assemblyscript.js";

export class Visitor {
  public currentSource: Source | null = null;
  visit(node: Node | Node[] | null, ref: Node | null = null): void {
    if (node == null) return;
    if (node instanceof Array) {
      for (const n of node) {
        this._visit(n, ref);
      }
    } else {
      // @ts-ignore
      this._visit(node, ref);
    }
  }
  _visit(node: Node, ref: Node | null): void {
    switch (node.kind) {
      case NodeKind.Source:
        this.visitSource(node as Source, ref);
        break;
      case NodeKind.NamedType:
        this.visitNamedTypeNode(node as NamedTypeNode, ref);
        break;
      case NodeKind.FunctionType:
        this.visitFunctionTypeNode(node as FunctionTypeNode, ref);
        break;
      case NodeKind.TypeName:
        this.visitTypeName(node as TypeName, ref);
        break;
      case NodeKind.TypeParameter:
        this.visitTypeParameter(node as TypeParameterNode, ref);
        break;
      case NodeKind.Identifier:
        this.visitIdentifierExpression(node as IdentifierExpression, ref);
        break;
      case NodeKind.Assertion:
        this.visitAssertionExpression(node as AssertionExpression, ref);
        break;
      case NodeKind.Binary:
        this.visitBinaryExpression(node as BinaryExpression, ref);
        break;
      case NodeKind.Call:
        this.visitCallExpression(node as CallExpression, ref);
        break;
      case NodeKind.Class:
        this.visitClassExpression(node as ClassExpression, ref);
        break;
      case NodeKind.Comma:
        this.visitCommaExpression(node as CommaExpression, ref);
        break;
      case NodeKind.ElementAccess:
        this.visitElementAccessExpression(node as ElementAccessExpression, ref);
        break;
      case NodeKind.Function:
        this.visitFunctionExpression(node as FunctionExpression, ref);
        break;
      case NodeKind.InstanceOf:
        this.visitInstanceOfExpression(node as InstanceOfExpression, ref);
        break;
      case NodeKind.Literal:
        this.visitLiteralExpression(node as LiteralExpression, ref);
        break;
      case NodeKind.New:
        this.visitNewExpression(node as NewExpression, ref);
        break;
      case NodeKind.Parenthesized:
        this.visitParenthesizedExpression(node as ParenthesizedExpression, ref);
        break;
      case NodeKind.PropertyAccess:
        this.visitPropertyAccessExpression(node as PropertyAccessExpression, ref);
        break;
      case NodeKind.Ternary:
        this.visitTernaryExpression(node as TernaryExpression, ref);
        break;
      case NodeKind.UnaryPostfix:
        this.visitUnaryPostfixExpression(node as UnaryPostfixExpression, ref);
        break;
      case NodeKind.UnaryPrefix:
        this.visitUnaryPrefixExpression(node as UnaryPrefixExpression, ref);
        break;
      case NodeKind.Block:
        this.visitBlockStatement(node as BlockStatement, ref);
        break;
      case NodeKind.Break:
        this.visitBreakStatement(node as BreakStatement, ref);
        break;
      case NodeKind.Continue:
        this.visitContinueStatement(node as ContinueStatement, ref);
        break;
      case NodeKind.Do:
        this.visitDoStatement(node as DoStatement, ref);
        break;
      case NodeKind.Empty:
        this.visitEmptyStatement(node as EmptyStatement, ref);
        break;
      case NodeKind.Export:
        this.visitExportStatement(node as ExportStatement, ref);
        break;
      case NodeKind.ExportDefault:
        this.visitExportDefaultStatement(node as ExportDefaultStatement, ref);
        break;
      case NodeKind.ExportImport:
        this.visitExportImportStatement(node as ExportImportStatement, ref);
        break;
      case NodeKind.Expression:
        this.visitExpressionStatement(node as ExpressionStatement, ref);
        break;
      case NodeKind.For:
        this.visitForStatement(node as ForStatement, ref);
        break;
      case NodeKind.If:
        this.visitIfStatement(node as IfStatement, ref);
        break;
      case NodeKind.Import:
        this.visitImportStatement(node as ImportStatement, ref);
        break;
      case NodeKind.Return:
        this.visitReturnStatement(node as ReturnStatement, ref);
        break;
      case NodeKind.Switch:
        this.visitSwitchStatement(node as SwitchStatement, ref);
        break;
      case NodeKind.Throw:
        this.visitThrowStatement(node as ThrowStatement, ref);
        break;
      case NodeKind.Try:
        this.visitTryStatement(node as TryStatement, ref);
        break;
      case NodeKind.Variable:
        this.visitVariableStatement(node as VariableStatement, ref);
        break;
      case NodeKind.While:
        this.visitWhileStatement(node as WhileStatement, ref);
        break;
      case NodeKind.ClassDeclaration:
        this.visitClassDeclaration(node as ClassDeclaration, false, ref);
        break;
      case NodeKind.EnumDeclaration:
        this.visitEnumDeclaration(node as EnumDeclaration, false, ref);
        break;
      case NodeKind.EnumValueDeclaration:
        this.visitEnumValueDeclaration(node as EnumValueDeclaration, ref);
        break;
      case NodeKind.FieldDeclaration:
        this.visitFieldDeclaration(node as FieldDeclaration, ref);
        break;
      case NodeKind.FunctionDeclaration:
        this.visitFunctionDeclaration(node as FunctionDeclaration, false, ref);
        break;
      case NodeKind.ImportDeclaration:
        this.visitImportDeclaration(node as ImportDeclaration, ref);
        break;
      case NodeKind.InterfaceDeclaration:
        this.visitInterfaceDeclaration(node as InterfaceDeclaration, false, ref);
        break;
      case NodeKind.MethodDeclaration:
        this.visitMethodDeclaration(node as MethodDeclaration, ref);
        break;
      case NodeKind.NamespaceDeclaration:
        this.visitNamespaceDeclaration(node as NamespaceDeclaration, false, ref);
        break;
      case NodeKind.TypeDeclaration:
        this.visitTypeDeclaration(node as TypeDeclaration, ref);
        break;
      case NodeKind.VariableDeclaration:
        this.visitVariableDeclaration(node as VariableDeclaration, ref);
        break;
      case NodeKind.Decorator:
        this.visitDecoratorNode(node as DecoratorNode, ref);
        break;
      case NodeKind.ExportMember:
        this.visitExportMember(node as ExportMember, ref);
        break;
      case NodeKind.SwitchCase:
        this.visitSwitchCase(node as SwitchCase, ref);
        break;
      case NodeKind.IndexSignature:
        this.visitIndexSignature(node as IndexSignatureNode, ref);
        break;
      case NodeKind.Null:
        this.visitNullExpression(node as NullExpression, ref);
        break;
      case NodeKind.True: {
        this.visitTrueExpression(node as TrueExpression, ref);
        break;
      }
      case NodeKind.False: {
        this.visitFalseExpression(node as FalseExpression, ref);
        break;
      }
      case NodeKind.Compiled: {
        this.visitCompiledExpression(node as CompiledExpression, ref);
        break;
      }
      case NodeKind.Constructor: {
        this.visitConstructorExpression(node as ConstructorExpression, ref);
        break;
      }
      case NodeKind.Comment: {
        this.visitComment(node as CommentNode, ref);
        break;
      }
      case NodeKind.ForOf: {
        this.visitForOfStatement(node as ForOfStatement, ref);
        break;
      }
      case NodeKind.Module: {
        this.visitModuleDeclaration(node as ModuleDeclaration, ref);
        break;
      }
      case NodeKind.Omitted: {
        this.visitOmittedExpression(node as OmittedExpression, ref);
        break;
      }
      case NodeKind.Parameter: {
        this.visitParameter(node as ParameterNode, ref);
        break;
      }
      case NodeKind.Super: {
        this.visitSuperExpression(node as SuperExpression, ref);
        break;
      }
      case NodeKind.This: {
        this.visitThisExpression(node as ThisExpression, ref);
        break;
      }
      case NodeKind.Void: {
        this.visitVoidStatement(node as VoidStatement, ref);
        break;
      }
      default:
        throw new Error("Could not visit invalid type!");
    }
  }
  visitSource(node: Source, _ref: Node | null = null): void {
    this.currentSource = node;
    this.visit(node.statements, node);
    this.currentSource = null;
  }
  visitTypeNode(_node: TypeNode, _ref: Node | null = null): void {}
  visitTypeName(node: TypeName, _ref: Node | null = null): void {
    this.visit(node.identifier, node);
    this.visit(node.next, node);
  }
  visitNamedTypeNode(node: NamedTypeNode, _ref: Node | null = null): void {
    this.visit(node.name, node);
    this.visit(node.typeArguments, node);
  }
  visitFunctionTypeNode(node: FunctionTypeNode, _ref: Node | null = null): void {
    this.visit(node.parameters, node);
    this.visit(node.returnType, node);
    this.visit(node.explicitThisType, node);
  }
  visitTypeParameter(node: TypeParameterNode, _ref: Node | null = null): void {
    this.visit(node.name, node);
    this.visit(node.extendsType, node);
    this.visit(node.defaultType, node);
  }
  visitIdentifierExpression(_node: IdentifierExpression, _ref: Node | null = null): void {}
  visitArrayLiteralExpression(node: ArrayLiteralExpression, _ref: Node | null = null): void {
    this.visit(node.elementExpressions, node);
  }
  visitObjectLiteralExpression(node: ObjectLiteralExpression, _ref: Node | null = null): void {
    this.visit(node.names, node);
    this.visit(node.values, node);
  }
  visitAssertionExpression(node: AssertionExpression, _ref: Node | null = null): void {
    this.visit(node.toType, node);
    this.visit(node.expression, node);
  }
  visitBinaryExpression(node: BinaryExpression, _ref: Node | null = null): void {
    this.visit(node.left, node);
    this.visit(node.right, node);
  }
  visitCallExpression(node: CallExpression, _ref: Node | null = null): void {
    this.visit(node.expression, node);
    this.visit(node.typeArguments, node);
    this.visit(node.args, node);
  }
  visitClassExpression(node: ClassExpression, _ref: Node | null = null): void {
    this.visit(node.declaration, node);
  }
  visitCommaExpression(node: CommaExpression, _ref: Node | null = null): void {
    this.visit(node.expressions, node);
  }
  visitElementAccessExpression(node: ElementAccessExpression, _ref: Node | null = null): void {
    this.visit(node.elementExpression, node);
    this.visit(node.expression, node);
  }
  visitFunctionExpression(node: FunctionExpression, _ref: Node | null = null): void {
    this.visit(node.declaration, node);
  }
  visitLiteralExpression(node: LiteralExpression, _ref: Node | null = null): void {
    switch (node.literalKind) {
      case LiteralKind.Float:
        this.visitFloatLiteralExpression(node as FloatLiteralExpression);
        break;
      case LiteralKind.Integer:
        this.visitIntegerLiteralExpression(node as IntegerLiteralExpression);
        break;
      case LiteralKind.String:
        this.visitStringLiteralExpression(node as StringLiteralExpression);
        break;
      case LiteralKind.Template:
        this.visitTemplateLiteralExpression(node as TemplateLiteralExpression);
        break;
      case LiteralKind.RegExp:
        this.visitRegexpLiteralExpression(node as RegexpLiteralExpression);
        break;
      case LiteralKind.Array:
        this.visitArrayLiteralExpression(node as ArrayLiteralExpression);
        break;
      case LiteralKind.Object:
        this.visitObjectLiteralExpression(node as ObjectLiteralExpression);
        break;
      default:
        throw new Error("Invalid LiteralKind at visitLiteralExpression(): " + node.literalKind);
    }
  }
  visitFloatLiteralExpression(_node: FloatLiteralExpression, _ref: Node | null = null): void {}
  visitInstanceOfExpression(node: InstanceOfExpression, _ref: Node | null = null): void {
    this.visit(node.expression, node);
    this.visit(node.isType, node);
  }
  visitIntegerLiteralExpression(_node: IntegerLiteralExpression, _ref: Node | null = null): void {}
  visitStringLiteralExpression(_node: StringLiteralExpression, _ref: Node | null = null): void {}
  visitTemplateLiteralExpression(_node: TemplateLiteralExpression, _ref: Node | null = null): void {}
  visitRegexpLiteralExpression(_node: RegexpLiteralExpression, _ref: Node | null = null): void {}
  visitNewExpression(node: NewExpression, _ref: Node | null = null): void {
    this.visit(node.typeName, node);
    this.visit(node.typeArguments, node);
    this.visit(node.args, node);
  }
  visitParenthesizedExpression(node: ParenthesizedExpression, _ref: Node | null = null): void {
    this.visit(node.expression, node);
  }
  visitPropertyAccessExpression(node: PropertyAccessExpression, _ref: Node | null = null): void {
    this.visit(node.property, node);
    this.visit(node.expression, node);
  }
  visitTernaryExpression(node: TernaryExpression, _ref: Node | null = null): void {
    this.visit(node.condition, node);
    this.visit(node.ifThen, node);
    this.visit(node.ifElse, node);
  }
  visitUnaryExpression(node: UnaryExpression, _ref: Node | null = null): void {
    this.visit(node.operand, node);
  }
  visitUnaryPostfixExpression(node: UnaryPostfixExpression, _ref: Node | null = null): void {
    this.visit(node.operand, node);
  }
  visitUnaryPrefixExpression(node: UnaryPrefixExpression, _ref: Node | null = null): void {
    this.visit(node.operand, node);
  }
  visitSuperExpression(_node: SuperExpression, _ref: Node | null = null): void {}
  visitFalseExpression(_node: FalseExpression, _ref: Node | null = null): void {}
  visitTrueExpression(_node: TrueExpression, _ref: Node | null = null): void {}
  visitThisExpression(_node: ThisExpression, _ref: Node | null = null): void {}
  visitNullExpression(_node: NullExpression, _ref: Node | null = null): void {}
  visitConstructorExpression(_node: ConstructorExpression, _ref: Node | null = null): void {}
  visitNodeAndTerminate(_statement: Statement, _ref: Node | null = null): void {}
  visitBlockStatement(node: BlockStatement, _ref: Node | null = null): void {
    this.visit(node.statements, node);
  }
  visitBreakStatement(node: BreakStatement, _ref: Node | null = null): void {
    this.visit(node.label, node);
  }
  visitContinueStatement(node: ContinueStatement, _ref: Node | null = null): void {
    this.visit(node.label, node);
  }
  visitClassDeclaration(node: ClassDeclaration, _isDefault: boolean = false, _ref: Node | null = null): void {
    this.visit(node.name, node);
    this.visit(node.decorators, node);
    if (node.isGeneric ? node.typeParameters != null : node.typeParameters == null) {
      this.visit(node.typeParameters, node);
      this.visit(node.extendsType, node);
      this.visit(node.implementsTypes, node);
      this.visit(node.members, node);
    } else {
      throw new Error("Expected to type parameters to match class declaration, but found type mismatch instead!");
    }
  }
  visitDoStatement(node: DoStatement, _ref: Node | null = null): void {
    this.visit(node.condition, node);
    this.visit(node.body, node);
  }
  visitEmptyStatement(_node: EmptyStatement, _ref: Node | null = null): void {}
  visitEnumDeclaration(node: EnumDeclaration, _isDefault: boolean = false, _ref: Node | null = null): void {
    this.visit(node.name, node);
    this.visit(node.decorators, node);
    this.visit(node.values, node);
  }
  visitEnumValueDeclaration(node: EnumValueDeclaration, _ref: Node | null = null): void {
    this.visit(node.name, node);
    this.visit(node.initializer, node);
  }
  visitExportImportStatement(node: ExportImportStatement, _ref: Node | null = null): void {
    this.visit(node.name, node);
    this.visit(node.externalName, node);
  }
  visitExportMember(node: ExportMember, _ref: Node | null = null): void {
    this.visit(node.localName, node);
    this.visit(node.exportedName, node);
  }
  visitExportStatement(node: ExportStatement, _ref: Node | null = null): void {
    this.visit(node.path, node);
    this.visit(node.members, node);
  }
  visitExportDefaultStatement(node: ExportDefaultStatement, _ref: Node | null = null): void {
    this.visit(node.declaration, node);
  }
  visitExpressionStatement(node: ExpressionStatement, ref: Node | null = null): void {
    this.visit(node.expression, ref);
  }
  visitFieldDeclaration(node: FieldDeclaration, _ref: Node | null = null): void {
    this.visit(node.name, node);
    this.visit(node.type, node);
    this.visit(node.initializer, node);
    this.visit(node.decorators, node);
  }
  visitForStatement(node: ForStatement, _ref: Node | null = null): void {
    this.visit(node.initializer, node);
    this.visit(node.condition, node);
    this.visit(node.incrementor, node);
    this.visit(node.body, node);
  }
  visitFunctionDeclaration(node: FunctionDeclaration, _isDefault: boolean = false, _ref: Node | null = null): void {
    this.visit(node.name, node);
    this.visit(node.decorators, node);
    this.visit(node.typeParameters, node);
    this.visit(node.signature, node);
    this.visit(node.body, node);
  }
  visitIfStatement(node: IfStatement, _ref: Node | null = null): void {
    this.visit(node.condition, node);
    this.visit(node.ifTrue, node);
    this.visit(node.ifFalse, node);
  }
  visitImportDeclaration(node: ImportDeclaration, _ref: Node | null = null): void {
    this.visit(node.foreignName, node);
    this.visit(node.name, node);
    this.visit(node.decorators, node);
  }
  visitImportStatement(node: ImportStatement, _ref: Node | null = null): void {
    this.visit(node.namespaceName, node);
    this.visit(node.declarations, node);
  }
  visitIndexSignature(node: IndexSignatureNode, _ref: Node | null = null): void {
    this.visit(node.keyType, node);
    this.visit(node.valueType, node);
  }
  visitInterfaceDeclaration(node: InterfaceDeclaration, _isDefault: boolean = false, _ref: Node | null = null): void {
    this.visit(node.name, node);
    this.visit(node.typeParameters, node);
    this.visit(node.implementsTypes, node);
    this.visit(node.extendsType, node);
    this.visit(node.members, node);
  }
  visitMethodDeclaration(node: MethodDeclaration, _ref: Node | null = null): void {
    this.visit(node.name, node);
    this.visit(node.typeParameters, node);
    this.visit(node.signature, node);
    this.visit(node.decorators, node);
    this.visit(node.body, node);
  }
  visitNamespaceDeclaration(node: NamespaceDeclaration, _isDefault: boolean = false, _ref: Node | null = null): void {
    this.visit(node.name, node);
    this.visit(node.decorators, node);
    this.visit(node.members, node);
  }
  visitReturnStatement(node: ReturnStatement, _ref: Node | null = null): void {
    this.visit(node.value, node);
  }
  visitSwitchCase(node: SwitchCase, _ref: Node | null = null): void {
    this.visit(node.label, node);
    this.visit(node.statements, node);
  }
  visitSwitchStatement(node: SwitchStatement, _ref: Node | null = null): void {
    this.visit(node.condition, node);
    this.visit(node.cases, node);
  }
  visitThrowStatement(node: ThrowStatement, _ref: Node | null = null): void {
    this.visit(node.value, node);
  }
  visitTryStatement(node: TryStatement, _ref: Node | null = null): void {
    this.visit(node.bodyStatements, node);
    this.visit(node.catchVariable, node);
    this.visit(node.catchStatements, node);
    this.visit(node.finallyStatements, node);
  }
  visitTypeDeclaration(node: TypeDeclaration, _ref: Node | null = null): void {
    this.visit(node.name, node);
    this.visit(node.decorators, node);
    this.visit(node.type, node);
    this.visit(node.typeParameters, node);
  }
  visitVariableDeclaration(node: VariableDeclaration, _ref: Node | null = null): void {
    this.visit(node.name, node);
    this.visit(node.type, node);
    this.visit(node.initializer, node);
  }
  visitVariableStatement(node: VariableStatement, _ref: Node | null = null): void {
    this.visit(node.decorators, node);
    this.visit(node.declarations, node);
  }
  visitWhileStatement(node: WhileStatement, _ref: Node | null = null): void {
    this.visit(node.condition, node);
    this.visit(node.body, node);
  }
  visitVoidStatement(_node: VoidStatement, _ref: Node | null = null): void {}
  visitComment(_node: CommentNode, _ref: Node | null = null): void {}
  visitDecoratorNode(node: DecoratorNode, _ref: Node | null = null): void {
    this.visit(node.name, node);
    this.visit(node.args, node);
  }
  visitParameter(node: ParameterNode, _ref: Node | null = null): void {
    this.visit(node.name, node);
    this.visit(node.implicitFieldDeclaration, node);
    this.visit(node.initializer, node);
    this.visit(node.type, node);
  }
  visitCompiledExpression(_node: CompiledExpression, _ref: Node | null = null): void {}
  visitForOfStatement(node: ForOfStatement, _ref: Node | null = null): void {
    this.visit(node.body, node);
    this.visit(node.variable, node);
    this.visit(node.iterable, node);
  }
  visitModuleDeclaration(_node: ModuleDeclaration, _ref: Node | null = null): void {}
  visitOmittedExpression(_node: OmittedExpression, _ref: Node | null = null): void {}
}
