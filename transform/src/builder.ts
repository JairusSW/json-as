// Taken from https://github.com/as-pect/visitor-as/blob/master/src/astBuilder.ts
// tslint:disable: as-internal-case

import {
  ArrayLiteralExpression,
  ArrowKind,
  AssertionExpression,
  AssertionKind,
  BinaryExpression,
  BlockStatement,
  BreakStatement,
  CallExpression,
  ClassDeclaration,
  ClassExpression,
  CommaExpression,
  CommonFlags,
  ContinueStatement,
  DeclarationStatement,
  DecoratorNode,
  DoStatement,
  ElementAccessExpression,
  EmptyStatement,
  EnumDeclaration,
  EnumValueDeclaration,
  ExportDefaultStatement,
  ExportImportStatement,
  ExportMember,
  ExportStatement,
  Expression,
  ExpressionStatement,
  FalseExpression,
  FieldDeclaration,
  FloatLiteralExpression,
  ForOfStatement,
  ForStatement,
  FunctionDeclaration,
  FunctionExpression,
  FunctionTypeNode,
  IdentifierExpression,
  IfStatement,
  ImportDeclaration,
  ImportStatement,
  IndexSignatureNode,
  InstanceOfExpression,
  IntegerLiteralExpression,
  InterfaceDeclaration,
  isTypeOmitted,
  LiteralExpression,
  LiteralKind,
  MethodDeclaration,
  NamedTypeNode,
  NamespaceDeclaration,
  NewExpression,
  Node,
  NodeKind,
  NullExpression,
  ObjectLiteralExpression,
  operatorTokenToString,
  ParameterKind,
  ParameterNode,
  ParenthesizedExpression,
  PropertyAccessExpression,
  RegexpLiteralExpression,
  ReturnStatement,
  Source,
  StringLiteralExpression,
  SwitchCase,
  SwitchStatement,
  TemplateLiteralExpression,
  TernaryExpression,
  ThrowStatement,
  TrueExpression,
  TryStatement,
  TypeDeclaration,
  TypeName,
  TypeNode,
  TypeParameterNode,
  UnaryExpression,
  UnaryPostfixExpression,
  UnaryPrefixExpression,
  util,
  VariableDeclaration,
  VariableStatement,
  WhileStatement,
} from "assemblyscript/dist/assemblyscript.js";
import { ThisExpression } from "types:assemblyscript/src/ast";
import { Visitor } from "./visitor.js";

function assert<T>(isTruish: T, message: string = "assertion error"): T {
  if (!isTruish) throw new Error(message);
  return isTruish;
}

/** An AST builder. */
export class ASTBuilder extends Visitor {
  /** Rebuilds the textual source from the specified AST, as far as possible. */
  static build(node: Node): string {
    const builder = new ASTBuilder();
    builder.visitNode(node);
    return builder.finish();
  }

  private sb: string[] = [];
  private indentLevel: number = 0;
  visitNode(node: Node) {
    return this.visit(node);
  }

  visitSource(source: Source): void {
    const statements = source.statements;
    for (let i = 0, k = statements.length; i < k; ++i) {
      this.visitNodeAndTerminate(statements[i]);
    }
  }

  // types

  visitTypeNode(node: TypeNode): void {
    switch (node.kind) {
      case NodeKind.NamedType: {
        this.visitNamedTypeNode(<NamedTypeNode>node);
        break;
      }
      case NodeKind.FunctionType: {
        this.visitFunctionTypeNode(<FunctionTypeNode>node);
        break;
      }
      default:
        assert(false);
    }
  }

  visitThisExpression(_node: ThisExpression, _ref?: Node | null): void {
    this.sb.push("this");
  }
  visitTypeName(node: TypeName): void {
    this.visitIdentifierExpression(node.identifier);
    const sb = this.sb;
    let current = node.next;
    while (current) {
      sb.push(".");
      this.visitIdentifierExpression(current.identifier);
      current = current.next;
    }
  }

  visitNamedTypeNode(node: NamedTypeNode): void {
    this.visitTypeName(node.name);
    const typeArguments = node.typeArguments;
    if (typeArguments) {
      const numTypeArguments = typeArguments.length;
      const sb = this.sb;
      if (numTypeArguments) {
        sb.push("<");
        this.visitTypeNode(typeArguments[0]);
        for (let i = 1; i < numTypeArguments; ++i) {
          sb.push(", ");
          this.visitTypeNode(typeArguments[i]);
        }
        sb.push(">");
      }
      if (node.isNullable) sb.push(" | null");
    }
  }

  visitFunctionTypeNode(node: FunctionTypeNode): void {
    const isNullable = node.isNullable;
    const sb = this.sb;
    sb.push(isNullable ? "((" : "(");
    const explicitThisType = node.explicitThisType;
    if (explicitThisType) {
      sb.push("this: ");
      this.visitTypeNode(explicitThisType);
    }
    const parameters = node.parameters;
    const numParameters = parameters.length;
    if (numParameters) {
      if (explicitThisType) sb.push(", ");
      this.serializeParameter(parameters[0]);
      for (let i = 1; i < numParameters; ++i) {
        sb.push(", ");
        this.serializeParameter(parameters[i]);
      }
    }
    const returnType = node.returnType;
    if (returnType) {
      sb.push(") => ");
      this.visitTypeNode(returnType);
    } else {
      sb.push(") => void");
    }
    if (isNullable) sb.push(") | null");
  }

