# Wide-key dispatch scaling

The generated slow parser used a linear exact-match chain inside each key-length
bucket. With N equally sized schema keys and N input members, that performs
quadratic key comparisons. This benchmark generates 10-unit integer field names,
reverses their input order, and measures public `JSON.parse` with fresh and reused
outputs. It disables fast-path generation to isolate the changed slow dispatcher.
The same fallback is used for wide reordered schemas when ordered fast paths miss.

From the repository root after installing dependencies:

```sh
bash bench/key-dispatch/build.sh ca2cb4747dd54923c23fe2b094c2f72523ca9eb2 build/key-dispatch
node bench/key-dispatch/run.mjs build/key-dispatch 1 4 8 16 32 64 128 256 512 1024 2048
```

The script archives the baseline's checked-in transform into a temporary sibling
of the current transform. Both binaries therefore use the same runtime sources,
compiler, flags, fixture and dependencies. That baseline is main before the
odd-key-tail correctness fix; these **even-length keys are unaffected by it**.
The prerequisite fix is independently covered by `odd-key-tail.spec.ts`.

`JSON_KEY_WIDTHS="32 128 512"` can shorten the build. The generated fixture is
untracked. The 4096-field baseline exceeded the AssemblyScript parser's default
JavaScript call-stack limit locally, so reported measurements stop at 2048.

Before timing, each Wasm instance serializes and verifies every field in both
changing payloads, using both fresh and reused outputs. The timed loop alternates
those two immutable strings and returns an endpoint checksum. It does not measure
input generation or stringify. Nine A/B samples alternate variant order; each
variant calibrates to approximately 40ms per sample. Forced collection is outside
timing, while any GC occurring inside fresh parses is included. JSON Lines retain
all raw samples, iteration counts, median nanoseconds, module sizes and host data.

For distinct aliases, the decision tree performs at most 16 branch tests per
UTF-16 key unit and then at most eight exact key comparisons. Identical aliases
keep declaration order and can retain a larger final chain. This is a bound on
slow-parser **key dispatch**, not all parsing or transform construction. The
transform still sorts candidates while generating the tree; runtime dispatch
allocates no hash table. Groups of eight or fewer keep the original matcher.

Measurements are warmed Node/V8 microbenchmarks, not application-wide throughput
claims. Record Node/AssemblyScript versions, CPU, baseline SHA, exact candidate
SHA, flags and module sizes alongside results. Do not mix timings with compiler
jobs or instrumented builds.

## Local results (2026-10-04)

Node 24.19.0/V8, AssemblyScript 0.28.18, incremental runtime, AMD EPYC 9V74.
Final nine-sample alternating medians; times are microseconds per fresh parse.

| Fields | Baseline | Decision tree | Speedup |
| --- | ---: | ---: | ---: |
| 32 | 1.296 | 1.223 | 1.06x |
| 128 | 6.409 | 5.060 | 1.27x |
| 512 | 48.922 | 23.368 | 2.09x |
| 1024 | 148.029 | 46.661 | 3.17x |
| 2048 | 600.588 | 108.832 | 5.52x |

At 2048 fields, reused-output parsing went from 604.207 to 106.766us (5.66x).
Doubling 1024 to 2048 fields increased baseline fresh latency 4.06x versus 2.33x
for the decision tree. Wasm size at 2048 fields grew from 605,632 to 616,129 bytes
(+1.73%). Widths 1, 4 and 8 produce byte-identical baseline/candidate Wasm; their
small measured fluctuations are noise, not gains or regressions.

A separate normal-fast-generation check (same reordered payloads) measured
679.938 to 106.374us at 2048 fields (6.39x fresh), and 673.280 to 106.081us reused
(6.35x). The ordered fast paths miss quickly and reach the improved fallback.
Reproduce that check with:

```sh
JSON_KEY_FAST=1 JSON_KEY_WIDTHS="128 512 2048" bash bench/key-dispatch/build.sh ca2cb4747dd54923c23fe2b094c2f72523ca9eb2 build/key-dispatch-fast
node bench/key-dispatch/run.mjs build/key-dispatch-fast 128 512 2048
```
