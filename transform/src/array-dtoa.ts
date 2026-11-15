// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { createHash } from "node:crypto";
import {
  CallExpression,
  CommonFlags,
  ExportStatement,
  FunctionDeclaration,
  ImportStatement,
  IdentifierExpression,
  Node,
  Source,
} from "assemblyscript/dist/assemblyscript.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
import { arrayRowSourceInfo } from "./array-row-safety.js";
import { ARRAY_ROW_SOURCES } from "./array-row-runtime.js";
import { NodeKind } from "./types.js";
import { cloneNode, SimpleParser, toString } from "./util.js";
import { Visitor } from "./visitor.js";

const DTOA_TEXT =
  "71915407aa68ea907d91a8c0f6167c46990c92a5f5403a99c837767ed48acc81";
const PEER_TEXT =
  "53e55e3d9703a4fb4107bec1ac0b189d4356440213e37029eb1b1d45bc0c68a7";
const DTOA_AST = new Set([
  "86344c325fc249dd08029a561a4ca182ab503c8579c37972dd4e4003e62d667d",
  "89edc1dee2b2ae79f7a0cf6de9fd01d00d206a45fd0ca5ff6ae25c1a3aa31d24",
]);
const PEER_AST =
  "0e096cc579cb1bb2d85c0d68659e4e375aff4577a1ed307110a182335e3db42a";
const ARRAY_AST =
  "e021aa2f40cefd871f44415487538dab5891475b35d7d266cc8e0c37a4201650";
const FUNCTIONS = [
  "setDecimalResult",
  "toDecimalDoubleNormal",
  "toDecimalDouble",
  "normalizeDoubleShortest",
  "formatDecodedDouble",
  "formatDouble",
  "dtoa_buffered",
];
const hash = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

interface Binding {
  source: Source;
  node: FunctionDeclaration;
}
function moduleSource(sources: Source[], path: string): Source | undefined {
  return sources.find(
    (source) =>
      source.internalPath === path || source.internalPath === path + "/index",
  );
}

// Follow actual named/star reexports. A stock dtoa file elsewhere in the program
// must not authorize replacing a wrapper that the array writer really imports.
function exportedFunction(
  sources: Source[],
  source: Source,
  name: string,
  seen = new Set<string>(),
): Binding | null {
  const key = source.internalPath + ":" + name;
  if (seen.has(key) || seen.size >= 32) return null;
  const trail = new Set(seen).add(key);
  const local = (localName: string): Binding | null => {
    const fn = source.statements.find(
      (node) =>
        node.kind === NodeKind.FunctionDeclaration &&
        (node as FunctionDeclaration).name.text === localName,
    ) as FunctionDeclaration | undefined;
    if (fn) return { source, node: fn };
    for (const node of source.statements) {
      if (node.kind !== NodeKind.Import) continue;
      const statement = node as ImportStatement;
      const imported = statement.declarations?.find(
        (item) => item.name.text === localName,
      );
      if (!imported) continue;
      const target = moduleSource(sources, statement.internalPath);
      if (target)
        return exportedFunction(
          sources,
          target,
          imported.foreignName.text,
          trail,
        );
    }
    return null;
  };
  const direct = source.statements.find(
    (node) =>
      node.kind === NodeKind.FunctionDeclaration &&
      (node as FunctionDeclaration).name.text === name &&
      !!((node as FunctionDeclaration).flags & CommonFlags.Export),
  ) as FunctionDeclaration | undefined;
  if (direct) return { source, node: direct };
  const exports = source.statements.filter(
    (node) => node.kind === NodeKind.Export,
  ) as ExportStatement[];
  const explicit = exports.filter((statement) =>
    statement.members?.some((member) => member.exportedName.text === name),
  );
  const bindings: Binding[] = [];
  for (const statement of explicit.length
    ? explicit
    : exports.filter((statement) => !statement.members)) {
    const member = statement.members?.find(
      (item) => item.exportedName.text === name,
    );
    const localName = member ? member.localName.text : name;
    let binding: Binding | null;
    if (statement.path) {
      const target = moduleSource(sources, statement.internalPath);
      binding = target
        ? exportedFunction(sources, target, localName, trail)
        : null;
    } else binding = local(localName);
    if (binding) bindings.push(binding);
  }
  if (
    !bindings.length ||
    bindings.some((binding) => binding.node !== bindings[0].node)
  )
    return null;
  return bindings[0];
}

