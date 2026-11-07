import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-sweep-runtime-"));
const transform = path.resolve("transform/lib/index.js");
const disabled = path.join(dir, "disabled.mjs");
const observer = path.resolve(
  "transform/__tests__/sweep-observer.transform.mjs",
);
fs.writeFileSync(
  disabled,
  `import Base from ${JSON.stringify(transform)};export default class extends Base {afterParse(parser){const rt=parser.sources.find(s=>s.internalPath==='~lib/rt/itcms');if(rt)rt.text+=' // specialization disabled by control';super.afterParse(parser);}}`,
);

function compile(
  fixture,
  selected,
  runtime,
  mode,
  strict,
  extra = [],
  fast = "1",
) {
  const output = path.join(dir, "fixture.wasm");
  execFileSync(
    process.execPath,
    [
      "node_modules/assemblyscript/bin/asc.js",
      fixture,
      "--transform",
      selected,
      "-O3",
      "--runtime",
      runtime,
      "--enable",
      "simd",
      "--exportStart",
      "start",
      "--use",
      "PUB_PROBE_FAST=1",
      "-o",
      output,
      ...extra,
    ],
    {
      stdio: "pipe",
      env: {
        ...process.env,
        JSON_MODE: mode,
        JSON_STRICT: strict,
        JSON_USE_FAST_PATH: fast,
        JSON_CACHE: "0",
      },
    },
  );
  return fs.readFileSync(output);
}
async function execute(bytes) {
  const events = {};
  const hooks = {};
  let items = 0,
    runs = 0,
    staticScans = 0,
    memory;
  for (const name of [
    "oninit",
    "onalloc",
    "onresize",
    "onmove",
    "onfree",
    "onvisit",
    "oncollect",
    "oninterrupt",
    "onyield",
    "onload",
    "onstore",
  ])
    hooks[name] = (...args) => {
      events[name] = (events[name] ?? 0) + 1;
      return name === "onvisit" ? 1 : args[0];
    };
  const lift = (p) =>
    p
      ? Buffer.from(
          memory.buffer,
          p,
          new DataView(memory.buffer).getUint32(p - 4, true),
        ).toString("utf16le")
      : "";
  const { instance } = await WebAssembly.instantiate(bytes, {
    rtrace: hooks,
    env: {
      jsonStaticArrayScan() {
        staticScans++;
      },
      jsonSweepItem() {
        items++;
      },
      jsonSweepRun() {
        runs++;
      },
      abort(m, f, l, c) {
        throw Error(`${lift(m)} at ${lift(f)}:${l}:${c}`);
      },
    },
  });
  memory = instance.exports.memory;
  instance.exports.start();
  items = 0;
  runs = 0;
  staticScans = 0;
  const result = instance.exports.verify();
  return {
    result,
    events,
    items,
    runs,
    staticScans,
    pages: memory.buffer.byteLength / 65536,
    finalized: instance.exports.finalizedCount?.(),
  };
}
try {
  const observed = await execute(
    compile(
      "assembly/__tests__/sweep-runs.fixture.ts",
      observer,
      "incremental",
      "SIMD",
      "false",
      ["--maximumMemory", "16"],
    ),
  );
  assert.equal(observed.result, 1);
  assert.ok(
    observed.items > observed.runs && observed.runs > 0,
    "must exercise coalescing, not merely pass with optimization disabled",
  );
  console.log(
    "Observed",
    observed.items,
    "dead objects in",
    observed.runs,
    "native frees; retained outputs passed",
  );
  const staticObserved = await execute(
    compile(
      "assembly/__tests__/static-array-scan.fixture.ts",
      observer,
      "incremental",
      "SIMD",
      "false",
      ["--maximumMemory", "16"],
    ),
  );
  assert.equal(staticObserved.result, 1);
  assert.ok(
    staticObserved.staticScans > 0,
    "must exercise static-buffer visit elision",
  );
  console.log(
    "Observed",
    staticObserved.staticScans,
    "static-buffer visits elided; growth, subclass and retained graph passed",
  );
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const strict of ["false", "true"])
      for (const fast of ["0", "1"]) {
        const result = await execute(
          compile(
            "assembly/__tests__/static-array-scan.fixture.ts",
            transform,
            "incremental",
            mode,
            strict,
            ["--maximumMemory", "16"],
            fast,
          ),
        );
        assert.equal(result.result, 1);
        assert.ok(result.pages <= 16);
      }
  console.log(
    "Static numeric-array scanning: 12 mode/strict/fast pressure configurations passed",
  );
  let checks = 0;
  for (const runtime of ["incremental", "minimal", "stub"])
    for (const mode of ["NAIVE", "SWAR", "SIMD"])
      for (const strict of ["false", "true"]) {
        const flags =
          runtime === "incremental" ? ["--use", "ASC_RTRACE=1"] : [];
        const fixture = "assembly/__tests__/static-array-scan.fixture.ts";
        const control = compile(
            fixture,
            disabled,
            runtime,
            mode,
            strict,
            flags,
          ),
          candidate = compile(fixture, transform, runtime, mode, strict, flags);
        assert.deepEqual(
          candidate,
          control,
          `${runtime}/${mode}/${strict}: disabled/instrumented binary`,
        );
        const a = await execute(control),
          b = await execute(candidate);
        assert.equal(b.result, 1);
        assert.deepEqual(b.events, a.events);
        checks++;
        console.log(runtime, mode, strict, "identical fallback binary/events");
      }
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const strict of ["false", "true"]) {
      const fixture = "assembly/__tests__/sweep-finalizer.fixture.ts";
      const control = compile(fixture, disabled, "incremental", mode, strict),
        candidate = compile(fixture, transform, "incremental", mode, strict);
      assert.deepEqual(
        candidate,
        control,
        `${mode}/${strict}: finalizer binary`,
      );
      const a = await execute(control),
        b = await execute(candidate);
      assert.equal(b.result, 56);
      assert.ok(b.finalized > 0);
      assert.equal(b.finalized, a.finalized);
      checks++;
      console.log(mode, strict, "identical finalizer binary/count");
    }
  console.log(
    `Sweep runtime: ${checks} fallback/finalizer configurations preserve exact binaries and runtime events`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
