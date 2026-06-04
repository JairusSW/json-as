// Drives assembly/playground/bench.wasm from Node and reports ns/op.
// Build first:
//   npx asc assembly/playground/bench.ts --transform ./transform \
//     -o build/pgbench.wasm --enable simd --runtime incremental -O3
import { readFileSync } from "node:fs";

const bytes = readFileSync(
  new URL("../../build/pgbench.wasm", import.meta.url),
);
let memory;
const { instance } = await WebAssembly.instantiate(bytes, {
  env: {
    abort(msg, file, line, col) {
      throw new Error(`abort @ ${line}:${col}`);
    },
  },
});
const x = instance.exports;
memory = x.memory;

// Pre-grow so memory.grow never fires inside a timed loop.
const targetPages = 4096; // 256 MiB
if (memory.buffer.byteLength / 65536 < targetPages)
  memory.grow(targetPages - memory.buffer.byteLength / 65536);

const ITERS = 5_000_000;
const WARMUP = 500_000;

function time(name, fn, iters = ITERS) {
  const warmup = Math.min(WARMUP, iters);
  // warmup
  let acc = 0;
  for (let i = 0; i < warmup; i++) acc += fn();
  x.collect();
  // measured
  const t0 = performance.now();
  for (let i = 0; i < iters; i++) acc += fn();
  const t1 = performance.now();
  x.collect();
  const nsPerOp = ((t1 - t0) * 1e6) / iters;
  const opsPerSec = iters / ((t1 - t0) / 1000);
  return { name, nsPerOp, opsPerSec, acc };
}

const cases = [
  ["eager  parse + read both", x.eagerBoth],
  ["eager  parse + read one ", x.eagerOne],
  ["lazy   bind + read both  ", x.lazyBoth],
  ["lazy   bind + read one   ", x.lazyOne],
  ["lazy   bind only (O(1))  ", x.lazyBind],
  ["dyn    Obj  read both    ", x.objBoth],
  ["dyn    Obj  read one     ", x.objOne],
  ["loc    read both (0-alloc)", x.locBoth],
  ["loc    read both (reuse buf)", x.locBothReuse],
  ["loc    read one  (0-alloc)", x.locOne],
];

const wideCases = [
  ["eager  wide read first   ", x.eagerWideFirst],
  ["eager  wide read last    ", x.eagerWideLast],
  ["dyn    Obj  read first   ", x.objWideFirst],
  ["dyn    Obj  read last    ", x.objWideLast],
  ["loc    wide read first   ", x.locWideFirst],
  ["loc    wide read last    ", x.locWideLast],
  ["loc    wide last len 0alloc", x.locWideLastLen],
];

const allCases = [
  ["eager  wide read ALL 12  ", x.eagerWideAll],
  ["loc    ALL via locGet O(N²)", x.locWideAllRepeated],
  ["loc    ALL via cursor O(N)", x.locWideAllCursor],
];

const repoCases = [
  ["eager  Repo struct read 3 ", x.eagerRepo3],
  ["eager  Repo struct read 1 ", x.eagerRepoFirst],
  ["dyn    Obj parse + read 3 ", x.dynRepo3],
  ["loc    read first (id)    ", x.locRepoFirst],
  ["loc    read last (branch) ", x.locRepoLast],
  ["loc    read owner.login   ", x.locRepoNested],
  ["loc    cursor read 3      ", x.locRepo3Cursor],
];

// interleave a couple of rounds to wash out ordering / JIT warmup effects
const rounds = 3;

function runGroup(title, groupCases, baseName, iters = ITERS) {
  const agg = new Map();
  for (let r = 0; r < rounds; r++) {
    for (const [name, fn] of groupCases) {
      const res = time(name, fn, iters);
      const prev = agg.get(name) ?? [];
      prev.push(res.nsPerOp);
      agg.set(name, prev);
    }
  }
  console.log(title);
  const base = Math.min(...agg.get(baseName));
  for (const [name, samples] of agg) {
    const best = Math.min(...samples);
    const rel = (best / base).toFixed(2);
    console.log(
      `  ${name}  ${best.toFixed(1).padStart(7)} ns/op   ${(1e3 / best).toFixed(1).padStart(7)} M ops/s   ${rel}x`,
    );
  }
  console.log();
}

console.log(
  `\n${ITERS.toLocaleString()} iters/round × ${rounds} rounds, best-of`,
);
runGroup(
  `\nsmall object: {"uid":7,"token":"abcdef"}\n`,
  cases,
  "eager  parse + read both",
);
runGroup(
  `wide object (12 fields), read 1 — the on-demand sweet spot\n`,
  wideCases,
  "eager  wide read first   ",
);
runGroup(
  `wide object (12 fields), read ALL — simdjson "scan from current pos"\n`,
  allCases,
  "eager  wide read ALL 12  ",
);
runGroup(
  `real GitHub repo object (~5.2 KB, ~80 fields) — vs TYPED struct baseline\n`,
  repoCases,
  "eager  Repo struct read 3 ",
  100_000, // µs-scale ops — fewer iters keeps this group quick
);

// SIMD vs scalar string scan, isolated on a 4 KB string value.
{
  const BYTES = 4096 * 2; // UTF-16
  const agg = new Map();
  const sc = [
    ["scalar  scan 4 KB string ", x.blobScanScalar],
    ["SIMD    scan 4 KB string ", x.blobScanSIMD],
  ];
  for (let r = 0; r < rounds; r++)
    for (const [name, fn] of sc) {
      const res = time(name, fn, 1_000_000);
      (agg.get(name) ?? agg.set(name, []).get(name)).push(res.nsPerOp);
    }
  console.log(`SIMD vs scalar — scan a 4 KB string value to its close\n`);
  const base = Math.min(...agg.get("scalar  scan 4 KB string "));
  for (const [name, samples] of agg) {
    const best = Math.min(...samples);
    const gbs = BYTES / best; // bytes/ns = GB/s
    console.log(
      `  ${name}  ${best.toFixed(0).padStart(6)} ns/op   ${gbs.toFixed(2).padStart(6)} GB/s   ${(base / best).toFixed(2)}x`,
    );
  }
  console.log();
}

// simdjson Stage 1 structural-index build, over the 5.2 KB repo doc.
{
  const BYTES = 5251 * 2; // UTF-16
  const agg = new Map();
  const sc = [
    ["scalar  build index 5KB  ", x.idxBuildScalar],
    ["SIMD    build index 5KB  ", x.idxBuildSIMD],
  ];
  for (let r = 0; r < rounds; r++)
    for (const [name, fn] of sc) {
      const res = time(name, fn, 200_000);
      (agg.get(name) ?? agg.set(name, []).get(name)).push(res.nsPerOp);
    }
  console.log(
    `simdjson Stage 1 — build structural index of the 5.2 KB repo doc\n`,
  );
  const base = Math.min(...agg.get("scalar  build index 5KB  "));
  for (const [name, samples] of agg) {
    const best = Math.min(...samples);
    console.log(
      `  ${name}  ${best.toFixed(0).padStart(6)} ns/op   ${(BYTES / best).toFixed(2).padStart(6)} GB/s   ${(base / best).toFixed(2)}x`,
    );
  }
  console.log();
}
