// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-strategic-"));
let checks = 0;

function compile(mode, runtime, strict, fast, strategy = "") {
  const file = path.join(dir, "probe.wasm");
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/assemblyscript/bin/asc.js",
      "assembly/__tests__/strategic-laziness/runtime.fixture.ts",
      "--transform",
      "./transform",
      "--runtime",
      runtime,
      process.env.PROBE_OPT === "0" ? "-O0" : "-O3",
      "--exportRuntime",
      "-o",
      file,
      ...(mode === "SIMD" ? ["--enable", "simd"] : []),
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        JSON_MODE: mode,
        JSON_STRICT: String(strict),
        JSON_USE_FAST_PATH: fast ? "1" : "0",
        JSON_STRATEGIC_LAZINESS: strategy,
        JSON_AS_LIBRARY_SOURCE: "assembly/index",
      },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.doesNotMatch(result.stdout + result.stderr, /WARNING AS201/);
  let g;
  const decode = (ptr) =>
    Buffer.from(
      g.memory.buffer,
      ptr,
      new DataView(g.memory.buffer).getUint32(ptr - 4, true) & 0x7fffffff,
    ).toString("utf16le");
  g = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(file)), {
    env: {
      abort(message, source, line, column) {
        throw Error(`${decode(message)} (${decode(source)}:${line}:${column})`);
      },
    },
  }).exports;
  const label = `${mode}/${runtime}/strict=${strict}/fast=${fast}/strategy=${strategy}`;
  return {
    check(name, args, wanted) {
      let result;
      try {
        result = g[name](...args);
      } catch (error) {
        throw new Error(`${label}/${name}/${args}: ${error.message}`, { cause: error });
      }
      assert.equal(
        typeof wanted === "string" ? decode(result) : result,
        wanted,
        `${label}/${name}/${args}`,
      );
      checks++;
    },
    checkRejects(name) {
      assert.throws(() => g[name](), /Invalid JSON|Unexpected key|Incomplete or unterminated/, `${label}/${name}`);
      checks++;
    },
  };
}

