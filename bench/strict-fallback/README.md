# Strict fallback prevalidation benchmark

This fixture measures complete strict parses into a reused destination and through
an object custom codec. The codec performs a nested fresh typed parse to construct
its result. Both paths include syntax prevalidation, allocation, and materialization;
input construction and transfer are excluded. A checksum consumes every result.

Build the identical `index.ts` fixture in the baseline and candidate checkouts:

```sh
JSON_STRICT=true JSON_MODE=SWAR node node_modules/assemblyscript/bin/asc.js \
  bench/strict-fallback/index.ts --transform ./transform -O3 \
  --runtime incremental --enable simd --exportRuntime --exportStart start \
  -o /tmp/fallback-SWAR.wasm
```

Repeat with `JSON_MODE=NAIVE` and `SIMD`. Run matching pairs using:

```sh
node --no-liftoff bench/strict-fallback/run.mjs /tmp/before-SWAR.wasm /tmp/after-SWAR.wasm
```

The runner uses two warmups, nine measured samples with alternating revision order,
and a full collection outside each timed sample. Each sample performs 10,000 small
or 200 large parses. It emits JSON lines with per-parse times, medians, time deltas,
and all samples. Negative time deltas are improvements. Fixtures cover compact and
pretty documents, escaped text, and numeric arrays of 16 or 8,192 elements.

These synthetic workloads are not application-wide throughput claims. Compare
all three modes and report binary size as well as timing; the scalar and checked
validators have different compiled footprints. Use an otherwise idle machine for
confirmation and preserve environment/compiler details with reported results.
