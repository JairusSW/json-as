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
import test from "node:test";
import { execFileSync } from "node:child_process";
import { beginBenchRun } from "../lib/bench-provenance.mjs";
for (const runtime of ["wavm", "wazero", "wago"]) {
  test("provenance probes the selected " + runtime + " executable", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-runtime-id-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(root, "package.json"), '{"version":"1.0.0"}');
    const selected = path.join(root, "selected-cli");
    const args = runtime === "wago" ? "--version" : "version";
    fs.writeFileSync(
      selected,
      '#!/bin/sh\n[ "$1" = "' +
        args +
        '" ] || exit 1\necho selected-' +
        runtime +
        "\n",
      { mode: 0o755 },
    );
    const file = beginBenchRun(root, { runtime, runtimeExecutable: selected });
    const state = JSON.parse(fs.readFileSync(file));
    assert.equal(state.tools.runtime, "selected-" + runtime);
    assert.equal(state.settings.runtimeExecutable, selected);
  });
}

test("WASI runner records the custom executable it actually invokes", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-wasi-id-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = path.resolve(import.meta.dirname, "../..");
  for (const name of [
    "scripts/run-bench.as.sh",
    "scripts/lib/bench-provenance.mjs",
    "scripts/lib/runtime-version.mjs",
  ]) {
    if (!fs.existsSync(path.join(repo, name))) continue;
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.copyFileSync(path.join(repo, name), path.join(root, name));
  }
  fs.writeFileSync(path.join(root, "package.json"), '{"version":"1.0.0"}');
  fs.mkdirSync(path.join(root, "assembly/__benches__"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "assembly/__benches__/fixture.bench.ts"),
    "// fixture",
  );
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  fs.symlinkSync(process.execPath, path.join(bin, "node"));
  const executable = (name, text) =>
    fs.writeFileSync(
      path.join(bin, name),
      "#!/bin/bash\nset -euo pipefail\n" + text,
      { mode: 0o755 },
    );
  executable(
    "npx",
    'while [[ $# -gt 0 ]]; do if [[ "$1" == -o ]]; then shift; touch "$1"; fi; shift; done\n',
  );
  executable("wazero", "echo unrelated-runtime\n");
  executable(
    "selected cli",
    'if [[ "$1" == version ]]; then echo selected-wazero; exit; fi\nprintf \'%s\\n\' ran > executed\nprintf \'__AS_BENCH_JSON__build/logs/as/swar/fixture.serialize.wavm.json\\t{"description":"fixture","mbps":7}\\n\'\n',
  );
  execFileSync(
    "/bin/bash",
    ["scripts/run-bench.as.sh", "fixture", "--wazero", "--mode", "swar"],
    {
      cwd: root,
      env: {
        ...process.env,
        PATH: bin + ":/usr/bin:/bin",
        WAZERO_BIN: path.join(bin, "selected cli"),
      },
      stdio: "pipe",
    },
  );
  assert.equal(
    fs.readFileSync(path.join(root, "executed"), "utf8").trim(),
    "ran",
  );
  const meta = JSON.parse(
    fs.readFileSync(
      path.join(
        root,
        "build/logs/as/swar/fixture.serialize.wazero.json.provenance.json",
      ),
    ),
  );
  assert.equal(meta.tools.runtime, "selected-wazero");
  assert.equal(meta.settings.runtimeExecutable, path.join(bin, "selected cli"));
});
