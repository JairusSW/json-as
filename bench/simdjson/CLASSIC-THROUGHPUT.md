# Classic owning-struct deserialization progress

The active target is every classic layout at 50% of native simdjson throughput,
then 60%, 70%, and onward toward parity. A subset passing does not complete a
stage. Work order starts Twitter, Canada, CITM, then the remaining corpora.

The classic comparison driver now builds the owning C++ models extracted from
the same AS class declarations. It uses simdjson 5.0.4's normal key-selector
reflection reader, permitting unknown fields like AS compatibility parsing.
The older strict adapter's `deny_unknown_fields` annotation selects a slower
scan reader; that adapter is not used for the current throughput gate.

`JSON.parse<T>()` is the timed AS API. Validation and string caching are off;
results are fresh, using the incremental runtime and the existing classic
harness. FGO and OTFCC also use fresh destinations, rather than comparing AS
reuse with fresh native construction. Declared Raw fields remain raw in both
implementations; native raw lexemes are copied and have no extra DOM pass.

Preparation checks every source value and emitted model default using Python's
integer-preserving JSON decoder. Native results are serialized after their
input is overwritten/destroyed and the parser is reused. AS results are
retained through additional parses and collection before full serialization.
Timing is separate from those oracles.

## First ARM64 screen, 2026-11-06

Five alternating fresh-process pairs per layout, Apple M4 Max, GCC 16.2.0,
AssemblyScript 0.28.20, xjb-as 1.0.0, V8 15.2.20. AS uses `-O3`, SIMD,
`--noAssert`, `--uncheckedBehavior always`, incremental GC, and wasm-opt
`-O4 -tnh -iit -ifwl -s 0`. Native uses `-O3 -mcpu=native` and the pinned
reflection library. Native input is pre-padded UTF-8; AS input is a pre-decoded
UTF-16 string, matching the respective string APIs.

Times are medians in microseconds. The ratio is native latency / AS latency;
higher is better. These runs used the shared timing lock and recorded power
and concurrent-process audits. Background work was allowed, so they are not
isolated-host release qualification.

| Corpus | Layout | AS | Native | Throughput fraction | 50% floor |
| --- | --- | ---: | ---: | ---: | --- |
| Twitter | min | 341.16 | 355.73 | 104.3% | Pass |
| Twitter | pretty | 459.39 | 376.09 | 81.9% | Pass |
| Canada | min | 5,188.57 | 2,730.39 | 52.6% | Pass |
| Canada | pretty | 5,239.81 | 2,800.93 | 53.5% | Pass |
| CITM, before empty-array optimization | min | 1,238.43 | 358.09 | 28.9% | Miss |
| CITM, before empty-array optimization | pretty | 1,547.80 | 434.12 | 28.0% | Miss |
| CITM, empty-array candidate | min | 883.59 | 343.54 | 38.9% | Miss |
| CITM, empty-array candidate | pretty | 1,130.13 | 413.01 | 36.5% | Miss |

Twitter/Canada baseline production source is `fe69c0c3`. The CITM candidate
adds independent empty native-array headers backed by a static zero-capacity
buffer; first growth creates normal writable storage. Its normal runtime
constructor fallback preserves subtype initialization. The allocation regression
uses an owner with two arrays: five allocations before, three after. Eighteen
mode/runtime/strictness configurations cover mutation, independent growth, GC,
and subtype controls. Minimal-runtime local controls are pinned across explicit
collection; native Array controls require the same rooting.

This optimization is not enough to clear CITM's first threshold. The remaining
six corpora have not been measured against the new adapter in this pass.
Twitter and Canada need rechecking after subsequent runtime changes.

Raw samples and exact binary/model/compiler manifests:
`build/perf/classic-native/twitter-normal-{samples,result,prepared}.json`,
`canada-citm-{samples,result,prepared}.json`, and
`build/perf/classic-native/citm-empty-paired.log`. The most recent selected-case
artifacts live under `build/classic-parity/`; archive them before another
selection replaces its manifest.

## Running the gate