/** Specialize the buffered f64 array route without changing scalar formatting. */
export function specializeArrayDtoa(
  sources: Source[],
  aliases: Map<string, string> | null,
): { entry: string; rounding: string } | null {
  if (aliases && [...aliases.keys()].some((name) => !/^JSON_/.test(name)))
    return null;
  const root = diagnosticsRuntimeRoot(sources);
  if (root === undefined) return null;
  const array = sources.find(
    (source) => source.internalPath === root + "assembly/serialize/naive/array",
  );
  if (
    !array ||
    hash(array.text) !==
      ARRAY_ROW_SOURCES.get("own:assembly/serialize/naive/array")![0]
  )
    return null;
  const writer = array.statements.find(
    (node) =>
      node.kind === NodeKind.FunctionDeclaration &&
      (node as FunctionDeclaration).name.text === "serializeF64ArrayFast",
  ) as FunctionDeclaration | undefined;
  if (!writer || hash(toString(writer)) !== ARRAY_AST) return null;
  const imported = array.statements
    .filter((node) => node.kind === NodeKind.Import)
    .flatMap((node) => {
      const statement = node as ImportStatement;
      return (statement.declarations || [])
        .filter((item) => item.name.text === "dtoa_buffered")
        .map((item) => ({ statement, item }));
    });
  if (imported.length !== 1) return null;
  const target = moduleSource(sources, imported[0].statement.internalPath);
  const binding = target
    ? exportedFunction(sources, target, imported[0].item.foreignName.text)
    : null;
  if (!binding || binding.node.name.text !== "dtoa_buffered") return null;
  const source = binding.source;
  const peer = sources.find(
    (input) =>
      input.internalPath === source.internalPath.replace(/\/dtoa$/, "/xjb"),
  );
  if (
    hash(source.text) !== DTOA_TEXT ||
    !DTOA_AST.has(hash(toString(source))) ||
    !peer ||
    hash(peer.text) !== PEER_TEXT ||
    hash(toString(peer)) !== PEER_AST
  )
    return null;

  const names = new Set<string>();
  for (const input of sources)
    for (const name of arrayRowSourceInfo(input).names) names.add(name);
  let prefix = "__json_array_",
    ordinal = 0;
  while ([...FUNCTIONS, "round10"].some((name) => names.has(prefix + name)))
    prefix = "__json_array_" + ++ordinal + "_";
  const renamed = new Map(FUNCTIONS.map((name) => [name, prefix + name]));
  const rounding = prefix + "round10";
  let products = 0;
  class Rewrite extends Visitor {
    visitCallExpression(node: CallExpression, parent: Node | null): void {
      if (node.expression.kind === NodeKind.Identifier) {
        const identifier = node.expression as IdentifierExpression;
        if (renamed.has(identifier.text))
          identifier.text = renamed.get(identifier.text)!;
        else if (
          identifier.text === "umul64hiCarry" &&
          node.args.length === 3 &&
          toString(node.args[0]) === "dotOne" &&
          toString(node.args[1]) === "10"
        ) {
          identifier.text = rounding;
          node.args.splice(1, 1);
          products++;
        }
      }
      super.visitCallExpression(node, parent);
    }
  }
  const originals = FUNCTIONS.map(
    (name) =>
      source.statements.find(
        (node) =>
          node.kind === NodeKind.FunctionDeclaration &&
          (node as FunctionDeclaration).name.text === name,
      ) as FunctionDeclaration | undefined,
  );
  if (originals.some((node) => !node)) return null;
  const clones = originals.map((original, index) => {
    const copy = cloneNode(original!) as FunctionDeclaration;
    copy.name.text = renamed.get(FUNCTIONS[index])!;
    new Rewrite().visit(copy.body!);
    return copy;
  });
  if (products !== 2) return null;
  const declaration =
    SimpleParser.parseTopLevelStatement(`@global @inline function ${rounding}(a:u64, carry:u64):u64 {
    const low = (a & 0xffffffff) * 10 + (carry & 0xffffffff);
    return ((a >> 32) * 10 + (carry >> 32) + (low >> 32)) >> 32;
  }`) as FunctionDeclaration;
  const entry = clones.at(-1)!;
  entry.decorators = [
    ...(entry.decorators || []),
    cloneNode(
      declaration.decorators!.find((node) =>
        toString(node).includes("global"),
      )!,
    ) as (typeof declaration.decorators)[0],
  ];
  class Bind extends Visitor {
    _visit(node: Node, parent: Node | null): void {
      node.range = source.range;
      super._visit(node, parent);
    }
  }
  new Bind().visit([...clones, declaration]);
  source.statements.push(...clones, declaration);
  class Route extends Visitor {
    visitCallExpression(node: CallExpression, parent: Node | null): void {
      if (
        node.expression.kind === NodeKind.Identifier &&
        (node.expression as IdentifierExpression).text === "dtoa_buffered"
      )
        (node.expression as IdentifierExpression).text = entry.name.text;
      super.visitCallExpression(node, parent);
    }
  }
  new Route().visit(writer.body!);
  return { entry: entry.name.text, rounding };
}
