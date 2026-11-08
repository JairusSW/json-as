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

## GitHub Events follow-up candidate

The first complete floor sweep identifies GitHub Events as the remaining miss.
Two independent six-pair screens find useful work at different layers:

| Change | Control min/pretty us | Candidate min/pretty us |
| --- | ---: | ---: |
| Route decoded strings through the scoped allocator | 78.80 / 83.47 | 74.79 / 80.13 |
| Mark the varying Payload union members optional | 78.94 / 83.47 | 73.69 / 80.92 |
| Add string allocation to optional-only | 73.49 / 80.72 | 69.64 / 76.74 |

The string change retains the installed allocator's managed registration and
zeroing. Existing string renewal and reuse still use their normal paths. The
annotation changes no field types or key order and removes no fields; every
record is fully decoded and serialized by the retained-output oracle. Native
classes already default missing fields. The old comment about an optional-union
corruption workaround is removed after the candidate passes all 12
mode/strict/fast retained-graph configurations.

Before integration, the string candidate also passes 1,728 string oracle checks,
the allocation/retention checks, 16,236 construction checks across nine
runtime/backend configurations, and the 12-configuration fixed-heap stress gate
with its paired tail-release control. The combined candidate is now integrated.
The fresh all-classic owning-native comparison passes the 50% floor; the full
44-script transform suite also passes for this final combination.

Evidence: `whitespace/github-{string,optional,combined}-{samples,summary}.json`,
`github-combined-matrix.log`, `github-string-tests.log`,
`github-string-pressure.log`, and `strings-optional-{preparation,transform-tests,packed}.log`
under `build/perf/classic-native`.

## First complete 50% floor pass

Five alternating fresh-process pairs per corpus, all nine classics and all 16
layouts, with the same normal `JSON.parse<T>()` API, original timing harnesses,
owning native models, validation off and string caching off:

| Corpus | Min throughput fraction | Pretty throughput fraction |
| --- | ---: | ---: |
| Twitter | 122.4% | 99.0% |
| Canada | 77.0% | 77.4% |
| CITM | 52.3% | 52.9% |
| Poet | 134.5% | 130.3% |
| GitHub Events | 56.0% | 52.5% |
| GSOC | 85.8% | 82.7% |
| Lottie | 61.2% | 51.6% |
| OTFCC | 59.2% | — |
| FGO | 63.8% | — |

The gate reports complete coverage and all rows pass. Paired-median ratios also
exceed 50% for every layout. Lottie pretty retains limited margin: its lowest
individual pair is 49.5%, while its paired median is 51.7%. These AC-powered
ARM64 measurements hold the shared timing lock and preserve concurrent-work
audits; they are not isolated-host release qualification.

Full retained-output oracles pass for every layout. GitHub's new output equals
the preserved original object/default graph in both layouts; its native
generated C++ and native binary hashes are unchanged. Packed consumers pass
252 operations across 36 configurations. The full transform suite passes,
including the final 960-check capability matrix. This establishes the measured 50%
milestone, rather than parity or completion of the active objective.

The next 60% stage still misses CITM, GitHub Events, Lottie pretty and OTFCC.
Following the requested order, CITM is next after the already-passing Twitter
and Canada cases.

Evidence: `strings-optional-native-{prepared,samples,result}.json`,
`strings-optional-pair-fractions.json`, and
`strings-optional-all-classic-paired.log` under `build/perf/classic-native`.

## Next CITM screen: barrier call overhead

Diagnostic-only transforms retain the installed incremental write-barrier body
but change inlining. The global version affects the ordinary barrier; the scoped
version leaves that global entry intact and rewrites library/generated parser
calls to a private inline clone, excluding original application methods.
Both pass the full retained-output oracle in both CITM layouts.

Six balanced three-way process orderings give:

| Variant | Min us | Pretty us | Wasm bytes | Peak process RSS MiB |
| --- | ---: | ---: | ---: | ---: |
| Control | 677.86 | 811.85 | 193,463 | 95.15 |
| Global inline | 638.00 | 766.79 | 202,272 | 98.55 |
| Scoped inline | 652.33 | 787.66 | 200,356 | 98.47 |

The scoped version gains 3.8%/3.0% but retains most of the RSS cost. Both remain
outside production while the next 60% work evaluates the tradeoff and profiles
remaining CITM costs. These relative screens do not establish a new native floor.
Evidence: `whitespace/citm-link-scoped-{samples,summary}.json`,
`citm-link-scoped-paired.log`, `citm-link-oracle.log`, and
`citm-scoped-link-oracle.log` under `build/perf/classic-native`.

## Next 60% stage: in-capacity array append

A same-engine named CITM profile records 25,656 minified and 30,751 pretty
samples. Aggregated self samples put TLSF insertion at 23.9%/20.6%, the native
write barrier at 8.4%/6.4%, and integer-field dispatch at 7.1% on minified input.
Native reference-array push contributes 5.4%/3.7%. These are diagnostic samples,
not qualified throughput timings; both profiled outputs pass the full oracle.

An explicit native append helper now handles the in-capacity case inside the
generated reader. It reads base-layout length and capacity, stores the element,
performs the standard multiple-store barrier, and updates length. Growth uses
the base setter, retaining overflow checks, buffer growth, zeroing and barriers.
Managed arguments remain rooted. Constructor state and subtype identity survive;
public subtype push/index overrides do not alter the wire values.

The isolated six-pair screen improves CITM minified 5.8% and pretty 2.7%, adding
less than 0.5% Wasm code. The production integration then passes 18
backend/runtime/strictness configurations, including capacity boundaries,
nullable references, sharing, collection, subtype storage, reuse, and zero
allocations on an in-capacity append. Packed consumers pass 252 operations over
36 configurations, and the full 45-script transform suite passes.

Five fresh owning-native pairs for the integration report CITM at 644.95 us
minified versus 355.03 us native (55.0%), and 800.08 us pretty versus 428.60 us
native (53.6%). Twitter and Canada pass the selected 60% gate; CITM still misses.
This does not complete the all-classic 60% stage. All selected full retained-output
oracles pass. The same AC-powered ARM64 lock/audit qualification applies.

Rejected screens retain useful controls: force-inlining TLSF insertion and the
integer dispatcher gives no useful gain; same-bucket TLSF coalescing regresses
minified 0.8%; leaf whitespace-reader cloning adds 9.6% code without a speed gain.
A packed-prefix integer tail passes 1,192,776 differential/boundary checks but
regresses minified 1.8%, so it is not adopted. The initial bounded colon-space screen improves pretty 2.4% with minified
unchanged; its subsequent integration is recorded below.

Evidence under `build/perf/classic-native`: `citm-current-{min,pretty}-profile.json`,
`citm-current-profile-summary.json`, `whitespace/citm-append-leaf-{samples,summary}.json`,
`native-append-tests.log`, `append-transform-tests.log`, `append-packed.log`,
`append-native-{prepared,samples,result}.json`, `append-native-paired.log`,
`integer-prefix-check.log`, and `whitespace/citm-prefix-colon-{samples,summary}.json`.

## Bounded pretty separators and next barrier screen

Generated required-field whitespace readers now match the common UTF-16 `: `
separator with one bounded word comparison. All other spellings retain the
original whitespace path, and whitespace after that word is still consumed.
The change is emitted at the separator construction site, without replacing
text inside aliases, comments, copied expressions, or application methods.
The 12 mode/strict/fast reader-tier configurations cover all combinations of
empty, space, tab and newline whitespace around colons, both fresh and populated
destinations, and an alias containing return-statement text. The production
CITM binary is identical to the previously screened separator prototype.
Packed consumers pass 252 operations across 36 configurations.

Five owning-native pairs on AC-powered local ARM64 report Twitter at 122.6%
minified / 99.8% pretty, Canada at 76.1% / 79.0%, and CITM at 55.1% / 55.3%.
CITM takes 639.74 / 779.06 us versus native 352.40 / 430.85 us. The selected
60% gate exits unsuccessfully, as expected. Full retained outputs pass for
both layouts of all three selected corpora. This is partial classic coverage,
with concurrent correctness work recorded in the audits, not an isolated
release qualification or completion of the all-classic 60% stage.

A separate library-scoped barrier prototype checks the parent's GC color before
loading the child color. It preserves the standard black/white and pinned-parent
transitions and leaves the global runtime barrier and application calls intact.
Two balanced six-round screens favor this prototype: 5.3% / 3.4% lower CITM
latency alone, and 6.7% / 5.0% with the separator change. Peak RSS increases
approximately 3 MiB. Full retained graphs and 12 fixed-heap pressure/GC
configurations pass. This remains a diagnostic prototype, pending explicit
library-helper integration and broader validation. Requesting the runtime's
multi-store barrier from generated readers passes the same correctness controls
but is slightly slower than the parent-first prototype, so it is rejected.

Evidence: `build/perf/classic-native/colon-native-{prepared,samples,result}.json`,
`colon-native-paired.log`, `colon-separators-tests.log`, `colon-packed-tests.log`,
`whitespace/citm-parent-first-{samples,summary}.json`,
`whitespace/citm-multiple-link-{samples,summary}.json`,
`parent-first-pressure.log`, and `multiple-link-pressure.log`.

An additional SIMD signed-field eight-digit prefix passes 1,120,676 differential
checks and both full CITM graphs, but the six-round screen is effectively flat
for minified input (0.3%) and regresses pretty input 1.4%. It is not adopted.
The production four-digit signed scan remains unchanged. Raw samples and
checks are in `whitespace/citm-signed-eight-{samples,summary}.json` and
`signed-eight-check.log`.

The full 45-script `npm run test:transform` command also passes on the integrated
separator source, including the final 960-check capability matrix.
Measured source fingerprint:
`deb610dccb019d91e6c6c0bb84b45339f40774574f3bea953eb089a1acd152ba`.

## Library-owned write-barrier integration

Generated reader stores and manual publication sites in the library now use
`linkObject`. The transform creates a private inline copy of the installed
incremental runtime barrier and binds only this helper to it. The original
global entry and application calls retain their original code. The recognized
stock body checks the parent color first; black-to-white and pinned-parent
marking actions remain equivalent. An unrecognized body is copied unchanged,
and other runtimes retain the normal helper fallback. No source-wide rewriting
of user expressions is involved. Unit checks cover selection, unknown-body and
runtime fallbacks, alias collisions, idempotence, and unchanged global/application
calls. The integrated CITM Wasm is identical to the parent-first prototype.

The integrated five-pair owning-native screen reports Twitter at 124.9%
minified / 104.2% pretty, Canada at 76.5% / 77.0%, and CITM at 57.7% / 57.0%.
CITM takes 625.30 / 766.66 us versus native 361.06 / 437.04 us. The selected
60% gate still fails; this does not qualify the complete classic stage.
Full retained-output oracles and 252 packed-consumer operations pass.

A second six-pair comparison restores the stock barrier on otherwise matching
sources. CITM improves in every pair for both layouts: median latency falls
6.5% minified and 4.6% pretty, with 2.77 MiB higher peak RSS. Canada is roughly
flat to 1% better, with 0.85 MiB higher RSS; it does not reproduce a consistent
regression. Both controls retain the owning output. These AC-powered local ARM64
runs use the shared timing lock; concurrent correctness work is recorded in the
audits. They are screens, not isolated release qualification.

Evidence: `build/perf/classic-native/owned-barrier-native-{prepared,samples,result}.json`,
`owned-barrier-native-paired.log`, `owned-barrier-transform/results.json`,
`owned-barrier-packed.log`, `canada-stock-link-oracle.log`, and
`whitespace/owned-controls-{samples,summary}.json`.

All 46 transform scripts pass on the integrated helper, including the final
960-check capability matrix. Measured production fingerprint:
`bfbf20053d9daba1cc56f50873737532cb7c82b1c9406f95a152e0a0682f4bdd`.

## Inline null composite claims

The composite-reuse wrapper now returns null destinations inline, before calling
ownership claiming. Non-null destinations retain the existing claim logic.
Six alternating CITM pairs improve minified latency 2.2%; pretty pairs are mixed
and roughly flat (0.5% slower median). Both full retained layouts, all 46
transform scripts, and 252 packed-consumer operations pass. The integrated
CITM binary matches the screened prototype.

Five owning-native pairs put CITM at 60.5% minified and 58.4% pretty. The selected
60% gate still fails. The same local ARM64 shared-lock/background-audit
qualification applies. A duplicate fresh-zeroing probe passed both oracles but
showed no useful speed gain and was rejected.

Evidence: `build/perf/classic-native/null-reuse-native-{prepared,samples,result}.json`,
`null-reuse-native-paired.log`, `null-reuse-transform/results.json`,
`null-reuse-packed.log`, and `whitespace/citm-null-reuse-{samples,summary}.json`.

## Fresh Map defaults

New, unpublished Map values can now use the same conservative default deferral
as generated child readers. The transform emits an exact-type eligibility
certificate only for supported generated readers without internal/effectful
initializers, custom cursor lifecycle hooks, or shared managed defaults.
Absent optional fields receive their defaults after a successful fast read;
a miss initializes before the slow reader. Existing mapped values retain the
reuse/reset path. Ineligible descendants cannot inherit an ancestor's certificate.

