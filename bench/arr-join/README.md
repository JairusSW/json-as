# JSON.Arr.join microbenchmark

From the repository root, after installing dependencies:

```sh
npm run build:transform
mkdir -p build/arr-join
JSON_AS_LIBRARY_SOURCE=assembly/index JSON_MODE=SWAR node node_modules/assemblyscript/bin/asc.js bench/arr-join/fixture.ts --transform ./transform -O3 --runtime incremental --exportRuntime -o build/arr-join/plain.wasm
JSON_AS_LIBRARY_SOURCE=assembly/index JSON_MODE=SWAR node node_modules/assemblyscript/bin/asc.js bench/arr-join/fixture.ts --transform ./transform -O3 --runtime incremental --exportRuntime --use ASC_RTRACE=1 -o build/arr-join/traced.wasm
node scripts/bench-arr-join.mjs build/arr-join/plain.wasm build/arr-join/traced.wasm
```

The fixture contains the pre-change loop and calls the current `JSON.Arr.join`.
It constructs the inputs before timing, warms lazy values and stringify capacity,
checks equal output, and measures nine alternating A/B samples of about 40 ms per
variant. Output is JSON Lines; latency is median nanoseconds per join. The separate
rtrace build reports allocation count and allocated TLSF block bytes (including
allocator/GC overhead, alignment, and positive in-place resize deltas) for one
warm join. Each allocation measurement starts in an identically warmed fresh
instance. It does not measure peak
live memory. Timing uses the uninstrumented incremental runtime; GC costs during
joins are included, and forced collection between batches is excluded.

Kinds cover ASCII strings, mixed/null/numeric/boolean/nested values, all-null
arrays, Unicode strings, nested arrays, and custom serializers at 8/256/4096
items, with empty and two-code-unit separators. Results are specific to this
runtime, compiler, machine and warmed workload. Retaining converted strings and
a temporary reference array can trade tiny/all-null overhead for linear copying. Managed
containers/structs take a conservative snapshot path so serializers that reuse
aliased string or separator output preserve the original prefix-copy timing;
that path creates linear-sized fragments before the final output copy. In all cases,
use actual measurements rather than assuming every case is faster.

To focus on tiny ASCII-string joins, set `JSON_JOIN_LENGTHS=0,1,2 JSON_JOIN_KINDS=0`
before the runner command. Kind indices follow the
order listed above, beginning at zero.
