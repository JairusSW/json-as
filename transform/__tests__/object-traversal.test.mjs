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
      "assembly/__tests__/object-scaling.fixture.ts",
      "--transform",
      "./transform",
      "-O3",
      "--use",
      "ASC_RTRACE=1",
      "--exportStart",
      "start",
      "-o",
      output,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        JSON_MODE: "SWAR",
        JSON_AS_LIBRARY_SOURCE: "assembly/index",
      },
      stdio: "pipe",
    },
  );
  let memory,
    count = 0,
    bytes = 0,
    largest = 0;
  const add = (block) => {
    const size = (new DataView(memory.buffer).getUint32(block, true) & ~3) + 4;
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
      onfree() {},
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
  for (const n of [500, 1000, 2000, 4000])
    for (const nested of [false, true]) {
      instance.exports.setup(n, nested);
      count = bytes = 0;
      const length = instance.exports.run();
      assert.ok(
        bytes < length * 4 + 64,
        "ordinary object traversal allocated extra snapshots",
      );
      assert.ok(
        count <= (nested ? 2 : 1),
        "ordinary nested objects allocated callback snapshots",
      );
      const ptr = instance.exports.result();
      const actual = Buffer.from(
        memory.buffer,
        ptr,
        new DataView(memory.buffer).getUint32(ptr - 4, true),
      ).toString("utf16le");
      const expected = {};
      for (let i = 0; i < n; i++)
        expected["k" + i] = nested && i === 0 ? {} : i;
      assert.deepEqual(
        JSON.parse(actual),
        JSON.parse(JSON.stringify(expected)),
      );
    }
  console.log(
    "Object traversal: flat/nested controls avoid property snapshots at 500-4000 keys",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
