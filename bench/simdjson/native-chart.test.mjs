// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { nativeSchema, schemaFromSource } from "./generate.mjs";
const root = path.resolve(import.meta.dirname, "../..");
const library = path.join(root, "build/simdjson-parity");
const compiler = process.env.PARITY_CXX ?? "/opt/homebrew/bin/g++-16";

test(
  "native chart owns complete struct values and rejects malformed/trailing input",
  {
    skip:
      !fs.existsSync(compiler) ||
      !fs.existsSync(path.join(library, "simdjson.o")),
  },
  () => {
    const dir = path.join(library, "chart-tests");
    fs.mkdirSync(dir, { recursive: true });
    const schema = schemaFromSource(
      "@json class Child { text:string; } @json class Root { n:u64; child:Child; @optional extra:Child|null; }",
      "chart.ts",
    );
    const source = path.join(dir, "driver.cpp");
    const binary = path.join(dir, "driver");
    const input = path.join(dir, "input.json");
    const output = path.join(dir, "output.json");
    fs.writeFileSync(
      source,
      nativeSchema(schema, "Root", { unknownFields: "ignore" }) +
        `\n#include ${JSON.stringify(path.join(root, "bench/simdjson/chart-struct-driver.h"))}\n`,
    );
    const flags = JSON.parse(
      fs.readFileSync(path.join(library, "native-library.json")),
    ).flags;
    execFileSync(compiler, [
      ...flags,
      source,
      path.join(library, "simdjson.o"),
      "-o",
      binary,
    ]);
    const good = '{"n":9007199254740993,"child":{"text":"a\\n漢字"}}';
    fs.writeFileSync(input, good);
    execFileSync(binary, [input, "1", output, "check"]);
    // Compare the token text as well as the decoded owned child: JS would round it.
    assert.match(fs.readFileSync(output, "utf8"), /9007199254740993/);
    assert.equal(JSON.parse(fs.readFileSync(output)).child.text, "a\n漢字");
    for (const invalid of [
      good + " {}",
      good.slice(0, -1),
      '{"n":"bad","child":{"text":"ok"}}',
    ]) {
      fs.writeFileSync(input, invalid);
      const result = spawnSync(binary, [input, "1", output, "check"], {
        encoding: "utf8",
      });
      assert.notEqual(result.status, 0, invalid);
    }
  },
);