  visitTypeParameter(node: TypeParameterNode): void {
    this.visitIdentifierExpression(node.name);
    const extendsType = node.extendsType;
    if (extendsType) {
      this.sb.push(" extends ");
      this.visitTypeNode(extendsType);
    }
    const defaultType = node.defaultType;
    if (defaultType) {
      this.sb.push("=");
      this.visitTypeNode(defaultType);
    }
  }

  // expressions

  visitIdentifierExpression(node: IdentifierExpression): void {
    if (node.isQuoted) this.visitStringLiteral(node.text);
    else this.sb.push(node.text);
  }

  visitArrayLiteralExpression(node: ArrayLiteralExpression): void {
    const sb = this.sb;
    sb.push("[");
    const elements = node.elementExpressions;
    const numElements = elements.length;
    if (numElements) {
      let element = elements[0];
      if (element) this.visitNode(element);
      for (let i = 1; i < numElements; ++i) {
        element = elements[i];
        sb.push(", ");
        if (element) this.visitNode(element);
      }
    }
    sb.push("]");
  }

  visitObjectLiteralExpression(node: ObjectLiteralExpression): void {
    const sb = this.sb;
    const names = node.names;
    const values = node.values;
    const numElements = names.length;
    assert(numElements == values.length);
    if (numElements) {
      sb.push("{\n");
      util.indent(sb, ++this.indentLevel);
      this.visitNode(names[0]);
      sb.push(": ");
      this.visitNode(values[0]);
      for (let i = 1; i < numElements; ++i) {
        sb.push(",\n");
        util.indent(sb, this.indentLevel);
        const name = names[i];
        const value = values[i];
        if (name == value) {
          this.visitNode(name);
        } else {
          this.visitNode(name);
          sb.push(": ");
          this.visitNode(value);
        }
      }
      sb.push("\n");
      util.indent(sb, --this.indentLevel);
      sb.push("}");
    } else {
      sb.push("{}");
    }
  }

  visitAssertionExpression(node: AssertionExpression): void {
    const sb = this.sb;
    switch (node.assertionKind) {
      case AssertionKind.Prefix: {
        sb.push("<");
        if (node.toType) this.visitTypeNode(node.toType);
        sb.push(">");
        this.visitNode(node.expression);
        break;
      }
      case AssertionKind.As: {
        this.visitNode(node.expression);
        sb.push(" as ");
        if (node.toType) this.visitTypeNode(node.toType);
        break;
      }
      case AssertionKind.NonNull: {
        this.visitNode(node.expression);
        sb.push("!");
        break;
      }
      case AssertionKind.Const: {
        this.visitNode(node.expression);
        sb.push(" as const");
        break;
      }
      default:
        assert(false);
    }
  }

  visitBinaryExpression(node: BinaryExpression): void {
    const sb = this.sb;
    this.visitNode(node.left);
    sb.push(" ");
    sb.push(operatorTokenToString(node.operator));
    sb.push(" ");
    this.visitNode(node.right);
  }

  visitCallExpression(node: CallExpression): void {
    this.visitNode(node.expression);
    this.visitArguments(node.typeArguments, node.args);
  }

  visitArguments(typeArguments: TypeNode[] | null, args: Expression[]): void {
    const sb = this.sb;
    if (typeArguments) {
      const numTypeArguments = typeArguments.length;
      if (numTypeArguments) {
        sb.push("<");
        this.visitTypeNode(typeArguments[0]);
        for (let i = 1; i < numTypeArguments; ++i) {
          sb.push(", ");
          this.visitTypeNode(typeArguments[i]);
        }
        sb.push(">(");
      }
    } else {
      sb.push("(");
    }
    const numArgs = args.length;
    if (numArgs) {
      this.visitNode(args[0]);
      for (let i = 1; i < numArgs; ++i) {
        sb.push(", ");
        this.visitNode(args[i]);
      }
    }
    sb.push(")");
  }

  visitClassExpression(node: ClassExpression): void {
    const declaration = node.declaration;
    this.visitClassDeclaration(declaration);
  }

  visitCommaExpression(node: CommaExpression): void {
    const expressions = node.expressions;
    const numExpressions = expressions.length;
    this.visitNode(expressions[0]);
    const sb = this.sb;
    for (let i = 1; i < numExpressions; ++i) {
      sb.push(",");
      this.visitNode(expressions[i]);
    }
  }

  visitElementAccessExpression(node: ElementAccessExpression): void {
    const sb = this.sb;
    this.visitNode(node.expression);
    sb.push("[");
    this.visitNode(node.elementExpression);
    sb.push("]");
  }

  visitFunctionExpression(node: FunctionExpression): void {
    const declaration = node.declaration;
    if (!declaration.arrowKind) {
      if (declaration.name.text.length) {
        this.sb.push("function ");
      } else {
        this.sb.push("function");
      }
    } else {
      assert(declaration.name.text.length == 0);
    }
    this.visitFunctionCommon(declaration);
  }

