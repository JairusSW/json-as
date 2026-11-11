// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import "../lib/index.js";
import assert from "node:assert/strict";
import { Parser } from "assemblyscript/dist/assemblyscript.js";
import {
  StrategicAccessAnalysis,
  accessProbability,
  materializationDecision,
} from "../lib/strategic-laziness.js";

const path = (...pairs) => new Map(pairs);
assert.equal(accessProbability([]), 0);
assert.equal(accessProbability([path()]), 1);
assert.equal(accessProbability([path([0, true]), path([0, true])]), 0.5);
assert.equal(accessProbability([path([0, true]), path([0, false])]), 1);
assert.equal(accessProbability([path([0, true]), path([1, true])]), 0.75);
assert.equal(
  accessProbability([path([0, true], [1, true], [2, false])]),
  0.125,
);
assert.equal(materializationDecision([path()], 1000).eager, true);
assert.equal(materializationDecision([path([0, true])], 1).eager, true);
assert.equal(materializationDecision([path([0, true])], 20).eager, false);
assert.equal(
  materializationDecision([path([0, true], [1, true], [2, true])], 1).eager,
  false,
);
const repeated = Array.from({ length: 8 }, (_, i) => path([i, true]));
assert.equal(materializationDecision(repeated, 20).eager, true);

function analyze(body) {
  const parser = new Parser();
  parser.parseFile(
    `function probe(a: bool, b: bool, c: bool): void { ${body} }`,
    "fixture.ts",
    true,
  );
  const analysis = new StrategicAccessAnalysis(
    (call, shadowed) =>
      call.expression.property?.text === "parse" && !shadowed("JSON") ? {} : null,
    undefined,
    true,
  );
  analysis.visit(parser.sources[0]);
  return analysis.sites;
}
const probability = (site, field) =>
  accessProbability(site.accesses.get(field) || []) /
  accessProbability(site.origin);
let sites = analyze(
  `const v = JSON.parse<Vec3>("{}"); v.x; if (a) { if (b) { if (c) v.y; } }`,
);
assert.equal(sites.length, 1);
assert.equal(probability(sites[0], "x"), 1);
assert.equal(probability(sites[0], "y"), 0.125);
assert.equal(probability(sites[0], "z"), 0);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); if (a) v.x; else v.x;`);
assert.equal(probability(sites[0], "x"), 1);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); if (a) v.x; if (b) v.x;`);
assert.equal(probability(sites[0], "x"), 0.75);
sites = analyze(
  `if (a) { const v = JSON.parse<Vec3>("{}"); v.x; if (b) v.y; }`,
);
assert.equal(probability(sites[0], "x"), 1);
assert.equal(probability(sites[0], "y"), 0.5);
sites = analyze(
  `const v = JSON.parse<Vec3>("{}"); const alias = v; alias.x; { const alias = unrelated(); alias.y; }`,
);
assert.equal(probability(sites[0], "x"), 1);
assert.equal(probability(sites[0], "y"), 0);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); if (a) return; v.x;`);
assert.equal(probability(sites[0], "x"), 0.5);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); v.x = 3; v.y += 1;`);
assert.equal(probability(sites[0], "x"), 0);
assert.equal(probability(sites[0], "y"), 1);
sites = analyze(
  `const v = JSON.parse<Vec3>("{}"); const callback = (): void => { v.x; };`,
);
assert.equal(probability(sites[0], "x"), 0);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); while (a) { if (b) v.x; }`);
assert.equal(probability(sites[0], "x"), 0.25);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); a && b && v.x;`);
assert.equal(probability(sites[0], "x"), 0.25);
sites = analyze(
  `function read(value: Vec3): void { value.x; if (a) value.y; } const v = JSON.parse<Vec3>("{}"); read(v);`,
);
assert.equal(probability(sites[0], "x"), 1);
assert.equal(probability(sites[0], "y"), 0.5);
sites = analyze(
  `function read(value: Vec3): void { value.x; } const v = JSON.parse<Vec3>("{}"); if (a) read(v);`,
);
assert.equal(probability(sites[0], "x"), 0.5);
assert.equal(
  analyze(`const JSON = local(); const v = JSON.parse<Vec3>("{}"); v.x;`)
    .length,
  0,
);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); if (a) if (b) return; v.x;`);
assert.equal(probability(sites[0], "x"), 0.75);
sites = analyze(
  `const v = JSON.parse<Vec3>("{}"); while (a) { if (b) return; } v.x;`,
);
assert.equal(probability(sites[0], "x"), 0.75);
sites = analyze(
  `const v = JSON.parse<Vec3>("{}"); switch (a) { case true: v.x; break; default: v.x; }`,
);
assert.equal(probability(sites[0], "x"), 1);
sites = analyze(
  `const v = JSON.parse<Vec3>("{}"); do { if (a) break; v.x; } while (b); v.y;`,
);
assert.equal(probability(sites[0], "x"), 0.5);
assert.equal(probability(sites[0], "y"), 1);
sites = analyze(`function helper(outer: Vec3): void {
  const inner = JSON.parse<Vec3>("{}"); if (a) inner.x; outer.y;
} const v = JSON.parse<Vec3>("{}"); helper(v);`);
assert.equal(sites.length, 2);
assert.equal(probability(sites[0], "x"), 0.5);
assert.equal(probability(sites[1], "y"), 1);
sites = analyze(
  `const first = JSON.parse<Vec3>("{}"); const second = JSON.parse<Vec3>("{}"); let selected = first; if (a) selected = second; selected.x;`,
);
assert.equal(probability(sites[0], "x"), 0);
assert.equal(probability(sites[1], "x"), 0);
sites = analyze(
  `const v = JSON.parse<Vec3>("{}"); if (true) v.x; if (false) v.y; false && v.z;`,
);
assert.equal(probability(sites[0], "x"), 1);
assert.equal(probability(sites[0], "y"), 0);
assert.equal(probability(sites[0], "z"), 0);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); while (false) v.x; v.y;`);
assert.equal(probability(sites[0], "x"), 0);
assert.equal(probability(sites[0], "y"), 1);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); while (true) { v.x; } v.y;`);
assert.equal(probability(sites[0], "x"), 1);
assert.equal(probability(sites[0], "y"), 0);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); return v;`);
assert.equal(sites[0].escaped, true);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); throw v;`);
assert.equal(sites[0].escaped, true);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); holder.value = v;`);
assert.equal(sites[0].escaped, true);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); values[0] = v;`);
assert.equal(sites[0].escaped, true);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); external = v;`);
assert.equal(sites[0].escaped, true);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); const list = [v];`);
assert.equal(sites[0].escaped, true);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); const box = { value: v };`);
assert.equal(sites[0].escaped, true);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); const later = (): void => { v.x; };`);
assert.equal(sites[0].escaped, true);
sites = analyze(`const v = JSON.parse<Vec3>("{}"); const address = changetype<usize>(v);`);
assert.equal(sites[0].escaped, true);
sites = analyze(`const first = JSON.parse<Vec3>("{}"); const second = JSON.parse<Vec3>("{}"); let value = first; if (a) value = second; value.x;`);
assert.equal(sites[0].escaped, true);
assert.equal(sites[1].escaped, true);
console.log(
  "Strategic analysis: weighted paths, costs, aliases, shadowing, exits, closures and loops passed",
);
