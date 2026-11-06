import {
  BlockStatement,
  CallExpression,
  ExpressionStatement,
  FunctionDeclaration,
  IdentifierExpression,
  Node,
  Source,
} from "assemblyscript/dist/assemblyscript.js";
import { NodeKind } from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";

/** Inline only library-owned stores; preserve the global runtime entry. */
export function specializeObjectBarrier(sources: Source[]): void {
  const root = diagnosticsRuntimeRoot(sources);
  if (root === undefined) return;
  const target = sources.find(
    (s) => s.internalPath === root + "assembly/util/runtime",
  );
  const runtime = sources.find((s) => s.internalPath === "~lib/rt/itcms");
  if (!target || !runtime) return;
  const find = (source: Source, name: string) =>
    source.statements.find(
      (s) =>
        s.kind === NodeKind.FunctionDeclaration &&
        (s as FunctionDeclaration).name.text === name,
    ) as FunctionDeclaration | undefined;
  const helper = find(target, "linkObject");
  const original = find(runtime, "__link");
  if (
    !helper?.body ||
    !original?.body ||
    original.signature.parameters.length !== 3
  )
    return;
  const statement = (helper.body as BlockStatement).statements[0];
  if (statement?.kind !== NodeKind.Expression) return;
  const call = (statement as ExpressionStatement).expression as CallExpression;
  if (
    call.kind !== NodeKind.Call ||
    call.expression.kind !== NodeKind.Identifier ||
    (call.expression as IdentifierExpression).text !== "__link"
  )
    return;
  const unused = (source: Source, prefix: string): string => {
    let name = prefix;
    for (let i = 0; source.text.includes(name); i++) name = prefix + i;
    return name;
  };
  const name = unused(runtime, "__json_as_link_object");
  const local = unused(target, "__json_as_runtime_link");
  const copy = cloneNode(original) as FunctionDeclaration;
  copy.name.text = name;
  copy.decorators = (copy.decorators ?? []).filter(
    (d) =>
      !["global", "inline"].includes((d.name as IdentifierExpression).text),
  );
  copy.decorators.push(
    Node.createDecorator(
      Node.createIdentifierExpression("inline", copy.range),
      null,
      copy.range,
    ),
  );

  // Only reorder the known stock barrier. If an installed runtime changes its
  // checks or transitions, inline its own body unchanged instead.
  const expected =
    SimpleParser.parseTopLevelStatement(`function barrier(parentPtr: usize, childPtr: usize, expectMultiple: bool): void {
    if (!childPtr) return;
    if (DEBUG) assert(parentPtr);
    let child = changetype<Object>(childPtr - TOTAL_OVERHEAD);
    if (child.color == white) {
      let parent = changetype<Object>(parentPtr - TOTAL_OVERHEAD);
      let parentColor = parent.color;
      if (parentColor == i32(!white)) {
        if (expectMultiple) { parent.makeGray(); } else { child.makeGray(); }
      } else if (parentColor == transparent && state == STATE_MARK) {
        child.makeGray();
      }
    }
  }`) as FunctionDeclaration;
  if (toString(original.body) === toString(expected.body)) {
    const reordered =
      SimpleParser.parseTopLevelStatement(`function barrier(parentPtr: usize, childPtr: usize, expectMultiple: bool): void {
      if (!childPtr) return;
      if (DEBUG) assert(parentPtr);
      const parent = changetype<Object>(parentPtr - TOTAL_OVERHEAD);
      const parentColor = parent.color;
      if (parentColor == i32(!white)) {
        const child = changetype<Object>(childPtr - TOTAL_OVERHEAD);
        if (child.color == white) {
          if (expectMultiple) parent.makeGray(); else child.makeGray();
        }
      } else if (parentColor == transparent && state == STATE_MARK) {
        const child = changetype<Object>(childPtr - TOTAL_OVERHEAD);
        if (child.color == white) child.makeGray();
      }
    }`) as FunctionDeclaration;
    class Bind extends Visitor {
      _visit(node: Node, parent: Node | null): void {
        node.range = original!.range;
        super._visit(node, parent);
      }
    }
    new Bind().visit(reordered.body!);
    copy.body = reordered.body;
  }
  runtime.statements.push(copy);
  const imports = Node.createImportStatement(
    [
      Node.createImportDeclaration(
        Node.createIdentifierExpression(name, target.range),
        Node.createIdentifierExpression(local, target.range),
        target.range,
      ),
    ],
    Node.createStringLiteralExpression("rt/itcms", target.range),
    target.range,
  );
  imports.internalPath = runtime.internalPath;
  target.statements.unshift(imports);
  call.expression = Node.createIdentifierExpression(local, call.range);
}
