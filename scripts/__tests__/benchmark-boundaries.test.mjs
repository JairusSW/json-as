import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { blackbox, readBlackbox } from "../../bench/lib/bench.js";
const root = path.resolve(import.meta.dirname, "../..");
test("JavaScript result sink never evaluates code inside the timed operation", () => {
  const original = globalThis.eval;
  let evaluations = 0;
  globalThis.eval = () => {
    evaluations++;
    throw new Error("blackbox evaluated code");
  };
  try {
    const value = { answer: 42 };
    assert.equal(blackbox(value), value);
    assert.equal(evaluations, 0);
    assert.equal(readBlackbox(), value);
  } finally {
    globalThis.eval = original;
  }
});
test("small benchmark counts and oversized frame counts make progress", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "json-as-bench-boundaries-"),
  );
  try {
    for (const frames of [0, 1, 40]) {
      const file = path.join(directory, `frames-${frames}.wasm`);
      execFileSync(
        process.execPath,
        [
          path.join(root, "node_modules/assemblyscript/bin/asc.js"),
          "assembly/__tests__/bench-boundary.fixture.ts",
          "--transform",
          "./transform",
          "--use",
          `BENCH_FRAMES=${frames}`,
          "--use",
          "BENCH_PREALLOC_BYTES=0",
          "-o",
          file,
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
      const module = new WebAssembly.Module(fs.readFileSync(file));
      let clocks = 0;
      const imports = {};
      for (const item of WebAssembly.Module.imports(module)) {
        imports[item.module] ??= {};
        imports[item.module][item.name] =
          item.name === "abort"
            ? () => {
                throw new Error("benchmark rejected");
              }
            : item.name.includes("now")
              ? () => {
                  if (++clocks > 1000)
                    throw new Error("frames made no progress");
                  return clocks;
                }
              : () => {};
      }
      const g = new WebAssembly.Instance(module, imports).exports;
      assert.equal(g.run(5n), 5, `frames=${frames}`);
      assert.equal(g.run(10n), 11, `frames=${frames}`);
      assert.throws(() => g.run(0n), /benchmark rejected/);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
