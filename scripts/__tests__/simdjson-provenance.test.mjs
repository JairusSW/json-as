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
import vm from "node:vm";
import { URL } from "node:url";
import crypto from "node:crypto";

// Exercise the real build preflight without requiring the native toolchain.
const source = fs.readFileSync(
  new URL("../../bench/simdjson/run.mjs", import.meta.url),
  "utf8",
);
const build = source.slice(
  source.indexOf("function build() {"),
  source.indexOf("function decodeAS("),
);
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");

function preflight(revision) {
  const metadata = {
    revision,
    assemblyscript: {},
    sourcePatchSha256: sha(""),
    xjb: { sha256: {} },
  };
  return () =>
    vm.runInNewContext(build + "\nbuild();", {
      path,
      JSON,
      sha,
      root: "/repo",
      dir: "/run",
      baseDir: "/parity",
      key: "case",
      args: [],
      process: { env: {} },
      console: { log() {} },
      verifyUpstream() {},
      verifyAssemblyscript() {},
      read() {
        return JSON.stringify(metadata);
      },
      option(_name, fallback) {
        return fallback;
      },
      invoke(bin, argv) {
        if (bin === "git" && argv[0] === "rev-parse") return "current-commit\n";
        if (bin === "git" && argv[0] === "diff") return "";
        throw new Error("native compiler reached");
      },
    });
}

test("prepared labels reject a different clean source revision before compilation", () => {
  assert.throws(preflight("old-commit"), /Source revision changed/);
  assert.throws(preflight(undefined), /Source revision changed/);
});
test("matching revision and patch pass source guards", () => {
  assert.throws(preflight("current-commit"), /native compiler reached/);
});
