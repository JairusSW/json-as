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
import { performance } from "node:perf_hooks";

const root = fileURLToPath(new URL("../../", import.meta.url));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-collision-"));
const benchmark = process.argv.includes("--bench");
const baseline = process.argv
  .find((arg) => arg.startsWith("--baseline="))
  ?.slice(11);
const modes =
  process.env.OBJ_MODES?.split(",") ||
  (benchmark ? ["SWAR"] : ["NAIVE", "SWAR", "SIMD"]);

async function compile(source, mode, strict, fast, label) {
  const binary = path.join(
    temporary,
    `${label}-${mode}-${strict}-${fast}.wasm`,
  );
  try {
    execFileSync(
      process.execPath,
      [
        path.join(root, "node_modules/assemblyscript/bin/asc.js"),
        benchmark
          ? "assembly/__tests__/obj-collision.fixture.ts"
          : "assembly/__tests__/obj-collision-invariants.fixture.ts",
        "--transform",
        "./transform",
        "-O3",
        ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        "--exportStart",
        "start",
        "--exportRuntime",
        "-o",
        binary,
      ],
      {
        cwd: source,
        env: {
          ...process.env,
          JSON_MODE: mode,
          JSON_STRICT: strict,
          JSON_USE_FAST_PATH: fast,
          JSON_CACHE: "0",
          JSON_AS_LIBRARY_SOURCE: "assembly/index",
        },
        stdio: "pipe",
      },
    );
  } catch (error) {
    throw new Error(
      `${label}/${mode}/${strict}/${fast}: ${error.stderr?.toString() || error.message}`,
      { cause: error },
    );
  }
  const module = await WebAssembly.compile(fs.readFileSync(binary));
  return async () => {
    const instance = await WebAssembly.instantiate(module, {
      env: {
        abort(_message, _file, line, column) {
          throw new Error(
            `${label}/${mode}/${strict}/${fast}: abort at ${line}:${column}`,
          );
        },
      },
    });
    instance.exports.start();
    return instance.exports;
  };
}

function baselineSource(ref) {
  // Never replace the live runtime: the comparison gets its own source tree,
  // sharing only the installed compiler and the unchanged built transform.
  const source = path.join(temporary, "baseline");
  fs.mkdirSync(source);
  for (const name of ["assembly", "lib"])
    fs.cpSync(path.join(root, name), path.join(source, name), {
      recursive: true,
    });
  for (const name of ["node_modules", "transform"])
    fs.symlinkSync(path.join(root, name), path.join(source, name), "dir");
  fs.copyFileSync(
    path.join(root, "package.json"),
    path.join(source, "package.json"),
  );
  fs.writeFileSync(
    path.join(source, "assembly/index.ts"),
    execFileSync("git", ["show", `${ref}:assembly/index.ts`], { cwd: root }),
  );
  return source;
}

const median = (values) => values.sort((a, b) => a - b)[values.length >> 1];
async function measure(factories, n, adversarial) {
  const phases = factories.map(() => ({ build: [], lookup: [], mutation: [] }));
  const rounds = Math.max(1, Math.floor(16384 / n));
  for (let sample = 0; sample < 9; sample++) {
    // Alternate current/baseline order to reduce drift. Each phase/sample gets
    // a fresh instance/object; key setup and checksum checks are not timed.
    const order = factories.map((_, i) => i);
    if (sample & 1) order.reverse();
    for (const variant of order) {
      for (const phase of Object.keys(phases[variant])) {
        const wasm = await factories[variant]();
        wasm.setup(n, adversarial);
        if (phase !== "build") assert.equal(wasm.build(), n);
        const start = performance.now();
        const result =
          phase === "build"
            ? wasm.build()
            : phase === "lookup"
              ? wasm.lookup(rounds)
              : wasm.mutate();
        const elapsed = performance.now() - start;
        assert.equal(
          result,
          phase === "build"
            ? n
            : phase === "lookup"
              ? (rounds * n * (n + 1)) / 2
              : n * 2,
        );
        if (phase === "mutation") {
          assert.equal(wasm.lookup(1), (n * (n + 3)) / 2);
          wasm.verifyMutation();
        }
        if (sample >= 2)
          phases[variant][phase].push(
            (elapsed * 1e6) / (phase === "lookup" ? n * rounds : n),
          );
      }
    }
  }
  return phases.map((values) =>
    Object.fromEntries(
      Object.entries(values).map(([key, times]) => [key, median(times)]),
    ),
  );
}

try {
  if (!benchmark) {
    let checked = 0;
    for (const mode of modes)
      for (const strict of ["false", "true"])
        for (const fast of ["0", "1"]) {
          const factory = await compile(root, mode, strict, fast, "current");
          const wasm = await factory();
          for (const n of [1, 6, 7, 8, 16, 17, 32, 64, 65, 127, 512, 4096])
            for (const adversarial of [false, true])
              wasm.regression(n, adversarial);
          for (const n of [64, 65]) wasm.wrappedRegression(n);
          checked++;
          console.log(
            `Obj collision semantics: ${mode}, strict=${strict}, fast=${fast} passed`,
          );
        }
    console.log(
      `Obj collision semantics: ${checked} configurations passed; no timing assertions`,
    );
  } else {
    const prior = baseline ? baselineSource(baseline) : null;
    console.log(
      `# Actual compiled Wasm; ${process.version}; ${process.platform}/${process.arch}; median of 7 samples after 2 warmups`,
    );
    console.log(
      "mode,keys,count,phase,current_ns_per_key,baseline_ns_per_key,change_percent",
    );
    for (const mode of modes) {
      const current = await compile(root, mode, "false", "1", "current");
      const before = prior
        ? await compile(prior, mode, "false", "1", "baseline")
        : null;
      for (const n of [64, 256, 1024, 4096])
        for (const adversarial of [false, true]) {
          const [a, b] = await measure(
            before ? [current, before] : [current],
            n,
            adversarial,
          );
          for (const phase of Object.keys(a))
            console.log(
              [
                mode,
                adversarial ? "colliding" : "ordinary",
                n,
                phase,
                a[phase].toFixed(2),
                b ? b[phase].toFixed(2) : "",
                b ? (100 * (a[phase] / b[phase] - 1)).toFixed(1) : "",
              ].join(","),
            );
        }
    }
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
