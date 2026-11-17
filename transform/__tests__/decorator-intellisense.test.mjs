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
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-intellisense-"));
try {
  const fixture = path.join(dir, "decorators.ts");
  fs.writeFileSync(
    fixture,
    `
    @json class Bare {}
    @json() class Empty {}
    @json({ lazy }) class Strategic {}
    @json({ nolazy }) class Eager {}
    @json({ lazy: true }) class Enabled {}
    @json({ lazy: false }) class Disabled {}
    @json({ lazy: "strategic" }) class Deferred {}
    @json({ lazy: "none" }) class None {}
    @json({ lazy: "auto" }) class Auto {}
    @json({ lazy: "all" }) class All {}
    @serializable class AliasBare {}
    @serializable() class AliasEmpty {}
    @serializable({ lazy }) class AliasStrategic {}
    @serializable({ nolazy }) class AliasEager {}
    class Fields { @lazy value: string = ""; }
    // @ts-expect-error Unsupported lazy mode.
    @json({ lazy: "invalid" }) class InvalidMode {}
    // @ts-expect-error nolazy requires a boolean.
    @json({ nolazy: "true" }) class InvalidNoLazy {}
    // @ts-expect-error Unknown option.
    @serializable({ unknown: true }) class InvalidOption {}
  `,
  );
  for (const decorators of ["legacy", "standard"]) {
    const result = spawnSync(
      process.execPath,
      [
        "node_modules/typescript/bin/tsc",
        "--noEmit",
        "--skipLibCheck",
        "--strict",
        ...(decorators === "legacy" ? ["--experimentalDecorators"] : []),
        "--target",
        "esnext",
        "assembly/index.d.ts",
        fixture,
      ],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(
      result.status,
      0,
      `${decorators}: ${result.stdout}${result.stderr}`,
    );
  }
  console.log(
    "Decorator IntelliSense: shorthand, options, and field decorator passed",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
