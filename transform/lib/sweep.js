// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { createHash } from "node:crypto";
import { Node, Parser, } from "assemblyscript/dist/assemblyscript.js";
import { NodeKind } from "./types.js";
import { SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
const STOCK_SOURCES = new Map([
    [
        "~lib/rt/itcms",
        "7ef783af8bc200fa9cd4acda183b8642166f0549ff82da1078ed612b7f1f6dea",
    ],
    [
        "~lib/rt/common",
        "8864fd8a1dcf43b0aa8f01030cf37f21760a52ee69e24cfb3f7b641c4386e36b",
    ],
    [
        "~lib/rt/tlsf",
        "4199f0fc9bd1faf5ca7df44a05931d7d1cbeff86255c0e845788024349c2f47b",
    ],
]);
const ALLOCATOR_ALIASES = new Set([
    "__alloc",
    "__free",
    "__new",
    "__renew",
    "__visit",
    "__visit_members",
    "__visit_globals",
    "__collect",
    "__finalize",
    "__typeinfo",
    "__heap_base",
    "__stack_pointer",
]);
export function specializeSweepRuns(sources, aliases, hasStaticI64ArraySchema = false) {
    if (aliases &&
        [...aliases.keys()].some((name) => ALLOCATOR_ALIASES.has(name)))
        return;
    for (const [path, expected] of STOCK_SOURCES) {
        const source = sources.find((s) => s.internalPath === path);
        if (!source ||
            createHash("sha256").update(source.text).digest("hex") !== expected)
            return;
    }
    const root = diagnosticsRuntimeRoot(sources);
    const target = sources.find((s) => s.internalPath === root + "assembly/util/runtime");
    const runtime = sources.find((s) => s.internalPath === "~lib/rt/itcms");
    if (root === undefined || !target || !runtime)
        return;
    const fn = (source, name) => source.statements.find((s) => s.kind === NodeKind.FunctionDeclaration &&
        s.name.text === name);
    const capability = fn(target, "canCoalesceSweepRuns");
    if (!capability?.body ||
        toString(capability.body).replace(/\s/g, "") !== "{returnfalse;}")
        return;
    const owned = (name, fallback = false) => {
        const helper = fn(target, name);
        const statements = helper?.body?.statements;
        const statement = fallback ? statements?.at(-1) : statements?.[0];
        if (statement?.kind !== NodeKind.Return)
            return undefined;
        const call = statement.value;
        if (call?.kind !== NodeKind.Call)
            return undefined;
        const expression = call.expression;
        if (expression.kind !== NodeKind.Identifier)
            return undefined;
        const imported = target.statements
            .filter((s) => s.kind === NodeKind.Import &&
            s.internalPath === runtime.internalPath)
            .flatMap((s) => s.declarations ?? [])
            .find((d) => d.name.text === expression.text);
        if (!imported)
            return undefined;
        const result = fn(runtime, imported.foreignName.text);
        return result?.body && result.name.text.startsWith("__json_as_")
            ? result
            : undefined;
    };
    const allocators = [owned("allocateObject"), owned("allocateCopiedString")];
    if (!allocators[0] || !allocators[1] || allocators[0] === allocators[1])
        return;
    const output = owned("allocateUninitialized", true);
    if (output && !allocators.includes(output))
        allocators.push(output);
    const free = fn(runtime, "free"), step = fn(runtime, "step"), interrupt = fn(runtime, "interrupt");
    if (!free?.body || !step?.body || !interrupt?.body)
        return;
    const stockParser = new Parser();
    stockParser.parseFile(runtime.text, runtime.normalizedPath, false);
    const stock = stockParser.sources[0];
    if (!stock ||
        [free, step, interrupt].some((f) => {
            const expected = fn(stock, f.name.text);
            return !expected?.body || toString(f.body) !== toString(expected.body);
        }))
        return;
    const countCalls = (body, name) => {
        let count = 0;
        class Count extends Visitor {
            visitCallExpression(node, parent) {
                if (node.expression.kind === NodeKind.Identifier &&
                    node.expression.text === name)
                    count++;
                super.visitCallExpression(node, parent);
            }
        }
        new Count().visit(body);
        return count;
    };
    if (allocators.some((a) => countCalls(a.body, "interrupt") !== 1))
        return;
    const used = new Set();
    const fresh = (source, prefix) => {
        const text = source.text + source.statements.map((s) => toString(s)).join("\n");
        let name = prefix;
        for (let i = 0; used.has(name) || text.includes(name); i++)
            name = prefix + i;
        used.add(name);
        return name;
    };
    const pending = fresh(runtime, "__json_as_sweep_pending");
    const end = fresh(runtime, "__json_as_sweep_end");
    const flush = fresh(runtime, "__json_as_sweep_flush");
    const defer = fresh(runtime, "__json_as_sweep_defer");
    const freeName = fresh(runtime, "__json_as_sweep_free");
    const stepName = fresh(runtime, "__json_as_sweep_step");
    const interruptName = fresh(runtime, "__json_as_sweep_interrupt");
    const select = fresh(runtime, "__json_as_sweep_select");
    const eligible = fresh(runtime, "__json_as_can_coalesce_sweep_runs");
    const local = fresh(target, "__json_as_sweep_capability");
    class Bind extends Visitor {
        _visit(node, parent) {
            node.range = step.range;
            super._visit(node, parent);
        }
    }
    const bind = (node) => {
        new Bind().visit(node);
        return node;
    };
    const parse = (text) => bind(SimpleParser.parseTopLevelStatement(text));
    const declarations = [
        parse(`@lazy let ${pending}: usize = 0;`),
        parse(`@lazy let ${end}: usize = 0;`),
        parse(`@inline function ${flush}(): void {
      const ptr = ${pending};
      if (ptr) { ${pending} = 0; ${end} = 0; __free(ptr); }
    }`),
        parse(`@inline function ${defer}(ptr: usize): void {
      const info = load<usize>(ptr - BLOCK_OVERHEAD);
      const payload = info & ~<usize>3;
      const next = ptr + payload + BLOCK_OVERHEAD;
      const held = ${pending};
      if (held) {
        const old = load<usize>(held - BLOCK_OVERHEAD);
        const oldPayload = old & ~<usize>3;
        const limit = OBJECT_MAXSIZE + OBJECT_OVERHEAD - BLOCK_OVERHEAD;
        if (payload <= limit && oldPayload <= limit - payload) {
          if (ptr == ${end}) {
            store<usize>(held - BLOCK_OVERHEAD, oldPayload + BLOCK_OVERHEAD + payload | (old & 2));
            ${end} = next; return;
          }
          if (next == held) {
            store<usize>(ptr - BLOCK_OVERHEAD, payload + BLOCK_OVERHEAD + oldPayload | (info & 2));
            ${pending} = ptr; return;
          }
        }
        ${flush}();
      }
      ${pending} = ptr; ${end} = next;
    }`),
    ];
    const freeCopy = parse(`function ${freeName}(obj: Object): void ${toString(free.body)}`);
    const stepCopy = parse(`function ${stepName}(): usize ${toString(step.body)}`);
    const interruptCopy = parse(`function ${interruptName}(): void ${toString(interrupt.body)}`);
    const arraySource = sources.find((s) => s.internalPath === "~lib/array");
    if (hasStaticI64ArraySchema &&
        !aliases?.has("Array") &&
        !aliases?.has("i64") &&
        arraySource &&
        createHash("sha256").update(arraySource.text).digest("hex") ===
            "b219355bec6fc830bf9b41662986aa81e657a701f71ea472749746779ee951cc" &&
        createHash("sha256").update(toString(arraySource)).digest("hex") ===
            "772b61ebcbc0d53c44b14082751c1d7f9e855c31b2b7aa1bc6b5bf541e56c017") {
        class SkipStaticBuffer extends Visitor {
            visitExpressionStatement(node, parent) {
                const expression = node.expression;
                if (parent?.kind === NodeKind.Block &&
                    expression.kind === NodeKind.Call &&
                    expression.expression.kind ===
                        NodeKind.Identifier &&
                    expression.expression
                        .text === "__visit_members") {
                    const guard = bind(SimpleParser.parseStatement("if (!(obj.rtId == idof<Array<i64>>() && load<usize>(changetype<usize>(obj) + TOTAL_OVERHEAD) < __heap_base)) {}"));
                    const block = parent;
                    guard.ifTrue.statements = [node];
                    block.statements[block.statements.indexOf(node)] = guard;
                    return;
                }
                super.visitExpressionStatement(node, parent);
            }
        }
        new SkipStaticBuffer().visit(stepCopy);
    }
    const redirect = (body, from, to) => {
        let count = 0;
        class Redirect extends Visitor {
            visitCallExpression(node, parent) {
                if (node.expression.kind === NodeKind.Identifier &&
                    node.expression.text === from) {
                    node.expression = bind(SimpleParser.parseExpression(to));
                    count++;
                }
                super.visitCallExpression(node, parent);
            }
        }
        new Redirect().visit(body);
        return count;
    };
    if (redirect(freeCopy.body, "__free", defer) !== 1 ||
        redirect(stepCopy.body, "free", freeName) !== 1 ||
        redirect(interruptCopy.body, "step", stepName) !== 1)
        return;
    const exits = [];
    class Exits extends Visitor {
        visitReturnStatement(node, parent) {
            if (parent?.kind === NodeKind.Block)
                exits.push({ node, parent: parent });
            super.visitReturnStatement(node, parent);
        }
    }
    new Exits().visit(interruptCopy.body);
    if (exits.length !== 1 || exits[0].node.value)
        return;
    const { node, parent } = exits[0];
    const index = parent.statements.indexOf(node);
    if (index < 0)
        return;
    parent.statements.splice(index, 1, bind(Node.createBlockStatement([SimpleParser.parseStatement(`${flush}();`), node], node.range)));
    interruptCopy.body.statements.push(bind(SimpleParser.parseStatement(`${flush}();`)));
    const enabled = parse(`@inline export function ${eligible}(): bool {
    return sizeof<usize>() == 4 && ASC_RUNTIME == 2 && !RTRACE && !TRACE &&
      !PROFILE && !isDefined(__finalize);
  }`);
    const wrapper = parse(`@inline function ${select}(): void {
    if (${eligible}()) ${interruptName}(); else interrupt();
  }`);
    for (const allocator of allocators)
        redirect(allocator.body, "interrupt", select);
    runtime.statements.push(...declarations, freeCopy, stepCopy, interruptCopy, enabled, wrapper);
    const imported = Node.createImportStatement([
        Node.createImportDeclaration(Node.createIdentifierExpression(eligible, target.range), Node.createIdentifierExpression(local, target.range), target.range),
    ], Node.createStringLiteralExpression("rt/itcms", target.range), target.range);
    imported.internalPath = runtime.internalPath;
    target.statements.unshift(imported);
    const call = Node.createCallExpression(Node.createIdentifierExpression(local, capability.range), null, [], capability.range);
    capability.body = Node.createBlockStatement([Node.createReturnStatement(call, capability.range)], capability.range);
}
