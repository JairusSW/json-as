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
import { fileURLToPath, URL } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-alloc-"));
try {
  const output = path.join(dir, "allocation.wasm");
  execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules/assemblyscript/bin/asc.js"),
      "assembly/__tests__/container-allocation.fixture.ts",
      "--transform",
      "./transform",
      "-O3",
      "--use",
      "ASC_RTRACE=1",
      "--enable",
      "simd",
      "--exportRuntime",
      "--exportStart",
      "start",
      "-o",
      output,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        JSON_MODE: "SIMD",
        JSON_AS_LIBRARY_SOURCE: "assembly/index",
      },
      stdio: "pipe",
    },
  );
  let memory,
    count = 0,
    bytes = 0,
    largest = 0;
  const live = new Map();
  const add = (block) => {
    const size = (new DataView(memory.buffer).getUint32(block, true) & ~3) + 4;
    live.set(block, size);
    count++;
    bytes += size;
    largest = Math.max(largest, size);
  };
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(output), {
    env: {
      abort(_m, _f, line, column) {
        throw new Error(`abort ${line}:${column}`);
      },
    },
    rtrace: {
      oninit() {},
      onalloc: add,
      onresize(block, old) {
        const size =
          (new DataView(memory.buffer).getUint32(block, true) & ~3) + 4;
        bytes += Math.max(0, size - old);
        largest = Math.max(largest, size);
      },
      onload: (p) => p,
      onstore: (p) => p,
      onmove() {},
      onfree(block) {
        live.delete(block);
      },
      onvisit() {
        return 1;
      },
      oncollect() {},
      oninterrupt() {},
      onyield() {},
    },
  });
  memory = instance.exports.memory;
  instance.exports.start();
  instance.exports.setup();
  const metrics = {};
  const measure = (name, call) => {
    count = bytes = 0;
    const result = call();
    metrics[name] = { result, count, bytes };
  };
  measure("strings", () => instance.exports.serializeStrings());
  measure("setStringify", () => instance.exports.serializeSet());
  measure("setFresh", () => instance.exports.parseSet(false));
  measure("setReuse", () => instance.exports.parseSet(true));
  measure("valueObject", () => instance.exports.parseObject(false));
  metrics.valueObject.metadata = instance.exports.metadataBytes();
  measure("denseObject", () => instance.exports.parseObject(true));
  metrics.arraySource = instance.exports.retainedArray();
  metrics.objectSource = instance.exports.retainedObject();
  assert.equal(
    metrics.strings.count,
    1,
    "materialized strings allocated wrappers",
  );
  assert.equal(
    metrics.setStringify.bytes,
    0,
    "primitive Set allocated a snapshot",
  );
  assert.ok(
    metrics.setFresh.bytes < 26400,
    "fresh Set redundantly cleared its buffers",
  );
  assert.ok(metrics.setReuse.bytes < 2048, "reused Set discarded capacity");
  assert.ok(
    metrics.valueObject.metadata < 1024,
    "large value over-reserved object metadata",
  );
  assert.ok(
    metrics.denseObject.bytes <= 38432,
    "key-dense reservation regressed allocation volume",
  );
  assert.equal(metrics.arraySource, 0);
  assert.equal(metrics.objectSource, 0);
  const input = (text) => {
    const data = Buffer.from(text, "utf16le");
    const ptr = instance.exports.__pin(
      instance.exports.allocInput(data.length),
    );
    new Uint8Array(memory.buffer, ptr, data.length).set(data);
    return ptr;
  };
  const alive = (ptr) =>
    [...live].some(([block, size]) => block <= ptr && ptr < block + size);
  for (const action of ["freshParse", "shrink"]) {
    const ptr = input(JSON.stringify({ value: "x".repeat(1000) }));
    instance.exports.trace(ptr);
    instance.exports.__unpin(ptr);
    instance.exports.dropTraceOutput();
    instance.exports.__collect();
    assert.ok(alive(ptr), "small reuse trace was not established");
    instance.exports[action]();
    instance.exports.__collect();
    assert.ok(!alive(ptr), action + " retained the old source cache");
  }
  for (const length of [100_000, 200_000]) {
    const big = input(JSON.stringify({ value: "x".repeat(length) }));
    instance.exports.trace(big);
    instance.exports.__unpin(big);
    instance.exports.dropTraceOutput();
    instance.exports.__collect();
    assert.ok(!alive(big), "oversized trace retained a large input");
  }
  console.log(JSON.stringify(metrics));
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
