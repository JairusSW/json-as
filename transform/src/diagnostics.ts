import {
  CallExpression,
  ExpressionStatement,
  FunctionDeclaration,
  FunctionExpression,
  IdentifierExpression,
  MethodDeclaration,
  NamespaceDeclaration,
  Node,
  Range,
  Source,
  ThrowStatement,
  TypeNode,
} from "assemblyscript/dist/assemblyscript.js";
import { NodeKind } from "./types.js";
import { Visitor } from "./visitor.js";

export function parseDiagnosticsFlag(value: string | undefined): boolean {
  switch (value?.trim().toLowerCase()) {
    case undefined:
    case "":
    case "true":
    case "1": return true;
    case "false":
    case "0": return false;
    default: throw new Error("JSON_DIAGNOSTICS must be true or false");
  }
}

export function collectOriginalMethods(sources: Source[]): WeakSet<MethodDeclaration> {
  const methods = new WeakSet<MethodDeclaration>();
  class OriginalMethods extends Visitor {
    visitMethodDeclaration(node: MethodDeclaration): void {
      methods.add(node);
      super.visitMethodDeclaration(node);
    }
  }
  const visitor = new OriginalMethods();
  for (const source of sources) visitor.visit(source);
  return methods;
}

/** Match the parsed runtime identity, including installed/aliased package roots. */
export function diagnosticsRuntimeRoot(sources: Source[]): string | undefined {
  const source = sources.find(source => source.internalPath.endsWith("assembly/index") &&
    source.statements.some(statement => statement.kind === NodeKind.NamespaceDeclaration &&
      (statement as NamespaceDeclaration).name.text === "JSON" &&
      ["Value", "Obj", "Arr", "Raw"].every(name =>
        (statement as NamespaceDeclaration).members.some(member =>
          member.kind === NodeKind.ClassDeclaration &&
          (member as { name?: IdentifierExpression }).name?.text === name))));
  return source?.internalPath.slice(0, -"assembly/index".length);
}

function replace(parent: Node | null, previous: Node, replacement: Node): void {
  if (!parent) throw new Error("Missing parent for diagnostic lowering");
  const fields = parent as unknown as Record<string, unknown>;
  for (const key of Object.keys(fields)) {
    if (fields[key] === previous) { fields[key] = replacement; return; }
    const children = fields[key];
    if (Array.isArray(children)) {
      const index = children.indexOf(previous);
      if (index >= 0) { children[index] = replacement; return; }
    }
  }
  throw new Error("Diagnostic node is not attached to its parent");
}

function trap(range: Range): CallExpression {
  return Node.createCallExpression(Node.createIdentifierExpression("unreachable", range), null, [], range);
}

/** Lower only library-owned failures; leave application callbacks/defaults intact. */
export function lowerDiagnostics(
  source: Source,
  originalMethods: WeakSet<MethodDeclaration>,
  runtimeRoot: string | undefined,
): void {
  const path = runtimeRoot !== undefined && source.internalPath.startsWith(runtimeRoot)
    ? source.internalPath.slice(runtimeRoot.length) : "";
  const library = path === "assembly/index" || path.startsWith("assembly/deserialize/") ||
    path.startsWith("assembly/serialize/") || path.startsWith("assembly/util/") ||
    path.startsWith("assembly/custom/") || path.startsWith("lib/");
  class Lower extends Visitor {
    generated = false;
    returnType: TypeNode | null = null;
    trapCall(range: Range): CallExpression {
      if (library) return trap(range);
      return Node.createCallExpression(
        Node.createPropertyAccessExpression(Node.createIdentifierExpression("JSON", range), Node.createIdentifierExpression("__trap", range), range),
        this.returnType ? [this.returnType] : null, [], range,
      );
    }
    visitMethodDeclaration(node: MethodDeclaration): void {
      if (!library && (originalMethods.has(node) ||
          !/^__(?:DESERIALIZE|SERIALIZE)/.test(node.name.text))) return;
      const previous = this.generated;
      const previousReturn = this.returnType;
      this.generated = true;
      this.returnType = node.signature.returnType;
      super.visitMethodDeclaration(node);
      this.generated = previous;
      this.returnType = previousReturn;
    }
    visitFunctionDeclaration(node: FunctionDeclaration): void {
      if (library) super.visitFunctionDeclaration(node);
    }
    visitFunctionExpression(node: FunctionExpression): void {
      // Function expressions copied from user defaults and predicates keep their behavior.
      if (library) super.visitFunctionExpression(node);
    }
    visitExpressionStatement(node: ExpressionStatement): void {
      this.visit(node.expression, node);
    }
    visitThrowStatement(node: ThrowStatement, parent: Node | null): void {
      if (library || this.generated)
        replace(parent, node, Node.createReturnStatement(this.trapCall(node.range), node.range));
    }
    visitCallExpression(node: CallExpression, parent: Node | null): void {
      if ((library || this.generated) && node.expression.kind === NodeKind.Identifier &&
          (node.expression as IdentifierExpression).text === "abort") {
        replace(parent, node, this.trapCall(node.range));
      } else super.visitCallExpression(node, parent);
    }
  }
  new Lower().visit(source);
}