All 47 transform scripts and 252 packed-consumer operations pass. The new
18-configuration backend/runtime/strict matrix checks missing and reordered
fields, populated destination reuse, getter effects, shared defaults, inherited
private state, namespace bindings and retained graphs after collection. It also
verifies fewer allocations against an eager control under incremental/minimal;
stub has no allocation-event counter. A separate constructor-sensitive control
matches eager behavior. The integrated CITM binary matches the prototype.

Six matched pairs improve CITM minified 5.0% and pretty 4.7%, reducing peak RSS
about 1.1 MiB. An initial native gate overlapping correctness builds reports
60.8% / 59.0%. After our compiler jobs finish, five fresh owning-native pairs
report 63.4% / 60.2%: 551.44 / 699.36 us versus native 349.39 / 421.10 us.
Twitter is 127.2% / 101.2%; Canada 76.2% / 78.1%. This selected gate passes,
but the complete all-classic 60% stage remains unqualified. CITM pretty has a
small margin and must remain covered by the complete sweep. The first Twitter
native audit records an external Go compile; CITM's audits show no heavy build.
All runs use the local ARM64 shared lock and retain the desktop/background audits.

Evidence: `build/perf/classic-native/map-defer-quiet-native-{prepared,samples,result}.json`,
`map-defer-native-quiet-paired.log`, `map-defer-mixed-native-{prepared,samples,result}.json`,
`map-defer-transform/results.json`, `map-defer-focused.log`, `map-defer-packed.log`,
and `whitespace/citm-map-defer-{samples,summary}.json`.

Measured Map-deferral source fingerprint:
`9fc7ad34e56c65bbe41ba3835516ecb3d204001fc7b09a9b556d709a1bbc6ca8`.

The fresh-Map certificate additionally excludes manual parse entry points and
cursor lifecycle hooks anywhere in the parent/dependency graph. A targeted
regression first fails: a manual child FAST reader increments shared state,
and a previously initialized `saved = state` default changes from 0 to 1 when
deferred. With the graph guard, eager and optimized results both preserve 0.
The regression is included in the 18-configuration Map fixture. The guard does
not disable manual readers or change their calls; it only denies default
deferral around them. All nine classic benchmark binaries remain identical.
The expanded 18-configuration test, all 47 transform scripts and 252 packed
consumer operations pass with this dependency guard. A fresh rebuild verifies
all nine classic binaries are byte-for-byte unchanged by the guard.

## Complete sweep after Map deferral

The complete nine-corpus / sixteen-layout five-pair gate does not pass 60%.
It also catches a Lottie pretty floor regression (48.6%, versus 51.6% in the
previous complete sweep). Current fractions, minified / pretty:
Twitter 125.8% / 100.7%; Canada 74.4% / 75.5%; CITM 61.4% / 58.5%;
Poet 136.4% / 129.2%; GitHub Events 54.0% / 51.3%; GSOC 99.8% / 95.5%;
Lottie 58.2% / 48.6%; OTFCC 57.3% minified; FGO 60.6% minified.

The earlier 50% milestone remains evidence for its pinned source, not proof that
this newer source retains that floor. Restore Lottie before accepting another
stage. The native binaries and V8 version (15.2.20) match the earlier sweep;
same-source stock/scoped barrier comparisons are retained to isolate recent
changes from run-to-run host variation. Evidence:
`build/perf/classic-native/map-hook-fix-all-60-{prepared,samples,result}.json`
and `map-hook-fix-all-60-paired.log`.


## Matched baseline and prepared optimization screens

Six alternating process pairs compare the pinned first-50%-passing source
(`48d63586`) with `52786767`, using the same current harness, inputs and V8.
Both pinned retained-graph oracles pass. Lottie latency is 299.645 / 577.145 us
at the baseline versus 303.800 / 581.100 us at current (minified / pretty).
GitHub is 73.680 / 81.560 versus 75.675 / 81.895 us. These same-batch controls
show a smaller source regression than comparing absolute latencies across the
older and newer complete sweeps. They do not restore the current 50% gate.
Evidence: `build/perf/classic-native/whitespace/pinned-regression-controls-{samples,summary}.json`.

A second six-pair screen changes one mechanism per corpus. Bounded whitespace
prefix consumption reduces Lottie medians from 305.055 / 588.205 to
297.110 / 572.615 us (2.6% lower latency in each layout); all six individual
pairs improve. It consumes the leading UTF-16 spaces from the already loaded
word instead of repeating overlapping wide probes. Exhaustive code-unit,
mixed-run, reversed/odd-bound and physical-end scanner checks pass in ten
runtime/backend configurations without allocations; retained Lottie graphs pass.

Deferring safe fresh array-row defaults, using the existing exact-type Map
certificate, reduces GitHub medians from 75.430 / 80.420 to 64.995 / 71.845 us
(13.8% / 10.7% lower latency); all six pairs improve. Retained GitHub graphs pass.
These are optimization screens, not a newly qualified all-corpus threshold.
Both screens use the shared ARM64 timing lock, AC power, and preserve process
audits; background VM activity was present. Evidence:
`build/perf/classic-native/whitespace/prepared-optimization-controls-{samples,summary}.json`
and `prepared-optimization-controls-paired.log`.


## Complete sweep after array and whitespace improvements

At `4235f863`, all 48 transform scripts pass, all nine retained owning graphs
pass, and 252 packed-consumer operations pass across 36 configurations. The
five-pair complete sweep restores the 50% floor across all sixteen layouts;
the lowest observed fraction is Lottie pretty at 51.3%. The 60% stage still
fails three pretty layouts: CITM 54.9%, GitHub 58.5%, and Lottie 51.3%.
Current minified / pretty fractions: Twitter 129.3% / 96.6%; Canada 76.3% /
78.0%; CITM 62.8% / 54.9%; Poet 150.1% / 134.2%; GitHub 63.2% / 58.5%;
GSOC 104.4% / 97.7%; Lottie 62.1% / 51.3%; OTFCC 60.2% minified; FGO
65.5% minified. OTFCC has little margin at 60%; retain it in the next full gate.

The sweep uses the shared ARM64 lock and AC power, with background VM/process
audits preserved. These are measured thresholds under that load, not an
isolated release qualification. Evidence:
`build/perf/classic-native/array-whitespace-all-60-{prepared,samples,result}.json`,
`array-whitespace-all-60-paired.log`, `array-whitespace-transform/results.json`,
and `array-whitespace-packed.log`.
Source fingerprint: `2cc940e31744e314183fb64838609fc2168754a5588ebbb9de01b352f99b3d65`.

A retained-graph-checked profile identifies Lottie's next bottleneck: composite
Raw boundary scanning accounts for 65.5% / 64.4% of self samples, with another
18.0% / 15.6% attributed to its typed wrapper. Evidence:
`build/perf/classic-native/lottie-array-whitespace-profile-summary.json` and
`lottie-array-whitespace-profile-audit.json`. Wider and packed-mask scanner
probes are experimental; they are not part of the production source above.


## Scanner screen and whitespace rollback

Six paired runs isolate a CITM pretty regression in the whitespace prefix
change: old `52786767` is 773.660 us, versus 847.240 us with the new helper
and eager array defaults. Keeping array deferral is 849.625 us; the array
change is essentially flat in this control. Minified CITM is essentially flat
across all three variants (611.465 / 614.780 / 610.955 us). Restore the prior
whitespace helper; the 50% result above remains pinned to `4235f863` until the
new source completes another full sweep.

The same screen finds a stronger general Lottie optimization. Grouping four
bounded SIMD masks into one 64-byte scan batch reduces minified / pretty
medians from 292.060 / 574.765 to 250.725 / 418.300 us (14.2% / 27.2% lower
latency), with unchanged retained owning graphs. Packed 32-byte masks are
slower than this 64-byte version. Larger and packed 64/128-byte alternatives
remain experimental pending their paired comparison. They pass 4,395,072
scalar-reference, UTF-16 code-unit/lane, randomized, escaped-string and physical
memory-end checks per variant. No scanner change is adopted by this note.
Evidence: `build/perf/classic-native/whitespace/scanner-default-controls-{samples,summary}.json`,
`scanner-default-controls-paired.log`, `large-scan-differential.log`, and
`prepare-large-scanner.log`.


## Larger scanner selection

A six-pair screen with the prior whitespace helper selects the packed
128-byte scanner: Lottie minified / pretty medians are 233.395 / 367.195 us,
versus 288.175 / 555.110 us for the original scanner (19.0% / 33.9% lower
latency). The plain 64-byte version is 239.695 / 401.745 us; plain 128-byte
238.615 / 403.190 us; packed 64-byte 239.900 / 382.280 us. Median peak RSS is
essentially unchanged (about 101 MB). The packed 128-byte Wasm adds under 1%.
The expanded scalar-reference checks pass 4,395,072 cases per candidate,
including every UTF-16 code unit at every mask position.

Contemporaneous CITM controls confirm the whitespace rollback: pretty is
759.220 us at old `52786767`, 818.805 us with prefix consumption, and
739.365 us with the prior helper restored while retaining array deferral.
Minified medians are 599.235 / 591.805 / 599.855 us. The restored helper avoids
the repeatable pretty regression; this is not a claim that every compact path
improves. Evidence:
`build/perf/classic-native/whitespace/large-scanner-controls-{samples,summary}.json`,
`large-scanner-controls-paired.log`, `large-scan-differential.log`, and
`scanner-probe-source-hashes.json`.

The selected scanner and helper rollback are integrated for broad verification.
They are not yet qualified by a complete owning-native throughput sweep.


## Complete packed-scanner sweep

At `999e838f`, all 49 transform scripts pass, the scanner's four-runtime
zero-allocation differential test passes, all nine retained owning graphs pass,
and all 252 packed-consumer operations pass. The integrated Lottie binary is
byte-for-byte identical to the winning timed probe.

The complete five-pair owning-native sweep has one remaining 60% miss: CITM
pretty at 59.9%. Minified / pretty fractions are Twitter 130.1% / 103.6%;
Canada 75.3% / 76.6%; CITM 62.3% / 59.9%; Poet 145.0% / 136.2%; GitHub
64.0% / 60.7%; GSOC 97.5% / 93.0%; Lottie 77.1% / 79.0%; OTFCC 87.0%
minified; FGO 63.7% minified. Do not round the CITM miss into a 60% pass.

The current CITM profile places 24.9% of pretty self samples in Area's generated
whitespace reader; allocator insertBlock remains 23.8% pretty / 29.7% minified.
This motivates a matched whitespace scan probe before revisiting allocation.

Evidence: `build/perf/classic-native/packed-scan-all-60-{prepared,samples,result}.json`,
`packed-scan-all-60-paired.log`, `packed-scan-transform/results.json`,
`packed-scan-packed.log`, and `citm-packed-profile-summary.json`. Source fingerprint:
`586849cbb946fb502f2740bb99ee253eed064e4eac0aaf722584cc4985c71654`.
Measurements use the shared ARM64 lock, AC power and preserved process audits;
background VM work remains present, so these are not isolated release timings.


## CITM whitespace probes and fresh Map-key allocation

Reject the packed whitespace helper: six-pair medians are 738.790 us pretty
for current CITM versus 953.585 us for the candidate, despite passing scanner
and owning-graph checks. A direct existing pretty-helper route fails the
all-whitespace end-bound test and is also rejected. Scalar end-limit hoisting
and four-code-unit unrolling do not reliably improve CITM pretty (754.145 /
739.055 us versus 734.225 us control). Production keeps the existing helper.
The exhaustive whitespace fixture now checks each UTF-16 code unit at every
four-code-unit word position through the actual long-run entry.

Fresh unescaped Map keys still used global `__new`. Routing that one call to
the already qualified library-owned `allocateObject` preserves zeroing,
managed headers, GC behavior, and other-runtime fallbacks. The six-pair screen
reports CITM minified / pretty 588.655 / 733.640 us control versus 574.450 /
727.805 us candidate; GSOC 1360.175 / 1478.075 versus 1325.855 / 1406.415 us;
FGO 28026.815 versus 27814.315 us. Peak RSS increases about 0.5 / 0.8 / 1.2 MiB.
A ten-pair CITM confirmation has minified within noise (575.520 versus
578.805 us), and pretty 740.525 versus 731.405 us; seven of ten pretty pairs
improve. Treat this as a modest gain, not a settled large CITM improvement.

The permanent control/current fixture passes eight runtime/strict configurations
with varied key lengths across allocation size classes. It forces collections
inside custom value decoders under incremental GC, and retains completed Maps
and keys through explicit roots when collecting in the other runtimes. The
initial fixture's forced in-decoder Minimal collection also failed on control;
that failure is not attributed to this allocation change.

Current-source targeted whitespace, allocation-policy, ownership/reuse and
reader-tier checks pass, all nine retained owning graphs pass, and all 252
packed-consumer operations pass. This call-site change has not rerun the full
50-script transform command; the previous complete 49-script gate belongs to
`999e838f`. Source fingerprint for this targeted qualification:
`ec97876a392734f8efbc7897e8f8fada0c16af468ecfa1a9fcdb129068a0c886`.