  visitLiteralExpression(node: LiteralExpression): void {
    switch (node.literalKind) {
      case LiteralKind.Float: {
        this.visitFloatLiteralExpression(<FloatLiteralExpression>node);
        break;
      }
      case LiteralKind.Integer: {
        this.visitIntegerLiteralExpression(<IntegerLiteralExpression>node);
        break;
      }
      case LiteralKind.String: {
        this.visitStringLiteralExpression(<StringLiteralExpression>node);
        break;
      }
      case LiteralKind.Template: {
        this.visitTemplateLiteralExpression(<TemplateLiteralExpression>node);
        break;
      }
      case LiteralKind.RegExp: {
        this.visitRegexpLiteralExpression(<RegexpLiteralExpression>node);
        break;
      }
      case LiteralKind.Array: {
        this.visitArrayLiteralExpression(<ArrayLiteralExpression>node);
        break;
      }
      case LiteralKind.Object: {
        this.visitObjectLiteralExpression(<ObjectLiteralExpression>node);
        break;
      }
      default: {
        assert(false);
        break;
      }
    }
  }

  visitFloatLiteralExpression(node: FloatLiteralExpression): void {
    this.sb.push(node.value.toString());
  }

  visitInstanceOfExpression(node: InstanceOfExpression): void {
    this.visitNode(node.expression);
    this.sb.push(" instanceof ");
    this.visitTypeNode(node.isType);
  }

  visitIntegerLiteralExpression(node: IntegerLiteralExpression): void {
    this.sb.push(i64_to_string(node.value));
  }

  visitStringLiteral(str: string): void {
    const sb = this.sb;
    sb.push('"');
    this.visitRawString(str, util.CharCode.DoubleQuote);
    sb.push('"');
  }

  private visitRawString(str: string, quote: util.CharCode): void {
    const sb = this.sb;
    let off = 0;
    let i = 0;
    for (let k = str.length; i < k; ) {
      switch (str.charCodeAt(i)) {
        case util.CharCode.Null: {
          if (i > off) sb.push(str.substring(off, (off = i + 1)));
          sb.push("\\0");
          off = ++i;
          break;
        }
        case util.CharCode.Backspace: {
          if (i > off) sb.push(str.substring(off, i));
          off = ++i;
          sb.push("\\b");
          break;
        }
        case util.CharCode.Tab: {
          if (i > off) sb.push(str.substring(off, i));
          off = ++i;
          sb.push("\\t");
          break;
        }
        case util.CharCode.LineFeed: {
          if (i > off) sb.push(str.substring(off, i));
          off = ++i;
          sb.push("\\n");
          break;
        }
        case util.CharCode.VerticalTab: {
          if (i > off) sb.push(str.substring(off, i));
          off = ++i;
          sb.push("\\v");
          break;
        }
        case util.CharCode.FormFeed: {
          if (i > off) sb.push(str.substring(off, i));
          off = ++i;
          sb.push("\\f");
          break;
        }
        case util.CharCode.CarriageReturn: {
          if (i > off) sb.push(str.substring(off, i));
          sb.push("\\r");
          off = ++i;
          break;
        }
        case util.CharCode.DoubleQuote: {
          if (quote == util.CharCode.DoubleQuote) {
            if (i > off) sb.push(str.substring(off, i));
            sb.push('\\"');
            off = ++i;
          } else {
            ++i;
          }
          break;
        }
        case util.CharCode.SingleQuote: {
          if (quote == util.CharCode.SingleQuote) {
            if (i > off) sb.push(str.substring(off, i));
            sb.push("\\'");
            off = ++i;
          } else {
            ++i;
          }
          break;
        }
        case util.CharCode.Backslash: {
          if (i > off) sb.push(str.substring(off, i));
          sb.push("\\\\");
          off = ++i;
          break;
        }
        case util.CharCode.Backtick: {
          if (quote == util.CharCode.Backtick) {
            if (i > off) sb.push(str.substring(off, i));
            sb.push("\\`");
            off = ++i;
          } else {
            ++i;
          }
          break;
        }
        default: {
          ++i;
          break;
        }
      }
    }
    if (i > off) sb.push(str.substring(off, i));
  }

  visitStringLiteralExpression(node: StringLiteralExpression): void {
    this.visitStringLiteral(node.value);
  }

  visitTemplateLiteralExpression(node: TemplateLiteralExpression): void {
    const sb = this.sb;
    const tag = node.tag;
    const parts = node.parts;
    const expressions = node.expressions;
    if (tag) this.visitNode(tag);
    sb.push("`");
    this.visitRawString(parts[0], util.CharCode.Backtick);
    assert(parts.length == expressions.length + 1);
    for (let i = 0, k = expressions.length; i < k; ++i) {
      sb.push("${");
      this.visitNode(expressions[i]);
      sb.push("}");
      this.visitRawString(parts[i + 1], util.CharCode.Backtick);
    }
    sb.push("`");
  }

  visitRegexpLiteralExpression(node: RegexpLiteralExpression): void {
    const sb = this.sb;
    sb.push("/");
    sb.push(node.pattern);
    sb.push("/");
    sb.push(node.patternFlags);
  }

  visitNewExpression(node: NewExpression): void {
    this.sb.push("new ");
    this.visitTypeName(node.typeName);
    this.visitArguments(node.typeArguments, node.args);
  }

  visitParenthesizedExpression(node: ParenthesizedExpression): void {
    const sb = this.sb;
    sb.push("(");
    this.visitNode(node.expression);
    sb.push(")");
  }

  visitPropertyAccessExpression(node: PropertyAccessExpression): void {
    this.visitNode(node.expression);
    this.sb.push(".");
    this.visitIdentifierExpression(node.property);
  }

