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
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-encoding-"));
const baseline = process.env.JSON_ENCODING_BASELINE === "1";
const modes = ["NAIVE", "SWAR", "SIMD"];
let checks = 0;
const encode = (s, be) =>
  Array.from({ length: s.length }, (_, i) =>
    be ? "\0" + s[i] : s[i] + "\0",
  ).join("");
const reference = (s) => {
  if (s.length < 4) return s;
  const byte = s.charCodeAt(0) === 0 ? 0 : s.charCodeAt(1) === 0 ? 1 : -1;
  if (byte < 0) return s;
  for (let i = byte; i < s.length; i += 2) if (s.charCodeAt(i) !== 0) return s;
  let out = "";
  for (let i = byte ^ 1; i < s.length; i += 2) out += s[i];
  return out;
};
try {
  for (const mode of modes)
    for (const fast of [false, true]) {
      const output = path.join(dir, "fixture.wasm");
      execFileSync(
        process.execPath,
        [
          "node_modules/assemblyscript/bin/asc.js",
          "assembly/__tests__/encoding-normalization.fixture.ts",
          "--transform",
          "./transform",
          "-O3",
          "--runtime",
          "incremental",
          "--use",
          "ASC_RTRACE=1",
          "--exportStart",
          "start",
          "--exportRuntime",
          "-o",
          output,
          ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            JSON_MODE: mode,
            JSON_STRICT: "true",
            JSON_USE_FAST_PATH: fast ? "1" : "0",
            JSON_AS_LIBRARY_SOURCE: "assembly/index",
          },
          stdio: "pipe",
        },
      );
      let memory,
        count = 0,
        bytes = 0;
      const size = (p) =>
        (new DataView(memory.buffer).getUint32(p, true) & ~3) + 4;
      const { instance } = await WebAssembly.instantiate(
        fs.readFileSync(output),
        {
          env: {
            abort(_m, _f, l, c) {
              throw Error(`abort ${l}:${c}`);
            },
          },
          rtrace: {
            oninit() {},
            onalloc(p) {
              count++;
              bytes += size(p);
            },
            onresize(p, old) {
              bytes += Math.max(0, size(p) - old);
            },
            onload: (p) => p,
            onstore: (p) => p,
            onmove() {},
            onfree() {},
            onvisit() {
              return 1;
            },
            oncollect() {},
            oninterrupt() {},
            onyield() {},
          },
        },
      );
      const g = instance.exports;
      memory = g.memory;
      g.start();
      const put = (s) => {
        const p = g.__pin(g.__new(s.length * 2, g.stringId()));
        const units = new Uint16Array(memory.buffer, p, s.length);
        for (let i = 0; i < s.length; i++) units[i] = s.charCodeAt(i);
        return p;
      };
      const get = (p) =>
        Buffer.from(
          memory.buffer,
          p,
          new DataView(memory.buffer).getUint32(p - 4, true),
        ).toString("utf16le");
      const check = (s) => {
        const p = put(s),
          expected = reference(s);
        count = bytes = 0;
        const result = g.normalize(p);
        assert.equal(get(result), expected);
        if (expected === s) assert.equal(result, p, "unchanged input identity");
        g.__unpin(p);
        checks++;
      };
      // Short, odd-length, malformed alternating-NUL and non-ASCII code units.
      for (const s of [
        "",
        "a",
        "\0",
        "\0a",
        "a\0",
        "\0a\0",
        "a\0b",
        "[1]",
        "\0\0\0\0",
        "a\0b\0c",
        "\0a\0b\0",
        "\0aXb",
        "a\0bX",
        "\0\ud800\0\udc00",
        "\uffff\0\ud800\0",
      ])
        check(s);
      const alphabet = ["\0", "a", "\uffff"];
      for (let n = 0; n < 729; n++) {
        let value = n,
          s = "";
        for (let i = 0; i < 6; i++) {
          s += alphabet[value % 3];
          value = Math.floor(value / 3);
        }
        check(s);
      }
      for (const be of [false, true])
        for (const length of [1024, 2048, 4096, 8192, 16384, 32768]) {
          const json = '"' + "x".repeat(length - 2) + '"';
          const input = put(encode(json, be));
          count = bytes = 0;
          assert.equal(g.validate(input), 1);
          const metrics = { mode, fast, be, outputUnits: length, count, bytes };
          if (!baseline) {
            assert.equal(count, 1, "one output allocation");
            assert.ok(
              bytes >= length * 2 && bytes <= length * 2 + 64,
              "linear allocation bytes",
            );
          }
          console.log(JSON.stringify(metrics));
          assert.equal(get(g.parse(input)), json.slice(1, -1));
          g.__unpin(input);
          checks += 2;
        }
      for (const be of [false, true]) {
        const p = put(encode("[1,]", be));
        assert.equal(g.validate(p), 0);
        g.__unpin(p);
        checks++;
      }
      console.log(`${mode}/fast=${fast} passed`);
    }
  console.log(`${checks} checks passed`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