```sh
node scripts/run-classic-parity.mjs --prepare --corpora=twitter,canada,citm_catalog
python3 ~/benchmark-lock.py --wait --owner "json-as: classic owning parity" \
  --planned-minutes 15 -- node scripts/run-classic-parity.mjs \
  --measure --corpora=twitter,canada,citm_catalog --pairs=5 --threshold=0.5
```

Omit `--corpora` for the complete classic set. `result.json` explicitly records
whether coverage is complete; a selected-case result must not be presented as
the whole-classic verdict. Preparation and measurement verify source, model,
input, compiler/runtime, and binary identities. Each parse starts at tier 1.

## Separate GC scheduling controls

Six alternating-order fresh processes per setting, identical CITM code and
normal parse calls. These flags have not been adopted into the primary gate.
RSS is whole-process peak resident memory, not retained AS heap bytes.

| Setting | Min us | Pretty us | Peak RSS MiB |
| --- | ---: | ---: | ---: |
| Default incremental settings | 882.02 | 1,138.32 | 88.5 |
| `ASC_GC_GRANULARITY=16384` | 855.83 | 1,115.04 | 78.2 |
| `ASC_GC_GRANULARITY=65536` | 852.32 | 1,111.89 | 75.1 |
| `ASC_GC_IDLEFACTOR=400` | 799.25 | 1,059.84 | 104.8 |

The gains are modest; even the higher-memory idle setting does not reach the
50% CITM floor. Raw samples, executable hashes, flags, load/power audits and
process RSS are under `build/perf/classic-native/gc-probes/`.

## Scoped allocation specialization, 2026-11-06

The transform exposes constant schema allocation sizes to a private inlined
copy of the installed incremental runtime's allocation entry. The runtime body
is preserved: zeroing, GC interruption, links and accounting remain intact.
Only explicit json-as allocation sites use the helper. Application allocation
calls and the standard global allocator are unchanged; minimal, stub and custom
runtimes retain their normal entry.

Four alternating fresh-process pairs against committed `2f411cdf`, with the
same classic harness and flags as above:

| Corpus | Layout | Control us | Candidate us | Latency change |
| --- | --- | ---: | ---: | ---: |
| Twitter | min | 332.49 | 334.20 | +0.5% |
| Twitter | pretty | 447.51 | 446.36 | -0.3% |
| Canada | min | 5,028.81 | 5,039.10 | +0.2% |
| Canada | pretty | 5,071.42 | 5,090.99 | +0.4% |
| CITM | min | 872.16 | 833.53 | -4.4% |
| CITM | pretty | 1,121.39 | 1,068.38 | -4.7% |

This screen shows a CITM gain and no major regression in Twitter/Canada;
sub-percent differences are not established improvements or regressions.
CITM Wasm grows from 143,165 to 148,249 bytes (+3.6%). Median peak process RSS
rises from 90.18 to 90.57 MiB. The deeper allocator probe remains experimental:
its additional gain came with much greater code growth.

All 40 existing transform scripts passed, plus the new allocation-specialization
regression. Packed consumers passed 252 operations across 36 configurations.
Full Twitter, Canada and CITM output graphs survived additional parses,
input-root release and collection before serialization. The AST regression
checks that runtime operations and application calls remain unchanged and that
other runtimes fall back normally.

CITM's allocation probe reports about 25,200 allocations per fresh parse,
including 8,685 Area objects and 9,057 integer-array objects. This points to
per-object allocator/collector cost as the next major opportunity while
preserving the requested class graph and independent array identities.
The redundant-zeroing probe (about 0.5%) was dropped; the empty-array visitor
probe (about 1–2%) remains outside production.

Matched samples, binary hashes, power/load audits and RSS:
`build/perf/classic-native/whitespace/scoped-all-{samples,summary}.json`.
Full validation: `build/perf/classic-native/scoped-transform-tests.log`,
`scoped-packed-consumer.log` and `scoped-preparation-final.log`.
Allocation counts: `build/perf/classic-native/allocation-counts.json`.

Five alternating native/AS process pairs for the scoped candidate give:

| Corpus | Layout | AS us | Native us | Throughput fraction | 50% floor |
| --- | --- | ---: | ---: | ---: | --- |
| Twitter | min | 329.64 | 341.55 | 103.6% | Pass |
| Twitter | pretty | 440.55 | 356.09 | 80.8% | Pass |
| Canada | min | 5,018.64 | 2,614.17 | 52.1% | Pass |
| Canada | pretty | 5,076.63 | 2,683.84 | 52.9% | Pass |
| CITM | min | 830.42 | 347.99 | 41.9% | Miss |
| CITM | pretty | 1,063.54 | 420.54 | 39.5% | Miss |

The selected-case gate correctly exits 1: CITM misses the floor, and this
selection does not establish complete classic coverage. The six remaining
corpora are still outstanding. The shared timing lock covered each batch;
background-load and AC-power evidence accompany the samples. No GC scheduling
flags or deeper backend/visitor probes are used in these results.
Artifacts: `build/perf/classic-native/scoped-native-{prepared,samples,result}.json`
and `scoped-native-paired.log`.

## Guarded small-block batching candidate

The next candidate acquires small raw allocator blocks in bounded batches.
Every parsed object still receives its own managed header, zeroing and GC
registration through the installed incremental runtime. The standard global
allocator and reclamation path remain in use. No live result graphs are pooled.
Batch lookup requires ample existing free capacity, never grows memory, and
falls back to one ordinary allocation under pressure. Unassigned tails are
returned before native heap growth. RTrace keeps the original physical-block
allocation stream by using the ordinary path.

The largest unfinished raw reservation is bounded by one batch per small size
class (roughly 70 KiB on wasm32). Heap-inspection GC-link words are cleared in
unassigned tails. Unsupported layouts and other runtimes keep their normal
allocation path.

Six alternating fresh-process pairs, current integrated candidate versus the
preceding allocator specialization, AC-powered ARM64 with concurrent correctness
compilation recorded in the sample audits:

| Layout | Previous us | Integrated us | Latency change |
| --- | ---: | ---: | ---: |
| CITM min | 858.35 | 731.86 | -14.7% |
| CITM pretty | 1,099.06 | 965.58 | -12.1% |

Median whole-process peak RSS changes from 90.59 to 92.00 MiB. This is a matched
exploratory screen, not isolated-host release qualification or a refreshed
native-throughput verdict. The raw batching prototype's larger gains are not
substituted for these guarded integration results.

The dedicated stress gate passes 12 mode/strict/fast configurations with live
graphs, multiple object sizes, native neighbors, growth, cycles and collection
under a fixed heap limit. Paired fixed-memory controls establish individual
fallback and required tail release. Packed consumers pass all 252 operations
across 36 configurations; full Twitter/Canada/CITM retained-output oracles pass.
The full 42-script transform suite passed for the batching candidate.

Rejected probes: caching already-freed blocks regressed latency by 8–15% and
increased RSS. The existing SIMD whitespace scanner regressed pretty parsing by
about 4%. A separate bounded SWAR object-whitespace probe improved pretty CITM
by about 9% in a matched screen. The bounded object-whitespace helper is now
integrated: 104,432 scalar/reference and 258 memory-boundary checks pass per
configuration across ten backend/runtime/RTrace configurations. Packed consumers
also pass all 252 operations across 36 configurations for the combined changes.
The combined changes pass the full 43-script transform suite.
The native-throughput gate has not yet been refreshed for this combination.
The earlier no-gain packed-whitespace experiment affected the
shared array scanner, rather than this object-helper path.

Evidence: `build/perf/classic-native/whitespace/integrated-batch-{samples,summary}.json`,
`object-whitespace-{samples,summary}.json`, `pool-{samples,summary}.json`;
`build/perf/classic-native/integrated-batch-stress.log`,
`batched-packed-consumer.log`, `batched-preparation.log`, and
`batched-transform-tests.log`.

## Native-array construction and generated child tier-down

