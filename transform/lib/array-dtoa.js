// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { createHash } from "node:crypto";
import { Node, } from "assemblyscript/dist/assemblyscript.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
import { arrayRowSourceInfo } from "./array-row-safety.js";
import { ARRAY_ROW_SOURCES } from "./array-row-runtime.js";
import { NodeKind } from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";
import { stockArrayExponentData, STOCK_POWER_SOURCE, } from "./array-exponents.js";
const DTOA_TEXT = "71915407aa68ea907d91a8c0f6167c46990c92a5f5403a99c837767ed48acc81";
const DTOA_AST = new Set([
    "86344c325fc249dd08029a561a4ca182ab503c8579c37972dd4e4003e62d667d",
    "89edc1dee2b2ae79f7a0cf6de9fd01d00d206a45fd0ca5ff6ae25c1a3aa31d24",
]);
const PEER_AST = "0e096cc579cb1bb2d85c0d68659e4e375aff4577a1ed307110a182335e3db42a";
const ARRAY_AST = "e021aa2f40cefd871f44415487538dab5891475b35d7d266cc8e0c37a4201650";
const FUNCTIONS = [
    "setDecimalResult",
    "toDecimalDoubleNormal",
    "toDecimalDouble",
    "normalizeDoubleShortest",
    "formatDecodedDouble",
    "formatDouble",
    "dtoa_buffered",
];
const hash = (text) => createHash("sha256").update(text).digest("hex");
function moduleSource(sources, path) {
    return sources.find((source) => source.internalPath === path || source.internalPath === path + "/index");
}
function exportedFunction(sources, source, name, seen = new Set()) {
    const key = source.internalPath + ":" + name;
    if (seen.has(key) || seen.size >= 32)
        return null;
    const trail = new Set(seen).add(key);
    const local = (localName) => {
        const fn = source.statements.find((node) => node.kind === NodeKind.FunctionDeclaration &&
            node.name.text === localName);
        if (fn)
            return { source, node: fn };
        for (const node of source.statements) {
            if (node.kind !== NodeKind.Import)
                continue;
            const statement = node;
            const imported = statement.declarations?.find((item) => item.name.text === localName);
            if (!imported)
                continue;
            const target = moduleSource(sources, statement.internalPath);
            if (target)
                return exportedFunction(sources, target, imported.foreignName.text, trail);
        }
        return null;
    };
    const direct = source.statements.find((node) => node.kind === NodeKind.FunctionDeclaration &&
        node.name.text === name &&
        !!(node.flags & 2));
    if (direct)
        return { source, node: direct };
    const exports = source.statements.filter((node) => node.kind === NodeKind.Export);
    const explicit = exports.filter((statement) => statement.members?.some((member) => member.exportedName.text === name));
    const bindings = [];
    for (const statement of explicit.length
        ? explicit
        : exports.filter((statement) => !statement.members)) {
        const member = statement.members?.find((item) => item.exportedName.text === name);
        const localName = member ? member.localName.text : name;
        let binding;
        if (statement.path) {
            const target = moduleSource(sources, statement.internalPath);
            binding = target
                ? exportedFunction(sources, target, localName, trail)
                : null;
        }
        else
            binding = local(localName);
        if (binding)
            bindings.push(binding);
    }
    if (!bindings.length ||
        bindings.some((binding) => binding.node !== bindings[0].node))
        return null;
    return bindings[0];
}
function prepareArrayExponents(fn, table) {
    const body = fn.body;
    if (!body || body.kind !== NodeKind.Block)
        return false;
    const statements = body.statements;
    const name = (node) => node.kind === NodeKind.Variable
        ? node.declarations[0]?.name.text
        : undefined;
    const qIndex = statements.findIndex((node) => name(node) === "q");
    const irregular = statements.find((node) => node.kind === NodeKind.If &&
        toString(node.condition) === "!regular");
    const start = statements.findIndex((node) => name(node) === "decExp");
    const end = statements.findIndex((node) => name(node) === "a");
    if (qIndex !== 1 ||
        !irregular ||
        irregular.ifTrue.kind !== NodeKind.Block ||
        start < 0 ||
        end <= start)
        return false;
    const replacement = [
        `const entry=${table}+(<usize>rawExp<<5);`,
        "let decExp=load<i32>(entry,16);",
        "let shift=load<i32>(entry,20);",
        "let h=load<i32>(entry,24);",
        "let pLo=load<u64>(entry,8);",
        "let pHi=load<u64>(entry);",
        "gPow10Hi=pHi;",
        "let y=c<<shift;",
    ].map((text) => SimpleParser.parseStatement(text));
    statements.splice(start, end - start, ...replacement);
    const [q] = statements.splice(qIndex, 1);
    irregular.ifTrue.statements.unshift(q);
    return true;
}
export function specializeArrayDtoa(sources, aliases) {
    if (aliases && [...aliases.keys()].some((name) => !/^JSON_/.test(name)))
        return null;
    const root = diagnosticsRuntimeRoot(sources);
    if (root === undefined)
        return null;
    const array = sources.find((source) => source.internalPath === root + "assembly/serialize/naive/array");
    if (!array ||
        hash(array.text) !==
            ARRAY_ROW_SOURCES.get("own:assembly/serialize/naive/array")[0])
        return null;
    const writer = array.statements.find((node) => node.kind === NodeKind.FunctionDeclaration &&
        node.name.text === "serializeF64ArrayFast");
    if (!writer || hash(toString(writer)) !== ARRAY_AST)
        return null;
    const imported = array.statements
        .filter((node) => node.kind === NodeKind.Import)
        .flatMap((node) => {
        const statement = node;
        return (statement.declarations || [])
            .filter((item) => item.name.text === "dtoa_buffered")
            .map((item) => ({ statement, item }));
    });
    if (imported.length !== 1)
        return null;
    const target = moduleSource(sources, imported[0].statement.internalPath);
    const binding = target
        ? exportedFunction(sources, target, imported[0].item.foreignName.text)
        : null;
    if (!binding || binding.node.name.text !== "dtoa_buffered")
        return null;
    const source = binding.source;
    const peer = sources.find((input) => input.internalPath === source.internalPath.replace(/\/dtoa$/, "/xjb"));
    if (hash(source.text) !== DTOA_TEXT ||
        !DTOA_AST.has(hash(toString(source))) ||
        !peer ||
        hash(peer.text) !== STOCK_POWER_SOURCE ||
        hash(toString(peer)) !== PEER_AST ||
        source.statements.some((node) => node.kind === NodeKind.Import &&
            moduleSource(sources, node.internalPath) !== peer))
        return null;
    const names = new Set();
    for (const input of sources)
        for (const name of arrayRowSourceInfo(input).names)
            names.add(name);
    let prefix = "__json_array_", ordinal = 0;
    while ([...FUNCTIONS, "round10", "decimal_table"].some((name) => names.has(prefix + name)))
        prefix = "__json_array_" + ++ordinal + "_";
    const renamed = new Map(FUNCTIONS.map((name) => [name, prefix + name]));
    const rounding = prefix + "round10";
    const table = prefix + "decimal_table";
    let products = 0, lowProducts = 0;
    class Rewrite extends Visitor {
        visitVariableDeclaration(node, parent) {
            if (node.name.text === "lo" &&
                node.initializer &&
                toString(node.initializer) === "pLo64 + umul64hi(pLo, y)") {
                node.initializer = SimpleParser.parseExpression("pLo64 + (pLo == 0 ? 0 : umul64hi(pLo, y))");
                lowProducts++;
            }
            super.visitVariableDeclaration(node, parent);
        }
        visitCallExpression(node, parent) {
            if (node.expression.kind === NodeKind.Identifier) {
                const identifier = node.expression;
                if (renamed.has(identifier.text))
                    identifier.text = renamed.get(identifier.text);
                else if (identifier.text === "umul64hiCarry" &&
                    node.args.length === 3 &&
                    toString(node.args[0]) === "dotOne" &&
                    toString(node.args[1]) === "10") {
                    identifier.text = rounding;
                    node.args.splice(1, 1);
                    products++;
                }
            }
            super.visitCallExpression(node, parent);
        }
    }
    const originals = FUNCTIONS.map((name) => source.statements.find((node) => node.kind === NodeKind.FunctionDeclaration &&
        node.name.text === name));
    if (originals.some((node) => !node))
        return null;
    const clones = originals.map((original, index) => {
        const copy = cloneNode(original);
        copy.name.text = renamed.get(FUNCTIONS[index]);
        new Rewrite().visit(copy.body);
        return copy;
    });
    if (products !== 2 || lowProducts !== 2)
        return null;
    const payload = stockArrayExponentData(peer.text);
    if (payload === null || !prepareArrayExponents(clones[1], table))
        return null;
    const data = SimpleParser.parseTopLevelStatement(`@lazy const ${table}=changetype<usize>("");`);
    data.declarations[0].initializer.args[0] =
        Node.createStringLiteralExpression(payload, source.range);
    const declaration = SimpleParser.parseTopLevelStatement(`@global @inline function ${rounding}(a:u64, carry:u64):u64 {
    const low = (a & 0xffffffff) * 10 + (carry & 0xffffffff);
    return ((a >> 32) * 10 + (carry >> 32) + (low >> 32)) >> 32;
  }`);
    const entry = clones.at(-1);
    entry.decorators = [
        ...(entry.decorators || []),
        cloneNode(declaration.decorators.find((node) => toString(node).includes("global"))),
    ];
    class Bind extends Visitor {
        _visit(node, parent) {
            node.range = source.range;
            super._visit(node, parent);
        }
    }
    new Bind().visit([...clones, declaration, data]);
    source.statements.push(...clones, declaration, data);
    class Route extends Visitor {
        visitCallExpression(node, parent) {
            if (node.expression.kind === NodeKind.Identifier &&
                node.expression.text === "dtoa_buffered")
                node.expression.text = entry.name.text;
            super.visitCallExpression(node, parent);
        }
    }
    new Route().visit(writer.body);
    return { entry: entry.name.text, rounding };
}
export function preserveFloatCallbackPolicy(sources, aliases) {
    const root = diagnosticsRuntimeRoot(sources);
    if (root === undefined)
        return () => { };
    const verified = new Map();
    const stock = (binding, name) => {
        if (!binding || binding.node.name.text !== name)
            return false;
        const source = binding.source;
        const cached = verified.get(source);
        if (cached !== undefined)
            return cached;
        const isDouble = name === "dtoa_buffered";
        const textHash = isDouble
            ? DTOA_TEXT
            : "ed720d81f73ca14e9976c07a403cab139b57977f1988f526212cda40e999eee9";
        const astHash = isDouble
            ? "86344c325fc249dd08029a561a4ca182ab503c8579c37972dd4e4003e62d667d"
            : "8ce6794a8299fded4b16f83dd01b7437b7e5f4e571c18341cef6915cd5a619fe";
        const peer = moduleSource(sources, source.internalPath.replace(/\/(?:dtoa|ftoa)$/, "/xjb"));
        const safe = hash(source.text) === textHash &&
            hash(toString(source)) === astHash &&
            !!peer &&
            hash(peer.text) === STOCK_POWER_SOURCE &&
            hash(toString(peer)) === PEER_AST &&
            source.statements.every((node) => node.kind !== NodeKind.Import ||
                moduleSource(sources, node.internalPath) ===
                    peer);
        verified.set(source, safe);
        return safe;
    };
    const entries = [
        "assembly/index",
        "assembly/serialize/naive/float",
        "assembly/serialize/naive/array",
    ];
    const safe = ![...(aliases?.keys() ?? [])].some((name) => !/^JSON_/.test(name)) &&
        entries.every((path) => {
            const source = moduleSource(sources, root + path);
            if (!source)
                return false;
            return ["dtoa_buffered", "ftoa_buffered"].every((name) => {
                const imported = source.statements
                    .filter((node) => node.kind === NodeKind.Import)
                    .flatMap((node) => {
                    const statement = node;
                    return (statement.declarations ?? [])
                        .filter((item) => item.name.text === name)
                        .map((item) => ({ statement, item }));
                });
                if (imported.length !== 1)
                    return false;
                const target = moduleSource(sources, imported[0].statement.internalPath);
                return stock(target
                    ? exportedFunction(sources, target, imported[0].item.foreignName.text)
                    : null, name);
            });
        });
    if (safe)
        return () => { };
    return () => {
        const source = moduleSource(sources, root + "assembly/serialize/naive/map");
        const entry = source?.statements.find((node) => node.kind === NodeKind.FunctionDeclaration &&
            node.name.text ===
                "canSerializeMapWithoutCallbacks");
        if (!entry?.body)
            return;
        const body = SimpleParser.parseStatement("{ return false; }");
        class Bind extends Visitor {
            _visit(node, parent) {
                node.range = entry.range;
                super._visit(node, parent);
            }
        }
        new Bind().visit(body);
        entry.body = body;
    };
}
