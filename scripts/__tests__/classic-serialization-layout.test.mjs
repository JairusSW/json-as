// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { classicSerializationLayout } from "../lib/comparison-workloads.mjs";
const root = path.resolve(import.meta.dirname, "../..");
test("classic writers use the source layout of their actual model initializer", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "bench/simdjson/workloads.json")),
  );
  for (const corpus of manifest.corpora) {
    const source = fs.readFileSync(path.join(root, corpus.source), "utf8");
    assert.equal(
      classicSerializationLayout(source, corpus.root),
      ["otfcc", "fgo"].includes(corpus.name) ? "min" : "pretty",
      corpus.name,
    );
  }
});
test("layout discovery follows the root type and rejects ambiguous or unknown input", () => {
  const source = `const text = readFile("payload.pretty.json");
    const other = JSON.parse<Other>(text);
    const model = JSON.parse<Map<string, Model>>(text);`;
  assert.equal(
    classicSerializationLayout(source, "Map<string,Model>"),
    "pretty",
  );
  assert.throws(
    () =>
      classicSerializationLayout(
        source + "\nconst duplicate=JSON.parse<Map<string,Model>>(text);",
        "Map<string,Model>",
      ),
    /one classic/,
  );
  assert.throws(
    () =>
      classicSerializationLayout(
        source.replace("readFile", "unknown"),
        "Map<string,Model>",
      ),
    /readFile/,
  );
  assert.throws(
    () => classicSerializationLayout(source, "Missing"),
    /one classic/,
  );
});
