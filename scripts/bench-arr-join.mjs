// Build the fixture twice (plain and --use ASC_RTRACE=1), then pass both Wasm
// paths here. Timing never includes the rtrace hooks. See bench/arr-join/README.md.
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { cpus } from "node:os";

const [plainPath, tracedPath] = process.argv.slice(2);
if (!plainPath || !tracedPath) {
  throw new Error(
    "Usage: node scripts/bench-arr-join.mjs plain.wasm traced.wasm",
  );
}

async function load(path) {
  let memory;
  let counting = false;
  let allocations = 0;
  let allocatedBytes = 0;
  let resizes = 0;
  const add = (block) => {
    if (counting) {
      allocations++;
      // TLSF block size includes allocator/GC overhead and alignment.
      allocatedBytes +=
        (new DataView(memory.buffer).getUint32(block, true) & ~3) + 4;
    }
  };
  const { instance } = await WebAssembly.instantiate(readFileSync(path), {
    env: {
      abort: (_message, _file, line, column) => {
        throw new Error(`Wasm abort at ${line}:${column}`);
      },
    },
    rtrace: {
      oninit() {},
      onload(pointer) {
        return pointer;
      },
      onstore(pointer) {
        return pointer;
      },
      onalloc: add,
      onresize(block, oldSize) {
        if (counting) {
          resizes++;
          const size =
            (new DataView(memory.buffer).getUint32(block, true) & ~3) + 4;
          allocatedBytes += Math.max(0, size - oldSize);
        }
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
    exports: instance.exports,
    string(pointer) {
      const size = new DataView(memory.buffer).getUint32(pointer - 4, true);
      return Buffer.from(memory.buffer, pointer, size).toString("utf16le");
    },
    count(old) {
      allocations = 0;
      allocatedBytes = 0;
      resizes = 0;
      counting = true;
      instance.exports.run(old, 1);
      counting = false;
      return { allocations, allocatedBytes, resizes };
    },
  };
}

const plain = await load(plainPath);
const names = ["strings", "mixed", "nulls", "unicode", "nested", "custom"];
const median = (values) =>
  [...values].sort((a, b) => a - b)[values.length >> 1];
console.log(
  JSON.stringify({ node: process.version, cpu: cpus()[0].model, samples: 9 }),
);
const lengths = (process.env.JSON_JOIN_LENGTHS || "8,256,4096")
  .split(",")
  .map(Number);
const kinds = (process.env.JSON_JOIN_KINDS || "0,1,2,3,4,5")
  .split(",")
  .map(Number);
for (const kind of kinds) {
  for (const length of lengths) {
    for (const empty of [false, true]) {
      plain.exports.setup(length, kind, empty);
      plain.exports.run(1, 1);
      const expected = plain.string(plain.exports.output());
      plain.exports.run(0, 1);
      if (plain.string(plain.exports.output()) !== expected)
        throw new Error("Output mismatch");
      // Calibrate each variant separately, then alternate order in paired samples.
      const iterations = [0, 1].map((old) => {
        let n = 1;
        for (;;) {
          plain.exports.__collect();
          const start = performance.now();
          plain.exports.run(old, n);
          const ms = performance.now() - start;
          if (ms >= 20 || n >= 65536)
            return Math.max(1, Math.round((n * 40) / Math.max(ms, 0.01)));
          n *= 2;
        }
      });
      const samples = [[], []];
      for (let sample = 0; sample < 9; sample++) {
        for (const old of sample % 2 ? [1, 0] : [0, 1]) {
          plain.exports.__collect();
          const start = performance.now();
          plain.exports.run(old, iterations[old]);
          samples[old].push(
            ((performance.now() - start) * 1e6) / iterations[old],
          );
        }
      }
      // Start each allocation measurement in the same fresh, warmed heap state.
      const counts = [];
      for (const old of [0, 1]) {
        const traced = await load(tracedPath);
        traced.exports.setup(length, kind, empty);
        traced.exports.__collect();
        counts[old] = traced.count(old);
      }
      const baseline = { ns: median(samples[1]), ...counts[1] };
      const candidate = { ns: median(samples[0]), ...counts[0] };
      console.log(
        JSON.stringify({
          kind: names[kind],
          length,
          separator: empty ? "" : "::",
          baseline,
          candidate,
          speedup: baseline.ns / candidate.ns,
          samples,
        }),
      );
    }
  }
}