The next integration specializes zero-length native Array construction at
explicit library and generated-reader sites. Exact native Arrays retain their
normal eight-element initial capacity, two independent managed allocations,
zeroed storage and GC link. Subtypes run their constructors; nonincremental
runtimes retain the standard constructor. The empty-wire-array optimization
continues to use its separate zero-capacity path.

A whitespace-tier parent now calls a known generated child's whitespace reader
directly. Its next parse still begins at tier 1. Manual fast methods and generic
children retain their existing dispatch. This change covers generated nested
field and inline struct-array calls, rather than claiming that every runtime
container worker inherits the caller's tier.

Matched six-pair candidate screens measured approximately 4% improvement for
the array factory in both CITM layouts, then 2% additional improvement for
pretty input from child tier-down. These screens used frozen binaries and the
old harness; production integration uses explicit factories and reader
capabilities rather than the diagnostic transform's broad AST substitutions.

Five alternating native/AS process pairs for the integrated candidate:

| Corpus | Layout | AS us | Owning native us | Throughput fraction | 50% floor |
| --- | --- | ---: | ---: | ---: | --- |
| Twitter | min | 338.03 | 362.96 | 107.4% | Pass |
| Twitter | pretty | 429.57 | 374.21 | 87.1% | Pass |
| Canada | min | 3,600.13 | 2,753.92 | 76.5% | Pass |
| Canada | pretty | 3,655.13 | 2,876.86 | 78.7% | Pass |
| CITM | min | 696.51 | 359.29 | 51.6% | Pass |
| CITM | pretty | 838.15 | 431.47 | 51.5% | Pass |

These three corpora pass the selected-case gate. The subsequent batch covers
the remaining six with the identical source hash, flags and environment:

| Corpus | Layout | AS us | Owning native us | Throughput fraction | 50% floor |
| --- | --- | ---: | ---: | ---: | --- |
| Poet | min | 1,431.48 | 1,690.10 | 118.1% | Pass |
| Poet | pretty | 1,530.36 | 1,715.52 | 112.1% | Pass |
| GitHub Events | min | 78.88 | 38.89 | 49.3% | Miss |
| GitHub Events | pretty | 83.64 | 40.45 | 48.4% | Miss |
| GSOC | min | 1,606.16 | 1,278.35 | 79.6% | Pass |
| GSOC | pretty | 1,705.44 | 1,292.72 | 75.8% | Pass |
| Lottie | min | 276.92 | 169.97 | 61.4% | Pass |
| Lottie | pretty | 538.71 | 270.60 | 50.2% | Pass |
| OTFCC | min | 55,702.95 | 34,357.18 | 61.7% | Pass |
| FGO | min | 26,979.73 | 17,367.33 | 64.4% | Pass |

The combined coverage check verifies all nine classics and all 16 layouts,
without duplicate cases. Fourteen pass; the two GitHub Events layouts miss,
so the all-classic 50% stage remains incomplete. Lottie pretty has little margin.
This AC-powered ARM64 batch held the shared timing lock and recorded concurrent
correctness builds in its audits; it is not isolated-host release qualification.
No timing flags, API semantics, validation settings or benchmark harnesses were
changed. Full retained graph oracles pass for all six measured layouts.

The array storage gate passes 18 backend/runtime/strictness configurations,
including scalar widths, managed elements, subclass initialization, independent
growth and collection. The instrumented tier gate passes 12 mode/strict/fast
configurations, including a compact parse after a pretty parse and manual and
generic fallbacks. Packed consumers pass 252 operations across 36 configurations.
The combined full 44-script transform suite passes, including the final
960-check capability matrix.

Evidence: `build/perf/classic-native/arrays-tier-native-{prepared,samples,result}.json`,
`arrays-tier-paired.log`, `native-array-tests.log`, `reader-tiers-tests.log`,
`arrays-tier-packed.log`, and `arrays-tier-transform-tests.log`.
The remaining batch is recorded in `remaining-floor-native-{prepared,samples,result}.json`
and `remaining-floor-paired.log`; `all-classic-floor-result.json` checks their
combined coverage and source identity with the preceding batch.