Evidence: `build/perf/classic-native/whitespace/{packed-whitespace,word-whitespace,map-key-allocator}-controls-{samples,summary}.json`,
`whitespace/map-key-confirmation-confirmation-{samples,summary}.json`,
`key-allocator-focused.log`, `key-allocator-targeted.log`,
`key-allocator-qualification-status.json`, and `key-allocator-packed.log`.
All timing screens use the shared ARM64 lock and retain background-load audits.


## Complete Map-key sweep and next bottlenecks

At `77c5f62d`, the complete five-pair sweep clears CITM pretty at 60.9%, but
GitHub pretty is 59.8%; the all-layout 60% stage therefore still fails. GitHub's
binary is byte-for-byte unchanged from the previous 60.7% result. This is an
insufficient performance margin, not evidence of a Map-key code regression in
GitHub. Retain all sixteen layouts in the gate instead of combining favorable
rows from separate sweeps. Evidence:
`build/perf/classic-native/key-allocator-all-60-{prepared,samples,result}.json`.

The current GitHub profile attributes 27.2% minified / 22.8% pretty self samples
to trusted SIMD string-field decoding. Source order also explains a slow-path
case: one Forkee object has reordered keys. No model types or input order are
changed to avoid it. Evidence: `github-current-profile-summary.json`.

A separate FGO probe routes shared Map value-boundary scans to the existing
SIMD-aware utility. Its six-pair median is 20.233 ms versus 28.042 ms control
(27.8% lower latency), with retained output equal to the full native model.
This remains experimental; production must retain the scalar NAIVE policy.
Evidence: `whitespace/fgo-map-scan-controls-{samples,summary}.json`.

An incremental-only string allocation/copy fusion probe passes its UTF-16,
escape/null, collection and retained-output checks, plus CITM/GitHub/Lottie
owning graphs. Minimal and stub binaries are byte-identical to control. The
large Unicode fixture itself fails on the Minimal control, so it is not claimed
as a non-incremental runtime pass. Fusion timings, RTrace validation and a proper
unknown-allocator fallback are still required before production integration.
Probe sources are hashed in `copy-and-map-scan-probe-hashes.json`.


## Copied-string fusion screen (experimental)

Six paired runs give GitHub 63.670 / 68.265 us control versus 59.350 / 64.695 us
fusion (6.8% / 5.2% lower latency), with peak RSS about 1.5 MiB higher. CITM is
577.930 / 745.420 versus 584.525 / 743.980 us; Lottie 236.225 / 369.055 versus
238.335 / 369.120 us. The latter results are essentially flat or mildly worse;
do not claim a universal win. Evidence:
`build/perf/classic-native/whitespace/string-copy-fusion-controls-{samples,summary}.json`.

The prototype copies string bytes inside a private allocator clone in place of
clearing them and then copying them outside. Headers and normal GC bookkeeping
are preserved; strings are fully initialized before publication. Only the two
explicit SIMD string-copy call sites are targeted. Production integration still
needs RTrace validation and a conservative fallback for unknown allocator
bodies. Minimal/stub are not rewritten and their compiled fixture binaries are
byte-identical to control. The Unicode fixture's Minimal-control failure remains
separate characterization, not a candidate regression or passing runtime gate.
The current production source remains `77c5f62d`; neither this fusion nor the
FGO Map boundary-scanner route is integrated yet.

## Managed string copying and Map boundary dispatch

`b04a87ff` routes the shared Map reader's four value-boundary scans through
mode-aware scanning. NAIVE retains its scalar scanner; accelerated builds use
the existing SIMD/SWAR boundary utility. All twelve mode/strict/fast combinations
pass nested Raw/string/array/class/custom-codec Map checks, including escaped
keys and destination reuse. The FGO retained owning-output oracle also passes.

`9b676d01` integrates the copied-string factory. For the recognized stock
incremental allocator, its private library clone copies the string payload
where the allocator ordinarily clears it. The original global allocator,
application calls and ordinary `allocateObject` zeroing contract are unchanged.
The string is fully initialized before the factory returns. Only two explicit
SIMD string-copy sites use this capability; reused string buffers retain their
existing path. Unknown allocator bodies fall back without throwing. Minimal
and stub retain byte-identical control binaries; RTrace callers preserve their
original allocation/publication order and have identical event counts.

The new allocator unit checks cover unknown implementations, other runtimes,
name collisions, global/application allocator preservation and idempotence.
The incremental Unicode/escape/null fixture retains strings across sixteen
additional parses and an explicit collection. Its existing Minimal-control
failure remains separate characterization: binary identity is verified there,
not a passing execution of that stress fixture. The packed-consumer matrix
executes ordinary workloads under all three runtimes.

On the integrated source, all **53 transform scripts** pass, including the
new Map-boundary and copied-string tests, and the packed consumer passes
**252 operations across 36 configurations**. Evidence is retained under
`build/perf/classic-native/copy-map-production-transform/`,
`copy-map-production-{transform,packed}.log`, and
`copy-map-production-qualification.json`. All nine classic retained owning
graphs also pass against the native models. The prepared source fingerprint is
`db0e7645a9d9e773f455c97f33f9ff228acada2268ebd9d7d11da70006bbba8a`.
The completed integrated throughput sweep is recorded below; prototype timing
gains remain separate from its production measurements.

## Integrated complete 60% gate

The five-pair ARM64 sweep on `9b676d01` clears **60% on every one of the
sixteen layouts across all nine classic corpora**. The minimum is CITM pretty
at 61.45%. This uses the old classic AS harness, ordinary fresh
`JSON.parse<T>()`, existing class models, validation/cache disabled, and native
simdjson owning structs rather than DOM. GB/s counts the UTF-8 input bytes
divided by median elapsed nanoseconds; it does not include AS input transcoding.

| Corpus / layout | json-as GB/s | Native GB/s | AS / native |
|---|---:|---:|---:|
| twitter / min | 1.757 | 1.274 | 1.379× |
| twitter / pretty | 1.824 | 1.672 | 1.091× |
| canada / min | 0.568 | 0.740 | 0.767× |
| canada / pretty | 0.786 | 1.002 | 0.785× |
| citm_catalog / min | 0.865 | 1.358 | 0.637× |
| citm_catalog / pretty | 1.586 | 2.581 | 0.614× |
| poet / min | 2.873 | 1.876 | 1.531× |
| poet / pretty | 2.905 | 1.891 | 1.536× |
| github_events / min | 0.905 | 1.344 | 0.673× |
| github_events / pretty | 1.016 | 1.592 | 0.638× |
| gsoc-2018 / min | 2.541 | 2.367 | 1.073× |
| gsoc-2018 / pretty | 2.610 | 2.414 | 1.081× |
| lottie / min | 1.280 | 1.683 | 0.761× |
| lottie / pretty | 4.181 | 5.370 | 0.779× |
| otfcc / min | 1.635 | 1.915 | 0.853× |
| fgo / min | 2.394 | 2.771 | 0.864× |

These are shared-lock measurements on AC power with background-process audits,
not isolated release qualification. The complete raw record has 90 fresh-process
samples and pins the prepared source fingerprint and all input/binary hashes.
Evidence: `build/perf/classic-native/copy-map-production-all-60-{prepared,samples,result}.json`
and `copy-map-production-all-60-paired.log`.

The next floor is **70%**, not completion of the parity goal. Only CITM and
GitHub (both layouts) miss that floor in this sweep. Current-source CITM
profiling is the next action; previous prototype timings are kept as separate
evidence rather than substituted for these integrated results.

The fresh CITM profile (same current class schema and `JSON.parse` API) validates
both retained owning outputs. TLSF `insertBlock` receives 29.7% minified / 23.8%
pretty self samples, predominantly below GC `step`/`__free`. The generated
SeatCategory fast reader receives 19.4% minified samples; Area's whitespace
reader receives 24.9% pretty samples. These function attributions include
inlined work and are not proof that key matching alone consumes that time.
Trusted SIMD string-field decoding is only 1.3% minified samples. The next
investigation is therefore GC/free-list pressure plus generated Area/SeatCategory
code and its helpers, rather than another string-decoder change. Evidence:
`build/perf/classic-native/citm-copy-map-profile-{min,pretty,summary,audit}.json`
and `citm-copy-map-profile-capture.log`. This profile is attribution evidence,
not a replacement throughput result.

## CITM allocation policy screens (not integrated)

Inspection of the current generated readers confirms deferred initialization
already applies to fresh Area rows. CITM contains 8,685 empty `blockIds` arrays;
non-empty `areas` arrays are predominantly 10–16 elements. The empty-array path
already preserves separate array identities with an immutable zero-capacity
buffer, so these probes do not share mutable arrays or change the model.

A six-round CITM-only screen compares the frozen current binary with separate
allocator batch-size and reference-array capacity probes:

| Policy | Minified us | Pretty us | Peak RSS MiB |
|---|---:|---:|---:|
| Current: batch128 / capacity8 | 580.630 | 732.320 | 98.90 |
| Batch32 | 639.305 | 790.595 | 97.72 |
| Batch256 | 564.415 | 710.815 | 98.59 |
| Managed-reference capacity16 | 538.495 | 695.320 | 97.66 |

The combined batch256/capacity16 probe passes all nine retained owning-output
oracles. Its six-round all-corpus comparison improves CITM throughput by
11.2% minified / 9.9% pretty, but regresses GitHub by 3.5% / 4.6%. It is not
retained as a production optimization. Evidence:
`build/perf/classic-native/whitespace/{citm-allocation,allocation-combined}-controls-{samples,summary}.json`.

A separate six-round GitHub isolation confirms batch256 is responsible for the
regression: 61.390 / 67.170 us versus 58.680 / 63.900 us control. Reference
capacity16 alone gives 57.235 / 63.505 us, with slightly lower peak RSS. The
allocator batch-size change is rejected. The capacity-only probe now passes all
nine retained owning-output oracles and its all-corpus comparison is running;
it is not yet integrated. Numeric arrays retain capacity8, subclasses run their
constructors, and the proposed capacity choice folds at compile time.
Evidence: `whitespace/github-allocation-isolation-controls-{samples,summary}.json`
and `reference-capacity-all-preparation.json`.

These screens ran on battery power, with that state and background-process
audits preserved. They do not replace the complete native throughput gate on
the committed implementation.

## Generated-field capacity policy

The blanket capacity16 probe's complete six-round comparison preserves FGO,
GSOC and OTFCC binaries, but Poet pretty throughput falls 4.0%, so that blanket
policy is not integrated. A narrower prototype leaves the ordinary root-array
factory alone and changes only the transform's internal array-field factory.
Poet is then byte-identical too. All nine retained-output oracles pass.

The field-only six-round comparison gives CITM 7.7% / 6.4% higher throughput
with about 1.2 MiB lower peak RSS. GitHub is essentially flat (+0.3% / +0.6%);
Twitter is 0.9% / 1.3% slower, Canada is flat with about 4 MiB higher peak RSS,
and Lottie is flat. These small differences remain background-load measurements,
not isolated qualification. Evidence:
`build/perf/classic-native/whitespace/field-reference16-all-controls-{samples,summary}.json`.
FGO, GSOC, OTFCC and Poet have exact unchanged-binary hashes and were not timed
redundantly in this screen.

The production integration keeps normal root capacity8 and allocator batch128.
Only generated reference-array fields request sixteen slots; scalar fields keep
eight, subclasses run their constructors, and the empty-array path is unchanged.
The selection folds at compile time. It uses a shared internal factory parameter
rather than duplicating the allocator implementation. Expanded tests cover
fresh and reused fields, growth at 8/16/32 boundaries, alias/null preservation,
retained outputs and forced collections across three runtimes.

Initial expanded testing exposed an unrooted fixture source string across its
new explicit Minimal collection. The old-policy control reproduced the same
failure. After explicitly pinning the source across its later reuse, both
old-policy and candidate controls pass. The initial failure is retained in
`native-append-minimal-control-first.log`; rooted controls are separate files.
At `1c0899f4`, all fourteen targeted scripts pass (including the repaired
eighteen-configuration growth test), the packed consumer passes 252 operations
across 36 configurations, and all nine retained owning-output oracles pass.
The previous full 53-script gate belongs to `9b676d01`; it was not rerun for
this allocation-policy change. The production binaries for all nine corpora
are byte-identical to the measured field-only prototype. Poet, FGO, GSOC and
OTFCC additionally remain identical to the previous production binaries.
The source fingerprint is
`e9dffd225739d8b6237b56486f913c3f4b5b5c00351815f6d01278f46ab9db55`.
The complete native70 gate is recorded below. Qualification evidence:
`reference-field-production-final-qualification.json`,
`reference-capacity-production-targeted/repaired-results.json`, and
`reference-field-production-probe-equivalence.json`.

## Complete native sweep after field-capacity integration

The five-pair sweep on production source `1c0899f4` (measurement HEAD
`59377df9`) completes all sixteen layouts / ninety process samples. All layouts
retain the 60% floor; **70% still fails for both CITM and both GitHub layouts**.
CITM is 67.6% / 62.5%; GitHub 68.8% / 65.1%. This is progress toward the next
floor, not native parity. The run records AC power with background-process
audits; the earlier paired policy screens were on battery power. Cross-sweep
deltas should not replace the paired controls or be treated as isolated results.