  visitTernaryExpression(node: TernaryExpression): void {
    const sb = this.sb;
    this.visitNode(node.condition);
    sb.push(" ? ");
    this.visitNode(node.ifThen);
    sb.push(" : ");
    this.visitNode(node.ifElse);
  }

  visitUnaryExpression(node: UnaryExpression): void {
    switch (node.kind) {
      case NodeKind.UnaryPostfix: {
        this.visitUnaryPostfixExpression(<UnaryPostfixExpression>node);
        break;
      }
      case NodeKind.UnaryPrefix: {
        this.visitUnaryPrefixExpression(<UnaryPrefixExpression>node);
        break;
      }
      default:
        assert(false);
    }
  }

  visitUnaryPostfixExpression(node: UnaryPostfixExpression): void {
    this.visitNode(node.operand);
    this.sb.push(operatorTokenToString(node.operator));
  }

  visitUnaryPrefixExpression(node: UnaryPrefixExpression): void {
    this.sb.push(operatorTokenToString(node.operator));
    this.visitNode(node.operand);
  }

  // statements

  visitNodeAndTerminate(node: Node): void {
    this.visitNode(node);
    const sb = this.sb;
    if (
      !sb.length || // leading EmptyStatement
      node.kind == NodeKind.Variable || // potentially assigns a FunctionExpression
      node.kind == NodeKind.Expression // potentially assigns a FunctionExpression
    ) {
      sb.push(";\n");
    } else {
      const last = sb[sb.length - 1];
      const lastCharPos = last.length - 1;
      if (
        lastCharPos >= 0 &&
        (last.charCodeAt(lastCharPos) == util.CharCode.CloseBrace ||
          last.charCodeAt(lastCharPos) == util.CharCode.Semicolon)
      ) {
        sb.push("\n");
      } else {
        sb.push(";\n");
      }
    }
  }

  visitBlockStatement(node: BlockStatement): void {
    const sb = this.sb;
    const statements = node.statements;
    const numStatements = statements.length;
    if (numStatements) {
      sb.push("{\n");
      const indentLevel = ++this.indentLevel;
      for (let i = 0; i < numStatements; ++i) {
        util.indent(sb, indentLevel);
        this.visitNodeAndTerminate(statements[i]);
      }
      util.indent(sb, --this.indentLevel);
      sb.push("}");
    } else {
      sb.push("{}");
    }
  }

  visitBreakStatement(node: BreakStatement): void {
    const label = node.label;
    if (label) {
      this.sb.push("break ");
      this.visitIdentifierExpression(label);
    } else {
      this.sb.push("break");
    }
  }

  visitContinueStatement(node: ContinueStatement): void {
    const label = node.label;
    if (label) {
      this.sb.push("continue ");
      this.visitIdentifierExpression(label);
    } else {
      this.sb.push("continue");
    }
  }

  visitClassDeclaration(node: ClassDeclaration, isDefault = false): void {
    const decorators = node.decorators;
    if (decorators) {
      for (let i = 0, k = decorators.length; i < k; ++i) {
        this.serializeDecorator(decorators[i]);
      }
    }
    const sb = this.sb;
    if (isDefault) {
      sb.push("export default ");
    } else {
      this.serializeExternalModifiers(node);
    }
    if (node.is(CommonFlags.Abstract)) sb.push("abstract ");
    if (node.name.text.length) {
      sb.push("class ");
      this.visitIdentifierExpression(node.name);
    } else {
      sb.push("class");
    }
    const typeParameters = node.typeParameters;
    if (typeParameters != null && typeParameters.length > 0) {
      sb.push("<");
      this.visitTypeParameter(typeParameters[0]);
      for (let i = 1, k = typeParameters.length; i < k; ++i) {
        sb.push(", ");
        this.visitTypeParameter(typeParameters[i]);
      }
      sb.push(">");
    }
    const extendsType = node.extendsType;
    if (extendsType) {
      sb.push(" extends ");
      this.visitTypeNode(extendsType);
    }
    const implementsTypes = node.implementsTypes;
    if (implementsTypes) {
      const numImplementsTypes = implementsTypes.length;
      if (numImplementsTypes) {
        sb.push(" implements ");
        this.visitTypeNode(implementsTypes[0]);
        for (let i = 1; i < numImplementsTypes; ++i) {
          sb.push(", ");
          this.visitTypeNode(implementsTypes[i]);
        }
      }
    }
    const indexSignature = node.indexSignature;
    const members = node.members;
    const numMembers = members.length;
    if (indexSignature !== null || numMembers) {
      sb.push(" {\n");
      const indentLevel = ++this.indentLevel;
      if (indexSignature) {
        util.indent(sb, indentLevel);
        this.visitNodeAndTerminate(indexSignature);
      }
      for (let i = 0, k = members.length; i < k; ++i) {
        const member = members[i];
        if (
          member.kind != NodeKind.FieldDeclaration ||
          (<FieldDeclaration>member).parameterIndex < 0
        ) {
          util.indent(sb, indentLevel);
          this.visitNodeAndTerminate(member);
        }
      }
      util.indent(sb, --this.indentLevel);
      sb.push("}");
    } else {
      sb.push(" {}");
    }
  }

