import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-followup-"));
const failures = [];
let checks = 0;
const check = (label, actual, expected) => {
  checks++;
  try {
    assert.deepEqual(actual, expected, label);
  } catch {
    failures.push(
      label +
        ": expected " +
        JSON.stringify(expected) +
        ", got " +
        JSON.stringify(actual),
    );
  }
};
try {
  for (const mode of process.env.PROBE_QUICK
    ? ["SWAR"]
    : ["NAIVE", "SWAR", "SIMD"])
    for (const strict of process.env.PROBE_QUICK ? [false] : [false, true])
      for (const fast of process.env.PROBE_QUICK ? [true] : [false, true]) {
        const wasm = path.join(dir, "probe.wasm");
        execFileSync(
          process.execPath,
          [
            path.join(root, "node_modules/assemblyscript/bin/asc.js"),
            "assembly/__tests__/review-followup.fixture.ts",
            "--transform",
            "./transform",
            "--exportRuntime",
            "-O3",
            "-o",
            wasm,
            ...(mode === "SIMD" ? ["--enable", "simd"] : []),
          ],
          {
            cwd: root,
            env: {
              ...process.env,
              JSON_MODE: mode,
              JSON_STRICT: String(strict),
              JSON_USE_FAST_PATH: fast ? "1" : "0",
              JSON_AS_LIBRARY_SOURCE: "assembly/index",
            },
            stdio: "pipe",
          },
        );
        const g = new WebAssembly.Instance(
          new WebAssembly.Module(fs.readFileSync(wasm)),
          {
            env: {
              abort(_m, _f, l, c) {
                throw Error("abort " + l + ":" + c);
              },
            },
          },
        ).exports;
        const prefix = mode + "/strict=" + strict + "/fast=" + fast;
        const decode = (p) =>
          Buffer.from(
            g.memory.buffer,
            p,
            new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
          ).toString("utf16le");
        check(prefix + "/manual mutation", JSON.parse(decode(g.manual())), {
          a: 1,
          c: 3,
        });
        // Duplicate property names are invisible after JSON.parse.
        check(
          prefix + "/manual wire",
          decode(g.manual()),
          JSON.stringify({ a: 1, c: 3 }),
        );
        for (const array of [false, true]) {
          check(prefix + "/getter/" + array, g.getter(array), 1);
          check(
            prefix + "/constructor/" + array,
            g.constructorDefault(array),
            1,
          );
        }
        for (const barrel of [false, true])
          check(prefix + "/enum/" + barrel, g.enumField(barrel), 1);
        for (const reuse of [false, true])
          check(prefix + "/raw subtype/" + reuse, g.rawSubtype(reuse), 1);
        for (const signed of [false, true])
          check(
            prefix + "/pointer tag/" + signed,
            g.pointerTag(signed),
            g.boxedPointerTag(signed),
          );
        check(prefix + "/scalar array source", g.scalarArraySource(), 0);
        check(prefix + "/lazy source control", g.lazySourceControl(), 1);
        check(prefix + "/zero sentinel", g.zeroPointerTag(), 0);
        const aliasWasm = path.join(dir, "aliases.wasm");
        execFileSync(
          process.execPath,
          [
            path.join(root, "node_modules/assemblyscript/bin/asc.js"),
            "assembly/__tests__/review-alias-consumer.fixture.ts",
            "--transform",
            "./transform",
            "--exportRuntime",
            "-O3",
            "-o",
            aliasWasm,
            ...(mode === "SIMD" ? ["--enable", "simd"] : []),
          ],
          {
            cwd: root,
            env: {
              ...process.env,
              JSON_MODE: mode,
              JSON_STRICT: String(strict),
              JSON_USE_FAST_PATH: fast ? "1" : "0",
              JSON_AS_LIBRARY_SOURCE: "assembly/index",
            },
            stdio: "pipe",
          },
        );
        const a = new WebAssembly.Instance(
          new WebAssembly.Module(fs.readFileSync(aliasWasm)),
          {
            env: {
              abort(_m, _f, l, c) {
                throw Error(prefix + " alias abort " + l + ":" + c);
              },
            },
          },
        ).exports;
        const decodeAlias = (p) =>
          Buffer.from(
            a.memory.buffer,
            p,
            new DataView(a.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
          ).toString("utf16le");
        check(
          prefix + "/private lazy alias",
          JSON.parse(decodeAlias(a.lazy())),
          { child: { value: 7 } },
        );
        check(
          prefix + "/private generic alias",
          JSON.parse(decodeAlias(a.generic())),
          { child: { value: 11 } },
        );
        check(
          prefix + "/parsed lazy alias",
          JSON.parse(decodeAlias(a.parsedLazy())),
          { child: { value: 13 } },
        );
        check(prefix + "/accessed lazy alias", a.accessedLazy(), 13);
        console.log(prefix + " checked");
      }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
assert.equal(failures.length, 0, failures.join("\n"));
console.log("Review followup: " + checks + " checks passed");
