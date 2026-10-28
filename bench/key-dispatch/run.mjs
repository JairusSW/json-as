import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { cpus } from "node:os";

const [directory, ...widthArgs] = process.argv.slice(2);
if (!directory)
  throw new Error(
    "Usage: node bench/key-dispatch/run.mjs directory [width...]",
  );
const widths = widthArgs.length
  ? widthArgs.map(Number)
  : [16, 32, 64, 128, 256, 512, 1024];
const median = (values) =>
  [...values].sort((a, b) => a - b)[values.length >> 1];
async function load(path) {
  const { instance } = await WebAssembly.instantiate(readFileSync(path), {
    env: {
      abort: (_message, _file, line, column) => {
        throw new Error(`Abort ${line}:${column}`);
      },
    },
  });
  assert.equal(instance.exports.verify(), 1, `Output mismatch: ${path}`);
  return instance.exports;
}
console.log(
  JSON.stringify({
    node: process.version,
    cpu: cpus()[0].model,
    samples: 9,
    targetMs: 40,
  }),
);
for (const width of widths) {
  const paths = ["base", "candidate"].map(
    (variant) => `${directory}/${variant}-${width}.wasm`,
  );
  const modules = await Promise.all(paths.map(load));
  for (const reuse of [false, true]) {
    const iterations = modules.map((module) => {
      let count = 1;
      for (;;) {
        module.__collect();
        const start = performance.now();
        module.run(reuse, count);
        const elapsed = performance.now() - start;
        if (elapsed >= 20)
          return Math.max(1, Math.round((count * 40) / elapsed));
        count *= 2;
      }
    });
    const samples = [[], []];
    for (let sample = 0; sample < 9; sample++) {
      for (const variant of sample & 1 ? [1, 0] : [0, 1]) {
        modules[variant].__collect();
        const start = performance.now();
        const checksum = modules[variant].run(reuse, iterations[variant]);
        assert.equal(checksum, width + 1 + ((iterations[variant] - 1) & 1) * 2);
        samples[variant].push(
          ((performance.now() - start) * 1e6) / iterations[variant],
        );
      }
    }
    const ns = samples.map(median);
    console.log(
      JSON.stringify({
        width,
        reuse,
        ns,
        speedup: ns[0] / ns[1],
        iterations,
        samples,
        wasmBytes: paths.map((path) => statSync(path).size),
      }),
    );
  }
}