  visitDoStatement(node: DoStatement): void {
    const sb = this.sb;
    sb.push("do ");
    this.visitNode(node.body);
    if (node.body.kind == NodeKind.Block) {
      sb.push(" while (");
    } else {
      util.indent(sb, this.indentLevel);
      sb.push("while (");
    }
    this.visitNode(node.condition);
    sb.push(")");
  }

  visitEmptyStatement(_node: EmptyStatement): void {
    /* nop */
  }

  visitEnumDeclaration(node: EnumDeclaration, isDefault = false): void {
    const sb = this.sb;
    if (isDefault) {
      sb.push("export default ");
    } else {
      this.serializeExternalModifiers(node);
    }
    if (node.is(CommonFlags.Const)) sb.push("const ");
    sb.push("enum ");
    this.visitIdentifierExpression(node.name);
    const values = node.values;
    const numValues = values.length;
    if (numValues) {
      sb.push(" {\n");
      const indentLevel = ++this.indentLevel;
      util.indent(sb, indentLevel);
      this.visitEnumValueDeclaration(node.values[0]);
      for (let i = 1; i < numValues; ++i) {
        sb.push(",\n");
        util.indent(sb, indentLevel);
        this.visitEnumValueDeclaration(node.values[i]);
      }
      sb.push("\n");
      util.indent(sb, --this.indentLevel);
      sb.push("}");
    } else {
      sb.push(" {}");
    }
  }

  visitEnumValueDeclaration(node: EnumValueDeclaration): void {
    this.visitIdentifierExpression(node.name);
    const initializer = node.initializer;
    if (initializer) {
      this.sb.push(" = ");
      this.visitNode(initializer);
    }
  }

  visitExportImportStatement(node: ExportImportStatement): void {
    const sb = this.sb;
    sb.push("export import ");
    this.visitIdentifierExpression(node.externalName);
    sb.push(" = ");
    this.visitIdentifierExpression(node.name);
  }

  visitExportMember(node: ExportMember): void {
    this.visitIdentifierExpression(node.localName);
    if (node.exportedName.text != node.localName.text) {
      this.sb.push(" as ");
      this.visitIdentifierExpression(node.exportedName);
    }
  }

  visitExportStatement(node: ExportStatement): void {
    const sb = this.sb;
    if (node.isDeclare) {
      sb.push("declare ");
    }
    const members = node.members;
    if (members == null) {
      sb.push("export *");
    } else if (members.length > 0) {
      const numMembers = members.length;
      sb.push("export {\n");
      const indentLevel = ++this.indentLevel;
      util.indent(sb, indentLevel);
      this.visitExportMember(members[0]);
      for (let i = 1; i < numMembers; ++i) {
        sb.push(",\n");
        util.indent(sb, indentLevel);
        this.visitExportMember(members[i]);
      }
      --this.indentLevel;
      sb.push("\n}");
    } else {
      sb.push("export {}");
    }
    const path = node.path;
    if (path) {
      sb.push(" from ");
      this.visitStringLiteralExpression(path);
    }
    sb.push(";");
  }

  visitExportDefaultStatement(node: ExportDefaultStatement): void {
    const declaration = node.declaration;
    switch (declaration.kind) {
      case NodeKind.EnumDeclaration: {
        this.visitEnumDeclaration(<EnumDeclaration>declaration, true);
        break;
      }
      case NodeKind.FunctionDeclaration: {
        this.visitFunctionDeclaration(<FunctionDeclaration>declaration, true);
        break;
      }
      case NodeKind.ClassDeclaration: {
        this.visitClassDeclaration(<ClassDeclaration>declaration, true);
        break;
      }
      case NodeKind.InterfaceDeclaration: {
        this.visitInterfaceDeclaration(<InterfaceDeclaration>declaration, true);
        break;
      }
      case NodeKind.NamespaceDeclaration: {
        this.visitNamespaceDeclaration(<NamespaceDeclaration>declaration, true);
        break;
      }
      default:
        assert(false);
    }
  }

  visitExpressionStatement(node: ExpressionStatement): void {
    this.visitNode(node.expression);
  }

  visitFieldDeclaration(node: FieldDeclaration): void {
    const decorators = node.decorators;
    if (decorators) {
      for (let i = 0, k = decorators.length; i < k; ++i) {
        this.serializeDecorator(decorators[i]);
      }
    }
    this.serializeAccessModifiers(node);
    this.visitIdentifierExpression(node.name);
    const sb = this.sb;
    if (node.flags & CommonFlags.DefinitelyAssigned) {
      sb.push("!");
    }
    const type = node.type;
    if (type) {
      sb.push(": ");
      this.visitTypeNode(type);
    }
    const initializer = node.initializer;
    if (initializer) {
      sb.push(" = ");
      this.visitNode(initializer);
    }
  }

  visitForStatement(node: ForStatement): void {
    const sb = this.sb;
    sb.push("for (");
    const initializer = node.initializer;
    if (initializer) {
      this.visitNode(initializer);
    }
    const condition = node.condition;
    if (condition) {
      sb.push("; ");
      this.visitNode(condition);
    } else {
      sb.push(";");
    }
    const incrementor = node.incrementor;
    if (incrementor) {
      sb.push("; ");
      this.visitNode(incrementor);
    } else {
      sb.push(";");
    }
    sb.push(") ");
    this.visitNode(node.body);
  }