| Corpus / layout | json-as GB/s | Native GB/s | AS / native |
|---|---:|---:|---:|
| twitter / min | 1.717 | 1.268 | 1.354× |
| twitter / pretty | 1.771 | 1.628 | 1.088× |
| canada / min | 0.569 | 0.742 | 0.767× |
| canada / pretty | 0.781 | 0.998 | 0.782× |
| citm_catalog / min | 0.928 | 1.373 | 0.676× |
| citm_catalog / pretty | 1.649 | 2.638 | 0.625× |
| poet / min | 2.937 | 1.855 | 1.583× |
| poet / pretty | 2.817 | 1.939 | 1.453× |
| github_events / min | 0.924 | 1.343 | 0.688× |
| github_events / pretty | 1.037 | 1.593 | 0.651× |
| gsoc-2018 / min | 2.469 | 2.268 | 1.089× |
| gsoc-2018 / pretty | 2.337 | 2.330 | 1.003× |
| lottie / min | 1.263 | 1.650 | 0.766× |
| lottie / pretty | 4.149 | 5.313 | 0.781× |
| otfcc / min | 1.616 | 1.875 | 0.862× |
| fgo / min | 2.394 | 2.786 | 0.859× |

Source fingerprint:
`e9dffd225739d8b6237b56486f913c3f4b5b5c00351815f6d01278f46ab9db55`.
Evidence: `build/perf/classic-native/reference-field-production-all-70-{prepared,samples,result}.json`
and `reference-field-production-all-70-paired.log`. The gate exits1 because the
70% target fails; it is a complete result, not a truncated measurement.

The fourteen targeted allocation/lifetime/construction scripts, packed consumer
(252 operations / 36 configurations), all nine retained owning outputs, and
production/prototype binary equivalence pass. The last full 53-script transform
run remains the previous `9b676d01` qualification. No release, tag or push is
performed. CITM pretty remains the first remaining bottleneck.

## Eight-space scans and empty-field publication probes

The whitespace regression now checks every UTF-16 code unit in all eight lanes
(524,288 lane/code-unit checks per configuration), in addition to mixed runs,
tails, reversed/odd bounds and the physical memory end. Control and both probes
pass ten runtime/mode configurations with zero allocations. The tests are
committed at `62e5c64c`; parser behavior is unchanged by that test-only commit.

Two bounded eight-space prefixes were measured: full-UTF16 SIMD equality and a
pair of u64 all-space comparisons, both retaining the existing four-space/scalar
tail. All retained-output checks pass for CITM/GitHub/Lottie. Six paired rounds
reject both: CITM pretty throughput falls 6.6% / 8.2%, GitHub pretty 2.7% / 4.0%,
and Lottie pretty 2.9% / 2.1%. These results are separate from the earlier
rejected 32-lane packed-classification and ctz-prefix approaches. Neither new
scan is integrated. Evidence: `whitespace-eight-qualification.json`,
`whitespace-eight-preparation.json`, and
`whitespace/whitespace-eight-controls-{samples,summary}.json`.

A separate code-generation probe suppresses a duplicate empty-array publication
barrier only when the common composite-field wrapper will publish that same
reference immediately afterward. No allocation or user callback occurs between
the store and common barrier. Instrumented paths and schema-owned publication
retain their earlier barrier. Six-round controls show CITM throughput +1.4% min
/ +1.7% pretty, GitHub near flat and Lottie min about1% lower. The three retained
owning-output oracles pass. Explicit old-owner/allocation-pressure/collection
controls pass in SWAR and SIMD, strict off/on, for old and candidate transforms.
The first callback-based fixture was ineligible for fast parsing and was replaced
with a fixture that asserts fast-reader eligibility; that initial control failure
is not a library defect. Evidence: `empty-field-link-gc-fast-controls.log`,
`empty-field-link-preparation.json`, and
`whitespace/empty-field-link-controls-{samples,summary}.json`.

The publication change is now uncommitted in the worktree with a permanent GC
fixture and is running the complete **54-script** transform gate, followed by
packed-consumer and owning-output checks. It is not yet qualified as production
or included in the completed native70 result above.

At `6f93cae9`, the publication change passes the full **54-script transform
gate**, 252 packed-consumer operations across 36 configurations, and all nine
retained owning-output oracles. CITM, GitHub and Lottie production binaries are
byte-identical to their measured publication prototypes. Only Twitter, Canada
and CITM differ from the previous production binaries; the other six are
unchanged. Source fingerprint:
`64bd9bca03ccfd94902f56804b8555393c899001c4edd4d87e2c8665761e1b1d`.
The complete native70 sweep is recorded below.
Evidence: `empty-publication-production-qualification.json`,
`empty-publication-production-transform/results.json`, and
`empty-publication-production-equivalence.json`. The frozen prior controls are
preserved with hashes in `empty-publication-control-binaries.json`.

## Complete native sweep after publication deduplication

Production source `6f93cae9` completes the five-pair, sixteen-layout sweep.
**All layouts retain60%;70% still fails for CITM and GitHub in both layouts.**
CITM is68.9% /63.1%; GitHub67.9% /65.5%. Six corpus binaries are byte-identical
to the previous production revision, so changes in their measured ratios are
variation rather than effects of publication deduplication. The run records
battery power at83% and background-load audits; do not treat these ratios or
cross-sweep deltas as isolated normal-power qualification.

| Corpus / layout | json-as GB/s | Native GB/s | AS / native |
|---|---:|---:|---:|
| twitter / min | 1.749 | 1.274 | 1.372× |
| twitter / pretty | 1.800 | 1.657 | 1.086× |
| canada / min | 0.581 | 0.759 | 0.766× |
| canada / pretty | 0.794 | 1.020 | 0.779× |
| citm_catalog / min | 0.934 | 1.356 | 0.689× |
| citm_catalog / pretty | 1.650 | 2.616 | 0.631× |
| poet / min | 2.935 | 1.881 | 1.560× |
| poet / pretty | 2.888 | 1.989 | 1.452× |
| github_events / min | 0.909 | 1.337 | 0.679× |
| github_events / pretty | 1.030 | 1.573 | 0.655× |
| gsoc-2018 / min | 2.375 | 2.211 | 1.074× |
| gsoc-2018 / pretty | 2.282 | 2.278 | 1.002× |
| lottie / min | 1.232 | 1.626 | 0.758× |
| lottie / pretty | 4.027 | 5.168 | 0.779× |
| otfcc / min | 1.607 | 1.889 | 0.851× |
| fgo / min | 2.384 | 2.783 | 0.857× |

Evidence: `build/perf/classic-native/empty-publication-production-all-70-{prepared,samples,result}.json`
and `empty-publication-production-all-70-paired.log`. All90 process samples,
prepared source/input/binary hashes and the complete16-row result are present.
The gate exits1 for an unmet70% target, not an incomplete execution. Source
fingerprint remains
`64bd9bca03ccfd94902f56804b8555393c899001c4edd4d87e2c8665761e1b1d`.

CITM pretty remains the next bottleneck. Two untested follow-up ideas are a
mixed-size native small-block stream for allocation/sweep locality, and avoiding
backing-buffer allocation before generated struct-array readers discover `[]`.
These are hypotheses, not integrated changes or claimed gains. The normal
`JSON.parse<T>()` API, existing models, owning outputs and tier-down policy
remain requirements. No tag, release or push is performed.


## Two-slot floating-point arrays: production `fe007a1b`

The production change passes all **55 transform scripts**, 252 packed-consumer
operations across 36 configurations, and all nine retained owning-output
oracles. Its new regression covers all 36 runtime/backend/strict/fast settings.
Canada's binary matches the measured two-slot prototype exactly. Seven other
corpus binaries are unchanged; Twitter's focused six-pair check is effectively
flat (+0.10% minified, -0.32% pretty). The old/new Canada comparison measures
+13.46% / +12.55% throughput with approximately 10 MiB more peak RSS.

The fresh five-pair owning-native sweep below contains all 90 process samples
and 16 layouts. **Every layout passes 60%; 70% still misses CITM and GitHub
Events in both layouts.** Canada now reaches 85.9% / 87.7% of native throughput.
This is still ordinary fresh `JSON.parse<T>()` into unchanged classic classes,
with validation and caching disabled and the incremental runtime. Native
simdjson materializes owning structs, rather than retaining a DOM.

The run records local ARM64, AC power at 97% charging, and per-process
background-load audits. It is not isolated-machine qualification; changes
between sweeps for byte-identical corpora are measurement variation. GB/s uses
UTF-8 input bytes; the AS harness receives predecoded UTF-16 as before.

| Corpus / layout | json-as GB/s | Native GB/s | AS / native |
|---|---:|---:|---:|
| twitter / min | 1.711 | 1.246 | 1.373× |
| twitter / pretty | 1.758 | 1.623 | 1.083× |
| canada / min | 0.643 | 0.748 | 0.859× |
| canada / pretty | 0.874 | 0.996 | 0.877× |
| citm_catalog / min | 0.930 | 1.355 | 0.686× |
| citm_catalog / pretty | 1.655 | 2.627 | 0.630× |
| poet / min | 2.825 | 1.752 | 1.612× |
| poet / pretty | 2.754 | 1.863 | 1.478× |
| github_events / min | 0.919 | 1.322 | 0.695× |
| github_events / pretty | 1.027 | 1.546 | 0.664× |
| gsoc-2018 / min | 2.506 | 2.315 | 1.082× |
| gsoc-2018 / pretty | 2.401 | 2.372 | 1.012× |
| lottie / min | 1.270 | 1.661 | 0.765× |
| lottie / pretty | 4.180 | 5.369 | 0.779× |
| otfcc / min | 1.627 | 1.920 | 0.847× |
| fgo / min | 2.385 | 2.791 | 0.855× |

Source fingerprint: `888b76936949c769df55e7570b6a1b9cf1aedb8fdafddfc8de6dead25bb999ca`.
Evidence under `build/perf/classic-native/`:
`float-capacity-production-qualification.json`,
`float-capacity-production-transform/results.json`,
`float-capacity-production-equivalence.json`,
`float-capacity-production-committed-source.json`, and
`float-capacity-production-all-70-{prepared,samples,result}.json` plus its paired
log. The measurement exits 1 because the 70% target is unmet, with complete
coverage and no missing samples.

The broad mixed-allocation prototype remains unintegrated; its gains and
regressions are recorded in [the allocation probe report](ALLOCATION-LOCALITY-PROBES.md).
The empty-array proposal was rejected after its GitHub timing check. Next work
remains CITM/GitHub's 70% gate, followed by the higher corpus-wide thresholds
and eventual parity.


## Scoped sweep integration: production `a97c0585`

The complete five-pair fresh native sweep now **passes 70% for every classic
layout**: nine corpora, 16 layouts, all 90 process samples present. The weakest
layout is Lottie minified at 77.96%. The next 80% gate misses only CITM pretty
(79.95%), Lottie minified (77.96%) and Lottie pretty (78.86%); parity remains
incomplete. Ratios below come directly from this paired native run, not from
applying prototype gains to a previous native baseline.

All 57 transform scripts, 252 packed-consumer operations/36 configurations and
all nine retained owning-output oracles passed. Every production benchmark
binary matches the selected prototype byte for byte. The optimization couples
mixed small-block allocation with coalescing of adjacent already-dead native
blocks inside library-triggered collector interrupts. Application allocation and
explicit collection retain their original collector functions; each managed
object retains ordinary registration and identity.

The local ARM64 run records AC power at 100% and per-process background-load
audits. It is not isolated-machine qualification. Models, the original classic
AS harness, validation/cache-off settings, fresh `JSON.parse<T>()` calls and the
incremental runtime remain unchanged. simdjson produces owning native structs;
GB/s counts UTF-8 input bytes, while AS receives predecoded UTF-16.

| Corpus / layout | json-as GB/s | Native GB/s | AS / native |
|---|---:|---:|---:|
| twitter / min | 2.389 | 1.315 | 1.817× |
| twitter / pretty | 2.268 | 1.698 | 1.336× |
| canada / min | 0.763 | 0.782 | 0.976× |
| canada / pretty | 1.040 | 1.043 | 0.997× |
| citm_catalog / min | 1.315 | 1.413 | 0.930× |
| citm_catalog / pretty | 2.166 | 2.710 | 0.799× |
| poet / min | 4.236 | 1.892 | 2.238× |
| poet / pretty | 4.024 | 1.957 | 2.056× |
| github_events / min | 1.217 | 1.373 | 0.886× |
| github_events / pretty | 1.312 | 1.599 | 0.820× |
| gsoc-2018 / min | 2.964 | 2.332 | 1.271× |
| gsoc-2018 / pretty | 2.756 | 2.476 | 1.113× |
| lottie / min | 1.306 | 1.675 | 0.780× |
| lottie / pretty | 4.324 | 5.483 | 0.789× |
| otfcc / min | 1.716 | 2.004 | 0.856× |
| fgo / min | 2.512 | 2.849 | 0.882× |

Source fingerprint: `fe8ce1728ffa56c340c61027a35801785811aea7e2352cb2e1a649de47800b79`.
Evidence: `build/perf/classic-native/sweep-production-all-70-{prepared,samples,result}.json`,
`sweep-production-all-70-paired.log`, `sweep-production-qualification.json`,
`sweep-production-transform/results.json` and `sweep-production-equivalence.json`.
The measurement exited zero and released its shared timing lock. The next
work is the remaining 80% misses, then the higher thresholds and corpus-wide
parity; this sweep does not establish completion of that goal.


