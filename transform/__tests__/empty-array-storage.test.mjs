import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-empty-"));
try {
  let checked = 0;
  for (const runtime of ["incremental", "minimal", "stub"])
    for (const mode of ["NAIVE", "SWAR", "SIMD"])
      for (const strict of ["false", "true"]) {
        const output = path.join(dir, "fixture.wasm");
        execFileSync(
          process.execPath,
          [
            "node_modules/assemblyscript/bin/asc.js",
            "assembly/__tests__/empty-array-storage.fixture.ts",
            "--transform",
            process.env.JSON_TEST_TRANSFORM ?? "./transform",
            "-O3",
            "--runtime",
            runtime,
            "--use",
            "ASC_RTRACE=1",
            "--enable",
            "simd",
            "--exportRuntime",
            "--exportStart",
            "start",
            "-o",
            output,
          ],
          {
            env: {
              ...process.env,
              JSON_MODE: mode,
              JSON_STRICT: strict,
              JSON_USE_FAST_PATH: "1",
              JSON_CACHE: "0",
            },
            stdio: "pipe",
          },
        );
        let count = 0;
        const { instance } = await WebAssembly.instantiate(
          fs.readFileSync(output),
          {
            env: {
              abort(m, f, l, c) {
                throw new Error(`abort ${runtime}/${mode}/${strict} ${l}:${c}`);
              },
            },
            rtrace: {
              oninit() {},
              onalloc() {
                count++;
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
        count = 0;
        assert.equal(instance.exports.allocateNative(), 64);
        if (runtime === "incremental")
          assert.equal(
            count,
            2,
            "native array retains its own header and buffer",
          );
        assert.equal(instance.exports.readNative(), 42);
        count = 0;
        assert.equal(instance.exports.parseEmpty(), 0);
        if (runtime === "incremental" && strict === "false")
          assert.equal(
            count,
            3,
            "one owner and two distinct arrays; empty buffers need no heap allocation",
          );
        assert.equal(instance.exports.mutate(), 1);
        try {
          assert.equal(instance.exports.verifyStorage(), 1);
        } catch (error) {
          throw new Error(`${runtime}/${mode}/${strict}: ${error.stack}`, {
            cause: error,
          });
        }
        assert.equal(instance.exports.verifyReuse(), 1);
        checked++;
      }
  console.log(
    `Empty native-array storage: allocation, independent growth and GC passed (${checked} configurations)`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