  visitForOfStatement(node: ForOfStatement): void {
    const sb = this.sb;
    sb.push("for (");
    this.visitNode(node.variable);
    sb.push(" of ");
    this.visitNode(node.iterable);
    sb.push(") ");
    this.visitNode(node.body);
  }

  visitFunctionDeclaration(node: FunctionDeclaration, isDefault = false): void {
    const sb = this.sb;
    const decorators = node.decorators;
    if (decorators) {
      for (let i = 0, k = decorators.length; i < k; ++i) {
        this.serializeDecorator(decorators[i]);
      }
    }
    if (isDefault) {
      sb.push("export default ");
    } else {
      this.serializeExternalModifiers(node);
      this.serializeAccessModifiers(node);
    }
    if (node.name.text.length) {
      sb.push("function ");
    } else {
      sb.push("function");
    }
    this.visitFunctionCommon(node);
  }

  visitFunctionCommon(node: FunctionDeclaration): void {
    const sb = this.sb;
    this.visitIdentifierExpression(node.name);
    const signature = node.signature;
    const typeParameters = node.typeParameters;
    if (typeParameters) {
      const numTypeParameters = typeParameters.length;
      if (numTypeParameters) {
        sb.push("<");
        this.visitTypeParameter(typeParameters[0]);
        for (let i = 1; i < numTypeParameters; ++i) {
          sb.push(", ");
          this.visitTypeParameter(typeParameters[i]);
        }
        sb.push(">");
      }
    }
    if (node.arrowKind == ArrowKind.Single) {
      const parameters = signature.parameters;
      assert(parameters.length == 1);
      assert(!signature.explicitThisType);
      this.serializeParameter(parameters[0]);
    } else {
      sb.push("(");
      const parameters = signature.parameters;
      const numParameters = parameters.length;
      const explicitThisType = signature.explicitThisType;
      if (explicitThisType) {
        sb.push("this: ");
        this.visitTypeNode(explicitThisType);
      }
      if (numParameters) {
        if (explicitThisType) sb.push(", ");
        this.serializeParameter(parameters[0]);
        for (let i = 1; i < numParameters; ++i) {
          sb.push(", ");
          this.serializeParameter(parameters[i]);
        }
      }
    }
    const body = node.body;
    const returnType = signature.returnType;
    if (node.arrowKind) {
      if (body) {
        if (node.arrowKind == ArrowKind.Single) {
          assert(isTypeOmitted(returnType));
        } else {
          if (isTypeOmitted(returnType)) {
            sb.push(")");
          } else {
            sb.push("): ");
            this.visitTypeNode(returnType);
          }
        }
        sb.push(" => ");
        this.visitNode(body);
      } else {
        assert(!isTypeOmitted(returnType));
        sb.push(" => ");
        this.visitTypeNode(returnType);
      }
    } else {
      if (
        !isTypeOmitted(returnType) &&
        !node.isAny(CommonFlags.Constructor | CommonFlags.Set)
      ) {
        sb.push("): ");
        this.visitTypeNode(returnType);
      } else {
        sb.push(")");
      }
      if (body) {
        sb.push(" ");
        this.visitNode(body);
      }
    }
  }

  visitIfStatement(node: IfStatement): void {
    const sb = this.sb;
    sb.push("if (");
    this.visitNode(node.condition);
    sb.push(") ");
    const ifTrue = node.ifTrue;
    this.visitNode(ifTrue);
    if (ifTrue.kind != NodeKind.Block) {
      sb.push(";\n");
    }
    const ifFalse = node.ifFalse;
    if (ifFalse) {
      if (ifTrue.kind == NodeKind.Block) {
        sb.push(" else ");
      } else {
        sb.push("else ");
      }
      this.visitNode(ifFalse);
    }
  }

  visitImportDeclaration(node: ImportDeclaration): void {
    const externalName = node.foreignName;
    const name = node.name;
    this.visitIdentifierExpression(externalName);
    if (externalName.text != name.text) {
      this.sb.push(" as ");
      this.visitIdentifierExpression(name);
    }
  }

  visitImportStatement(node: ImportStatement): void {
    const sb = this.sb;
    sb.push("import ");
    const declarations = node.declarations;
    const namespaceName = node.namespaceName;
    if (declarations) {
      const numDeclarations = declarations.length;
      if (numDeclarations) {
        sb.push("{\n");
        const indentLevel = ++this.indentLevel;
        util.indent(sb, indentLevel);
        this.visitImportDeclaration(declarations[0]);
        for (let i = 1; i < numDeclarations; ++i) {
          sb.push(",\n");
          util.indent(sb, indentLevel);
          this.visitImportDeclaration(declarations[i]);
        }
        --this.indentLevel;
        sb.push("\n} from ");
      } else {
        sb.push("{} from ");
      }
    } else if (namespaceName) {
      sb.push("* as ");
      this.visitIdentifierExpression(namespaceName);
      sb.push(" from ");
    }
    this.visitStringLiteralExpression(node.path);
  }

  visitIndexSignature(node: IndexSignatureNode): void {
    const sb = this.sb;
    sb.push("[key: ");
    this.visitTypeNode(node.keyType);
    sb.push("]: ");
    this.visitTypeNode(node.valueType);
  }