## Quote-parity composite scanning: production `a112b74b`

The next full paired native sweep records all **90 process samples and 16
layouts**. Fifteen layouts exceed 80%; **CITM pretty alone misses, at 79.61%**.
All layouts retain the 70% milestone. Lottie now reaches 143.0% / 93.0% of
owning native throughput, OTFCC 163.5% and FGO 158.9%. These are measured ratios
from this run, replacing the earlier projections.

The change classifies quote parity across bounded 64-code-unit batches. A
prefix XOR removes bracket events inside strings without visiting every quote.
Backslashes within a batch or at its incoming boundary retain the scalar
escape-parity walk. Short tails and physical range limits remain unchanged;
scanning does not allocate. Models, the parse API and harness remain unchanged.

Before integration, a properly alternating six-pair comparison (108 processes)
measured +84.4% / +19.0% throughput for Lottie, +87.8% for OTFCC and +77.1% for
FGO. Other corpus/layout changes ranged from -1.5% to +4.1%. An earlier
control-first exploratory run is retained separately; decisions use the balanced
confirmation. All nine production binaries match its prototype byte for byte.

Production qualification passed seven relevant suites: expanded composite
scanning (4,461,378 differential/boundary checks per configuration, four runtime/
instrumentation configurations), V8 oracle, traversal, ownership, reader tiers,
API composition (738 checks) and capability edges (960 checks). The packed
artifact passed 252 operations across 36 configurations, and all nine complete
retained owning-output oracles passed. The earlier full 57-script gate belongs
to the preceding sweep integration, not this newer source snapshot.

The local ARM64 native sweep records battery power at 100% and per-process
background-load audits. It is not isolated normal-power qualification. AS uses
fresh `JSON.parse<T>()`, validation/cache off and the incremental runtime;
GB/s counts UTF-8 input bytes, with predecoded UTF-16 supplied to AS as before.

| Corpus / layout | json-as GB/s | Native GB/s | AS / native |
|---|---:|---:|---:|
| twitter / min | 2.407 | 1.335 | 1.803× |
| twitter / pretty | 2.280 | 1.732 | 1.316× |
| canada / min | 0.771 | 0.786 | 0.981× |
| canada / pretty | 1.048 | 1.056 | 0.992× |
| citm_catalog / min | 1.320 | 1.415 | 0.933× |
| citm_catalog / pretty | 2.160 | 2.713 | 0.796× |
| poet / min | 4.384 | 1.992 | 2.201× |
| poet / pretty | 4.151 | 2.074 | 2.001× |
| github_events / min | 1.243 | 1.382 | 0.900× |
| github_events / pretty | 1.343 | 1.652 | 0.813× |
| gsoc-2018 / min | 2.840 | 2.370 | 1.198× |
| gsoc-2018 / pretty | 2.773 | 2.389 | 1.161× |
| lottie / min | 2.411 | 1.685 | 1.430× |
| lottie / pretty | 5.135 | 5.519 | 0.930× |
| otfcc / min | 3.186 | 1.949 | 1.635× |
| fgo / min | 4.437 | 2.793 | 1.589× |

Source fingerprint: `bd416c749e5c8ecf7c97cdfe126d0afd7c81c474929bff07a2284e112c0e6c06`.
Evidence: `build/perf/classic-native/quote-parity-production-all-80-{prepared,samples,result}.json`
and its paired log, `quote-parity-production-qualification.json`,
`quote-parity-production-equivalence.json`, and
`whitespace/quote-parity-confirm-controls-{samples,summary}.json`.
The native measurement completed and exited 1 for the unmet 80% threshold;
coverage is complete and the shared timing lock was released. Next work is
CITM pretty, followed by the remaining 90% and parity gaps.


### Follow-up: combined pretty-key comparison not promoted

A prototype matched a complete key plus `": "` together, retaining the existing
general whitespace path. Its 12 reader-tier configurations and all nine complete
owning-output oracles passed. An unmodified copy of the experimental transform
produced the exact production control binary. The initial six-pair CITM check
showed +2.06% pretty throughput, but the eight-changed-corpus confirmation
(96 processes, six alternating pairs; FGO byte-identical) measured only +0.51%
for CITM pretty, -2.05% for Canada pretty and -1.62% for GitHub pretty. The
proposal remains experimental and was not applied to production.

The confirmation wrapper records a wall-clock overrun from 04:55:14 to 05:58:40
UTC on November 7, 2026, against a five-minute plan. It finished rather than
being cancelled and released the lock. The host power-management log confirms repeated sleep/dark-wake intervals
overlapping this batch, including a full wake at 05:58:32 UTC. This is not
a continuous awake-host confirmation, so its small differences are provisional. Raw samples,
audits and logs are retained under `build/perf/classic-native/whitespace/`
as `fused-pretty-key-all-controls-{samples,summary}.json`, with the paired log
and 18-step owning-output preparation record one directory above. This screen
does not change the qualified production table or its unmet CITM-pretty 80% gate.


The subsequent short awake-host confirmation completed all 36 processes across
CITM, Canada and GitHub (six alternating pairs) from 06:25:02 to 06:27:30 UTC.
It exceeded its two-minute plan by 28 seconds, finished normally and released
the lock. CITM pretty was flat (-0.14%), Canada pretty -0.89%, and GitHub pretty
-1.66%, with GitHub peak RSS +2.74 MiB. This does not support promoting the
whole-key duplication proposal. Production remains unchanged. Evidence:
`whitespace/fused-pretty-key-awake-controls-{samples,summary}.json` and
`fused-pretty-key-awake-paired.log` under `build/perf/classic-native/`.


## Verified allocator clears: production `c0752adb` passes 80%

The fresh five-pair native sweep **passes 80% for all 16 layouts**, with all
90 process samples and nine corpora present. CITM reaches 97.92% minified /
82.41% pretty. The next 90% threshold misses CITM pretty (82.41%), GitHub
minified (89.36%) and GitHub pretty (81.83%); corpus-wide parity remains open.

The change removes only redundant fresh-object payload clearing after a verified
zeroing allocation entry. Unknown allocators and other runtimes keep explicit
clears, as do instrumentation and alternate pointer layouts. Reused-object
initialization is unchanged. All 58 transform scripts, 252 packed-consumer
operations across 36 configurations and all nine complete retained owning-output
oracles passed. The 18-setting fresh-clear test verifies poisoned minimal-runtime
reuse and a failing negative control; ABI/body guard tests preserve fallback
when the actual allocator differs. Eight corpus binaries match the measured
prototype. Canada's independent production/control check is effectively flat
(-0.12% / -0.22%). See the allocation probe report for the paired controls.

This run uses local ARM64, records AC power at 100%, and retains per-process
background-load audits. It is not isolated-machine qualification. Differences
between native sweeps for unchanged binaries are variation, not effects of this
change. Ordinary fresh `JSON.parse<T>()`, unchanged classic models/harness,
validation/cache off and the incremental runtime remain in use. Native simdjson
materializes owning structs. GB/s uses UTF-8 input bytes, with AS receiving
predecoded UTF-16 as before.

| Corpus / layout | json-as GB/s | Native GB/s | AS / native |
|---|---:|---:|---:|
| twitter / min | 2.430 | 1.359 | 1.788× |
| twitter / pretty | 2.343 | 1.762 | 1.330× |
| canada / min | 0.767 | 0.797 | 0.962× |
| canada / pretty | 1.057 | 1.067 | 0.991× |
| citm_catalog / min | 1.384 | 1.414 | 0.979× |
| citm_catalog / pretty | 2.218 | 2.692 | 0.824× |
| poet / min | 4.439 | 2.033 | 2.184× |
| poet / pretty | 4.223 | 2.117 | 1.995× |
| github_events / min | 1.262 | 1.412 | 0.894× |
| github_events / pretty | 1.369 | 1.673 | 0.818× |
| gsoc-2018 / min | 3.187 | 2.513 | 1.268× |
| gsoc-2018 / pretty | 3.070 | 2.602 | 1.180× |
| lottie / min | 2.494 | 1.698 | 1.469× |
| lottie / pretty | 5.228 | 5.530 | 0.946× |
| otfcc / min | 3.250 | 2.044 | 1.590× |
| fgo / min | 4.491 | 2.856 | 1.572× |

Source fingerprint: `4030c5bc96afe7ad88a7258ba57b8279c5424ea32a798a84f8904f34de238c81`.
Evidence under `build/perf/classic-native/`:
`clear-production-all-80-{prepared,samples,result}.json`, its paired log,
`clear-production-qualification.json`, `clear-production-transform/results.json`,
`clear-production-equivalence.json` and the Canada production-control artifacts.
The threshold run exited zero and released its shared host lock. Next work is
the three remaining 90% misses and then the remaining parity gaps; this is an
80% milestone, not completion of the overall parity goal.


## Wider keyed fallback for required schemas (ARM64)

The GitHub model has a 64-field object whose keys are reordered in one event.
The previous 24-field keyed fallback limit sent it through the token-scanning
slow reader. Required schemas with 25–64 unique fields and no explicit defaults
now retain typed keyed dispatch. The missing-field mask uses `u64` above 32
fields; optional and lazy schemas retain their existing eligibility rules.

A six-pair, alternating-order comparison against the preceding production binary
used the unchanged classic harness, fresh `JSON.parse<T>()`, validation and cache
disabled, incremental GC, and owning class output. The shared host timing lock
was held for the batch. The recorded power state was battery/100%; process
audits are retained. This is a paired screen, not normal-power qualification
or a claim of an otherwise idle machine.

| GitHub layout | Previous µs/op | Wider keyed µs/op | Throughput change |
| --- | ---: | ---: | ---: |
| min | 42.700 | 38.545 | +10.8% |
| pretty | 47.830 | 43.750 | +9.3% |

Median peak process RSS increased from 85.73 to 93.98 MiB (+8.26 MiB), including
V8's compiled-code and runtime overhead. The candidate and production GitHub
binaries are identical. All eight other classic benchmark binaries are unchanged
from the preceding qualified revision. Complete retained owning outputs passed
for all nine corpora. A regression matrix covers 24/25/32/33/64/65-field schemas,
reordered keys, duplicate keys, sparse inputs, reused destinations, and typed
scalar/string/nullable/nested defaults across 12 configurations. Its slow-reader
instrumentation fails on the preceding transform and passes with the change.

Evidence under `build/perf/classic-native/`: `wide-keyed-paired.log`,
`whitespace/wide-keyed-controls-{samples,summary}.json`,
`wide-keyed-production-{prepared,equivalence}.json`, and the red/green regression
logs. This controlled comparison is separate from a fresh native parity gate.


## Owning-native refresh after wider keyed readers

At runtime revision `98fc3be8`, five process pairs per corpus (90 samples total)
covered all nine corpora and 16 layouts on ARM64. The staged 90% gate completed
with **15/16 passing** and exited 1 for the remaining CITM pretty miss. This is
not completion of the parity goal. The recorded power state was AC/100%.
Per-process audits include concurrent non-timing compilation during parts of
the run; the timing lock does not establish an otherwise idle host. CITM pretty
measured 79.8% here versus 82.4% in the preceding complete run with the identical
CITM binary, so the earlier 80% milestone is not a universal performance floor.
GitHub pretty is only narrowly over 90% and should be retained in later gates.

Both implementations use owning typed models. AS uses the original classic
harness, fresh `JSON.parse<T>()`, incremental runtime, validation/cache disabled;
native simdjson parses the JSON string into owning native structs.

| Corpus / layout | AS GB/s | Native GB/s | AS / native |
| --- | ---: | ---: | ---: |
| twitter / min | 2.410 | 1.327 | 1.816× |
| twitter / pretty | 2.299 | 1.722 | 1.335× |
| canada / min | 0.775 | 0.789 | 0.982× |
| canada / pretty | 1.049 | 1.053 | 0.996× |
| citm_catalog / min | 1.358 | 1.402 | 0.969× |
| citm_catalog / pretty | 2.133 | 2.673 | 0.798× |
| poet / min | 4.398 | 1.993 | 2.207× |
| poet / pretty | 4.191 | 2.084 | 2.011× |
| github_events / min | 1.390 | 1.411 | 0.985× |
| github_events / pretty | 1.500 | 1.666 | 0.900× |
| gsoc-2018 / min | 3.127 | 2.496 | 1.253× |
| gsoc-2018 / pretty | 3.024 | 2.588 | 1.169× |
| lottie / min | 2.411 | 1.703 | 1.416× |
| lottie / pretty | 5.166 | 5.626 | 0.918× |
| otfcc / min | 3.180 | 1.959 | 1.623× |
| fgo / min | 4.576 | 2.877 | 1.591× |

Source fingerprint: `f457892bcf17ab17bb2fa0d3a2089fad17d3bc8735a7217f6c33c8215c6d49d9`. Evidence:
`wide-keyed-all-90-{prepared,samples,result}.json` and
`wide-keyed-all-90-paired.log` under `build/perf/classic-native/`. All 59 transform
scripts and 252 packed-consumer operations / 36 configurations passed before
committing the runtime change.