try {
  for (const mode of process.env.PROBE_QUICK
    ? ["SWAR"]
    : ["NAIVE", "SWAR", "SIMD"])
    for (const runtime of process.env.PROBE_QUICK || process.env.PROBE_REVIEW
      ? ["incremental"]
      : ["incremental", "minimal", "stub"])
      for (const strict of process.env.PROBE_QUICK ? [false] : [false, true])
        for (const fast of process.env.PROBE_QUICK ? [true] : [false, true]) {
          const { check, checkRejects } = compile(mode, runtime, strict, fast);
          check("apiFastCapability", [], fast ? 1 : 0);
          check("apiSummary", [], "7:hello");
          check("reviewSignedByte", [], -1);
          check("reviewSignedShort", [], -2);
          check("reviewSignedNegative", [], 1);
          check("reviewUnsignedShort", [], 65535);
          check("reviewOptionalByte", [], 1);
          check("reviewReusedByte", [], 2);
          check("effectfulDefaultCapability", [], 0);
          check("inheritedEffectfulDefaultCapability", [], 0);
          check("lifecycleDefaultCapability", [], 0);
          check("lifecycleDefaultCount", [], 1);
          check("effectfulDefaultCount", [], 1);
          for (const [name, wanted] of Object.entries({
            xOnly: "1:1.5",
            method: "1:1.5",
            gcDeferred: "1:2.5",
            scalars:
              "10:-128:255:-32768:65535:-2147483648:4294967295:-9223372036854775808:18446744073709551615:-1.25:2.5",
            yOnly: "2:2.5",
            alias: "4:3.5",
            reordered: "1:1.5",
            helper: "4:3.5",
            existing: "0:7",
            generic: "1:7",
            inherited: "1:7.5",
            whitespace: "1:1.5",
            reused: "1:4.5:0.0:6.5",
            custom: "1:7:1",
          }))
            check(name, [], wanted);
          check("conditionalAlias", [0], "1");
          check("conditionalAlias", [1], "1:7");
          check("unused", [], 0);
          check("fullStringFields", [], "a\\b:hello:world");
          check("fullNullableStrings", [], "hi!:1");
          check("fullBooleanFields", [], '1:0:{"first":true,"second":false}');
          check("booleanFieldVariants", [], "1:0:0:1:0:1");
          if (strict) {
            checkRejects("invalidBooleanField");
            checkRejects("invalidBooleanFieldReuse");
          }
          check("implicitArrayConstruction", [], '0:0:0:0:7:1:{"value":[1]}');
          check("lazyReferenceStates", [], "1:hello:hello:1:set");
          check("nestedFullRead", [], "7:7.5");
          if (strict) checkRejects("nestedReaderFallback");
          else check("nestedReaderFallback", [], "7.5");
          check("nestedReaderReordered", [], "7.5");
          check("aliasedNestedFullRead", [], "7:7.5");
          check("nestedFullReadAfterGC", [], "7:7.5");
          check("missingNestedDefaults", [], "3:7:tail");
          check("missingArrayDefaults", [], "3:7:tail");
          check("nestedArrayWhitespaceAndReordering", [], "4:7:3:5:8:tail");
          check("nestedEmptyArray", [], 0);
          check("nestedPartialRead", [], "1:1.5");
          check("explicitLazyNested", [], "0:7");
          check("nestedArrayFullRead", [], "0:7.5");
          check("nestedArrayPartialRead", [], "0:1.5");
          check("nestedArrayLoopRead", [], "0:24.0");
          check("nestedArrayGrowthAfterGC", [], "0:360.0");
          check("arrayFormsDecodeEagerly", [], "3:7:8:9:3");
          check("eagerArraysRespectReuseOwnership", [], '{"a":[1],"b":[2]}|{"a":[3],"b":[4]}');
          check("genericArrayFieldDecodesEagerly", [], "1:7:1");
          check("inheritedGenericArrayDecodesEagerly", [], "1:7:9:1");
          check("genericTypedArrayFieldDecodesEagerly", [], '{"value":[1,2]}');
          check("genericNullableArrayFieldDecodesEagerly", [], "1:7:1:1");
          check("subclassArrayFieldDecodesEagerly", [], "1:7:1");
          if (strict) checkRejects("subclassArrayFallbackDoesNotReplay");
          else check("subclassArrayFallbackDoesNotReplay", [], "1:7:9");
          check("genericSubclassArrayFieldDecodesEagerly", [], "1:7:1");
          check("customArrayFieldDecodesEagerly", [], "1:7:1");
          check("userNamedArrayRemainsLazy", [], '{"item":{ "n" : 7 }}');
          check("dynamicArrayStillDefersElements", [], "1:7.0:0");
          check("genericDynamicArrayFieldDecodesEagerly", [], "1:1");
          check("dynamicArrayFieldDecodesEagerly", [], '{"value":[{ "n":7 }]}:1');
          check("nullableNestedArrayRead", [], "1:0:7.5");
          if (strict) {
            checkRejects("nestedCodecFallback");
            checkRejects("nestedCodecArrayFallback");
          } else {
            check("nestedCodecFallback", [], "7:1");
            check("nestedCodecArrayFallback", [], "7:1");
          }
          check("overwrittenNestedChild", [], "0:0");
          check("unknownNestedWrite", [], "0:0");
          if (strict) checkRejects("pureNestedFallback");
          else check("pureNestedFallback", [], "7:7.5:2");
          check("nested", [0, 0, 0], "1:1.5");
          check("nested", [1, 1, 1], "1:4.0");
          check("halves", [0], "1:1.5");
          check("halves", [1], "1:1.5");
          const text = "3:a" + String.fromCharCode(8);
          check("texts", [0, 0, 0], text);
          check("texts", [1, 1, 1], text + "hellohellohelloworld");
        }
  for (const strategy of ["false", "true"])
    for (const strict of [false, true]) {
      const { check } = compile("SWAR", "incremental", strict, true, strategy);
      check("reviewSignedByte", [], -1);
      check("reviewSignedShort", [], -2);
      check("reviewSignedNegative", [], 1);
      check("reviewUnsignedShort", [], 65535);
      check("reviewOptionalByte", [], 1);
      check("reviewReusedByte", [], 2);
      check("existing", [], strategy === "true" ? "1:7" : "0:7");
      check("explicitLazyNested", [], strategy === "true" ? "1:7" : "0:7");
      check("xOnly", [], strategy === "true" ? "1:1.5" : "0:1.5");
      check("custom", [], strategy === "true" ? "1:7:1" : "0:7:1");
      check("lazyReferenceStates", [], "1:hello:hello:1:set");
      check("genericDynamicArrayFieldDecodesEagerly", [], "1:1");
      check("dynamicArrayStillDefersElements", [], "1:7.0:0");
    }
  console.log(
    `Strategic laziness: ${checks} eager/deferred state, parse-site, cost, fallback, reuse, GC and opt-in checks passed`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
