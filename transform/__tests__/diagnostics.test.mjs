import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-diagnostics-"));
const metrics = [];
try {
  for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
    for (const strict of ["false", "true"]) {
    for (const diagnostics of ["true", "false"]) {
      const output = path.join(dir, `${mode}-${strict}-${diagnostics}.wasm`);
      execFileSync(process.execPath, [
        path.join(root, "node_modules/assemblyscript/bin/asc.js"),
        "assembly/__tests__/diagnostics.fixture.ts", "--transform", "./transform",
        "-O3", "--use", "ASC_RTRACE=1", "--exportStart", "start",
        ...(mode === "SIMD" ? ["--enable", "simd"] : []), "-o", output,
      ], { cwd: root, env: { ...process.env, JSON_MODE: mode, JSON_DIAGNOSTICS: diagnostics,
        JSON_STRICT: strict, JSON_AS_LIBRARY_SOURCE: "assembly/index" }, stdio: "pipe" });
      const module = new WebAssembly.Module(fs.readFileSync(output));
      for (const name of ["boundsFailure", "parseFailure", "abortFailure", "userFailure", "userAbort", "codecFailure", "valid", "numeric", "numericFailure", "userUnreachable", "userConstant"]) {
        let allocations = 0, aborts = 0;
        const guest = new WebAssembly.Instance(module, {
          env: { abort() { aborts++; throw new Error("host abort"); } },
          rtrace: { oninit() {}, onalloc() { allocations++; }, onresize() { allocations++; },
            onload: p => p, onstore: p => p, onmove() {}, onfree() {}, onvisit() { return 1; },
            oncollect() {}, oninterrupt() {}, onyield() {} },
        }).exports;
        guest.start(); guest.setup(); allocations = 0;
        if (["valid", "numeric", "userConstant"].includes(name)) assert.equal(guest[name](), name === "valid" ? 9 : name === "numeric" ? 1 : 3);
        else if (diagnostics === "false" && !["userFailure", "userAbort", "codecFailure", "userUnreachable"].includes(name)) {
          assert.throws(() => guest[name](), WebAssembly.RuntimeError);
          assert.equal(aborts, 0, `${mode}/${name}: no diagnostic host call`);
          if (name === "boundsFailure") assert.equal(allocations, 0, "cold trap allocates no Error");
        } else {
          assert.throws(() => guest[name](), /host abort/);
          assert.equal(aborts, 1);
        }
        metrics.push({ mode, strict, diagnostics, name, allocations, aborts });
      }
    }
  }
  }
  console.log(`Diagnostics flag: ${metrics.length} checks passed; library traps allocate no Error, user failures preserved`);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