A separate six-round CITM sweep-cost confirmation did not justify changing
production pacing: cost 5 improved pretty throughput 1.3% but regressed minified
1.5%; cost 2 improved pretty 0.4% and regressed minified 1.8%. The inlining-only
whitespace experiment was byte-identical to production and needed no timing run.
Evidence: `sweep-cost-confirm-paired.log`,
`whitespace/sweep-cost-confirm-controls-{samples,summary}.json`.


### Whitespace follow-up: retained hot path, corrected SIMD tail

Two further CITM experiments did not justify changing the production scanner.
Replacing the long-run scanner with SIMD mixed-whitespace masks reduced pretty
throughput 20.7%. A partial four-space prefix / `ctz` probe reduced pretty
throughput 0.9% while improving minified 0.8%. Both remain unpromoted.

The investigation exposed a correctness defect in the existing SIMD helper:
its scalar tail advanced before checking the first unit after a full vector,
including when the vector ended exactly at the supplied bound. The helper now
checks that position before advancing. Existing exhaustive whitespace tests
were extended to select both public scanners. The old helper fails; the fixed
helper passes code-unit, mixed-run, reversed/odd-bound, and physical-memory-end
checks with zero allocations across the runtime/mode configurations.

All nine retained owning graph oracles passed. Only Canada's classic binary
changes. Its preceding binary was rebuilt exactly for a six-pair comparison:
minified 2662.455 → 2665.315 µs/op (−0.1% throughput), pretty 2722.520 →
2713.140 µs/op (+0.3%), effectively flat; median peak RSS differs by 8 KiB.
The change repairs bounds handling rather than claiming a throughput gain.

Evidence under `build/perf/classic-native/`: `pretty-whitespace-tail-{red,green}.log`,
`pretty-whitespace-tail-all-preparation.log`, `pretty-whitespace-tail-prepared.json`,
`mixed-whitespace-paired.log`, `whitespace-scalar-paired.log` and
`whitespace/{mixed-whitespace,whitespace-scalar}-controls-{samples,summary}.json`.

### CITM attribution and code-layout probes

Production remains `3cdf1720`; the following diagnostic builds were not
promoted. Retained owning outputs passed for both instrumented profiles. They
exposed allocation/publication and decoding as separate call targets to separate
costs hidden by inlining. Empty-array creation accounted for roughly 8% of
samples in the first diagnostic; object allocation roughly 5%; publication
roughly 1.5%. The second diagnostic exposed whitespace at roughly 16.5% and
integer decoding at roughly 5.1%. Indirect-call instrumentation affects these
fractions: they are attribution clues, not production throughput percentages.

Two six-pair old-harness screens retained actual allocation, GC and output
semantics. They held the shared host lock and recorded power/process audits:

| CITM experiment | Minified throughput change | Pretty throughput change | Decision |
| --- | ---: | ---: | --- |
| Separate keyed fallback for plain required small structs | −0.04% | +0.76% | Unpromoted; essentially flat |
| Shared library object allocator instead of forced inlining | −17.7% | −13.6% | Rejected |

The keyed split retained three separate cold methods after adding a real compact
empty-object entry. Its 24 regression/control configurations covered empty,
reordered, duplicate, sparse and reused values. Merely removing the refill
wrapper's inline annotation produced identical Wasm and was not timed.

Evidence under `build/perf/classic-native/`: `citm-outline-{costs,decoders}-*`,
`cold-keyed-correctness.log`, `cold-keyed-paired.log`,
`outline-object-allocator-paired.log` and corresponding `whitespace/*-controls-`
`samples.json` / `summary.json`. A separate machine-code capture attempt stalled
in the OS debugger attach operation before benchmark execution; it produced no
instruction disassembly and was ended without restarting the benchmark.

### Additional CITM architectural screens

Production remains `3cdf1720`. Four further six-pair ARM64 screens used the
unchanged classic harness, fresh `JSON.parse<T>()`, validation/cache off and the
shared timing lock. Power was AC at 100%; per-process audits are retained, so
these remain paired screens rather than isolated-host release qualification.

| Experiment | Minified throughput change | Pretty throughput change | Decision |
| --- | ---: | ---: | --- |
| Decode pure small children before allocating their normal owning graph | +1.61% | −5.26% | Rejected |
| Bounded newline/indentation prefix | +0.20% | −7.37% | Rejected |
| Same prefix after the existing no-whitespace exit | −0.86% | −8.64% | Rejected |
| Outline the whole whitespace helper | −3.11% | −7.18% | Rejected |

The decode-first prototype preserved actual class identity, independent mutable
array headers and normal publication barriers. Both the unmodified control and
prototype passed 36 runtime/mode/strict/fast configurations, including bounded
GC pressure, integer extremes, fallback and reuse. This does not qualify its
experimental runtime capability guards for production.

Each scanner variant passed ten exhaustive whitespace configurations and both
retained owning CITM graphs. Whole-helper outlining reduced Wasm from 209,602
to 168,138 bytes and peak process RSS by about 10.4 MiB, but lost throughput.
None of these experiments changes production or the latest full native gate:
15 of 16 layouts pass the 90% threshold; CITM pretty remains the miss.

Evidence under `build/perf/classic-native/`: `decode-first-{correctness,controls}.log`,
`{newline-prefix,newline-gated,outline-all-whitespace}-correctness.log`, retained
`citm-*-oracle.log` files and `whitespace/<experiment>-controls-{samples,summary}.json`.

### Single scalar whitespace tail

A candidate changes only the long whitespace helper: consume full four-space
words, then finish the remaining mixed/short run with one scalar loop. The
previous outer loop retried a wide load for every residual whitespace character.
The bounded reads and existing whitespace classification remain unchanged.

An independent six-pair/four-corpus confirmation followed the initial CITM
screen. Old classic harnesses and models, fresh `JSON.parse<T>()`, incremental
GC, validation/cache off and ARM64 were retained. AC power was at 100%; process
audits are retained, and this is not an isolated-host qualification.

| Corpus | Minified throughput change | Pretty throughput change |
| --- | ---: | ---: |
| CITM | −0.18% | +5.14% |
| Canada | +0.20% | −0.76% |
| GitHub | −0.58% | +3.76% |
| Lottie | −1.13% | +1.13% |

All four retained owning graphs and ten exhaustive whitespace configurations
passed before confirmation. After integration, all nine classic retained graphs
passed and the CITM production binary matched the measured prototype exactly.
Packed consumption passed 252 operation checks over 36 configurations. All 59 transform scripts passed, including 960 capability-edge checks. The
renewed native comparison is complete below.

Evidence: `build/perf/classic-native/whitespace-single-tail-correctness.log`,
`single-tail-confirm-paired.log`, `whitespace/single-tail-confirm-controls-`
`{samples,summary}.json`, `single-tail-all-preparation.log`,
`single-tail-production-transform.log` and `single-tail-packed.log`.

The renewed five-pair, all-nine-corpus gate contains 90 fresh process samples.
All 16 layouts clear 80%; 15 clear 90%. CITM pretty remains the only 90% miss,
at 85.7% versus 79.8% in the preceding full run. That cross-run change includes
machine/run variation; the independent paired CITM estimate for the code change
is +5.14%. The goal remains active.

Throughput uses the same logical UTF-8 payload byte count divided by parse time
(decimal GB/s); the AS API still receives UTF-16 strings and native simdjson
receives padded UTF-8, as described above. These medians are audited shared-host
measurements, not an isolated-host release floor.

| Corpus | Layout | AS us | Native us | AS GB/s | Native GB/s | Native throughput reached |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| twitter | min | 191.88 | 352.84 | 2.433 | 1.323 | 183.9% |
| twitter | pretty | 268.32 | 370.13 | 2.354 | 1.706 | 137.9% |
| canada | min | 2,727.35 | 2,665.51 | 0.766 | 0.784 | 97.7% |
| canada | pretty | 2,728.23 | 2,716.72 | 1.055 | 1.060 | 99.6% |
| citm_catalog | min | 361.21 | 348.05 | 1.385 | 1.437 | 96.4% |
| citm_catalog | pretty | 490.09 | 420.18 | 2.350 | 2.742 | 85.7% |
| poet | min | 745.45 | 1,640.67 | 4.425 | 2.010 | 220.1% |
| poet | pretty | 820.36 | 1,672.39 | 4.282 | 2.101 | 203.9% |
| github_events | min | 38.82 | 37.99 | 1.374 | 1.404 | 97.9% |
| github_events | pretty | 41.51 | 38.99 | 1.568 | 1.670 | 93.9% |
| gsoc-2018 | min | 992.64 | 1,234.12 | 3.093 | 2.488 | 124.3% |
| gsoc-2018 | pretty | 1,032.32 | 1,257.98 | 3.117 | 2.558 | 121.9% |
| lottie | min | 117.69 | 168.95 | 2.455 | 1.710 | 143.6% |
| lottie | pretty | 283.36 | 263.19 | 5.256 | 5.659 | 92.9% |
| otfcc | min | 20,422.72 | 33,511.67 | 3.252 | 1.982 | 164.1% |
| fgo | min | 10,599.50 | 17,065.29 | 4.601 | 2.858 | 161.0% |

Full-gate evidence: `build/perf/classic-native/single-tail-all-90-`
`{prepared,samples,result}.json` and `single-tail-all-90-paired.log`.
Measured source fingerprint:
`6f9d6608ae996131636275bbf7d8bae159cabda51ff91ae270aba057a9a8b8c9`.

### Fused separator and value-start check

The generated required-field whitespace reader can establish that the code unit
following `: ` is above U+0020. Such a code unit cannot be whitespace, so the
reader advances directly to its typed decoder. Other spacing retains the
general before/after-colon scans. RTrace builds retain the original read
sequence. No validation, allocation, tracing or result-ownership checks are
removed.

The independent six-pair ARM64 screen uses the unchanged classic harness,
fresh `JSON.parse<T>()`, incremental runtime and validation/cache off. Power and
process audits are retained; these are shared-host screens, not an isolated
release floor. Results show a modest tradeoff:

| Corpus | Minified throughput change | Pretty throughput change |
| --- | ---: | ---: |
| CITM | −0.52% | +1.36% |
| Canada | +1.35% | +0.76% |
| GitHub | +0.21% | +1.65% |
| Lottie | −1.53% | −0.55% |

The integrated CITM Wasm matches the measured prototype byte for byte. The
permanent regression covers 37 runtime/mode/strict/fast/tracing configurations,
asserting actual shortcut execution and tracing fallback, plus extra whitespace,
Unicode keys, fresh/reused destinations, nullable Raw fields and exactly one
custom-codec call. All nine retained owning models and the packed consumer's
252 operations over 36 configurations pass. All 60 transform scripts passed, including 960 capability-edge checks. The
renewed native comparison is complete below.

Evidence under `build/perf/classic-native/`: `colon-value-start-confirm-paired.log`,
`whitespace/colon-value-start-confirm-controls-{samples,summary}.json`,
`colon-value-start-manifest.json`, `separator-value-start-permanent.log`,
`separator-value-start-transform.log`, `separator-value-start-packed.log` and
`separator-value-start-all-preparation.log`.

The renewed five-pair all-classic gate contains 90 fresh processes. All 16
layouts clear 80%; 15 clear 90%. CITM pretty is the remaining miss at 87.9%
versus 85.7% in the preceding full run. This cross-run ratio includes machine
variation: the code's independent paired CITM estimate is +1.36%, with the
Lottie tradeoff shown above. Absolute latencies should not be compared across
these separate shared-host batches as if the machine were isolated.

Decimal GB/s uses the same logical UTF-8 payload byte count divided by parse
latency. The respective APIs still receive UTF-16 AS strings and padded native
UTF-8, and native results are owning structs rather than DOM values.

| Corpus | Layout | AS us | Native us | AS GB/s | Native GB/s | Native throughput reached |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| twitter | min | 202.00 | 369.49 | 2.311 | 1.264 | 182.9% |
| twitter | pretty | 283.10 | 385.66 | 2.231 | 1.637 | 136.2% |
| canada | min | 2,808.77 | 2,784.26 | 0.744 | 0.751 | 99.1% |
| canada | pretty | 2,848.79 | 2,882.09 | 1.011 | 0.999 | 101.2% |
| citm_catalog | min | 377.39 | 361.66 | 1.326 | 1.383 | 95.8% |
| citm_catalog | pretty | 497.49 | 437.09 | 2.315 | 2.635 | 87.9% |
| poet | min | 760.83 | 1,723.32 | 4.335 | 1.914 | 226.5% |
| poet | pretty | 842.51 | 1,741.63 | 4.170 | 2.017 | 206.7% |
| github_events | min | 39.41 | 39.44 | 1.353 | 1.352 | 100.1% |
| github_events | pretty | 41.40 | 40.51 | 1.572 | 1.607 | 97.9% |
| gsoc-2018 | min | 1,070.48 | 1,326.59 | 2.868 | 2.314 | 123.9% |
| gsoc-2018 | pretty | 1,155.65 | 1,323.25 | 2.784 | 2.432 | 114.5% |
| lottie | min | 125.09 | 174.20 | 2.310 | 1.659 | 139.3% |
| lottie | pretty | 294.06 | 272.46 | 5.065 | 5.466 | 92.7% |
| otfcc | min | 20,961.53 | 34,408.55 | 3.168 | 1.930 | 164.2% |
| fgo | min | 10,664.35 | 16,655.72 | 4.573 | 2.928 | 156.2% |