  visitInterfaceDeclaration(
    node: InterfaceDeclaration,
    isDefault = false,
  ): void {
    const decorators = node.decorators;
    if (decorators) {
      for (let i = 0, k = decorators.length; i < k; ++i) {
        this.serializeDecorator(decorators[i]);
      }
    }
    const sb = this.sb;
    if (isDefault) {
      sb.push("export default ");
    } else {
      this.serializeExternalModifiers(node);
    }
    sb.push("interface ");
    this.visitIdentifierExpression(node.name);
    const typeParameters = node.typeParameters;
    if (typeParameters != null && typeParameters.length > 0) {
      sb.push("<");
      this.visitTypeParameter(typeParameters[0]);
      for (let i = 1, k = typeParameters.length; i < k; ++i) {
        sb.push(", ");
        this.visitTypeParameter(typeParameters[i]);
      }
      sb.push(">");
    }
    const extendsType = node.extendsType;
    if (extendsType) {
      sb.push(" extends ");
      this.visitTypeNode(extendsType);
    }
    // must not have implementsTypes
    sb.push(" {\n");
    const indentLevel = ++this.indentLevel;
    const members = node.members;
    for (let i = 0, k = members.length; i < k; ++i) {
      util.indent(sb, indentLevel);
      this.visitNodeAndTerminate(members[i]);
    }
    --this.indentLevel;
    sb.push("}");
  }

  visitMethodDeclaration(node: MethodDeclaration): void {
    const decorators = node.decorators;
    if (decorators) {
      for (let i = 0, k = decorators.length; i < k; ++i) {
        this.serializeDecorator(decorators[i]);
      }
    }
    this.serializeAccessModifiers(node);
    if (node.is(CommonFlags.Get)) {
      this.sb.push("get ");
    } else if (node.is(CommonFlags.Set)) {
      this.sb.push("set ");
    }
    this.visitFunctionCommon(node);
  }

  visitNamespaceDeclaration(
    node: NamespaceDeclaration,
    isDefault = false,
  ): void {
    const decorators = node.decorators;
    if (decorators) {
      for (let i = 0, k = decorators.length; i < k; ++i) {
        this.serializeDecorator(decorators[i]);
      }
    }
    const sb = this.sb;
    if (isDefault) {
      sb.push("export default ");
    } else {
      this.serializeExternalModifiers(node);
    }
    sb.push("namespace ");
    this.visitIdentifierExpression(node.name);
    const members = node.members;
    const numMembers = members.length;
    if (numMembers) {
      sb.push(" {\n");
      const indentLevel = ++this.indentLevel;
      for (let i = 0, k = members.length; i < k; ++i) {
        util.indent(sb, indentLevel);
        this.visitNodeAndTerminate(members[i]);
      }
      util.indent(sb, --this.indentLevel);
      sb.push("}");
    } else {
      sb.push(" {}");
    }
  }

  visitReturnStatement(node: ReturnStatement): void {
    const value = node.value;
    if (value) {
      this.sb.push("return ");
      this.visitNode(value);
    } else {
      this.sb.push("return");
    }
  }

  visitTrueExpression(_node: TrueExpression): void {
    this.sb.push("true");
  }

  visitFalseExpression(_node: FalseExpression): void {
    this.sb.push("false");
  }
  visitNullExpression(_node: NullExpression): void {
    this.sb.push("null");
  }
  visitSwitchCase(node: SwitchCase): void {
    const sb = this.sb;
    const label = node.label;
    if (label) {
      sb.push("case ");
      this.visitNode(label);
      sb.push(":\n");
    } else {
      sb.push("default:\n");
    }
    const statements = node.statements;
    const numStatements = statements.length;
    if (numStatements) {
      const indentLevel = ++this.indentLevel;
      util.indent(sb, indentLevel);
      this.visitNodeAndTerminate(statements[0]);
      for (let i = 1; i < numStatements; ++i) {
        util.indent(sb, indentLevel);
        this.visitNodeAndTerminate(statements[i]);
      }
      --this.indentLevel;
    }
  }

  visitSwitchStatement(node: SwitchStatement): void {
    const sb = this.sb;
    sb.push("switch (");
    this.visitNode(node.condition);
    sb.push(") {\n");
    const indentLevel = ++this.indentLevel;
    const cases = node.cases;
    for (let i = 0, k = cases.length; i < k; ++i) {
      util.indent(sb, indentLevel);
      this.visitSwitchCase(cases[i]);
      sb.push("\n");
    }
    --this.indentLevel;
    sb.push("}");
  }

  visitThrowStatement(node: ThrowStatement): void {
    this.sb.push("throw ");
    this.visitNode(node.value);
  }

  visitTryStatement(node: TryStatement): void {
    const sb = this.sb;
    sb.push("try {\n");
    const indentLevel = ++this.indentLevel;
    const statements = node.bodyStatements;
    for (let i = 0, k = statements.length; i < k; ++i) {
      util.indent(sb, indentLevel);
      this.visitNodeAndTerminate(statements[i]);
    }
    const catchVariable = node.catchVariable;
    if (catchVariable) {
      util.indent(sb, indentLevel - 1);
      sb.push("} catch (");
      this.visitIdentifierExpression(catchVariable);
      sb.push(") {\n");
      const catchStatements = node.catchStatements;
      if (catchStatements) {
        for (let i = 0, k = catchStatements.length; i < k; ++i) {
          util.indent(sb, indentLevel);
          this.visitNodeAndTerminate(catchStatements[i]);
        }
      }
    }
    const finallyStatements = node.finallyStatements;
    if (finallyStatements) {
      util.indent(sb, indentLevel - 1);
      sb.push("} finally {\n");
      for (let i = 0, k = finallyStatements.length; i < k; ++i) {
        util.indent(sb, indentLevel);
        this.visitNodeAndTerminate(finallyStatements[i]);
      }
    }
    util.indent(sb, indentLevel - 1);
    sb.push("}");
  }

