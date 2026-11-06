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