Full evidence: `build/perf/classic-native/separator-value-start-all-90-`
`{prepared,samples,result}.json` and `separator-value-start-all-90-paired.log`.
Measured source fingerprint:
`5c7539d111b03415fd815622ab3b795ade01aa46bedd1ebc381848c60cfa6f73`.
The parity goal remains active.

### Direct comma matching before whitespace scanning

Generated ordered whitespace readers now consume an already-present comma
directly. A comma cannot be whitespace; other input retains the original
scan/check/advance sequence. RTrace builds retain that original sequence too.
The permanent separator regression now independently counts both shortcuts and
covers whitespace before commas, codecs, reuse, Unicode and tracing fallback.
All 37 configurations pass.

The independent six-pair ARM64 screen retained the old harness, fresh
`JSON.parse<T>()`, validation/cache off and owning class models:

| Corpus | Minified throughput change | Pretty throughput change |
| --- | ---: | ---: |
| CITM | +0.86% | +1.93% |
| Canada | −0.54% | −0.82% |
| GitHub prototype | −0.17% | −0.69% |
| Lottie | −1.19% | +0.85% |

Integrated CITM, Canada and Lottie binaries exactly match their prototypes.
GitHub also receives the same check in wide-reader helpers, so its actual
production binary was measured independently in all six orders against both
the previous source and prototype. Production was +1.40% minified and +0.11%
pretty versus the previous source. No material regression was established in
that screen.

Current validation: seven relevant transform scripts pass (reader tiers,
parser regressions, API composition, key dispatch, ownership allocation,
diagnostics and scalar composition), along with the extended 37-configuration
regression, all nine retained owning graphs and 252 packed-consumer operations
over 36 configurations. The preceding source passed all 60 transform scripts;
the entire 60-script gate was not repeated for this change.

The renewed native gate has 90 fresh-process samples. All 16 layouts clear 80%,
and 15 clear 90%. CITM pretty remains the miss, at 88.8% versus the preceding
run's 87.9%. Cross-run ratios include machine variation; +1.93% above is the
paired estimate for this code change. Power/process audits and all samples,
including an outlying GSOC launch, are retained. This is a shared-host result,
not an isolated release floor. Logical UTF-8 bytes normalize decimal GB/s;
the respective APIs continue to receive AS UTF-16 and padded native UTF-8.

| Corpus | Layout | AS us | Native us | AS GB/s | Native GB/s | Native throughput reached |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| twitter | min | 190.72 | 341.79 | 2.448 | 1.366 | 179.2% |
| twitter | pretty | 264.36 | 355.49 | 2.389 | 1.776 | 134.5% |
| canada | min | 2,732.26 | 2,704.29 | 0.765 | 0.773 | 99.0% |
| canada | pretty | 2,766.52 | 2,758.02 | 1.041 | 1.044 | 99.7% |
| citm_catalog | min | 364.75 | 350.47 | 1.372 | 1.428 | 96.1% |
| citm_catalog | pretty | 475.67 | 422.56 | 2.422 | 2.726 | 88.8% |
| poet | min | 751.27 | 1,647.77 | 4.391 | 2.002 | 219.3% |
| poet | pretty | 832.15 | 1,684.68 | 4.221 | 2.085 | 202.4% |
| github_events | min | 38.53 | 37.99 | 1.384 | 1.404 | 98.6% |
| github_events | pretty | 40.70 | 39.09 | 1.600 | 1.665 | 96.0% |
| gsoc-2018 | min | 1,049.05 | 1,286.36 | 2.926 | 2.387 | 122.6% |
| gsoc-2018 | pretty | 1,104.60 | 1,301.48 | 2.913 | 2.472 | 117.8% |
| lottie | min | 122.21 | 172.70 | 2.364 | 1.673 | 141.3% |
| lottie | pretty | 287.44 | 270.61 | 5.181 | 5.503 | 94.1% |
| otfcc | min | 20,548.30 | 33,525.57 | 3.232 | 1.981 | 163.2% |
| fgo | min | 10,694.88 | 16,806.86 | 4.560 | 2.901 | 157.1% |

Evidence under `build/perf/classic-native/`: `comma-shortcut-confirm-paired.log`,
`comma-github-production-paired.log`, corresponding `whitespace/*-controls-`
`{samples,summary}.json`, `comma-targeted/results.json`,
`comma-production-correctness.log`, `comma-packed.log`, `comma-all-preparation.log`
and `comma-all-90-{prepared,samples,result}.json` / `comma-all-90-paired.log`.
Measured source fingerprint:
`9e3e148899402edb36a9df3998c5e1b72b2b81a0c5058067b151a78a72ee5dd9`.
The parity goal remains active.


### Eliding a proven static numeric-array edge

The scoped incremental marker now skips the native member visitor for exact
`Array<i64>` instances backed by static storage. The stock visitor's only edge
for that type is its buffer, and a static buffer cannot require marking.
Heap-backed buffers and subclass fields retain the original visitor. Collector
colors, pacing, registration, publication and explicit collection are unchanged.
The transform enables this only when schema metadata already proves use of the
array type, the installed Array source and AST match the recognized layout, and
no global Array/scalar alias overrides the meaning. Existing instrumentation,
finalizer, runtime and allocator guards remain in force.

The integrated CITM binary exactly matches the measured prototype. All eight
other classic binaries are byte-identical to the preceding production source;
the schema gate avoids adding otherwise-unused type machinery to them.
A twelve-pair CITM confirmation measured 364.700 -> 359.315 us minified
(+1.50% throughput) and 474.640 -> 472.605 us pretty (+0.43%). Eleven minified
pairs and ten pretty pairs improved; paired median gains were +1.52%/+0.78%.
This is a modest improvement, not the larger first-screen estimate.

All 60 transform scripts passed on the integrated implementation. After adding
conservative global-alias guards, the transform was rebuilt and the expanded
activation/source/AST/alias tests, 12 mode/strict/fast pressure configurations,
24 exact-binary fallback/finalizer configurations, all nine retained owning
model oracles, and the packed consumer (252 operations / 36 configurations)
passed again. The untimed observer proves 2,220 visitor elisions while retaining
growing heap-backed arrays and a subclass's managed field. The full 60-script
matrix was not repeated after those final guard-only additions.

The fresh native gate completed 90 processes and passes 90% on all 16 layouts.
CITM pretty reaches only 90.1%, so this is a narrow milestone, not a stable
normal-power floor or proof that the remaining parity work is complete.
The gate started on battery at 100%; process audits and every sample are
retained. Ratios vary across shared-host batches, including unchanged binaries;
the paired AS-vs-AS figures above are the estimate for the code change.
The old harness, fresh JSON.parse-to-class API, owning native structs,
validation/cache-off settings, and logical UTF-8 normalization are unchanged.

| Corpus | Layout | AS us | Native us | AS GB/s | Native GB/s | Native throughput reached |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| twitter | min | 198.06 | 361.90 | 2.357 | 1.290 | 182.7% |
| twitter | pretty | 276.86 | 376.83 | 2.281 | 1.676 | 136.1% |
| canada | min | 2,764.41 | 2,685.86 | 0.756 | 0.778 | 97.2% |
| canada | pretty | 2,800.30 | 2,765.57 | 1.028 | 1.041 | 98.8% |
| citm_catalog | min | 371.10 | 364.10 | 1.348 | 1.374 | 98.1% |
| citm_catalog | pretty | 488.47 | 440.11 | 2.358 | 2.617 | 90.1% |
| poet | min | 757.36 | 1,660.94 | 4.355 | 1.986 | 219.3% |
| poet | pretty | 829.63 | 1,699.16 | 4.234 | 2.067 | 204.8% |
| github_events | min | 38.91 | 38.29 | 1.371 | 1.393 | 98.4% |
| github_events | pretty | 41.06 | 39.51 | 1.586 | 1.648 | 96.2% |
| gsoc-2018 | min | 1,005.31 | 1,261.85 | 3.054 | 2.433 | 125.5% |
| gsoc-2018 | pretty | 1,052.33 | 1,264.26 | 3.058 | 2.545 | 120.1% |
| lottie | min | 120.53 | 172.25 | 2.397 | 1.677 | 142.9% |
| lottie | pretty | 287.21 | 270.32 | 5.185 | 5.509 | 94.1% |
| otfcc | min | 20,340.97 | 32,910.72 | 3.265 | 2.018 | 161.8% |
| fgo | min | 10,650.42 | 16,920.26 | 4.579 | 2.882 | 158.9% |

Evidence under `build/perf/classic-native/`: `scoped-static-array-visit-long-`
`paired.log` and corresponding `whitespace/*-controls-{samples,summary}.json`,
`static-array-scan-transform/results.json`, `static-array-scan-final-`
`{qualification,runtime,guards,preparation,packed}.log`,
`static-array-scan-final-binary-proof.json`, and `static-array-scan-all-90-`
`{prepared,samples,result}.json` / `static-array-scan-all-90-paired.log`.
Measured source fingerprint:
`c173cfc5b3e1d92a426cdb0b8d6963fb41e69f79d9c41486df688f1939fdb593`.
The parity goal remains active.


## Bounded nine-digit integer fields

The signed SWAR/SIMD field scanners recognize an exact nine-digit run before
entering the general four-digit/scalar loop. A bounded ten-code-unit window
proves that the ninth character is a digit and the tenth is a terminator;
only then is the eight-digit prefix validated and folded. SWAR uses the
existing pair-multiply helper, SIMD its existing eight-digit helper. Other
lengths retain the general scan, and RTrace retains its original load sequence.
Typed truncation, signs, default initialization, tiers, models and allocation
policy are unchanged.

The first pair-multiply-only prototype improved CITM but introduced small
neighbor costs. The SIMD variant reproduced CITM gains in two independent
balanced four-corpus comparisons. Its complete nine-corpus, six-pair
confirmation (108 processes) measured the following throughput changes against
the preceding production binaries:

| Changed corpus | Minified | Pretty |
| --- | ---: | ---: |
| Twitter | -0.34% | -0.36% |
| CITM | +2.58% | +3.52% |
| GitHub | -0.69% | +0.58% |
| Lottie | +0.02% | -0.44% |

Canada, Poet, GSOC, OTFCC and FGO binaries are byte-for-byte unchanged.
Their observed timing differences illustrate host variability. The alternate
first-four-digit-reuse prototype was not promoted: its CITM gains were smaller.
Both successful prototypes passed 3,814,216 differential checks, including
every UTF-16 code unit in each prefix/tail position, signed inputs, widths,
offsets, long runs and physical memory boundaries.

The integrated implementation passes an independent ASCII/BigInt oracle with
2,765,490 checks and twelve mode/strict/fast API configurations, parser
regressions, the scalar-composition oracle, boundary checks and the packed
consumer (252 operations across 36 configurations). All nine full owning-graph
oracles pass; the production binaries match the measured SIMD prototype
exactly. The complete transform/RFC suites were not repeated for this change.

Evidence under `build/perf/classic-native/`: `integer-nine-simd-neighbors-`
`paired.log`, corresponding `whitespace/*-controls-{samples,summary}.json`,
`integer-nine-production-tests.json`, `integer-nine-final-binary-proof.json`,
and `integer-nine-host.json`. The paired run started on AC power at 100% on
Apple M4 Max ARM64. These are shared-host results, not an isolated floor.

The final exact-source native gate completed 90 processes and again passes
90% on all 16 layouts. The lowest fraction is Lottie pretty at 92.5%;
95% and full parity remain open. The old classic harness, fresh `JSON.parse`
to classes, validation/cache-off settings, owning native structs and logical
UTF-8 normalization are unchanged. Cross-batch ratios include host variation;
use the paired figures above to estimate this change.

| Corpus | Layout | AS us | Native us | AS GB/s | Native GB/s | Native throughput reached |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| twitter | min | 202.70 | 366.75 | 2.303 | 1.273 | 180.9% |
| twitter | pretty | 280.58 | 383.58 | 2.251 | 1.646 | 136.7% |
| canada | min | 2,686.41 | 2,637.16 | 0.778 | 0.793 | 98.2% |
| canada | pretty | 2,718.43 | 2,724.97 | 1.059 | 1.056 | 100.2% |
| citm_catalog | min | 348.54 | 347.24 | 1.435 | 1.441 | 99.6% |
| citm_catalog | pretty | 452.76 | 421.69 | 2.544 | 2.732 | 93.1% |
| poet | min | 745.15 | 1,638.18 | 4.427 | 2.013 | 219.8% |
| poet | pretty | 816.58 | 1,671.61 | 4.302 | 2.101 | 204.7% |
| github_events | min | 38.74 | 38.25 | 1.377 | 1.394 | 98.7% |
| github_events | pretty | 40.98 | 39.49 | 1.589 | 1.648 | 96.4% |
| gsoc-2018 | min | 981.45 | 1,236.26 | 3.128 | 2.483 | 126.0% |
| gsoc-2018 | pretty | 1,032.04 | 1,247.98 | 3.118 | 2.578 | 120.9% |
| lottie | min | 117.18 | 169.73 | 2.466 | 1.702 | 144.8% |
| lottie | pretty | 284.08 | 262.79 | 5.242 | 5.667 | 92.5% |
| otfcc | min | 20,309.05 | 34,843.60 | 3.270 | 1.906 | 171.6% |
| fgo | min | 10,607.55 | 16,594.76 | 4.597 | 2.939 | 156.4% |

