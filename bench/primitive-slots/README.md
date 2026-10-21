# Dynamic primitive-slot allocation probe

This fixture measures allocations during one warmed `JSON.stringify` of an eager
`JSON.Arr` or `JSON.Obj`. Inputs and spilled integer boxes are constructed before
counting. The staging buffer and output string are warmed, then the heap is
collected. Fresh-output and same-size output-reuse calls are measured separately.
The runner verifies every output against its warm result and the other revision.

Build the same `fixture.ts` in a baseline checkout and the candidate checkout.
Copy this fixture unchanged into the baseline checkout if it predates the probe.
From each checkout root, after installing dependencies:

```sh
npm run build:transform
mkdir -p build/primitive-slots
JSON_AS_LIBRARY_SOURCE=assembly/index JSON_MODE=SWAR node node_modules/assemblyscript/bin/asc.js bench/primitive-slots/fixture.ts --transform ./transform -O3 --runtime incremental --exportRuntime --use ASC_RTRACE=1 -o build/primitive-slots/traced.wasm
```

Then compare the two generated files:

```sh
node scripts/bench-primitive-slots.mjs /path/to/baseline/traced.wasm /path/to/candidate/traced.wasm
```

Repeat with `JSON_MODE=NAIVE`, and with `JSON_MODE=SIMD` plus `--enable simd`.
The JSON Lines output covers lengths 0, 1, 8, 256, and 4096; null, boolean, f64,
heap-spilled i64, and a string control; both container shapes; and both output
policies. Each cell uses a fresh Wasm instance for each revision.

## Measured result

Baseline: main `17fa2ab34a3af3195c84de73df786baa57f67c1e`.
AssemblyScript 0.28.18, incremental runtime, `-O3`, Node 24.19.0.
All 300 cells across NAIVE/SWAR/SIMD produced identical complete output.

For every primitive fixture of length N, the candidate removes N transient
allocations and 32 × N allocator bytes. At N = 256, both Arr and Obj drop from
256 allocations / 8192 bytes to zero with output reuse. Fresh-output calls drop
from 257 allocations to one, retaining the result string allocation. The string
controls and empty containers have unchanged allocation counts and bytes.

The rtrace hooks count allocations and positive resize growth. Byte totals
include allocator/GC overhead and alignment, not just object payloads. This is
not a latency benchmark, a retained/peak-memory measurement, or a claim that
all JSON serialization is allocation-free. Reference slots retain their existing
wrapper path, and input construction is excluded.
