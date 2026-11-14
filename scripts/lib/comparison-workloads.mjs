// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ts from "typescript";

export const OVERVIEW = [
  "abc",
  "uuidv4",
  "vec3",
  "token",
  "small",
  "medium",
  "large",
];
export const CLASSIC = [
  "twitter",
  "canada",
  "citm_catalog",
  "poet",
  "github_events",
  "gsoc-2018",
  "lottie",
  "otfcc",
  "fgo",
];
export const NATIVE_MODELS = {
  abc: { source: "assembly/__benches__/abc.bench.ts", root: "string" },
  uuidv4: { source: "assembly/__benches__/uuidv4.bench.ts", root: "string" },
  vec3: { source: "assembly/__benches__/vec3.bench.ts", root: "Vec3" },
  token: { source: "assembly/__benches__/token.bench.ts", root: "Token" },
  small: { source: "assembly/__benches__/small.bench.ts", root: "SmallJSON" },
  medium: {
    source: "assembly/__benches__/medium.bench.ts",
    root: "MediumAPIResponse",
  },
  large: { source: "assembly/__benches__/large.bench.ts", root: "Repo" },
  multilib: { source: "assembly/__benches__/multilib/shared.ts", root: "Repo" },
};
export const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
export function literalPayload(source, filename = "benchmark.ts") {
  const tree = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  let value;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "v2") {
      if (!node.initializer || !ts.isStringLiteralLike(node.initializer))
        throw new Error(`Expected a literal v2 payload in ${filename}`);
      value = node.initializer.text;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (value === undefined) throw new Error(`Missing v2 payload in ${filename}`);
  JSON.parse(value);
  return value;
}
export function comparisonWorkload(root, suite) {
  let source, text, group;
  if (OVERVIEW.includes(suite)) {
    group = "overview";
    source = `bench/${suite}.bench.ts`;
    text = literalPayload(
      fs.readFileSync(path.join(root, source), "utf8"),
      source,
    );
    const asSource = `assembly/__benches__/${suite}.bench.ts`;
    const asText = literalPayload(
      fs.readFileSync(path.join(root, asSource), "utf8"),
      asSource,
    );
    if (text !== asText) throw new Error(`AS/JS input mismatch for ${suite}`);
  } else if (suite === "multilib") {
    group = "library";
    source = "assembly/__benches__/payloads/multilib.json";
    text = fs.readFileSync(path.join(root, source), "utf8");
  } else {
    const name = suite.replace(/-(min|pretty)$/, "");
    if (
      !CLASSIC.includes(name) ||
      ![`${name}-min`, `${name}-pretty`].includes(suite)
    )
      throw new Error(`Unknown comparison suite ${suite}`);
    group = "classic";
    source = `assembly/__benches__/payloads/${suite.replace(/-(min|pretty)$/, ".$1")}.json`;
    text = fs.readFileSync(path.join(root, source), "utf8");
  }
  return {
    suite,
    group,
    source,
    text,
    bytes: Buffer.byteLength(text),
    inputSha256: digest(text),
    sourceSha256: digest(fs.readFileSync(path.join(root, source))),
  };
}
export function comparisonWorkloads(root) {
  return [...OVERVIEW, "multilib", ...CLASSIC.map((name) => `${name}-min`)].map(
    (suite) => comparisonWorkload(root, suite),
  );
}

/** Identify the input used to construct the classic serialization model.
 * Raw fields preserve this layout, so native and AS must use the same input. */
export function classicSerializationLayout(source, rootType) {
  const tree = ts.createSourceFile(
    "classic.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const declarations = tree.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations]);
  const normalize = (text) => text.replace(/\s/g, "");
  const models = declarations.filter((declaration) => {
    const init = declaration.initializer;
    return (
      init &&
      ts.isCallExpression(init) &&
      normalize(init.expression.getText(tree)) === "JSON.parse" &&
      init.typeArguments?.length === 1 &&
      normalize(init.typeArguments[0].getText(tree)) === normalize(rootType)
    );
  });
  if (models.length !== 1)
    throw Error("Expected one classic serialization model initializer");
  const input = models[0].initializer.arguments[0];
  if (!input || !ts.isIdentifier(input))
    throw Error("Expected a named classic input");
  const declaration = declarations.find(
    (candidate) => candidate.name.getText(tree) === input.text,
  );
  const init = declaration?.initializer;
  if (
    !init ||
    !ts.isCallExpression(init) ||
    init.expression.getText(tree) !== "readFile" ||
    init.arguments.length !== 1 ||
    !ts.isStringLiteralLike(init.arguments[0])
  )
    throw Error("Expected the classic input to come from readFile");
  const layout = /\.(min|pretty)\.json$/.exec(init.arguments[0].text)?.[1];
  if (!layout) throw Error("Unrecognized classic input layout");
  return layout;
}
