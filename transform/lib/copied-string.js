import { Node, } from "assemblyscript/dist/assemblyscript.js";
import { NodeKind } from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
export function specializeCopiedStringAllocator(sources) {
    const root = diagnosticsRuntimeRoot(sources);
    if (root === undefined)
        return;
    const target = sources.find((s) => s.internalPath === root + "assembly/util/runtime");
    const runtime = sources.find((s) => s.internalPath === "~lib/rt/itcms");
    if (!target || !runtime)
        return;
    const fn = (source, name) => source.statements.find((s) => s.kind === NodeKind.FunctionDeclaration &&
        s.name.text === name);
    const original = fn(runtime, "__new");
    const allocate = fn(target, "allocateObject");
    const helper = fn(target, "allocateCopiedString");
    const capability = fn(target, "canAllocateCopiedString");
    if (!original?.body || !allocate?.body || !helper?.body || !capability?.body)
        return;
    const expected = SimpleParser.parseTopLevelStatement(`function expected(size: usize, id: i32): usize {
    if (size >= OBJECT_MAXSIZE) throw new Error(E_ALLOCATION_TOO_LARGE);
    if (total >= threshold) interrupt();
    let obj = changetype<Object>(__alloc(OBJECT_OVERHEAD + size) - BLOCK_OVERHEAD);
    obj.rtId = id; obj.rtSize = <u32>size; obj.linkTo(fromSpace, white); total += obj.size;
    let ptr = changetype<usize>(obj) + TOTAL_OVERHEAD;
    memory.fill(ptr, 0, size); return ptr;
  }`);
    const normalized = (node) => toString(node).replace(/\s/g, "");
    if (normalized(original.body) !== normalized(expected.body))
        return;
    const statement = allocate.body.statements[0];
    if (statement?.kind !== NodeKind.Return)
        return;
    const call = statement.value;
    if (call?.kind !== NodeKind.Call)
        return;
    const expression = call.expression;
    if (expression.kind !== NodeKind.Identifier)
        return;
    const localAllocator = expression.text;
    const importedAllocator = target.statements
        .filter((s) => s.kind === NodeKind.Import &&
        s.internalPath === runtime.internalPath)
        .flatMap((s) => s.declarations ?? [])
        .find((d) => d.name.text === localAllocator);
    if (!importedAllocator)
        return;
    const scoped = fn(runtime, importedAllocator.foreignName.text);
    if (!scoped?.body || scoped === original)
        return;
    if (normalized(capability.body) !== "{returnfalse;}")
        return;
    const unused = (source, prefix) => {
        let name = prefix;
        const text = source.text + source.statements.map((s) => toString(s)).join("\n");
        for (let i = 0; text.includes(name); i++)
            name = prefix + i;
        return name;
    };
    const name = unused(runtime, "__json_as_allocate_copied_string");
    const local = unused(target, "__json_as_copy_string");
    const copy = cloneNode(scoped);
    copy.name.text = name;
    class Bind extends Visitor {
        _visit(node, parent) {
            node.range = copy.range;
            super._visit(node, parent);
        }
    }
    const parameter = SimpleParser.parseTopLevelStatement("function parameter(__jsonAsStringSource: usize): void {}").signature.parameters[0];
    new Bind().visit(parameter);
    copy.signature.parameters.push(parameter);
    let fills = 0;
    class Fill extends Visitor {
        visitCallExpression(node, parent = null) {
            if (normalized(node.expression) === "memory.fill" &&
                node.args.length === 3 &&
                normalized(node.args[0]) === "ptr" &&
                normalized(node.args[1]) === "0" &&
                normalized(node.args[2]) === "size") {
                node.expression = SimpleParser.parseExpression("memory.copy");
                node.args[1] = SimpleParser.parseExpression("__jsonAsStringSource");
                new Bind().visit(node.expression);
                new Bind().visit(node.args[1]);
                fills++;
            }
            super.visitCallExpression(node, parent);
        }
    }
    new Fill().visit(copy.body);
    if (fills !== 1)
        return;
    runtime.statements.push(copy);
    const imported = Node.createImportStatement([
        Node.createImportDeclaration(Node.createIdentifierExpression(name, target.range), Node.createIdentifierExpression(local, target.range), target.range),
    ], Node.createStringLiteralExpression("rt/itcms", target.range), target.range);
    imported.internalPath = runtime.internalPath;
    target.statements.unshift(imported);
    const replacement = SimpleParser.parseTopLevelStatement(`function replacement(source: usize, size: usize): usize {
    return ${local}(size, idof<string>(), source);
  }`);
    class TargetBind extends Visitor {
        _visit(node, parent) {
            node.range = helper.range;
            super._visit(node, parent);
        }
    }
    new TargetBind().visit(replacement.body);
    helper.body = replacement.body;
    capability.body = Node.createBlockStatement([
        Node.createReturnStatement(Node.createTrueExpression(capability.range), capability.range),
    ], capability.range);
}
