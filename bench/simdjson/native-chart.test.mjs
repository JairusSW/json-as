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

test(
  "owning serialization reads changed fields into independent fresh outputs",
  {
    skip:
      !fs.existsSync(compiler) ||
      !fs.existsSync(path.join(library, "simdjson.o")),
  },
  () => {
    const dir = path.join(library, "fresh-serialization-test");
    fs.mkdirSync(dir, { recursive: true });
    const schema = schemaFromSource(
      "@json class Child { text:string; } @json class Root { n:u64; child:Child; }",
      "fresh.ts",
    );
    const source = path.join(dir, "fresh.cpp");
    const binary = path.join(dir, "fresh");
    fs.writeFileSync(
      source,
      nativeSchema(schema, "Root", { unknownFields: "ignore" }) +
        `
#include <iostream>
int main() {
  model::Root value{};
  value.n = 7; value.child.text = "first";
  std::string first;
  if(model::to_owned_json(value, first)) return 1;
  std::cout << first << '\\n';
  value.n = 9007199254740993ULL; value.child.text = "second";
  std::string second;
  if(model::to_owned_json(value, second)) return 2;
  std::cout << second << '\\n';
  std::fill(first.begin(), first.end(), 'x');
  std::string third;
  if(model::to_owned_json(value, third)) return 3;
  if(third != second) return 4;
  value.n = 9; value.child.text = "third";
  std::string fourth;
  if(model::to_owned_json(value, fourth)) return 5;
  std::cout << fourth << '\\n';
}
`,
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
    const output = execFileSync(binary, [], { encoding: "utf8" })
      .trim()
      .split("\n");
    assert.deepEqual(JSON.parse(output[0]), { n: 7, child: { text: "first" } });
    assert.match(output[1], /9007199254740993/);
    assert.equal(JSON.parse(output[1]).child.text, "second");
    assert.deepEqual(JSON.parse(output[2]), { n: 9, child: { text: "third" } });
  },
);
