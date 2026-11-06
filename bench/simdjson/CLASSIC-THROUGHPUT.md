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