  visitTypeDeclaration(node: TypeDeclaration): void {
    const decorators = node.decorators;
    if (decorators) {
      for (let i = 0, k = decorators.length; i < k; ++i) {
        this.serializeDecorator(decorators[i]);
      }
    }
    const sb = this.sb;
    this.serializeExternalModifiers(node);
    sb.push("type ");
    this.visitIdentifierExpression(node.name);
    const typeParameters = node.typeParameters;
    if (typeParameters) {
      const numTypeParameters = typeParameters.length;
      if (numTypeParameters) {
        sb.push("<");
        for (let i = 0; i < numTypeParameters; ++i) {
          this.visitTypeParameter(typeParameters[i]);
        }
        sb.push(">");
      }
    }
    sb.push(" = ");
    this.visitTypeNode(node.type);
  }

  visitVariableDeclaration(node: VariableDeclaration): void {
    this.visitIdentifierExpression(node.name);
    const type = node.type;
    const sb = this.sb;
    if (node.flags & CommonFlags.DefinitelyAssigned) {
      sb.push("!");
    }
    if (type) {
      sb.push(": ");
      this.visitTypeNode(type);
    }
    const initializer = node.initializer;
    if (initializer) {
      sb.push(" = ");
      this.visitNode(initializer);
    }
  }

  visitVariableStatement(node: VariableStatement): void {
    const decorators = node.decorators;
    if (decorators) {
      for (let i = 0, k = decorators.length; i < k; ++i) {
        this.serializeDecorator(decorators[i]);
      }
    }
    const sb = this.sb;
    const declarations = node.declarations;
    const numDeclarations = declarations.length;
    const firstDeclaration = declarations[0];
    this.serializeExternalModifiers(firstDeclaration);
    sb.push(
      firstDeclaration.is(CommonFlags.Const)
        ? "const "
        : firstDeclaration.is(CommonFlags.Let)
          ? "let "
          : "var ",
    );
    this.visitVariableDeclaration(node.declarations[0]);
    for (let i = 1; i < numDeclarations; ++i) {
      sb.push(", ");
      this.visitVariableDeclaration(node.declarations[i]);
    }
  }

  visitWhileStatement(node: WhileStatement): void {
    const sb = this.sb;
    sb.push("while (");
    this.visitNode(node.condition);
    const statement = node.body;
    if (statement.kind == NodeKind.Empty) {
      sb.push(")");
    } else {
      sb.push(") ");
      this.visitNode(node.body);
    }
  }

  // other

  serializeDecorator(node: DecoratorNode): void {
    const sb = this.sb;
    sb.push("@");
    this.visitNode(node.name);
    const args = node.args;
    if (args) {
      sb.push("(");
      const numArgs = args.length;
      if (numArgs) {
        this.visitNode(args[0]);
        for (let i = 1; i < numArgs; ++i) {
          sb.push(", ");
          this.visitNode(args[i]);
        }
      }
      sb.push(")\n");
    } else {
      sb.push("\n");
    }
    util.indent(sb, this.indentLevel);
  }

  serializeParameter(node: ParameterNode): void {
    const sb = this.sb;
    const kind = node.parameterKind;
    const implicitFieldDeclaration = node.implicitFieldDeclaration;
    if (implicitFieldDeclaration) {
      this.serializeAccessModifiers(implicitFieldDeclaration);
    }
    if (kind == ParameterKind.Rest) {
      sb.push("...");
    }
    this.visitIdentifierExpression(node.name);
    const type = node.type;
    const initializer = node.initializer;
    if (type) {
      if (kind == ParameterKind.Optional && !initializer) sb.push("?");
      if (!isTypeOmitted(type)) {
        sb.push(": ");
        this.visitTypeNode(type);
      }
    }
    if (initializer) {
      sb.push(" = ");
      this.visitNode(initializer);
    }
  }

  serializeExternalModifiers(node: DeclarationStatement): void {
    const sb = this.sb;
    if (node.is(CommonFlags.Export)) {
      sb.push("export ");
    } else if (node.is(CommonFlags.Import)) {
      sb.push("import ");
    } else if (node.is(CommonFlags.Declare)) {
      sb.push("declare ");
    }
  }

  serializeAccessModifiers(node: DeclarationStatement): void {
    const sb = this.sb;
    if (node.is(CommonFlags.Public)) {
      sb.push("public ");
    } else if (node.is(CommonFlags.Private)) {
      sb.push("private ");
    } else if (node.is(CommonFlags.Protected)) {
      sb.push("protected ");
    }
    if (node.is(CommonFlags.Static)) {
      sb.push("static ");
    } else if (node.is(CommonFlags.Abstract)) {
      sb.push("abstract ");
    }
    if (node.is(CommonFlags.Readonly)) {
      sb.push("readonly ");
    }
  }

  finish(): string {
    const ret = this.sb.join("");
    this.sb = [];
    return ret;
  }
}
