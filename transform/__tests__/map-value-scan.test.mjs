import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-map-scan-"));
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const strict of ["false", "true"])
      for (const fast of ["0", "1"]) {
        const binary = path.join(dir, "scan.wasm");
        const flags = mode === "SIMD" ? ["--enable", "simd"] : [];
        execFileSync(
          process.execPath,
          [
            "node_modules/assemblyscript/bin/asc.js",
            "assembly/__tests__/map-value-scan.fixture.ts",
            "--transform",
            "./transform",
            "-O3",
            "--runtime",
            "incremental",
            "--exportStart",
            "start",
            ...flags,
            "-o",
            binary,
          ],
          {
            env: {
              ...process.env,
              JSON_MODE: mode,
              JSON_STRICT: strict,
              JSON_USE_FAST_PATH: fast,
              JSON_CACHE: "0",
            },
            stdio: "pipe",
          },
        );
        const { instance } = await WebAssembly.instantiate(
          fs.readFileSync(binary),
          {
            env: {
              abort(m, f, l, c) {
                throw Error(`${mode}/${strict}/${fast}: ${l}:${c}`);
              },
            },
          },
        );
        instance.exports.start();
        assert.equal(instance.exports.verify(), 11);
        console.log(mode, strict, fast, "Map value boundaries passed");
      }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
