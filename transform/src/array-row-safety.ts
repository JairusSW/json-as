// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { createHash } from "node:crypto";
import {
  Node,
  Options,
  Runtime,
  Source,
} from "assemblyscript/dist/assemblyscript.js";
import { NodeKind } from "./types.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
import { hasStockMarkingRuntime } from "./gc-marking.js";
import { ARRAY_ROW_SOURCES } from "./array-row-runtime.js";

const HOOKS = new Set([
  "__visit",
  "__finalize",
  "__new",
  "__renew",
  "__link",
  "__collect",
  "__alloc",
  "__realloc",
  "__free",
  "onvisit",
  "onalloc",
  "onresize",
  "onfree",
]);
const digest = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

// Range objects refer back to their whole source. All semantic AST properties,
// including expressions skipped by the general visitor, remain in this shape.
export function arrayRowAstFingerprint(node: unknown, root = ""): string {
  const active = new Set<object>();
  const shape = (value: unknown): unknown => {
    if (typeof value === "bigint") return { bigint: String(value) };
    if (value === null || typeof value !== "object") return value;
    if (active.has(value)) throw Error("Cyclic semantic AST property");
    active.add(value);
    let result: unknown;
    if (Array.isArray(value)) result = value.map(shape);
    else {
      const object = value as Record<string, unknown>;
      result = Object.fromEntries(
        Object.keys(object)
          .sort()
          .filter(
            (key) =>
              key !== "range" &&
              key !== "parent" &&
              typeof object[key] !== "function",
          )
          .map((key) => {
            const child = object[key];
            if (
              key === "internalPath" &&
              typeof child === "string" &&
              child.startsWith(root) &&
              /^(?:assembly|lib|index)(?:\/|$)/.test(child.slice(root.length))
            )
              return [key, "@json-as/" + child.slice(root.length)];
            return [key, shape(child)];
          }),
      );
    }
    active.delete(value);
    return result;
  };
  return digest(JSON.stringify(shape(node)));
}

export function arrayRowSourceInfo(source: Source): {
  names: Set<string>;
  hooks: Set<string>;
} {
  const names = new Set<string>();
  const hooks = new Set<string>();
  const visited = new Set<object>();
  const walk = (value: unknown, scope: string[]): void => {
    if (Array.isArray(value)) {
      for (const child of value) walk(child, scope);
      return;
    }
    if (!value || typeof value !== "object" || visited.has(value)) return;
    const node = value as Node & { name?: { text: string }; text?: string };
    if (typeof node.kind !== "number" || !("range" in node)) return;
    visited.add(value);
    if (node.kind === NodeKind.Identifier && typeof node.text === "string")
      names.add(node.text);
    const name = node.name?.text;
    let next = scope;
    if (
      node.kind === NodeKind.ClassDeclaration ||
      node.kind === NodeKind.NamespaceDeclaration
    )
      next = [...scope, name ?? ""];
    if (
      node.kind === NodeKind.FunctionDeclaration ||
      node.kind === NodeKind.MethodDeclaration ||
      node.kind === NodeKind.VariableDeclaration ||
      node.kind === NodeKind.FieldDeclaration
    ) {
      const kind =
        node.kind === NodeKind.MethodDeclaration
          ? "method"
          : node.kind === NodeKind.FunctionDeclaration
            ? "function"
            : node.kind === NodeKind.FieldDeclaration
              ? "field"
              : "variable";
      if (name && HOOKS.has(name)) {
        const key = scope.join(".") + "#" + kind + ":" + name;
        hooks.add(key);
      }
      next = [...scope, kind + ":" + name];
    }
    for (const [key, child] of Object.entries(node))
      if (key !== "range" && key !== "parent") walk(child, next);
  };
  walk(source, []);
  return { names, hooks };
}

/** Prove allocation cannot run application code while a row is borrowed. */
export function arrayRowSafety(
  sources: Source[],
  options: Options,
): Set<string> | null {
  if (
    options.runtime !== Runtime.Incremental ||
    options.isWasm64 ||
    options.sharedMemory ||
    [...(options.globalAliases?.keys() ?? [])].some(
      (name) => !/^JSON_/.test(name),
    ) ||
    !hasStockMarkingRuntime(sources, options.globalAliases)
  )
    return null;
  const root = diagnosticsRuntimeRoot(sources);
  if (root === undefined) return null;
  const keyFor = (source: Source): string =>
    source.internalPath.startsWith(root) &&
    ARRAY_ROW_SOURCES.has("own:" + source.internalPath.slice(root.length))
      ? "own:" + source.internalPath.slice(root.length)
      : source.internalPath;
  const trusted = new Set<Source>();
  for (const [key, [hash, ast]] of ARRAY_ROW_SOURCES) {
    const source = sources.find((input) => keyFor(input) === key);
    if (!source) {
      if (key.startsWith("own:")) return null;
      else continue;
    }
    if (digest(source.text) !== hash) return null;
    try {
      if (arrayRowAstFingerprint(source.statements, root) !== ast) return null;
    } catch {
      return null;
    }
    trusted.add(source);
  }
  const names = new Set<string>();
  for (const source of sources) {
    const info = arrayRowSourceInfo(source);
    for (const name of info.names) names.add(name);
    if (info.hooks.size && !trusted.has(source)) return null;
  }
  return names;
}