Final native evidence: `integer-nine-all-90-{prepared,samples,result}.json`
and `integer-nine-all-90-paired.log`. Measured source fingerprint:
`e7682776d5f733eeedd618df08c43b1ab055aec390ab57616769000ff70530a3`.


## Optional-field lookahead motion

Whitespace readers normalize the next key once and keep that position when a
field is absent. After a present field finishes decoding, its arm prepares the
next lookahead. This removes repeated whitespace/comma scans without a dynamic
validity flag, extra tier, persistent cache or changes to value readers. The
first lookahead remains unconditional. RTrace retains the original per-field
preparations and load sequence. Missing-field bits and default evaluation
remain in their original order.

The earlier pointer-comparison guard was not promoted because of its
minified/pretty tradeoff. The new code-motion prototype passed 37 mode/runtime/
strict/fast/instrumentation configurations and all nine retained owning-graph
oracles. Production binaries match the timed prototype exactly. Only Twitter,
GitHub and Lottie change; the other six corpus binaries are identical.

An independent twelve-pair, three-corpus confirmation (72 fresh processes)
measured the following throughput changes against the preceding production
binaries, with essentially flat RSS:

| Changed corpus | Minified | Pretty |
| --- | ---: | ---: |
| Twitter | +0.35% | +1.75% |
| GitHub | +0.54% | +2.67% |
| Lottie | -0.73% | +1.50% |

The permanent preparation-count regression fails on the prior implementation:
a reused six-field object with no supplied fields performs six lookahead
preparations instead of one. The new implementation passes 37 configurations,
including all 64 presence masks in minified and pretty layouts, fresh and
reused destinations, direct value assertions, nested arrays, reordered and
duplicate keys, nullable Raw fields, effects, and traced preparation counts.

The two-space whitespace-tail prototype was also checked but rejected: it
passed the whitespace/property/ownership oracles yet measured -0.31% minified
and -0.78% pretty on CITM. Its smaller code footprint did not establish a win.

Raw evidence is under `build/perf/classic-native/`: `optional-motion-confirm-`
`paired.log`, `whitespace/optional-motion-confirm-controls-{samples,summary}.json`,
`optional-motion-permanent-red.log`, `optional-motion-production-green.log`,
`optional-motion-production-binary-proof.json` and
`optional-motion-production-qualification.log`. These are shared-host ARM64
measurements, not an isolated floor.

All 62 commands from the package's transform-test list passed on the integrated
implementation, including 960 capability checks and both new scanner/lookahead
regressions. Packed-consumer verification passed 252 operations across
36 configurations. The transform rebuild passed. The full ordinary/RFC suites
were not repeated for this change.

The final native gate completed all 90 processes. All 16 layouts remain above
90%, and 14 clear 95%. Pretty CITM and pretty Lottie still miss the 95% target,
so the gate exits 1 as expected for that open performance target. This is a
completed measurement, not an incomplete run or a correctness-test failure.
The original fresh-class API, old harness, validation/cache-off settings,
owning native structs and logical UTF-8 normalization are unchanged.

| Corpus | Layout | AS us | Native us | AS GB/s | Native GB/s | Native throughput reached |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| twitter | min | 193.08 | 351.84 | 2.418 | 1.327 | 182.2% |
| twitter | pretty | 264.94 | 367.65 | 2.384 | 1.718 | 138.8% |
| canada | min | 2,680.32 | 2,661.98 | 0.780 | 0.785 | 99.3% |
| canada | pretty | 2,760.44 | 2,764.18 | 1.043 | 1.041 | 100.1% |
| citm_catalog | min | 348.31 | 349.85 | 1.436 | 1.430 | 100.4% |
| citm_catalog | pretty | 451.48 | 422.75 | 2.551 | 2.725 | 93.6% |
| poet | min | 742.40 | 1,637.67 | 4.443 | 2.014 | 220.6% |
| poet | pretty | 816.44 | 1,665.81 | 4.303 | 2.109 | 204.0% |
| github_events | min | 38.19 | 37.86 | 1.396 | 1.408 | 99.1% |
| github_events | pretty | 39.56 | 38.96 | 1.646 | 1.671 | 98.5% |
| gsoc-2018 | min | 968.72 | 1,222.39 | 3.169 | 2.511 | 126.2% |
| gsoc-2018 | pretty | 1,024.04 | 1,248.47 | 3.142 | 2.577 | 121.9% |
| lottie | min | 118.06 | 172.07 | 2.447 | 1.679 | 145.7% |
| lottie | pretty | 280.63 | 262.80 | 5.307 | 5.667 | 93.6% |
| otfcc | min | 20,158.80 | 32,572.86 | 3.294 | 2.039 | 161.6% |
| fgo | min | 10,592.90 | 16,587.44 | 4.604 | 2.940 | 156.6% |

Final native evidence: `optional-motion-all-95-{prepared,samples,result}.json`
and `optional-motion-all-95-paired.log`. Measured source fingerprint:
`7948143e9735708d3183fe3ac5743401fee998dfee0e651e0781678b556f6b9f`. Cross-batch ratios include shared-host variability;
use the independent paired AS-vs-AS figures above for the change estimate.
The parity goal remains active.

### Empty-array publication locals

The required ordered readers keep a newly created scalar-array pointer in a
local until the existing common publication barrier. Reused arrays and the
nonempty reader reload the actual field after callbacks. Nullable fields,
manual readers, optional/keyed dispatch, tracing, profiling and finalizers keep
their previous publication arguments. No allocation or GC barrier is removed.

The source emitter produces exactly the measured prototype binary for every
classic corpus. All nine retained owning-model oracles pass. Independent
12-pair ARM64 candidate/control measurements give:

| Corpus | Min throughput change | Pretty throughput change |
|---|---:|---:|
| Twitter | +0.19% | +0.73% |
| Canada | -0.34% | +0.29% |
| CITM | +1.64% | +0.81% |

The other six corpus binaries are identical to the control. RSS is essentially
unchanged in these paired samples. These small shared-host changes are not an
isolated performance floor; they do not establish all-corpus parity.

Evidence: `whitespace/empty-phi-neighbors-controls-{samples,summary}.json`,
`empty-phi-production-all-preparation.json`, and the corresponding per-corpus
preparation logs under `build/perf/classic-native`. The new publication test
observes actual publication arguments and field reloads for fresh/reused empty
arrays, nonempty arrays, callbacks, compact/whitespace input, all three runtimes
and modes, strict/fast switches, and trace/profile builds.

Qualification: all 63 commands in `test:transform` pass, including the
38-configuration publication regression and the full capability matrix.
The packed artifact passes 252 operations across 36 configurations. The full
ordinary/RFC suites were not rerun for this change. Current source fingerprint:
`6bbde3e32998b1602ebb2d492fdbd16b4f29313dc826522a016f7befa63dcd80`.

### Publication-local full native comparison (`7f99285a`)

All 90 comparison processes completed on ARM64, AC power at 100%, with the
same classic class models, fresh `JSON.parse<T>()` results, validation/cache
disabled, and simdjson owning structs. All 16 layouts exceed 90%; 14 meet 95%.
CITM pretty (93.9%) and Lottie pretty (94.1%) still miss the 95% target. The
runner exits 1 for that unmet target; the run itself is complete.

| Corpus | Layout | json-as GB/s | simdjson GB/s | Throughput delta |
|---|---|---:|---:|---:|
| twitter | min | 2.462 | 1.374 | +79.1% |
| twitter | pretty | 2.476 | 1.778 | +39.3% |
| canada | min | 0.792 | 0.805 | -1.6% |
| canada | pretty | 1.078 | 1.075 | +0.3% |
| citm_catalog | min | 1.465 | 1.434 | +2.2% |
| citm_catalog | pretty | 2.579 | 2.747 | -6.1% |
| poet | min | 4.409 | 2.031 | +117.2% |
| poet | pretty | 4.286 | 2.126 | +101.6% |
| github_events | min | 1.399 | 1.430 | -2.2% |
| github_events | pretty | 1.651 | 1.686 | -2.1% |
| gsoc-2018 | min | 3.193 | 2.521 | +26.6% |
| gsoc-2018 | pretty | 3.142 | 2.618 | +20.0% |
| lottie | min | 2.430 | 1.696 | +43.3% |
| lottie | pretty | 5.327 | 5.661 | -5.9% |
| otfcc | min | 3.297 | 2.054 | +60.5% |
| fgo | min | 4.551 | 2.923 | +55.7% |

Evidence: `empty-phi-production-all-95-{prepared,samples,result}.json` and
`empty-phi-production-all-95-paired.log`. Source fingerprint remains
`6bbde3e32998b1602ebb2d492fdbd16b4f29313dc826522a016f7befa63dcd80`.
These are shared-host measurements; use the paired AS/control results above
to estimate the optimization itself, rather than cross-batch ratio changes.

### Exact SIMD bracket classification

The packed composite scanner recognizes the four brackets with the exact byte
predicate `((byte - '[') & 0xdd) == 0`, using wrapping byte subtraction. The four
accepted offsets are 0, 2, 32 and 34; all other bits must be clear. Quotes retain
their separate comparison. Saturated non-ASCII lanes cannot match. This removes
a vector comparison/merge from each packed classifier without adding a branch,
changing escape handling, or changing the nesting walk.

Independent 12-pair Lottie confirmation improves min throughput by 2.21% and
pretty by 2.51% using ratios of median times. Pretty wins all 12 pairs (median
paired gain 2.62%). The all-nine-corpus six-pair screen also improves OTFCC by
1.91% and FGO by 2.79%. An independent 12-pair check of neighboring corpora is
essentially flat for CITM and Poet; GitHub pretty is about 0.1–0.2% lower.
These small neighboring differences remain subject to shared-host variability.

The four-configuration scanner differential suite passes randomized structures,
every UTF-16 code unit in every wide lane, escape runs, truncation and physical
memory ends with zero allocations. All nine retained owning-model oracles pass,
and production binaries exactly match their measured prototypes in every corpus.
The earlier bulk-depth and singleton-guard experiments remain unpromoted because
they slow pretty input.

Evidence under `build/perf/classic-native`: `composite-subtract-confirm-paired.log`,
`composite-subtract-all-paired.log`, `composite-subtract-neighbors-paired.log`,
`whitespace/composite-subtract-{confirm,all,neighbors}-controls-{samples,summary}.json`,
and `composite-subtract-production-all-preparation.json`.

Production qualification: all 63 transform scripts pass, including the exhaustive
scanner differential suite and capability matrix. The packed artifact passes
252 operation checks across 36 configurations. The full ordinary/RFC suites
were not rerun for this isolated classifier change. Current source fingerprint:
`87ddc83ee9e170522ae0e20240d19d53d7a7df91256ec25a504fc71e1144f878`.

### Simplified-classifier full native comparison (`d2814638`)

All 90 processes completed with full classic coverage on ARM64, AC power,
unchanged native class models and fresh `JSON.parse<T>()` results. Validation
and caching remain disabled; simdjson constructs owning structs. Fifteen of
16 layouts meet 95%. Pretty Lottie reaches 98.6%; pretty CITM remains at 93.2%,
so the all-layout target and parity objective remain open. Exit 1 reports that
remaining threshold miss, rather than an incomplete run.

| Corpus | Layout | json-as GB/s | simdjson GB/s | Throughput delta |
|---|---|---:|---:|---:|
| twitter | min | 2.431 | 1.332 | +82.4% |
| twitter | pretty | 2.411 | 1.729 | +39.4% |
| canada | min | 0.792 | 0.791 | +0.1% |
| canada | pretty | 1.071 | 1.058 | +1.2% |
| citm_catalog | min | 1.436 | 1.435 | +0.1% |
| citm_catalog | pretty | 2.562 | 2.748 | -6.8% |
| poet | min | 4.289 | 1.993 | +115.2% |
| poet | pretty | 4.229 | 2.077 | +103.6% |
| github_events | min | 1.399 | 1.406 | -0.5% |
| github_events | pretty | 1.649 | 1.672 | -1.3% |
| gsoc-2018 | min | 3.170 | 2.489 | +27.4% |
| gsoc-2018 | pretty | 3.144 | 2.585 | +21.6% |
| lottie | min | 2.526 | 1.706 | +48.0% |
| lottie | pretty | 5.459 | 5.539 | -1.4% |
| otfcc | min | 3.341 | 2.018 | +65.5% |
| fgo | min | 4.714 | 2.910 | +62.0% |

Evidence: `composite-subtract-production-all-95-{prepared,samples,result}.json`
and `composite-subtract-production-all-95-paired.log`. Source fingerprint:
`87ddc83ee9e170522ae0e20240d19d53d7a7df91256ec25a504fc71e1144f878`.
As before, shared-host cross-batch ratio changes do not measure the isolated
change. The independent paired CITM confirmation above was essentially flat.
