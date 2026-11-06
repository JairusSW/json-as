# String Set traversal

Baseline: `8bd9ac6314203f521b1bfa40dfc248e6b4e6e527`.

String Sets can use the existing native-entry traversal used by numeric and
boolean Sets. A string serializer cannot call user code or mutate the Set.
The managed `src` parameter stays on the shadow stack for the traversal, so
both the entries storage and every remaining string stay reachable during
allocation and collection. The optimized Wasm was checked for these roots.
Nullable strings retain the normal null serializer. Object/custom elements
continue to use the snapshot path because their serializers can mutate a Set.

## Benchmark

`fixture.ts` builds deterministic short, short escaped, long escaped and
nullable string Sets. Sizes are 0, 1, 8, 64 and 1,024 before deletion. Deleted
cases remove every fourth entry starting at index 1. Long strings prepend
128 repetitions of quote/backslash/newline. The benchmark retains the last
output, verifies exact baseline/candidate equality, warms output buffers,
uses the same iteration count for each paired variant, alternates order and
reports the median of nine samples. Each sample targets at least 40 ms of
process CPU time. Full GC runs before each timing sample, outside the timer.

Measurements use Node 24.22.1 / V8 (`--no-liftoff`), AssemblyScript 0.28.18,
`-O3`, the incremental runtime and an AMD EPYC 9V74. Process CPU time was used
because shared-host scheduling made wall-clock samples unreliable. These are
local throughput measurements, not cross-runtime or end-to-end latency claims.
Long-escaping and unchanged empty controls are noisy; do not treat small
percentage changes as established wins or regressions.

Allocation measurements use separate `ASC_RTRACE=1` builds and fresh, warmed
instances. They count physical TLSF allocations including headers/alignment.
Tracing disables the library's small-block batching, so these counts must not
be read as native untraced allocator-call counts. The source-level result is
unambiguous: the temporary Array object and its backing buffer disappear.
At 1/8, 64 and 1,024 initial entries, traced allocation bytes fall by 112, 336
and 4,176 bytes per nonempty stringify respectively. Warmed calls go from
three allocations to one. Empty Sets remain unchanged.

The full 96-case matrix and raw samples are in [RESULTS.md](./RESULTS.md)
and `results-{naive,swar,simd}.jsonl`. Short strings consistently improve.
Long escaped strings have mixed results (0.81–1.27× for nonempty final cases),
including 23% higher CPU time for 1,024 initial entries with tombstones in NAIVE.
Other repeated long-string samples reverse direction, so this change should
be justified by allocation reduction and short-string throughput, not a claim
of universal speedup. Check long-string workloads on the target runtime.

## Reproduce

Use separate baseline and candidate checkouts with the same dependencies.
Copy `bench/string-set/fixture.ts` into the baseline checkout, then run the
following in each checkout (set `variant` to `baseline` or `candidate`).
Keep both output directories available to the runner.

```sh
npm run build:transform
mkdir -p build/string-set
for mode in NAIVE SWAR SIMD; do
  simd=''
  [ "$mode" = SIMD ] && simd='--enable simd'
  for traced in plain traced; do
    trace=''
    [ "$traced" = traced ] && trace='--use ASC_RTRACE=1'
    JSON_MODE=$mode JSON_AS_LIBRARY_SOURCE=assembly/index \
      node node_modules/assemblyscript/bin/asc.js bench/string-set/fixture.ts \
      --transform ./transform -O3 --exportRuntime --runtime incremental \
      $simd $trace --outFile build/string-set/$variant-$mode-$traced.wasm
  done
done
```

For each mode, pass its four files in this order:

```sh
node --no-liftoff scripts/bench-string-set.mjs \
  /path/to/baseline-NAIVE-plain.wasm \
  /path/to/candidate-NAIVE-plain.wasm \
  /path/to/baseline-NAIVE-traced.wasm \
  /path/to/candidate-NAIVE-traced.wasm
```

Optional environment variables: `JSON_SET_SIZES`, `JSON_SET_KINDS` (0=short,
1=escaped, 2=long-escaped, 3=nullable), and `JSON_SET_SAMPLES`.

## Correctness

`assembly/__tests__/string-set-direct.spec.ts` covers tombstones and reinsertion,
empty/nullable/unicode/escaped values, subclasses overriding public size and
values, temporary Set lifetime, repeated small/large output reuse, and custom
serializers that mutate the source Set and perform nested serialization/GC.
The large-string case exceeds the 64 KiB owned-output threshold.

For the additional forced-collection check, insert
`if (isString<indexof<T>>()) __collect();` immediately after `const value =
entry.key;` in the traversal, run that spec in all three modes, and restore
the source before ordinary builds. This instrumented version is only a test:
the shipping traversal has no explicit collection. All 54 assertions passed
with collection forced on every live entry.
