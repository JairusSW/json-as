import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-whitespace-"));
try {
  const configs = ["incremental", "minimal", "stub"].flatMap((runtime) =>
    ["NAIVE", "SWAR", "SIMD"].map((mode) => ({ runtime, mode, trace: false })),
  );
  configs.push({ runtime: "incremental", mode: "SWAR", trace: true });
  for (const { runtime, mode, trace } of configs) {
    const binary = path.join(dir, "runs.wasm");
    const flags = [
      "-O3",
      "--runtime",
      runtime,
      "--exportStart",
      "start",
      "--exportRuntime",
    ];
    if (mode === "SIMD") flags.push("--enable", "simd");
    if (trace) flags.push("--use", "ASC_RTRACE=1");
    execFileSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        "assembly/__tests__/whitespace-runs.fixture.ts",
        "--transform",
        process.env.JSON_TEST_TRANSFORM ?? "./transform",
        ...flags,
        "-o",
        binary,
      ],
      { env: { ...process.env, JSON_MODE: mode }, stdio: "pipe" },
    );
    let allocations = 0;
    const { instance } = await WebAssembly.instantiate(
      fs.readFileSync(binary),
      {
        env: {
          abort(m, f, l, c) {
            throw new Error(`abort ${runtime}/${mode} ${l}:${c}`);
          },
        },
        rtrace: {
          oninit() {},
          onalloc() {
            allocations++;
          },
          onresize() {},
          onmove() {},
          onfree() {},
          onvisit() {
            return 1;
          },
          oncollect() {},
          oninterrupt() {},
          onyield() {},
          onload(p) {
            return p;
          },
          onstore(p) {
            return p;
          },
        },
      },
    );
    instance.exports.start();
    allocations = 0;
    assert.equal(instance.exports.verify(), 104432);
    assert.equal(instance.exports.boundary(), 258);
    assert.equal(instance.exports.codeUnits(), 524288);
    if (mode === "SIMD") {
      instance.exports.selectPrettyScanner();
      assert.equal(instance.exports.verify(), 104432);
      assert.equal(instance.exports.boundary(), 258);
      assert.equal(instance.exports.codeUnits(), 524288);
    }
    instance.exports.selectNumericRowScanner();
    assert.equal(instance.exports.verify(), 104432);
    assert.equal(instance.exports.boundary(), 258);
    assert.equal(instance.exports.codeUnits(), 524288);
    assert.equal(allocations, 0, "whitespace scanning does not allocate");
  }
  console.log(
    `Whitespace runs: exhaustive code units, mixed runs, reversed/odd bounds and physical memory end passed (${configs.length} configurations); zero allocations`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
