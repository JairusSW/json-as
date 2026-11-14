// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { createHash } from "node:crypto";
import {
  BinaryExpression,
  BlockStatement,
  CallExpression,
  Expression,
  ExpressionStatement,
  FunctionDeclaration,
  IfStatement,
  Node,
  Source,
  TernaryExpression,
} from "assemblyscript/dist/assemblyscript.js";
import { diagnosticsRuntimeRoot } from "./diagnostics.js";
import { NodeKind } from "./types.js";
import { cloneNode, toString } from "./util.js";

const STOCK_DTOA =
  "71915407aa68ea907d91a8c0f6167c46990c92a5f5403a99c837767ed48acc81";
const STOCK_XJB =
  "53e55e3d9703a4fb4107bec1ac0b189d4356440213e37029eb1b1d45bc0c68a7";
const DTOA_AST =
  "86344c325fc249dd08029a561a4ca182ab503c8579c37972dd4e4003e62d667d";
const XJB_AST =
  "0e096cc579cb1bb2d85c0d68659e4e375aff4577a1ed307110a182335e3db42a";
const BINDINGS = new Set([
  "umul64hi",
  "umul64hiCarry",
  "setDecimalResult",
  "BIASED_HALF",
  "gSig",
  "gLastDigit",
  "gHasLastDigit",
  "gExp",
  "MAX_VALUE",
  "u64",
  "i64",
  "u32",
  "i32",
  "f32",
  "f64",
  "bool",
]);
const hash = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

function guard(
  condition: Expression,
  digit: Expression,
  publish: ExpressionStatement,
): IfStatement {
  const copy = cloneNode(publish) as ExpressionStatement;
  (copy.expression as CallExpression).args[1] = cloneNode(digit) as Expression;
  return Node.createIfStatement(
    condition,
    Node.createBlockStatement(
      [copy, Node.createReturnStatement(null, publish.range)],
      publish.range,
    ),
    null,
    condition.range,
  );
}

/** Skip a pure rounding product when a later clamp already determines its result. */
export function specializeDecimalClamps(
  sources: Source[],
  aliases: Map<string, string> | null,
): boolean {
  if (diagnosticsRuntimeRoot(sources) === undefined) return false;
  if (
    aliases &&
    [...aliases.keys()].some((name) =>
      BINDINGS.has(name.split(/[.#/\\]/).at(-1)!),
    )
  )
    return false;
  let changed = false;
  for (const source of sources) {
    if (
      !source.text.includes("function setDecimalResult") ||
      hash(source.text) !== STOCK_DTOA
    )
      continue;
    const path = source.internalPath.replaceAll("\\", "/");
    const peerPath = path.slice(0, path.lastIndexOf("/") + 1) + "xjb";
    const peer = sources.find(
      (s) => s.internalPath.replaceAll("\\", "/") === peerPath,
    );
    // The skipped function and its bindings must still have their stock, pure meanings.
    if (
      !peer ||
      hash(peer.text) !== STOCK_XJB ||
      hash(toString(source)) !== DTOA_AST ||
      hash(toString(peer)) !== XJB_AST
    )
      continue;
    const plans = ["toDecimalDoubleNormal", "toDecimalDouble"].map((name) => {
      const fn = source.statements.find(
        (n) =>
          n.kind === NodeKind.FunctionDeclaration &&
          (n as FunctionDeclaration).name.text === name,
      ) as FunctionDeclaration | undefined;
      if (fn?.body?.kind !== NodeKind.Block) return null;
      const body = fn.body as BlockStatement;
      const tail = body.statements.slice(-4);
      if (
        tail.length !== 4 ||
        tail[0].kind !== NodeKind.Variable ||
        tail.slice(1).some((n) => n.kind !== NodeKind.Expression)
      )
        return null;
      const lower = (
        (tail[1] as ExpressionStatement).expression as BinaryExpression
      ).right as TernaryExpression;
      const upper = (
        (tail[2] as ExpressionStatement).expression as BinaryExpression
      ).right as TernaryExpression;
      const publish = tail[3] as ExpressionStatement;
      if (
        lower?.kind !== NodeKind.Ternary ||
        upper?.kind !== NodeKind.Ternary ||
        publish.expression.kind !== NodeKind.Call
      )
        return null;
      return { body, one: tail[0], lower, upper, publish };
    });
    if (plans.some((plan) => plan === null)) continue;
    for (const plan of plans) {
      if (!plan) continue;
      // The original upper clamp overrides the lower clamp, including overlap.
      plan.body.statements.splice(
        -4,
        4,
        guard(plan.upper.condition, plan.upper.ifThen, plan.publish),
        guard(plan.lower.condition, plan.lower.ifThen, plan.publish),
        plan.one,
        plan.publish,
      );
    }
    changed = true;
  }
  return changed;
}
