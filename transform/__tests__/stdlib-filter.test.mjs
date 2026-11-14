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
import { fileURLToPath } from "node:url";

// Initialize through the compiler entry before importing its cyclic helpers.
await import("../lib/index.js");
const { isStdlib } = await import("../lib/util.js");
for (const internalPath of [
  "assembly/models/session",
  "assembly/models/security",
  "assembly/models/memory",
  "assembly/models/util/session",
  "assembly/uri/model",
  "polyfills/session",
  "~lib/my-app/security",
  "~lib/my-app/util/model",
  "~lib/array-extra",
  "~lib/shared/typeinfo-extra",
]) {
  assert.equal(
    isStdlib({ range: { source: { internalPath } } }),
    false,
    internalPath,
  );
}
for (const internalPath of [
  "~lib/array",
  "~lib/arraybuffer",
  "~lib/rt/itcms",
  "~lib/util/string",
  "~lib/uri",
  "~lib/memory",
  "~lib/polyfills",
  "~lib/shared/typeinfo",
]) {
  assert.equal(
    isStdlib({ range: { source: { internalPath } } }),
    true,
    internalPath,
  );
}

const root = fileURLToPath(new URL("../../", import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-stdlib-filter-"));
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
    for (const strict of ["false", "true"]) {
      const output = path.join(dir, `${mode}-${strict}.wasm`);
      execFileSync(
        process.execPath,
        [
          path.join(root, "node_modules/assemblyscript/bin/asc.js"),
          "assembly/__tests__/stdlib-app.fixture.ts",
          "--transform",
          "./transform",
          "-O3",
          ...(mode === "SIMD" ? ["--enable", "simd"] : []),
          "-o",
          output,
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            JSON_MODE: mode,
            JSON_STRICT: strict,
            JSON_USE_FAST_PATH: "1",
            JSON_AS_LIBRARY_SOURCE: "assembly/index",
          },
          stdio: "pipe",
        },
      );
      const guest = new WebAssembly.Instance(
        new WebAssembly.Module(fs.readFileSync(output)),
        {
          env: {
            abort(_message, _file, line, column) {
              throw new Error(`guest abort ${line}:${column}`);
            },
          },
        },
      ).exports;
      assert.equal(guest.verify(), 1, `${mode}/strict=${strict}`);
    }
  }
  console.log(
    "Stdlib filtering: 18 path checks and 24 application-model checks passed",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
