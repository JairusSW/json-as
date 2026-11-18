// Compare separately compiled baseline/candidate fixtures. Allocation counts
// require separate ASC_RTRACE builds; timings never include tracing hooks.
import { readFileSync } from "node:fs";
import { cpus } from "node:os";
const paths = process.argv.slice(2);
if (paths.length != 4)
  throw new Error(
    "Usage: node scripts/bench-string-set.mjs baseline.wasm candidate.wasm baseline-traced.wasm candidate-traced.wasm",
  );
async function load(path) {
  let memory,
    counting = false,
    allocations = 0,
    allocatedBytes = 0;
  const { instance } = await WebAssembly.instantiate(readFileSync(path), {
    env: {
      abort: (_m, _f, l, c) => {
        throw new Error(`abort ${l}:${c}`);
      },
    },
    rtrace: {
      oninit() {},
      onload(p) {
        return p;
      },
      onstore(p) {
        return p;
      },
      onalloc(block) {
        if (counting) {
          allocations++;
          allocatedBytes +=
            (new DataView(memory.buffer).getUint32(block, true) & ~3) + 4;
        }
      },
      onresize(block, oldSize) {
        if (counting)
          allocatedBytes += Math.max(
            0,
            (new DataView(memory.buffer).getUint32(block, true) & ~3) +
              4 -
              oldSize,
          );
      },
      onmove() {},
      onfree() {},
      onvisit() {
        return 1;
      },
      oncollect() {},
      oninterrupt() {},
      onyield() {},
    },
  });
  memory = instance.exports.memory;
  return {
    e: instance.exports,
    output() {
      const p = instance.exports.output();
      const n = new DataView(memory.buffer).getUint32(p - 4, true);
      return Buffer.from(memory.buffer, p, n).toString("utf16le");
    },
    count() {
      allocations = allocatedBytes = 0;
      counting = true;
      instance.exports.run(1);
      counting = false;
      return { allocations, allocatedBytes };
    },
  };
}
const now = () => {
  const t = process.cpuUsage();
  return (t.user + t.system) / 1000;
};
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const variants = await Promise.all(paths.slice(0, 2).map(load));
const sizes = (process.env.JSON_SET_SIZES || "0,1,8,64,1024")
  .split(",")
  .map(Number);
const kinds = (process.env.JSON_SET_KINDS || "0,1,2,3").split(",").map(Number);
const samples = Number(process.env.JSON_SET_SAMPLES || 9);
console.log(
  JSON.stringify({
    node: process.version,
    cpu: cpus()[0].model,
    samples,
    timing: "process CPU time, incremental runtime, -O3, warmed output buffers",
    trace:
      "physical TLSF allocations; ASC_RTRACE disables small-block batching",
  }),
);
for (const kind of kinds)
  for (const size of sizes)
    for (const deleted of [false, true]) {
      if (deleted && size < 8) continue;
      for (const v of variants) {
        v.e.setup(size, kind, deleted);
        v.e.run(20);
      }
      const expected = variants[0].output();
      if (variants[1].output() !== expected) throw new Error("Output mismatch");
      const iterations = Math.max(
        ...variants.map((v) => {
          let n = 1;
          for (;;) {
            v.e.__collect();
            const t = now();
            v.e.run(n);
            const ms = now() - t;
            if (ms >= 10 || n >= 262144)
              return Math.max(1, Math.round((n * 40) / Math.max(ms, 0.01)));
            n *= 2;
          }
        }),
      );
      const times = [[], []];
      for (let s = 0; s < samples; s++)
        for (const v of s % 2 ? [1, 0] : [0, 1]) {
          variants[v].e.__collect();
          const t = now();
          variants[v].e.run(iterations);
          times[v].push(((now() - t) * 1e6) / iterations);
        }
      const counts = [];
      for (const p of paths.slice(2)) {
        const v = await load(p);
        v.e.setup(size, kind, deleted);
        v.e.run(20);
        v.e.__collect();
        counts.push(v.count());
      }
      const baseline = { ns: median(times[0]), ...counts[0] };
      const candidate = { ns: median(times[1]), ...counts[1] };
      console.log(
        JSON.stringify({
          kind: ["short", "escaped", "long-escaped", "nullable"][kind],
          size,
          deleted,
          outputBytes: expected.length * 2,
          baseline,
          candidate,
          speedup: baseline.ns / candidate.ns,
          samplesNs: times,
        }),
      );
    }
