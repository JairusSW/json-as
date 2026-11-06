import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-boxed-fast-"));
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
    for (const strict of ["false", "true"]) {
      for (const fast of ["0", "1"]) {
        const output = path.join(dir, `${mode}-${strict}-${fast}.wasm`);
        execFileSync(
          process.execPath,
          [
            path.join(root, "node_modules/assemblyscript/bin/asc.js"),
            "assembly/__tests__/boxed-fast.fixture.ts",
            "--transform",
            "./transform",
            "-O3",
            ...(fast === "1" && strict === "false"
              ? [
                  "--use",
                  "ASC_GC_GRANULARITY=16",
                  "--use",
                  "ASC_GC_IDLEFACTOR=0",
                  "--use",
                  "ASC_GC_SWEEPFACTOR=10000",
                ]
              : []),
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
              JSON_USE_FAST_PATH: fast,
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
        assert.equal(
          guest.fastEnabled(),
          Number(fast),
          `${mode}/strict=${strict}/fast=${fast}: concrete Box fields retain fast readers`,
        );
        assert.equal(
          guest.verify(),
          0,
          `${mode}/strict=${strict}/fast=${fast}`,
        );
        assert.equal(
          guest.verifyDefaults(),
          0,
          `${mode}/strict=${strict}/fast=${fast}: nested defaults`,
        );
        if (fast === "1")
          assert.equal(
            guest.verifyStorage(),
            0,
            `${mode}/strict=${strict}: speculative storage`,
          );
        assert.equal(
          guest.verifyWideDefaults(),
          0,
          `${mode}/strict=${strict}/fast=${fast}: wide defaults`,
        );
        assert.equal(
          guest.verifyRetained(),
          0,
          `${mode}/strict=${strict}/fast=${fast}: retained graphs`,
        );
      }
    }
  }
  console.log(
    "Typed fast readers: capability, defaults, storage and retention checks passed in 12 configurations",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
