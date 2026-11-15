// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import asc from "assemblyscript/asc";
import { Transform } from "assemblyscript/transform";
import "../lib/index.js";
import { arrayRowSafety, arrayRowSourceInfo } from "../lib/array-row-safety.js";
import { SimpleParser } from "../lib/util.js";

let checks = 0;
class Inspect extends Transform {
  afterParse(parser) {
    const options = this.program.options;
    const safe = () => arrayRowSafety(parser.sources, options);
    assert.ok(safe());
    checks++;
    const entry = parser.sources.find((source) =>
      source.internalPath.endsWith("array-row.fixture"),
    );
    for (const text of [
      "function __visit(cookie: i32): void {}",
      "function __finalize(pointer: usize): void {}",
      "const __finalize: (pointer: usize) => void = (_pointer: usize): void => {};",
      "class Foreign { private __visit(cookie: i32): void {} }",
      "namespace Foreign { function onalloc(pointer: usize): void {} }",
    ]) {
      entry.statements.push(SimpleParser.parseTopLevelStatement(text));
      assert.equal(safe(), null, text);
      checks++;
      entry.statements.pop();
    }
    const runtime = parser.sources.find(
      (source) => source.internalPath === "~lib/rt/itcms",
    );
    const fn = runtime.statements.find((node) => node.name?.text === "__visit");
    fn.body.statements.unshift(
      SimpleParser.parseStatement("trace('foreign visitor');"),
    );
    assert.equal(safe(), null, "AST-only collector modification");
    checks++;
    fn.body.statements.shift();
    const original = runtime.text;
    runtime.text += "\n// foreign runtime\n";
    assert.equal(safe(), null, "raw collector modification");
    checks++;
    runtime.text = original;
    const aliases = options.globalAliases;
    for (const name of ["ASC_RTRACE", "ASC_GC_PROFILE", "__finalize", "i64"]) {
      options.globalAliases = new Map([...(aliases ?? []), [name, "1"]]);
      assert.equal(safe(), null, name);
      checks++;
    }
    options.globalAliases = aliases;
    const shared = options.sharedMemory;
    options.sharedMemory = true;
    assert.equal(safe(), null, "shared memory");
    checks++;
    options.sharedMemory = shared;
    entry.statements.push(
      SimpleParser.parseTopLevelStatement(
        "function identifiers(): void { const marker = `hello ${__json_as_flat_strings_0_id}`; void __json_as_flat_strings_1_array; }",
      ),
    );
    const info = arrayRowSourceInfo(entry);
    assert.ok(info.names.has("__json_as_flat_strings_0_id"));
    assert.ok(info.names.has("__json_as_flat_strings_1_array"));
    checks += 2;
    entry.statements.pop();
    assert.ok(safe(), "restored sources and options");
    checks++;
    throw Error("ARRAY_ROW_INSPECTED");
  }
}
const result = await asc.main(
  ["assembly/__tests__/array-row.fixture.ts", "--noEmit"],
  { transforms: [Inspect] },
);
assert.match(String(result.error), /ARRAY_ROW_INSPECTED/);
console.log(`Array row safety: ${checks} checks passed`);
