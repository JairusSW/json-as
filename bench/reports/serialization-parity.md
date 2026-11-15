# Native-struct serialization parity

**Methodology correction:** the historical native rows below used minified
input while the AS classic writers usually serialized a pretty-derived model.
This is materially unequal for Lottie: preserved raw fields make the AS output
about 1.48 MB versus native's 0.30 MB. Historical captures remain available,
but their Lottie throughput and parity ratios are superseded. The runner now
discovers the AS writer's actual initialization input and uses that layout for
native serialization and output-byte accounting. Source-aligned qualification
is reported below; the isolated AS-before/after screens are unaffected.

Latest full qualification: [numeric-row implementation `abd0b5db`](#full-native-refresh-at-abd0b5db). Three of nine workloads meet the 90% gate; near parity remains unmet.

Work in progress on `jairus/serialize-parity`. The target is near parity with
simdjson's fresh owning-struct serialization across the classic corpus. The
initial three-corpus screen is not whole-corpus qualification.

## Initial baseline

Measured on local ARM64, on AC power, with the shared host timing lock.
Runtime/host versions, binary and source hashes, power state, process audits,
and every sample are in the [raw capture](data/serialize-parity-baseline-6a37efd7.json.gz).
The json-as implementation is main at `6a37efd7`; the only code change for this
capture is the serialization phase added to the paired comparison runner.

| Corpus | json-as µs | simdjson µs | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|---:|---:|
| Twitter | 134.67 | 45.59 | 3.55 | 10.47 | 0.34× |
| Canada | 2541.57 | 1706.70 | 0.82 | 1.22 | 0.67× |
| CITM | 264.75 | 49.34 | 1.89 | 10.14 | 0.19× |

Numbers are medians of five alternating fresh-process pairs, SIMD json-as with
the incremental runtime, compatibility mode, validation disabled, and fast
readers enabled. Both writers serialize complete owned models to fresh strings
on every operation; the simdjson adapter does not cache serialized output.
The original classic AS harness, including its warmup and allocation behavior,
is retained. This is warmed-code serialization of an existing object, not
latency of the first call in a fresh module. GB/s uses each writer's actual
UTF-8 output length; json-as internally produces UTF-16 strings.

Before timing, complete model outputs were checked against integer-preserving
oracles, including retained models serialized after input disposal and GC.
Native output is also checked after every process invocation. Preparation seals
sources, runtime files and binaries; measurement rejects changed seals.

The 90% gate failed on all three initial corpora. CITM is the first profiling
target. Runtime optimization, paired before/after qualification, remaining
classic coverage, and a final performance verdict are outstanding.

## Reservation policy experiment

An allocation trace of warmed CITM serialization found four large allocations
per call: approximately 1.02 MB, 1.27 MB, 1.59 MB, then a 1.00 MB final output.
Generated field reservations exceed actual output size, so learning capacity
from the final length repeatedly underestimates the managed writer's demand.

The candidate retains reusable staging when reservation demand exceeds output
length by more than 25%. The same probe then records one large allocation.
The permanent synthetic integer-record regression fails on the baseline with
nine large allocations per warmed output and passes with one on the candidate.
Output retention and size transitions pass on all three backends and runtimes;
allocation counts are asserted only on incremental/minimal because stub does
not provide allocator trace callbacks. Static-output regressions pass 117 checks.

An isolated serialization-only CITM screen then measured six alternating
fresh-process pairs under the shared timing lock: median baseline 245.275 µs,
candidate 144.55 µs, a 41.1% latency reduction (1.70× throughput).
Both binaries used the same named-function profiling build and model source.
This establishes a local before/after effect, not a revised native parity ratio.
The regular harness and remaining classic corpora still need qualification.
The [screen capture](data/serialization-reservation-screen.json.gz) retains
all samples, logs, binary hashes, candidate patch, model source and CPU capture.
The profile processor warned of a V8 version mismatch, so native-symbol labels
should not be interpreted; named Wasm allocation/GC frames corroborate churn.

## Regular-harness requalification after reservation change

Five process pairs, same machine and settings, commit `d04de7ee`:

| Corpus | json-as µs | simdjson µs | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|---:|---:|
| Twitter | 137.22 | 45.90 | 3.48 | 10.40 | 0.33× |
| Canada | 2556.18 | 1675.46 | 0.82 | 1.25 | 0.66× |
| CITM | 147.26 | 48.96 | 3.40 | 10.22 | 0.33× |

All complete-output oracles passed. CITM's latency is 44.4% below the original
screen; Twitter and Canada are roughly flat. These regular-harness captures
were sequential before/after batches, unlike the alternating binary screen
above, so small changes must not be treated as statistically established wins
or losses. The [raw capture](data/serialization-reservation-native.json.gz)
retains all samples and provenance. The 90% gate still fails on all three.

## Learn reservation demand below the fallback threshold

Twitter still made three large allocations per warmed output: approximately
0.84 MB, 1.05 MB and a final 0.83 MB. Its reservation demand was below the
staging fallback threshold but above the hint learned from final output size.
The next change learns reservation demand as well as output length, capped at
the existing 25% retained-slack limit. The probe then records one 0.92 MB
allocation. A synthetic string-heavy regression reproduces the three-to-one
allocation change, with retained-output checks across all nine configurations.

A six-pair alternating Twitter writer screen measures median baseline
137.47 µs and candidate 87.28 µs: 36.5% lower latency, 1.58× throughput.
The [raw screen](data/serialization-demand-hint-screen.json.gz) retains samples,
logs, binary hashes, model source, code patch and the preceding CPU capture.
This is an isolated before/after screen; regular-harness native ratios and
full classic coverage still need requalification.

The later `316baea7` run is retained as a [superseded raw capture](data/serialization-316baea7-unmatched-layout.json.gz)
because it completed before source-layout matching was corrected. It must not
be used for a Lottie parity verdict.

## All-classic qualification at `420b0ed0`

Five alternating process pairs on local ARM64/AC power, the same harness
and flags, and all complete-output oracles passing:

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 5.46 | 10.44 | 0.52× |
| canada | 0.90 | 1.24 | 0.73× |
| citm_catalog | 3.46 | 10.28 | 0.34× |
| poet | 14.12 | 24.00 | 0.59× |
| github_events | 4.88 | 15.68 | 0.31× |
| gsoc-2018 | 6.81 | 16.70 | 0.41× |
| lottie | 3.86 | 13.65 | 0.28× |
| otfcc | 27.50 | 23.62 | 1.16× |
| fgo | 29.15 | 20.76 | 1.40× |

Only OTFCC and FGO pass the 90% threshold; the whole gate fails.
The [raw capture](data/serialization-all-420b0ed0.json.gz) retains all process
samples, logs and provenance. Raw-heavy results do not establish typed-field
serialization parity on the other models.

## Guarded output-string allocation

On the recognized incremental allocator, freshly allocated string payloads are
normally cleared before being overwritten. The candidate clones the verified
allocator for the library's output helper, preserving allocation checks, GC
interrupts, object headers, list linking, and accounting. Non-string IDs and
allocation tracing retain the clear; unknown allocator bodies/runtimes and
existing native uninitialized-allocation support retain their original paths.

A six-pair Twitter writer screen measures median 87.21 µs with ordinary
allocation versus 84.115 µs for the prototype, 3.55% lower latency. This smaller
gain is not a new whole-corpus qualification. The [raw screen](data/serialization-output-allocation-screen.json.gz)
retains samples, process outputs, binary hashes and prototype code. Final
regular-harness before/after measurements remain outstanding.

Validation passes the exact-body allocator and hygiene/fallback tests, 117
static-output checks, retained-output tests across nine configurations, 1,728
root/field/reuse string-oracle checks, and 288 packed-consumer operations across
36 configurations. Typecheck, lint and license-header checks also pass.

## Current clean source-aligned qualification

Commit `10da43f7`, Apple M4 Max on AC power, five alternating fresh-process
pairs per corpus under the shared timing lock. All complete-output checks pass.
The preceding capture that overlapped profile compilation was excluded.

| Corpus | Source layout | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---|---:|---:|---:|
| twitter | pretty | 5.85 | 10.51 | 0.56× |
| canada | pretty | 0.91 | 1.24 | 0.73× |
| citm_catalog | pretty | 3.46 | 10.18 | 0.34× |
| poet | pretty | 15.19 | 22.66 | 0.67× |
| github_events | pretty | 5.30 | 16.45 | 0.32× |
| gsoc-2018 | pretty | 7.37 | 15.97 | 0.46× |
| lottie | pretty | 23.26 | 21.60 | 1.08× |
| otfcc | min | 35.72 | 24.23 | 1.47× |
| fgo | min | 37.97 | 21.16 | 1.79× |

The [raw capture](data/serialization-aligned-10da43f7.json.gz) retains all
process samples, logs and provenance. Lottie, OTFCC and FGO pass the 90%
threshold; the other six do not, so the complete goal remains unmet.

## Private output allocator collector routing

The output-string allocator clone initially used the global incremental
interrupt, bypassing the existing library-scoped sweep optimizations. The next
change routes its private fallback through the same guarded selector already
used by object/copied-string allocation. Native/global allocation entries stay
unchanged; unknown versions, aliases and instrumentation retain the fallback.

Six alternating process pairs in the original GitHub classic harness measure
median baseline 11.285 µs versus candidate 11.005 µs, 2.48% lower latency.
All pairs favor the candidate. The [raw screen](data/serialization-collector-routing-screen.json.gz)
contains process results, binary hashes and the patch. A separate collector
ordering experiment was also measured but is not retained. Updated whole-corpus
native ratios are pending.

The routing change passes collector activation/AST/alias guards, unchanged
global collector assertions, idempotence, native-free/retained-graph pressure
checks, 12 static numeric-array pressure configurations, 24 exact-binary/event
fallback and finalizer configurations, nine output-retention configurations,
117 static-output checks, typecheck and lint.

## Bounded SIMD string tails

Medium strings (8–15 UTF-16 units) and clean long-string tails now use
payload-bounded overlapping vector loads instead of scalar tail loops. Every
load stays inside the source range; exceptional controls, quotes, backslashes
and surrogates retain the shared escaping path. No serialized output is cached.

Six alternating fresh-process pairs per workload on Apple M4 Max/AC power,
under the shared timing lock, using the original classic harness:

| Workload | Previous µs | Candidate µs | Latency delta |
|---|---:|---:|---:|
| GitHub events | 10.930 | 10.470 | −4.21% |
| Twitter | 82.345 | 82.205 | −0.17% |

All six GitHub pairs favor the candidate. Twitter is noisy and effectively
flat; this capture does not establish a Twitter gain. The diagnostic isolated
writer screen gave −3.38% / −2.66%, respectively, and does not replace the
original-harness evidence. Background virtualization and interactive apps were
running; these are shared-host measurements, not an isolated-host claim.
The [raw capture](data/serialization-string-tail-screen.json.gz) retains logs,
binary hashes, patch, host/power audit and commands. Whole-corpus native ratios
are pending refresh.

Validation: 1,872 root/field/reuse oracle checks across all 12 backend ×
strictness × fast-path configurations, including every control unit and
surrogate boundary at every position in lengths 7–17, 23–25, 31–33 and 63–65;
117 static-output checks; retained-output/allocation checks across nine
backend/runtime configurations; typecheck, lint and license headers pass.

## Complete refresh at 3efb7905

Five alternating fresh-process pairs per corpus on Apple M4 Max/AC power,
under the shared timing lock. All full-output oracles passed. Original classic
harness, SIMD/incremental, compatibility mode without validation; source layouts
match the preceding source-aligned matrix. Background virtualization and
interactive applications were active; per-process audits are retained.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 5.81 | 10.57 | 0.55× |
| canada | 0.92 | 1.24 | 0.74× |
| citm_catalog | 3.54 | 10.17 | 0.35× |
| poet | 15.80 | 23.51 | 0.67× |
| github_events | 5.54 | 15.96 | 0.35× |
| gsoc-2018 | 7.38 | 16.60 | 0.44× |
| lottie | 23.35 | 22.51 | 1.04× |
| otfcc | 34.95 | 23.91 | 1.46× |
| fgo | 38.60 | 21.70 | 1.78× |

[Raw qualification](data/serialization-aligned-3efb7905.json.gz) includes samples,
logs, source/binary provenance and host audits. Three of nine pass the 90%
threshold. The six typed workloads remain below it; the goal is still unmet.
Between-capture throughput changes are not an isolated causal estimate of the
string-tail change; the paired AS-before/after screen above supplies that
evidence. The runner exits 1 because the parity gate fails.

## Callback-bounded string reservation groups

Mixed schemas previously disabled all direct string-payload reservations because
nested serializers can mutate later fields. The transform now groups consecutive
plain fields, reserving their string payloads together at the first string in
each run. Nested values, lazy fields and other potentially effectful operations
end the run. Later sizes are loaded only after those operations finish. Pure
flat schemas keep their existing single reservation. No output cache or runtime
analysis is added.

Six alternating fresh-process pairs per workload in the original classic harness
on shared Apple M4 Max/AC power, using SIMD/incremental without validation:

| Workload | Previous µs | Candidate µs | Latency delta |
|---|---:|---:|---:|
| GitHub events | 10.535 | 9.065 | −13.95% |
| Twitter | 81.395 | 69.990 | −14.01% |
| CITM | 141.800 | 140.610 | −0.84% |

Every GitHub/Twitter pair improves; CITM is mixed and effectively flat. Background
virtualization and interactive apps were present; no isolated-host claim.
[Raw screen](data/serialization-string-groups-screen.json.gz) retains all logs,
audits, binary hashes and patches. Final cleaned-up compiler output produces
byte-identical benchmark binaries to the screened candidate. The full native
comparison remains pending for this change.

The same capture retains a rejected 4–7-character vector experiment: its first
screen suggested small gains, but independent confirmation regressed GitHub
2.25% while improving Twitter 1.52%. That runtime change was reverted.

Validation passes: 324 callback-order/GC/retained-output checks across nine
backend/runtime configurations, including callbacks that expand later strings
and mutate already-emitted fields; 1,872 escaping root/field/reuse oracle checks
across 12 configurations; unchanged zero-allocation static string-array checks;
288 packed-consumer operations across 36 configurations; typecheck, lint and
license headers.

## Complete refresh at 91fc355e

Five alternating fresh-process pairs per corpus, original classic harness,
SIMD/incremental without validation. Apple M4 Max on AC power under the shared
timing lock; background virtualization/interactive applications were active.
All source-aligned complete-output oracles pass.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 6.77 | 10.37 | 0.65× |
| canada | 0.88 | 1.22 | 0.72× |
| citm_catalog | 3.58 | 10.24 | 0.35× |
| poet | 16.51 | 22.96 | 0.72× |
| github_events | 6.37 | 16.29 | 0.39× |
| gsoc-2018 | 7.84 | 16.07 | 0.49× |
| lottie | 23.72 | 21.52 | 1.10× |
| otfcc | 35.92 | 23.77 | 1.51× |
| fgo | 36.09 | 21.93 | 1.65× |

[Raw qualification](data/serialization-aligned-91fc355e.json.gz) retains every
sample, log, per-process audit and sealed source/binary provenance. Three of
nine meet 90% parity; six typed workloads remain below it. Between-capture
changes are descriptive, not causal deltas; the paired grouped-reservation
screen above isolates that change. The parity gate exits 1 as expected.

## Compile-time integer digit pairs

The fixed 100-entry UTF-16 digit-pair table is now embedded as static data,
removing its mutable initialization flag and the check performed for every
integer. The existing initialization helper remains as a no-op for source
compatibility. Numeric conversion and formatting algorithms are unchanged.

An initial six-pair original-classic screen suggested CITM −2.20%, GitHub
−0.80%, and Twitter +0.60% in median latency. Independent confirmation with
eight alternating fresh-process pairs per workload gives:

| Workload | Previous µs | Candidate µs | Latency delta |
|---|---:|---:|---:|
| CITM | 141.630 | 138.600 | −2.14% |
| GitHub events | 9.380 | 9.380 | 0.00% |
| Twitter | 70.180 | 70.280 | +0.14% |

CITM improves in six of eight confirmation pairs; the other workloads are
mixed and effectively flat. Shared Apple M4 Max/AC, SIMD/incremental without
validation, shared timing lock; background work remains visible in the
[raw screen and confirmation](data/serialization-static-pairs-screen.json.gz).
Updated full-corpus native ratios are pending.

The capture also retains refreshed isolated-writer profiles at the preceding
revision. CITM attributes 31.4% of samples to its generated serializer and
24.8% to its 64-bit integer formatter (including inlined narrow formatting).
These profiles guide experiments; their timings and GC mix do not replace
classic-harness qualification. Profile processing warns of a V8 version
mismatch, so native C++ symbol names are not interpreted.

Validation: 85,995 exact public root/field/array BigInt-oracle comparisons
across all nine backend/runtime configurations; 40,434 additional full-width
and decimal-boundary comparisons; typecheck, lint and license checks pass.

## Bounded integer inlining

The u32 formatter and small-value u64 entry are inlined into their callers;
large magnitudes retain a shared out-of-line helper. This exposes the common
formatting path to the caller's optimizer without duplicating the complete
large-number routine at every field. Numeric algorithms and output are unchanged.

Six alternating original-classic process pairs per corpus compare the sealed
`91fc355e` binaries against static digit data plus bounded inlining. Apple M4
Max/AC, SIMD/incremental, no validation, shared timing lock; per-process
background audits retained. Every complete-model output oracle passes.

| Corpus | Previous µs | Bounded µs | Median latency delta |
|---|---:|---:|---:|
| twitter | 69.980 | 67.130 | -4.07% |
| canada | 2348.655 | 2301.890 | -1.99% |
| citm_catalog | 140.735 | 118.830 | -15.56% |
| poet | 205.725 | 208.650 | 1.42% |
| github_events | 9.040 | 8.890 | -1.66% |
| gsoc-2018 | 400.025 | 394.705 | -1.33% |
| lottie | 62.255 | 61.025 | -1.98% |
| otfcc | 1858.035 | 1860.640 | 0.14% |
| fgo | 1365.535 | 1294.165 | -5.23% |

Poet's paired geometric-mean change is +0.75%, with a 95% paired-percentile
bootstrap interval of −1.79% to +3.39%. No regression is statistically resolved
in this small batch; that is not a guarantee of universal non-regression.
CITM's corresponding interval is −16.14% to −15.28%, Twitter's −5.09% to −3.50%.
Intervals use 20,000 resamples of six process pairs without multiplicity
correction. Full native-parity qualification is pending.

A three-way screen against the preceding static-table writer measured CITM
139.710 / 118.340 / 119.390 µs for baseline / full inlining / bounded inlining,
Twitter 70.240 / 67.725 / 68.440 µs, and GitHub 9.165 / 8.875 / 8.890 µs. Bounded
inlining reduces CITM's added Wasm from approximately 78 KB to 24 KB, Twitter's
from 87 KB to 42 KB, and GitHub's from 79 KB to 38 KB. These are binary sizes,
not heap/RSS measurements. Performance qualification is ARM64-only.

The [raw capture](data/serialization-bounded-inline-screen.json.gz) includes
all process logs/hashes/audits, both full-corpus trials, the three-way screen,
scripts, and representative compiler IR. The IR already lowers constant
integer division to ARM64 multiply/shift operations, ruling out redundant
source-level division rewrites.

Rejected experiments are retained there too: the 64-byte string loop regressed
Twitter 2.53%; packed surrogate validation regressed GitHub 8.14%, Twitter
2.60%, and CITM 3.76%; direct map-value dispatch regressed CITM 1.94%. All three
runtime changes were reverted. The stronger string oracle remains: it now
checks exact JSON encoding, including lone surrogates and exhaustive small
surrogate combinations across vector boundaries, in addition to decoded values.

Validation passes: 85,995 exact integer root/field/array comparisons across nine
backend/runtime configurations, 1,872 expanded exact string root/field/reuse
checks across 12 configurations, nine full model-output oracles, typecheck,
lint and license headers.

## Complete native refresh at f68c4749

Five alternating fresh-process pairs per corpus, original classic harness,
source-aligned owning models and fresh output strings on both sides. Apple M4
Max/AC, SIMD/incremental without validation, shared timing lock; background
process audits retained. All full-output checks pass.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 7.11 | 10.76 | 0.66× |
| canada | 0.91 | 1.24 | 0.73× |
| citm_catalog | 4.24 | 10.22 | 0.41× |
| poet | 16.42 | 23.81 | 0.69× |
| github_events | 6.44 | 16.30 | 0.39× |
| gsoc-2018 | 7.75 | 16.96 | 0.46× |
| lottie | 24.59 | 22.20 | 1.11× |
| otfcc | 35.13 | 23.57 | 1.49× |
| fgo | 37.64 | 20.55 | 1.83× |

[Raw qualification](data/serialization-aligned-f68c4749.json.gz) contains the
sealed source/runtime/binary provenance, every sample and process log. Three
of nine pass 90% parity. Six typed workloads remain below it, so the goal
remains active and unmet. These are current native ratios; the preceding
paired AS-before/after gate supplies causal evidence for the retained changes.

## Guarded callback-map key snapshots

CITM's profile places its temporary Map key arrays on the ordinary allocator
path. Callback serializers now construct that snapshot through the existing
native-array factory. Keys remain managed and traced; reference barriers and
length publication precede all callbacks. Capacity uses the live key count,
not the number of live plus deleted entry slots. Values are still read when
visited, deleted keys are skipped, and additions wait until the next call.

The transform enables this path only with recognized collector, allocator,
Array and Map source/AST layouts and no conflicting aliases. Unknown sources,
modified ASTs, instrumentation, finalizers and other runtimes keep nativeKeys.

Eight alternating original-classic fresh-process pairs compare final candidate
binaries against sealed `f68c4749` binaries. Apple M4 Max/AC, SIMD/incremental,
no validation, shared timing lock; background VM activity is audited.

| Corpus | Previous µs | Snapshot µs | Median latency delta |
|---|---:|---:|---:|
| citm_catalog | 119.845 | 117.365 | -2.07% |
| gsoc-2018 | 396.055 | 389.120 | -1.75% |

CITM improves in eight of eight pairs; its paired geometric-mean change is
-1.93%, with a 95% paired-percentile bootstrap interval of -2.98% to -0.95%.
GSOC improves in five pairs; its interval is -3.35% to -0.01%, with a -1.68%
paired mean. Intervals use 20,000 seeded resamples without multiplicity
correction; GSOC is borderline and an earlier confirmation was flat. All seven
other corpus binaries are byte-for-byte identical. The preceding prototype
screen and both independent confirmations remain in the
[raw capture](data/serialization-map-snapshot-screen.json.gz), together with
patches, scripts, hashes, process audits and validation logs.

Validation: nine complete owned-model/GC oracles; 375 capability, mutation,
rehash, GC and retained-output checks across 15 configurations; 243 existing
Map callback/codec checks; 288 packed-consumer checks across 36 configurations;
24 exact fallback/finalizer binary and runtime-event configurations; transform
source/AST/alias guards; typecheck, lint, formatting and license headers. Forced
collection inside callbacks is tested on incremental; minimal requires explicit
roots rather than implicit active-stack rooting. Full native refresh follows.

## Complete native refresh at e1ab611f

Five alternating fresh-process pairs for all nine corpora, same source-aligned
classic harness and fresh owning output. Apple M4 Max/AC, SIMD/incremental,
validation disabled, shared timing lock; background activity retained in audits.
All owned-model output oracles pass.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 7.15 | 10.70 | 0.67× |
| canada | 0.91 | 1.25 | 0.72× |
| citm_catalog | 4.29 | 10.17 | 0.42× |
| poet | 15.92 | 22.81 | 0.70× |
| github_events | 6.52 | 16.46 | 0.40× |
| gsoc-2018 | 7.90 | 16.72 | 0.47× |
| lottie | 24.67 | 20.08 | 1.23× |
| otfcc | 34.96 | 23.86 | 1.46× |
| fgo | 37.69 | 22.27 | 1.69× |

[Raw qualification](data/serialization-aligned-e1ab611f.json.gz) retains all
samples, logs, source/runtime/binary seals and process audits. Three of nine
still clear 90%; six typed workloads remain below the target. The gate exits
1 for that unmet threshold, with no execution or output-oracle failure. Small
cross-batch native changes are not attributed to the snapshot optimization;
the preceding paired AS-before/after screen measures that change directly.

## Rejected runtime 32-byte string tails

A general packed 32-byte overlapping tail improved the initial GitHub/Twitter
screen, but independent six-pair full-corpus confirmation exposed regressions:
CITM +2.14% and Canada +1.13% median latency. GitHub improved 7.03%, Twitter
2.26% and GSOC 3.46%; that tradeoff was not retained. A straddling-only variant
improved CITM in an eight-pair screen but regressed Poet 9.80%. Changing only
its guard order still regressed Poet 11.96%, while its smaller gains elsewhere
were statistically unresolved. Those variants were also rejected.

All probes used the original classic harness against sealed `e1ab611f` binaries
on Apple M4 Max/AC, SIMD/incremental, no validation and the shared timing lock.
The [raw experiment archive](data/serialization-overlap32-rejected.json.gz)
retains the initial screen, full-corpus confirmation, both narrowed controls,
all scripts, patches, binary hashes, process audits and validation logs.

The runtime source and all nine current binaries have been restored to the
qualified snapshot implementation. The stronger oracle remains: every length
from zero through 33 UTF-16 units is checked with controls/surrogates at every
position, plus longer block boundaries. It passes 1,872 exact root/field/reuse
checks across 12 configurations on the restored writer. The earlier native
table remains the current retained implementation's qualification.

## Unicode literal-packing regression found during constant-store work

The baseline at `0680127d` cannot compile an ordinary SIMD model with
`@alias("hello😀")`: it emits a surrogate code unit as a positive i16x8 lane,
which AssemblyScript rejects with AS200. A second packed-word path emits
negative JavaScript u32 words as invalid hexadecimal source such as `0x-ff9c`
for high-BMP aliases. Both failures are reproduced in the
[regression capture](data/serialization-unicode-literal-regression.json.gz).

Constant construction now sign-extends SIMD i16 lanes and keeps packed u32
words unsigned through the shared helper. The new regression executes 3,105
cases: exact literal bytes, cursor and surrounding write fences across six
SIMD/runtime configurations, plus public Unicode serialization/fresh/reused
parsing across nine backend/runtime configurations. The existing publication
matrix passes 48 checks; typecheck, lint, formatting and licenses pass.

All nine classic models were rebuilt with complete output/GC oracles, and
their binaries remain byte-for-byte identical to the qualified `e1ab611f`
implementation. No additional timing claim is made for this correctness fix;
the preceding native table still describes those exact classic binaries.

## Rejected static literal-vector loads

A small ARM64 compiler probe showed that loading a constant vector from static
memory can reduce the native instructions for a literal store. That local
code-size improvement did not translate into a safe whole-corpus change.
Three variants were tested: overlapping constant tails, static vector pools,
and pools restricted to literals containing at least two complete vectors.
All retain the exact literal payload bounds and fresh output ownership.

The final two pool confirmations each used six alternating baseline/candidate
fresh-process pairs per corpus, original classic AS harness, SIMD/incremental,
validation disabled, Apple M4 Max on AC and the shared timing lock. Each executed
binary was checked against its recorded hash. Process audits retain background
activity; these are shared-host measurements. Positive deltas mean slower.

| Corpus | Broad pools latency delta | Two-vector-minimum latency delta |
|---|---:|---:|
| twitter | −3.15% | −2.77% |
| canada | +0.80% | +0.58% |
| citm_catalog | −3.02% | −0.51% |
| poet | −1.95% | +4.66% |
| github_events | −1.45% | −0.96% |
| gsoc-2018 | +0.87% | −2.10% |
| lottie | +0.78% | +2.04% |
| otfcc | +3.72% | +1.60% |
| fgo | −3.91% | +2.92% |

These are ratios of process medians. Paired geometric-mean bootstrap intervals
resolve the broad-pool OTFCC regression (+1.30% to +8.68%) and the narrowed
Poet regression (+4.38% to +10.41%). The small Canada regression also remains
resolved in both captures. These tradeoffs were rejected; the qualified writer
is restored. The preceding native table remains the retained qualification.

The initial eager pools also retained unused static data. Compiler `@lazy`
declarations removed that footprint and passed the unused-image regression;
this concerns declaration liveness, not deferred JSON materialization. It did
not remove the performance regressions. Restricting pools to longer literals
also changed benchmark-reporting schemas, so short-key models did not produce
byte-identical complete benchmark modules.

Before timing, both final candidates passed complete output/retained-model GC
oracles for all nine corpora, 3,142 literal-byte/cursor/fence/liveness and public
codec checks across 26 configurations, and all 51 compiler-warning configurations.
The broad compile-lazy candidate additionally passed 288 packed-consumer
operations, six installed AssemblyScript 0.28.18 configurations, and the scalar
startup-allocation control. Correctness passes do not qualify the throughput
tradeoff. The restored original literal regression passes separately.

[Raw experiment archive](data/serialization-literal-pools-rejected.json.gz)
contains every trial's samples, scripts, patches, source and binary hashes,
compiler-IR controls and validation logs. The failed initial screen invocation
with a stale candidate filename is retained for provenance and excluded from
all statistics. No runtime/transform optimization from these experiments is
retained; the earlier Unicode constant-packing fix remains.

## Rejected scalar-only generated literals

Replacing vector constants with u64/u32/u16 stores avoided static pools and
reduced the small ARM64 emission control's maximum mapped PC from 120 to 116
bytes. The actual classic corpus still regressed. Six alternating fresh-process
pairs per corpus under the same SIMD/incremental, no-validation M4 Max/AC
method measured median latency deltas of Twitter +3.70%, Canada +0.04%,
CITM +1.24%, Poet −1.88%, GitHub +2.70%, GSOC +1.59%, Lottie +2.01%,
OTFCC −3.65% and FGO −2.45%. Paired geometric-mean intervals resolve the
Twitter (+0.45% to +3.96%) and GitHub (+0.52% to +5.47%) regressions.

All nine complete-output/GC oracles and 3,105 literal checks passed before
measurement. The scalar-only transform change was reverted. The
[raw capture](data/serialization-scalar-literals-rejected.json.gz) preserves
all 108 process runs, provenance, process audits, patch, scripts, validation
and native-emission control. The retained native table is unchanged.

## Short-string probe and refreshed hotspots

A bounded first/final-u64 SIMD check for four to seven UTF-16 units passed
1,872 exact string-oracle checks, all nine complete-output/GC oracles and all
51 compiler-warning configurations. Its six-pair corpus confirmation did not
resolve an improvement: Twitter median −1.02% (paired interval −2.61% to
+0.67%), CITM −1.38% (−2.27% to +0.74%), with mixed other rows. The change
was reverted rather than adding an unqualified fast path. All 108 process
runs, patch, hashes, shared-host audits and validation are in the
[raw capture](data/serialization-short-vector-rejected.json.gz).

That archive also preserves refreshed retained-writer CITM, Twitter and GitHub
sampling profiles, binary hashes and their build/capture driver. These isolated
serialization-only, min-input modules are hotspot diagnostics, not classic/native
throughput evidence. The decoder reports a V8-version mismatch, retained in
its output. Symbolized samples point to generated root writers, string scanning,
GC traversal and CITM callback-map key snapshots. They motivate investigation;
they do not change the qualified native table.

## Callback-free generated Map values

A generated type certificate now supports a bounded instance check for nested
references. The original no-argument form still certifies only flat scalar
models for `JSON.Value`; a nonnegative depth checks fields for Map traversal.
The returned declaring-type ID must match the actual type, preventing inherited
certificates from authorizing a subclass's manual or custom serializer. No
object fields, startup allocations or serialized-output cache are added.

For primitive/string keys, the guarded native Map path checks every value
before emitting any entry. Exact generated models and primitive native arrays
can then traverse stored entries without allocating a key snapshot or hashing
keys again. Custom codecs, omission predicates, deferred fields, uncertain
subtypes and graphs beyond the depth bound retain the snapshot path. The
existing collector/layout capability gate also preserves fallbacks for unknown
sources, runtimes, instrumentation, allocator aliases and finalizers.

The initial six-pair AS-before/after screen improved median CITM latency
15.55% and GSOC 14.18%. An independent eight-pair confirmation measured:

| Corpus | Baseline µs | Candidate µs | Median latency delta | Paired 95% interval |
|---|---:|---:|---:|---:|
| citm_catalog | 118.100 | 101.395 | −14.14% | −15.31% to −13.27% |
| gsoc-2018 | 400.015 | 341.965 | −14.51% | −15.69% to −13.77% |

Every confirmation pair improved. Seven other classic binaries are unchanged.
These are original classic-harness measurements on shared Apple M4 Max/AC,
SIMD/incremental, validation disabled, with alternating fresh processes, the
host timing lock and executed-binary hash checks. Intervals use paired
geometric means; point deltas use process medians. This is an AS-before/after comparison; a full native refresh is reported below.

Validation includes 555 graph/alias/callback/GC/legacy-marker checks across 15
configurations, with warning-free compilation asserted for each; 375 existing
snapshot lifetime/callback/rehash checks; 288 packed-consumer operations across
36 configurations; and 162 installed-tarball checks across six AssemblyScript
0.28.18 configurations. The inherited manual-serializer certificate test was
observed failing on the initial prototype before the declaring-type guard was
added. All nine complete-output/retained-model GC oracles, all 51 warning
configurations, typecheck, lint and license checks pass.

[Raw screen, confirmation and validation](data/serialization-callback-free-map.json.gz)
retain all samples, full-corpus binary hashes, source patches, execution audits,
compiler conditions and lower-bound consumer artifacts. A full native refresh
on the committed implementation follows separately.

## Native refresh after callback-free Map traversal

Committed implementation `e48e0489`, five alternating native/AS fresh-process
pairs across all nine corpora on shared Apple M4 Max/AC, original classic
harness, SIMD/incremental and validation disabled. Complete output checks pass;
the source, runtime and executed binaries match the prepared seals.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 7.04 | 10.45 | 0.67× |
| canada | 0.91 | 1.25 | 0.73× |
| citm_catalog | 4.97 | 10.51 | 0.47× |
| poet | 16.04 | 23.34 | 0.69× |
| github_events | 6.55 | 16.53 | 0.40× |
| gsoc-2018 | 9.25 | 16.73 | 0.55× |
| lottie | 24.54 | 22.20 | 1.11× |
| otfcc | 35.43 | 23.38 | 1.52× |
| fgo | 36.88 | 21.10 | 1.75× |

[Raw native qualification](data/serialization-aligned-e48e0489.json.gz) retains
all 90 process samples, logs, audits, model/layout accounting and provenance.
The threshold gate exits 1 because six typed rows remain below 90%, not because
of an execution or output mismatch. This table supersedes the earlier native
qualification. Cross-capture shifts in unchanged/native binaries are not
attributed to the Map change; its paired AS confirmation above isolates that
change. The Map optimization adds 1,165 bytes to the CITM Wasm and 909 bytes to
GSOC; these are artifact sizes, not heap/RSS measurements.

## Stock marking-call expansion

The retained change expands the stock incremental collector's `Object.makeGray`
call inside `__visit`. It clones the original AST body, binds its receiver to
`obj`, and preserves the iterator check, list operations, pointer-free decision,
and `visitCount` ordering. It does not change GC pacing, object headers, roots,
or output ownership. Stock runtime source and body checks gate the rewrite;
unknown layouts and affected aliases remain unchanged. RTRACE, PROFILE, and
finalizer configurations retain the original call.

A controlled emitted-code comparison confirms one `makeGray` call in the
baseline `__visit` and zero in the candidate. The original method remains
available. All nine classic outputs, including retained models after collection,
pass their integer-preserving model oracles. AST selection and unchanged-fallback
checks pass 36 assertions; the allocation-pressure suite passes 12 configurations
plus its fixed-memory control, and 24 runtime fallback/finalizer configurations
preserve exact binaries and event counts.

Local Apple M4 Max / AC, SIMD, incremental runtime, validation disabled,
JSON_CACHE=0, original classic harness. The baseline is `e48e0489`; only the
marking-call expansion changes the measured implementation. An independent
eight-pair confirmation alternates fresh baseline/candidate processes:

| Corpus | Baseline µs | Candidate µs | Median latency change |
|---|---:|---:|---:|
| Twitter | 68.165 | 66.720 | -2.12% |
| Canada | 2291.625 | 2276.120 | -0.68% |
| CITM | 99.695 | 98.305 | -1.39% |
| Poet | 204.695 | 204.885 | +0.09% |
| GitHub | 8.940 | 8.395 | -6.10% |
| GSOC | 336.150 | 332.515 | -1.08% |
| Lottie | 61.400 | 61.495 | +0.15% |
| OTFCC | 1871.495 | 1931.320 | +3.20% |
| FGO | 1317.235 | 1300.725 | -1.25% |

GitHub is faster in all eight pairs; its paired geometric latency change is
-5.01% (paired bootstrap 95% interval -5.99% to -3.98%). CITM's corresponding
interval is -5.16% to -0.52%. Most other intervals include zero; their point
estimates do not establish individual speedups. OTFCC's apparent slowdown also
has an interval crossing zero. A separate 16-pair OTFCC confirmation resolves
that risk: 1858.715 to 1850.340 µs (-0.45% medians), paired geometric change
-1.96% with interval -4.37% to +0.32%.

These captures are **under background load**, not isolated host measurements:
process audits record VM activity, substantial during the initial four-pair
screen and lower but still present during confirmation. No background services
were stopped. All samples, process audits, power state, hashes, implementation,
controlled emitted-code evidence, and verification logs are preserved in the
[raw capture](data/serialization-gc-marking.json.gz). The shared timing lock was
released after each batch. This is incremental AS-before/after evidence; the
latest full native comparison above still refers to `e48e0489`, and whole-corpus
near parity remains unmet.

The final local package matrix passes 288 operations across 36 configurations.
All 51 compiler-warning configurations pass with AS201 enabled, along with
typechecking, lint, license headers, and formatting.

## Native refresh after marking-call expansion

Implementation `e9971446`, five alternating fresh-process pairs per corpus,
Apple M4 Max / AC, SIMD/incremental, validation disabled, JSON_CACHE=0.
The original AS classic harness and source-aligned owning-model inputs are
unchanged. GB/s uses actual UTF-8 output bytes; every call writes fresh output.
All nine rebuilt binaries match the independently measured marking candidate.
Complete outputs and retained models after collection pass their oracles.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 7.34 | 10.52 | 0.70× |
| canada | 0.91 | 1.26 | 0.73× |
| citm_catalog | 5.13 | 10.08 | 0.51× |
| poet | 15.66 | 23.65 | 0.66× |
| github_events | 6.90 | 16.26 | 0.42× |
| gsoc-2018 | 9.23 | 16.74 | 0.55× |
| lottie | 24.63 | 22.30 | 1.10× |
| otfcc | 36.30 | 24.19 | 1.50× |
| fgo | 32.50 | 21.95 | 1.48× |

Three of nine workloads pass the 90% gate. Six typed workloads remain below it,
so the gate exits 1 and the goal remains unmet. These are audited background-load
measurements, with variability in both engines. Cross-capture changes, including
Poet and FGO, are not attributed to the marking patch; its isolated before/after
evidence is reported above. The [raw qualification](data/serialization-aligned-e9971446.json.gz)
retains all 90 invocation logs, samples, process audits, power state, source and
binary seals, output hashes, and the final gate result.

## Rejected grouped string-Map reservations

A fresh e997 diagnostic profile locates approximately 57% of CITM samples in its
generated root serializer, 28% of GitHub samples in GC marking and 26% in string
writing, and 31% of Twitter samples in string writing. These isolate serialization
with source-recorded inputs (CITM/Twitter min; GitHub pretty), not the classic
throughput qualification. The decoder's V8-version warning is preserved.

An experimental string-to-string Map loop reserves each key/value pair together
and keeps its output cursor local. Correctness passes 4,212 exact-output and
retention checks across all three backends/runtimes, plus 555 callback and 375
snapshot/rehash checks. All nine full-model output/GC oracles pass. Only the CITM
classic binary changes. Four alternating baseline/candidate pairs versus e997
measure 97.40 versus 97.80 µs medians (+0.41% latency), with no useful gain.
The prototype is rejected and the runtime restored. The [raw capture](data/serialization-map-string-pairs-rejected.json.gz)
retains the implementation, tests, all samples/audits and refreshed profiles.
No speedup is claimed from the lower reservation-call count.

## Rejected decimal-kernel trials on `5d3a041c`

The Canada serialization-only diagnostic attributes 3,334/3,435 samples (97.1%)
to the inlined owning-model writer; sampled GC work is below 1%. This narrows
investigation to the writer but does not separate decimal arithmetic, digit
formatting and array-loop bookkeeping. The profile decoder warns about a V8
version mismatch. A second matching-PC capture emits code ranges/sizes but this
V8 build does not print instruction disassembly, so it does not establish an
instruction-level bottleneck. Both captures and their audits are preserved.

Two independent formatter experiments were rejected. Each screen used four
alternating fresh-process pairs per changed corpus on Apple M4 Max / arm64 / AC,
SIMD/incremental, validation off, cache off, with the existing classic harness
and shared host lock. Process audits are included; these are shared-host screens,
not isolated qualification or replacement native throughput results.

| Corpus | SWAR digit kernel latency delta | Low-zero-limb multiply latency delta |
|---|---:|---:|
| Twitter | +2.35% | -0.41% |
| Canada | +34.33% | -2.41% |
| CITM | -0.14% | +0.16% |
| Poet | -2.34% | +5.46% |
| GitHub | +0.65% | +0.35% |
| GSoC | -0.28% | -1.56% |
| Lottie | +1.23% | +2.33% |
| OTFCC | -0.14% | -0.21% |
| FGO | +1.14% | -0.38% |

Deltas compare medians against the same retained `e9971446` binaries, whose
classic images remain unchanged at `5d3a041c`. Negative means faster. Four pairs
are a screening signal, not a confidence interval. The 34% Canada loss rejects
the SWAR option; the multiply shortcut's Canada benefit does not justify the
Poet regression. Neither experiment is retained.

The SWAR experiment changes only existing `XJB_SIMD=0`, leaving JSON_MODE=SIMD.
All nine model/GC oracles pass. Explicit `XJB_SIMD=1` Canada and FGO controls are
byte-identical to the retained default binaries, confirming which setting was
measured. All nine images differ with flag zero, including images with only
cold formatter changes; this does not imply nine hot paths use the formatter.

The second experiment changes only `umul64hi`: when the low limb of operand
`a` is zero, high64(a*b) equals `a1*b1 + ((a1*b0)>>32)`. This is exact integer
arithmetic, with no floating-point rounding or corpus constants. The original
and candidate each pass 400,049 BigInt product checks, including zero limbs and
boundary values. All nine full-model/GC oracles pass. It remains rejected on
performance grounds. Installed xjb-as sources have been restored, and all nine
main classic images/manifests restored to their retained baseline.

The [raw archive](data/serialization-numeric-trials-rejected.json.gz) contains
all samples/audits, sealed manifests, compiler options, scripts, source prototypes,
profile logs, explicit-control results and third-party licenses. It includes
work that did not improve performance so it will not be repeated as a new idea.
The separate float-array accounting prototype is not part of these results.

## Rejected float-array loop variants

Three further independent screens keep the decimal formatter unchanged and alter
only f32/f64 array bookkeeping. The outer-chunk variant updates size accounting
once per 16-value chunk, using an inner loop. The first-chunk variant reserves
before the existing loop and advances an explicit chunk boundary instead of
checking `i & 15`. The third retains the original loop and computes total bytes
from a buffer-relative starting position at the end. All three are rejected;
no production patch is retained.

| Variant | Twitter latency delta | Canada latency delta |
|---|---:|---:|
| Outer chunk loop | -0.54% | +5.51% |
| First chunk before loop | +0.59% | +6.83% |
| Frame-relative accounting | -0.70% | +2.09% |

Each screen uses four alternating fresh-process pairs, the same retained
`e9971446` baseline and original classic harness, M4 Max / arm64 / AC,
SIMD/incremental, validation/cache off, under the shared lock. Raw process audits
are preserved. Only Twitter/Canada images differ; the other seven are
byte-identical. These are shared-host screening results, not confidence bounds
or a new native parity table.

All three variants pass 448 exact baseline/candidate float-array outputs, spanning
f32/f64, empty/single/pair arrays, 15/16/17 and 31/32/33 boundaries, and lengths
through 2,049, with collection between operations. An independent host oracle
checks all 113,376 numbers: f64 round trips exactly, f32 rounds back to the same
float32 value, nonfinite values become null, and zero is normalized. Another 468 explicit edge outputs across the six
baseline/candidate images cover signed zero, subnormals, normal boundaries,
maximum finite values, infinities and NaNs. All nine
complete model/GC oracles pass for each variant.

The emitted Canada module changes only function 132. Its body grows from 3,134
to 3,147 bytes for the first variant and 3,265 for the second; declared i32 locals
grow from 14 to 15/16. The third variant is 3,142 bytes with 15 i32 locals.
The static call counts for baseline/variants are 33/33/34/33. This establishes added
emitted work; it does not establish native register spills or branch-predictor
behavior. The trials illustrate why fewer global updates in source are not
sufficient performance evidence.

The [raw archive](data/serialization-float-loops-rejected.json.gz) contains all three
source prototypes, all samples/audits, sealed binaries' manifests, the full
baseline float outputs, independent oracle, scripts, full-model build logs and
function disassemblies. The original source is restored.

## Matched native-code diagnostics and unresolved screens

The missing printed ARM64 disassembly was a tooling limitation, not a reason
to infer instructions from Wasm. d8's module serializer provides compiled code
bytes. A read-only parser for the pinned V8 15.2.20 cache format validates the
version, imported/declared function counts, total code bytes, every code header,
and final tiering-budget boundary. Its layout follows the pinned
[V8 serializer](https://raw.githubusercontent.com/v8/v8/15.2.20/src/wasm/wasm-serialization.cc)
and [import-status representation](https://raw.githubusercontent.com/v8/v8/15.2.20/src/wasm/well-known-imports.h).
This is a diagnostic parser, not a general cache loader; it never deserializes
or executes a saved native cache.

Extracted function bytes are aligned in a Mach-O text section for `otool`.
Printed native address ranges are matched to cache function indices and exact
instruction sizes. Same-process sampled PCs then map to instruction offsets.
Serialized call operands are relocated tags, so their printed destination
addresses must not be interpreted as live callees. Native-code snapshots are
diagnostic artifacts; the serialization benchmarks still create fresh owning
output strings.

A two-function control computes correct u64/u32 quotients before capture. Its
actual native instructions use `umulh` and shifts for division by 100,000,000,
and `umull` and shifts for division by 10,000. Replacing these constant divisions
on the assumption that they emit hardware divide instructions is unwarranted.

| Capture / function | Native instruction bytes | Samples / all samples |
|---|---:|---:|
| Serialization-only diagnostic, generated writer 97 | 19,848 | 3,249 / 3,362 |
| Actual retained classic binary, decimal formatter 29 | 5,020 | 1,508 / 3,380 |
| Actual retained classic binary, root writer 132 | 14,280 | 214 / 3,380 |

The classic capture includes both parsing and serialization; its percentages
must not be compared directly with the serialization-only program. Three
prominent formatter PCs at decimal-result publication receive 347 samples.
These sampled locations do not establish branch-misprediction cost. They
motivated testing an equivalent branchless helper rather than assuming a win.
Both captures use sealed retained binaries and the same-process code snapshot;
they are profiling diagnostics, not fresh native throughput qualification.

Four additional candidates remain **unretained**:

- Skipping a high-product calculation for a zero cached-power low limb preserves
  exact arithmetic. Its four-pair Canada screen observes -1.43% median latency,
  without an independent confirmation; this is preliminary.
- Stable entry storage restricted to string-valued Maps changes only CITM's
  binary. It passes 4,212 checks across nine configurations plus all nine model/GC
  oracles. Its timing capture has substantial overlapping VM/indexing activity.
- Restricting stable entries to preflighted object writers changes CITM/GSoC
  only; FGO and the other six binaries stay identical. It passes 555 callback/GC
  checks and 375 snapshot-lifetime checks across 15 configurations each, plus
  all nine model/GC oracles. Its CITM baseline ranges from 100.61 to 177.30 µs
  under overlapping builds and VM activity, preventing a performance conclusion.
- Branchless decimal-result publication matches 448 random array outputs
  (113,376 independently checked numbers), 156 explicit edge outputs, and all
  nine model/GC oracles. Its first screen shows no Canada gain. Late FGO baseline
  samples range from 1.285 to 2.861 ms amid host activity; the complete screen
  cannot qualify a corpus-wide change. The zero-limb variant passes the same
  numeric/output checks.

No services or other agents' work were stopped. The shared timing lock was used
and released for every capture; other repositories' non-timing builds were
permitted by the host policy and are recorded in the audits. No production
formatter or Map change from these screens is retained. The original installed
sources and all nine main benchmark images/manifests are restored. The latest
qualified native table remains `e9971446`: **three of nine clear 90%**.

The [sealed archive](data/serialization-pc-diagnostics-and-pending-trials.json.gz)
preserves 168 timing records, process audits, all four prototypes and build
logs, exact numeric outputs, native snapshots, matched PC logs, parser and
annotation scripts, division controls, both diagnostic Wasm images and required
third-party notices. These unresolved screens must not be used as performance
claims.

## Skip an already-clamped decimal product

The actual classic formatter profile motivated moving the final rounding clamps
ahead of a pure high-product calculation. If the upper or lower clamp determines
the last digit, the formatter publishes that result immediately. The upper
clamp remains first because it wins when both conditions hold. Unclamped values
use the original product and publication helper. No tables, output caches,
allocation policies, or GC transitions change.

The transform selects only the exact stock xjb-as 1.0.0 source and parsed AST
for both formatter and arithmetic helper, with guards against affected compiler
aliases. Changed sources, modified bindings, earlier AST instrumentation, and
unknown versions retain the original implementation. The rewrite is idempotent.

An independent eight-pair confirmation follows a separate eight-pair Canada/Poet
screen. Each pair alternates fresh baseline/candidate processes in the original
classic harness. Settings remain SIMD/incremental, -O3 plus the recorded
wasm-opt passes, validation off and cache zero on Apple M4 Max / arm64 / AC.
The shared timing lock covers each batch; process, swap, and VM audits record
background activity. Paired intervals are bootstrap intervals for geometric
latency ratios, not guarantees of isolated host conditions.

| Corpus | Baseline µs | Candidate µs | Median latency delta | Paired geometric delta | Paired 95% interval | Faster pairs |
|---|---:|---:|---:|---:|---:|---:|
| twitter | 66.140 | 65.885 | -0.39% | -0.42% | -2.35% to +1.29% | 4/8 |
| canada | 2280.740 | 2207.680 | -3.20% | -3.41% | -3.95% to -2.91% | 8/8 |
| citm_catalog | 99.390 | 98.270 | -1.13% | +0.34% | -1.62% to +2.13% | 3/8 |
| poet | 204.885 | 201.095 | -1.85% | -1.85% | -3.40% to -0.12% | 6/8 |
| github_events | 8.595 | 8.575 | -0.23% | -0.14% | -0.77% to +0.44% | 5/8 |
| gsoc-2018 | 337.780 | 338.050 | +0.08% | +0.67% | -0.60% to +2.09% | 4/8 |
| lottie | 62.410 | 61.040 | -2.20% | -0.95% | -3.10% to +1.12% | 4/8 |
| otfcc | 1903.715 | 1872.280 | -1.65% | -0.77% | -3.37% to +2.13% | 6/8 |
| fgo | 1317.555 | 1354.130 | +2.78% | +0.03% | -2.06% to +2.26% | 5/8 |

Canada and Poet improve in both captures. The other seven paired intervals
include zero. FGO's median increases 2.78%, while its paired geometric estimate
is +0.03% with a -2.06% to +2.26% interval; this noisy row is retained rather
than described as a proven improvement or regression.

Validation includes 84 AST selection/purity/binding/idempotence checks and
324,990 runtime assertions across all three backends and runtimes. Untimed
observers count the actual multiplication and compare both normal/subnormal
rounding tails against independent BigInt arithmetic, including overlapping
clamps and the normal-path special bias. Original-body and modified-helper
controls retain the product, while selected forced results eliminate it.
Random f32/f64 outputs match the original code and independent numeric oracles.
The earlier prototype also passes 448 float-array comparisons, 113,376 numeric
round trips, 156 explicit edge outputs and all nine full owned-model/GC oracles.

All nine production binaries match the measured prototype byte for byte. Their
static data sections match the retained baseline. These are AS-before/after
measurements; they do not establish new simdjson parity ratios. The 90% native
gate remains unmet.

The [raw archive](data/serialization-decimal-clamps.json.gz) retains samples,
audits, exact source prototypes, compiler/binary seals, oracle outputs and
validation logs. It also preserves a rejected two-lane SIMD high-product trial:
eight-pair latency increases of +12.01% for Canada and +5.63% for Poet, despite
correct arithmetic and output. No SIMD arithmetic change is retained. A separate
618-row cached-power proof matches the current coefficients against BigInt;
no new power table is introduced.

### Fresh native qualification of the retained clamp change

Five alternating fresh-process pairs per corpus, same source-aligned complete
owned models and original classic harness. Every AS/native output oracle and
source/binary seal passes. The explicit 90% throughput target still fails for
six rows, so the command correctly exits 1 after completing all measurements.
Both writers produce a fresh owning string each operation; neither caches output.
GB/s uses actual UTF-8 output bytes. Background-load audits are retained.

| Corpus | json-as GB/s | Native GB/s | Throughput / native |
|---|---:|---:|---:|
| twitter | 7.14 | 10.39 | 0.69× |
| canada | 0.94 | 1.25 | 0.76× |
| citm_catalog | 5.06 | 10.21 | 0.50× |
| poet | 16.39 | 23.10 | 0.71× |
| github_events | 6.87 | 15.70 | 0.44× |
| gsoc-2018 | 9.16 | 16.45 | 0.56× |
| lottie | 24.33 | 22.68 | 1.07× |
| otfcc | 35.35 | 23.76 | 1.49× |
| fgo | 36.43 | 21.43 | 1.70× |

Only Lottie, OTFCC and FGO clear the gate. These are a fresh capture, not
a paired old/new native ratio experiment; changes from earlier tables include
host and native measurement variation. The independently confirmed AS-before/after
Canada and Poet improvements above are the evidence for retaining the change.
Typecheck, lint, license headers, all 51 warning configurations, and the packed
consumer's 324 operations across 36 configurations pass on the candidate.

## Multiplication and string-frame trials remain unretained

An exact multiply-ten-plus-carry limb formulation reduces its isolated ARM64
helper from 80 to 68 instruction bytes. Both versions pass 400,100 independent
BigInt cases, 448 exact array outputs / 113,376 numeric round trips, and 156
explicit edge outputs. All nine model/GC oracles pass, with unchanged data
sections. The prototype preserves the already-retained early clamps.

Its first eight-pair screen observes Canada -1.18% paired geometric latency
(95% interval -2.14% to -0.05%); Poet is unresolved. An independent eight-pair
full-nine confirmation gives Canada -1.50% (-1.96% to -0.96%), all eight pairs
faster, but Poet +2.22% (+0.45% to +3.78%). The other seven intervals include
zero. Poet's timed model contains only strings, so this is not evidence that
its payload spends time in the changed arithmetic. The result may involve code
layout or host variation; it still does not qualify a corpus-wide change. The
candidate is preserved but **not retained**.

### Attribute the GitHub writer using the actual classic image

A named diagnostic build of the retained GitHub classic module has identical
bytes in **every non-custom Wasm section**, including code and data. Only custom
diagnostic sections differ. The capture uses the original classic benchmark,
with same-process sampled PCs and a pinned native-code snapshot. It includes
both parsing and serialization, so whole-profile percentages are not isolated
serialization costs.

A separate classifier selects ticks whose absolute stack PCs contain the
actual root serializer or its serialization benchmark closure. It rejects
unknown stack encodings and retains unmapped samples. Of 1,791 total ticks,
288 have a matching serializer-root stack:

| Sampled PC location | Ticks | Share of selected ticks |
|---|---:|---:|
| General SIMD string writer | 114 | 39.6% |
| Root array/object writer | 64 | 22.2% |
| GC visit | 28 | 9.7% |
| Sweep interrupt | 19 | 6.6% |
| GC member visitor | 7 | 2.4% |
| Unmapped native PC | 18 | 6.3% |

These are sampling locations, not hardware cycles or branch-misprediction
counts. Node's optional profile report warns that its V8 version differs from
the recording engine; the table instead uses the same-process printed native
regions and raw absolute PCs. Function names come from the equivalent named
module. A compile-only snapshot independently reproduces the sampled baseline
string function's native bytes exactly.

### Split escape expansion out of the common frame

A second prototype separates escape expansion from the common scan/copy loop.
Medium strings that already identify an exceptional first block enter expansion
directly. Its hot native function shrinks from 11,248 to 2,736 instruction bytes;
the shared expansion helper is 6,968 bytes. No output caching or GC pacing change
is introduced. This passes 1,872 string-oracle root/field/reuse checks, 324
retained-output/GC checks across nine configurations, and all nine model oracles.

Nevertheless, an eight-pair screen does not establish a useful improvement:

| Workload | Paired geometric latency delta | Paired 95% interval |
|---|---:|---:|
| GitHub | -0.56% | -2.14% to +1.21% |
| CITM | -0.05% | -1.47% to +1.31% |
| Poet | +2.18% | +0.01% to +4.96% |

The smaller function is **not retained**. Code size alone is insufficient
performance evidence, and these captures do not identify the cause of Poet's
result. Both timing investigations use alternating fresh processes, the shared
host lock, Apple M4 Max/AC, original harness, SIMD/incremental, validation off,
cache zero, and process/memory audits. No other services or agents were stopped.

### Next classifier probe

The actual snapshot shows a vector reduction followed by scalar Boolean
normalization in the 32-byte clean loop. Combining its two 64-bit lanes with OR
is equivalent for any mask. An isolated probe passes 2,097,152 checks (all UTF-16
values in every lane, baseline and candidate) and emits a 496-byte native scan
versus 512 bytes. Each unrolled block uses two lane transfers, OR and a direct
branch, replacing the reduction, transfer, comparison, Boolean result and
branch. The full writer subsequently passes the 1,872 string-oracle checks, 324
retained-output/GC checks, and all nine model oracles. Its eight-pair screen
finds no resolved benefit: CITM -1.02% (95% interval -2.50% to +0.53%),
Poet +1.45% (-1.15% to +4.01%), and GitHub +0.57% (-0.48% to +1.75%).
The classifier change is **not retained**.

The [raw archive](data/serialization-mask-and-cold-trials.json.gz) preserves
both unretained candidates, all samples/audits, oracle results, exact named and
native snapshots, source/seal comparisons, stack classifier and the isolated
mask probe. Production sources are restored. The current native gate remains
**3/9**, qualified on `3a9a7913`; near parity is still unfinished.


### Compile-time closed serializer graphs: unretained screen

A separate prototype proves closed, nonrecursive generated model graphs before
lazy lowering. The existing positive-depth callback certificate can then return
its type identity without visiting every child. Its negative-depth certificate
for dynamic boxing stays unchanged. Runtime type-ID, tracing/finalizer
capability checks and callback snapshot policy remain unchanged; no runtime
method or public flag is added.

The proof rejects uncertain or effectful types, known descendants, custom codecs,
omission predicates, explicit deferred fields, generic models and unknown native
references. It follows resolved declarations across aliases and modules, includes
excluded modules when finding descendants, and bounds depth and total work.
Fifteen proof groups pass. Eighteen backend/runtime/enabled-control configurations
verify exact output, native-container override handling, mutation during callbacks
and actual removal of child-certificate visits. Existing callback-free Map and
snapshot-lifetime matrices pass 555 and 375 checks respectively. All nine complete
model/retained-GC oracles pass. Non-mutating certificate recording reproduces the
regular CITM binary exactly. Only CITM and GSoC benchmark images change; the other
seven remain byte-identical to the retained baseline.

Eight alternating fresh-process pairs on Apple M4 Max/AC, original classic
harness, SIMD/incremental, validation off and cache zero give:

| Workload | Baseline median µs | Candidate median µs | Paired geometric latency delta | Paired 95% interval |
|---|---:|---:|---:|---:|
| CITM | 96.645 | 97.680 | +1.21% | -0.49% to +3.13% |
| GSoC | 332.225 | 329.430 | -0.97% | -2.96% to +0.94% |

Neither interval establishes an improvement. The prototype is **not retained**;
production transform and runtime sources are restored. These are shared-host
measurements with process, memory and power audits, not an isolation claim.

The [sealed evidence](data/serialization-closed-and-mask-screens.json.gz)
contains both full-writer screens (80 process records), trial sources and images,
proof/runtime controls, model checks and per-file SHA-256 values. It supplements
the earlier archive's isolated lane-classifier probe. The qualified native
parity table remains unchanged at **3/9**, and the goal is still unfinished.

### Medium-string block classification: two rejected variants

Two further prototypes combine the overlapping blocks used for strings of
8–15 UTF-16 units. The first packs both blocks into byte lanes, conservatively
routing high Unicode through the complete writer. The second combines exact
16-bit predicates, preserving the original control/escape/surrogate test.
Both produce fresh output and retain the established escape fallback.

Each passes 1,872 root/field/reuse string-oracle checks, 324 callback-order and
retained-GC checks, and all nine complete-model/GC oracles. Each is then screened
with eight alternating fresh-process pairs per workload, using the retained
3a9a7913 images, original harness, SIMD/incremental, validation off, cache zero,
Apple M4 Max/AC and the shared host lock. Process/memory audits are preserved.

| Candidate | Workload | Paired geometric latency delta | Paired 95% interval |
|---|---|---:|---:|
| Packed | CITM | -0.53% | -1.48% to +0.36% |
| Packed | Poet | +8.44% | +6.47% to +10.78% |
| Packed | GitHub | -0.20% | -0.94% to +0.59% |
| Exact predicate | CITM | +0.23% | -1.25% to +2.11% |
| Exact predicate | Poet | +7.84% | +6.56% to +8.81% |
| Exact predicate | GitHub | +0.19% | -0.67% to +1.05% |

All eight Poet pairs are slower for both candidates. Neither is retained.
The packed variant conservatively falls back on all 99 medium strings in Poet,
although none contains an actual escape or surrogate. That is not a sufficient
causal explanation: the exact-predicate variant also regresses.

Named diagnostic images reproduce every non-custom section of their measured
images. Comparing symbolic functions shows that only the medium writer changes;
the general string writer remains identical. Binaryen also swaps the order of
the general string writer and a TLSF batch-allocation helper in both candidates,
rewriting references elsewhere. This is a verified layout difference, **not
proof that it causes the slowdown**. The audit preserves both structural and
symbolic comparisons rather than attributing every byte difference to new work.

The [raw evidence](data/serialization-medium-string-screens.json.gz) includes
96 timed process records, both prototypes/images, all correctness logs, named
controls, symbolic WAT, Unicode route audit and per-file SHA-256 seals. Production
sources remain unchanged. The native parity gate is still **3/9**.

## String-bearing array rows: fewer managed aliases

Generated string-bearing records can use the existing pointer-argument element
entry. The element's managed method receiver still roots it; the array remains
managed and its backing pointer is reloaded after callbacks. No pinning, output
cache, collector change or allocation-policy change is introduced.

The transform emits a compile-time hint only on plain, nongeneric model
declarations with a native string field and no direct native i64/u64 field.
Classification uses resolved type identity, including preserved aliases and
shadowed builtin names. Generic and inherited declarations do not introduce a
new hint. Presence queries do not invoke application members. Virtual custom
serializer dispatch, nullable elements and existing inherited hints remain valid.

Applying the entry to every generated row regresses CITM by 5.10% (eight-pair
95% interval +4.57% to +5.83%). Restricting it to string-bearing rows removes
most of that cost, but an independent capture still observes +0.86%. Retaining
the established wide-integer row path restores **CITM's entire benchmark binary
byte-for-byte**. GSoC, OTFCC and FGO also retain their baseline images.

All nine final production images match the measured restricted prototype
exactly. The Canada, GitHub and Poet images also match the earlier string-row
prototype, allowing those exact-image captures to be retained. Twitter and
Lottie receive a separate eight-pair capture after the final restriction.

| Corpus | Latest paired geometric latency delta | Paired 95% interval | Evidence |
|---|---:|---:|---|
| twitter | +0.06% | -0.51% to +0.65% | Unresolved |
| canada | -1.31% | -1.76% to -0.67% | Independent confirmation; 7/8 faster |
| citm_catalog | 0 | Identical binary | Original wide-integer path |
| poet | +0.45% | -0.60% to +1.43% | Initial -2.58% gain did not repeat |
| github_events | -0.48% | -0.78% to -0.19% | Latest capture; initial interval crossed zero |
| gsoc-2018 | 0 | Identical binary | Unchanged |
| lottie | -0.91% | -1.69% to -0.31% | Focused final-image screen |
| otfcc | 0 | Identical binary | Unchanged |
| fgo | 0 | Identical binary | Unchanged |

Canada's separate initial eight-pair capture is -1.60% (-2.69% to -0.34%),
also 7/8 faster, with the same final binary. Other small movements are not
claimed as independently repeated gains. These are AS-before/after results,
not a new native comparison. The latest native gate remains the earlier
**3/9** qualification until refreshed on this implementation.

Measurements use alternating fresh processes, the original classic harness,
SIMD/incremental, validation off, JSON_CACHE=0, Apple M4 Max/arm64/AC and V8
15.2.20. Process, VM and power audits preserve shared-host interference. The
balanced CITM probe uses all six three-variant orders twice. An unrelated
nested-object confirmation interrupted by an explicit user pause is preserved
separately; its 20 records are excluded from qualification.

A matched named diagnostic image reproduces every non-custom section of the
measured Poet image. Its root serializer's shadow-stack frame falls from 16 to
8 bytes, and its static shadow-store sites from 7 to 4. This demonstrates the
eliminated alias bookkeeping; it is not a cycle attribution or a claim that the
initial Poet timing gain repeated.

Validation on the final source:

- Nine full owning-model and retained-GC oracles pass, with exact final/prototype
  binary equality for every workload.
- 63 new checks cover collection after a serializer clears its owning array,
  heap-string descendants, nullable slots, inherited application-member
  collisions, alias identity and actual compiler-emission selection/fallback.
- 555 callback-free Map checks, 375 snapshot-lifetime checks and 1,872 string
  oracle checks pass on the restricted prototype.
- Actual tarball consumers pass 324 operations across 36 configurations.
- All 51 compiler-warning configurations pass, with AS201 enabled.
- Strategic serialization passes 760 checks across 38 configurations.
- Typecheck, lint and license headers pass.

The [sealed evidence](data/serialization-array-row-roots.json.gz) preserves
source variants, final-source images and WAT controls, all available raw samples
and audits, lifetime controls, fallback probes and per-file SHA-256 values.
It also retains the unshipped Unicode-prefix, forced-inlining and nested-object
experiments, plus the old stable-Map retries. No throughput claim is made for
those candidates. Near parity remains unfinished.

## Full native refresh at 6f69d211

Five alternating fresh-process pairs per corpus, using the original classic AS
harness and source-aligned complete owning models. Serialization creates fresh
strings in both engines. Apple M4 Max / arm64 / AC; AssemblyScript 0.28.20,
V8 15.2.20, SIMD/incremental, validation off and JSON_CACHE=0. Native uses GCC
16.2.0, C++26 reflection, -O3/-DNDEBUG/-mcpu=native, and simdjson 5.0.4 at
3b0b2b53aaffb46208817821dce2cd47a5e6bb2a. GB/s uses actual UTF-8 output bytes.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 7.60 | 10.97 | 0.69× |
| canada | 0.98 | 1.27 | 0.77× |
| citm_catalog | 5.22 | 10.47 | 0.50× |
| poet | 16.37 | 23.95 | 0.68× |
| github_events | 6.92 | 16.52 | 0.42× |
| gsoc-2018 | 9.47 | 17.19 | 0.55× |
| lottie | 25.61 | 23.39 | 1.10× |
| otfcc | 37.01 | 24.74 | 1.50× |
| fgo | 39.13 | 22.51 | 1.74× |

The complete gate still clears **3/9** at the 0.90 threshold and correctly
returns status 1. All 90 process records and complete output checks finish.
Source/input, Wasm, generated native-model and executable seals pass after
capture. The host audit retains 57 periodic power/VM/process/RSS snapshots;
these are shared-host observations, not isolation or per-engine peak RSS claims.

Changes from earlier native tables are not attributed to the array-row patch:
CITM/GSoC/OTFCC/FGO images are unchanged, and native timings also move between
captures. The paired AS-before/after evidence above isolates the smaller change.

The [raw qualification](data/serialization-array-rows-native.json.gz) preserves
198 sealed artifacts, all samples and logs, host audits, final Wasm images,
model/driver sources, compiler conditions, input/output hashes and end seals.
All earlier snapshots remain available. Near parity for the six remaining
workloads is still unachieved.

## Owning-array replacement control and rejected scanner screens

Two further isolated candidates are **not retained**. Both use sealed 6f69d211
baseline images, eight alternating fresh-process pairs, the original classic
harness, SIMD/incremental, validation off and JSON_CACHE=0. Apple M4 Max / arm64,
AC power and V8 15.2.20; every sample retains process and VM audits under the
shared timing lock. These shared-host screens do not refresh the native gate.

Replacing the pointer-entry loop's managed `src.dataStart` access with a raw
native-layout load removes one static shadow-stack store from the Poet Wasm.
The backing pointer is still reloaded after callbacks. A new lifetime control
replaces the parent's owning-array field during a custom child serializer,
forces incremental collection with allocation pressure, then serializes the
next element of the original array. Baseline and candidate pass 54 checks
across three modes and three runtimes. The production regression fixture now
covers that replacement, in addition to clearing the existing array; its full
suite passes **90 checks**, with no compiler warnings.

| Raw backing-pointer reload | Paired geometric latency delta | Paired 95% interval |
|---|---:|---:|
| canada | +0.11% | -0.20% to +0.44% |
| poet | -0.80% | -2.46% to +0.99% |
| github_events | -0.70% | -1.51% to +0.05% |

All intervals cross zero. The raw-load rewrite remains unretained.

A compile-only native-code capture of the matched named Poet image shows V8
already unrolls the existing 32-byte scan four times. Rather than duplicating
that loop, the second candidate combines two adjacent masks before one escape
reduction, scanning 64 bytes at a time. It preserves bounds and the established
exceptional fallback. The candidate passes 1,872 string oracle checks, 324
reservation/GC checks, and complete model/retained-GC oracles for all four
screened corpora. Correctness does not establish a performance improvement:

| Combined 64-byte masks | Paired geometric latency delta | Paired 95% interval |
|---|---:|---:|
| twitter | +0.38% | +0.06% to +0.65% |
| citm_catalog | +0.09% | -0.41% to +0.49% |
| poet | +3.13% | +2.18% to +3.96% |
| github_events | +1.68% | +0.61% to +2.99% |

Poet is slower in all eight pairs. The combined-mask candidate is rejected;
no specific machine-code cause is inferred from these timings. Production
serialization remains unchanged. Only the stronger lifetime regression and
these records are added.

The [sealed archive](data/serialization-native-load-and-string64.json.gz)
contains 93 files in 87 deduplicated SHA-256 blobs: all 112 timing records,
source variants, baseline and candidate images, build/oracle logs, replacement
controls, process/VM/power audits and the compile-only native-code diagnostic.
All measured image hashes are rechecked after capture. Native parity remains
**3/9 at 0.90**, with the full table immediately above still authoritative.

## Disabled metadata, reservation sizes and loop interaction: unretained

The installed AssemblyScript 0.28.20 runtime exposes no string-metadata bit.
Nevertheless, the SIMD writer compares its completed byte count and writes the
unchanged `rtSize` back after a clean long string. A two-site compile-time guard
removes those comparisons/writes when the flag is zero. It preserves the
nonzero-flag path: twelve control builds across three runtimes verify identical
images with a synthetic nonzero flag and correct scalar/field output with zero.
The synthetic flag is an **emission-preservation control**, not a compatibility
claim for an unpatched runtime executing flagged strings.

The guard passes 1,872 string-oracle checks, 324 reservation/GC checks and all
nine complete-model/retained-GC oracles. Its nine-corpus eight-pair screen is
mixed:

| Corpus | Paired geometric latency delta | Paired 95% interval |
|---|---:|---:|
| twitter | -1.44% | -2.32% to -0.42% |
| canada | +0.32% | -0.52% to +1.14% |
| citm_catalog | +0.09% | approximately 0.00% to +0.20% |
| poet | +5.57% | +3.50% to +7.72% |
| github_events | -3.55% | -4.16% to -2.95% |
| gsoc-2018 | -1.88% | -2.45% to -1.41% |
| lottie | -6.51% | -6.77% to -6.24% |
| otfcc | -0.60% | -2.43% to +1.06% |
| fgo | -0.07% | -1.95% to +1.24% |

CITM's tiny interval endpoint is below the printed latency precision; an
independent balanced capture crosses zero. No meaningful CITM change is claimed.
The Poet regression prevents retaining this guard as-is.

A matched named Poet image preserves every non-custom section of the measured
candidate. Same-process PC/native-cache captures show its general scanner's
11,232 instruction bytes are **identical** to baseline. The enclosing serializer
shrinks from 4,904 to 4,424 instruction bytes without increasing loop unrolling.
The samples do not establish why it slows down; neither register allocation nor
instruction placement is asserted as the cause.

Two attempts to mitigate the tradeoff are also unretained:

- Reuse sizes already read for reservation in callback-free generated schemas.
  Five complete-model/GC oracles, the string/reservation suites, 90 array-root
  checks, 555 callback-free Map checks and 375 snapshot checks pass. Its separate
  eight-pair screen still slows Poet by **2.85%** (95% +0.98% to +4.82%). The
  prototype would additionally require a conservative allocator/instrumentation
  proof before production use; no such unproven path is shipped.
- Advance the existing pointer-selected string-row loop by native byte offsets,
  retaining backing-storage reloads, managed receivers and virtual codecs. Both
  versions pass 90 root/GC checks and four complete-model/retained-GC oracles.
  The loop alone regresses Poet and Lottie.

A final balanced four-variant capture compares both changes independently and
together against baseline, with each variant occupying every measurement
position equally over eight groups:

| Corpus | Metadata guard | Byte-offset loop | Both |
|---|---:|---:|---:|
| citm_catalog | -0.30% | -0.06% | -0.18% |
| poet | +5.27% | +2.07% | +4.42% |
| github_events | -3.90% | -0.50% | -3.23% |
| lottie | -5.69% | +1.07% | -5.09% |

All CITM intervals cross zero. Metadata-only Poet is slower in all eight groups
(95% +4.05% to +6.66%); its GitHub and Lottie gains repeat (respectively -4.99%
to -2.89%, and -6.59% to -4.16%). The offset loop does not remove the regression.
All production and compiled-transform source is restored.

These are AS-before/after screens, using sealed images, the original classic
harness, SIMD/incremental, validation off, JSON_CACHE=0, Apple M4 Max/arm64/AC
and V8 15.2.20. Shared timing locks cover each complete capture; process/VM/power
audits preserve concurrent non-timing work. They are not isolated-host claims.

The next route audit records 8,934 Poet rows: every `id` is 36 UTF-16 units;
8,692 names have at most three units; descriptions span 0 to 1,108 units, with
821 in the 16–31 range. This motivates investigating bounded-string dispatch
rather than repeating the eight-to-fifteen-unit classifier experiments. It is
a distribution observation, not evidence of an optimization.

The [sealed archive](data/serialization-metadata-size-and-loop-screens.json.gz)
contains all **352** timing records, variant sources/images, controls, complete
model/GC logs, matched native diagnostics and the length audit. End image seals
pass. The native comparison is unchanged: **3/9 at the 0.90 gate**, still short
of near parity.

## Bounded strings and flat array workers: unretained

Two bounded clean-string writers target strings of 16–63 UTF-16 units. Both
retain the existing escape/surrogate fallback and metadata semantics. Each
passes 1,872 string checks, 324 reservation/GC checks, 90 array-root checks
and four complete-model/retained-GC oracles. An initial compact-loop screen
suggests a GitHub gain, but an independent balanced three-variant capture does
not resolve it. Explicitly unrolling those bounded blocks improves GitHub
while regressing Poet and CITM:

| Corpus | Compact loop latency delta (95% interval) | Explicit blocks latency delta (95% interval) |
|---|---:|---:|
| citm_catalog | +0.07% (-0.31% to +0.45%) | +1.02% (+0.59% to +1.49%) |
| poet | -0.31% (-1.72% to +1.34%) | +3.89% (+2.01% to +5.80%) |
| github_events | -0.76% (-1.81% to +0.24%) | -2.08% (-2.96% to -1.18%) |
| lottie | -0.47% (-1.52% to +0.33%) | -0.72% (-1.72% to +0.09%) |

A separate prototype moves plain string-row serialization into a generated
raw-pointer array worker. It retains the owning array, reloads native storage,
and falls back for nulls and unexpected subtypes. A second version batches
reservations over up to sixteen exact-type rows. Both pass complete CITM,
Poet and GitHub model/retained-GC oracles. The plain worker and the gated
chunk worker also pass nine runtime/backend selection checks and 81 callback,
array-replacement, growth and GC outputs. These checks are not a complete
proof for arbitrary allocator hooks, lexical bindings or reservation overflow;
no such unproven path is shipped.

The independent balanced capture resolves no improvement from the plain
worker. The chunk worker regresses Poet by **4.52%** (95% +3.14% to +6.01%,
slower in all twelve groups); CITM and GitHub intervals cross zero. All source
and compiled-transform edits are restored. Neither family is retained.

The [sealed archive](data/serialization-bounded-and-flat-array-screens.json.gz)
contains **364 timing records**, original/candidate sources and images,
correctness logs, callback/GC fixtures, process/VM/power audits and end-image
hash verification. It comprises 147 files in 118 deduplicated blobs. Captures
use the original classic harness, Apple M4 Max/arm64/AC, V8 15.2.20,
SIMD/incremental, validation off and JSON_CACHE=0 under the shared timing lock.
They measure AS-before/after changes, not a new native comparison or an
isolated host. The full native table remains unchanged: **3/9 at 0.90**.

## SIMD mask isolation: unretained

A matched compile-only ARM64 inspection shows V8 rematerializing three SIMD
classification constants inside each 32-byte block. Passing those constants
as vector arguments is insufficient: Binaryen removes the constant arguments.
Loading them from a static 48-byte table keeps the vectors in registers; the
matched named image preserves every non-custom section of the measured image.
This changes classification plumbing, not serialized-result caching.

Keeping masks in both the main scanner and its Unicode helper passes 1,872
string checks, 324 reservation/GC checks, 90 root checks, the scalar startup
control and all nine complete-model/retained-GC oracles. Its eight-pair
nine-corpus screen improves GSoC but regresses Poet. An independent balanced
twelve-group capture repeats both effects. Restoring only the original Unicode
helper removes the clear GSoC benefit:

| Corpus | Masks in both scanners (95% interval) | Main scanner only (95% interval) |
|---|---:|---:|
| citm_catalog | -0.26% (-0.72% to +0.12%) | +0.38% (-0.16% to +0.94%) |
| poet | +4.63% (+3.15% to +6.17%) | +1.46% (-0.08% to +3.08%) |
| github_events | +0.13% (-0.34% to +0.59%) | +0.01% (-0.57% to +0.62%) |
| gsoc-2018 | -3.48% (-3.89% to -3.02%) | -0.43% (-1.03% to +0.47%) |

Two further isolations each pass the string, reservation and root suites plus
four complete-model/retained-GC oracles. The Unicode-only variant leaves the
main scanner unchanged. The ASCII-block helper is inlined by Binaryen, keeping
the public scanner's three scalar parameters; it adds no helper call in the
measured Poet image. A separate balanced twelve-group capture still finds
unacceptable Poet tradeoffs:

| Corpus | Unicode helper only (95% interval) | Inlined ASCII-block helper (95% interval) |
|---|---:|---:|
| citm_catalog | +0.10% (-0.15% to +0.29%) | +0.26% (-0.02% to +0.53%) |
| poet | +6.62% (+4.78% to +8.34%) | +6.43% (+3.62% to +9.27%) |
| github_events | -0.96% (-1.60% to -0.34%) | -2.78% (-3.52% to -2.10%) |
| gsoc-2018 | -2.72% (-3.79% to -1.74%) | -1.44% (-2.23% to -0.69%) |

All entries are paired geometric **latency** deltas against the frozen
6f69d211 baseline; negative means faster. No specific spill, instruction-layout
or microarchitectural cause is established for Poet's regressions. None of
these candidates is retained, and production source is restored.

The [sealed archive](data/serialization-string-mask-isolation.json.gz)
preserves **432 process records** in 155 files / 140 deduplicated blobs,
including raw timing/host audits, source and image seals, correctness logs,
compile-only native diagnostics and runners. An initial scalar-startup harness
failure inherited SIMD mode into a non-SIMD compile; its diagnostic is retained
separately, and the corrected SWAR harness passes. The completed captures use
the original classic harness, Apple M4 Max/arm64/AC, V8 15.2.20,
SIMD/incremental, validation off and JSON_CACHE=0. Each uses the shared timing
lock; concurrent non-timing work is audited, so these are not isolated-host
claims. No new native qualification is claimed: **3/9 at 0.90** remains the
current result.

## Matched CITM attribution and numeric-row experiments

A new named CITM classic image matches every non-custom section of the frozen
baseline. The original harness is captured with same-process native regions,
code cache and 100-microsecond sampling. Of 16,576 total ticks, 3,009 contain
the actual serializer root or its benchmark closure. The generated root
contains 57.0% of those ticks; sweep, mark and member-visit routines together
contain 16.2%; 16.5% are unmapped. These are sampled locations, not hardware
cycle attribution. The root includes substantial inlined integer, literal and
array work, so its percentage does not isolate one operation.

Three investigations follow:

- Retain entry storage for compile-time string-valued Maps on the verified
  runtime path. Existing callback and snapshot policies remain unchanged.
  It passes 4,212 string/retention checks, 555 callback checks, 375 snapshot
  checks, 90 root checks and all nine model/GC oracles. Only CITM changes,
  but twelve pairs resolve no gain: **+0.17%** latency (95% -0.18% to +0.58%).
- Compute five-to-eight-digit integer pairs and padded trailing groups from
  independent quotients rather than serial remainders. It passes 85,995 exact
  numeric comparisons, 90 root checks and all nine model/GC oracles. The
  nine-corpus screen finds no CITM/Twitter gain and regresses Poet **7.32%**
  (95% +6.08% to +8.57%). It is rejected. An unchanged rebuild reproduces all
  nine frozen images exactly. Matched Poet native snapshots show only the
  large-integer helper and benchmark-result serializer changing; its main
  scanner, Unicode helper and root writer remain byte-identical. The slowdown
  is not attributed to active integer arithmetic.
- Borrow exact-type numeric rows through a generated raw-pointer array worker,
  retaining the owning array. Ordinary workers regress CITM. Inlining removes
  most of that penalty. Removing per-element type tests only for classes with
  no known descendants gives a CITM gain, but unconditional runtime plumbing
  also changes unrelated images and regresses Poet.

Each row-worker form passes its complete-model/retained-GC oracles and the
existing 90-root regression. These are experimental probes, **not complete
qualification** of foreign GC hooks and binding/collision cases. None is
retained. The strict unresolved-base prototype emits no workers and is not
timed; the corrected native-base version explicitly verifies emission for
CITM's Price and Area classes.

| Numeric-row variant | CITM paired latency delta | 95% interval |
|---|---:|---:|
| Broad worker | +5.79% | +5.06% to +6.37% |
| Worker restricted to array-field uses | +6.36% | +5.57% to +7.11% |
| Inlined worker | +1.05% | +0.46% to +1.76% |
| Inlined closed-leaf worker | -1.56% | -2.15% to -0.86% |
| Closed-leaf worker, conditional runtime injection | **-2.02%** | **-2.92% to -1.13%** |

The first two rows share a balanced twelve-group capture; inlining and leaf
selection have separate balanced captures. The leaf form's Poet regression is
**+2.31%** (+0.70% to +3.98%). The final variant instead injects runtime code
only when eligible workers exist, preserving **all eight non-CITM benchmark
images byte-for-byte**. Its independent twelve-pair screen is faster in 11/12
pairs. That is a promising first screen for this exact image; an independent
repeat and full callback/binding qualification remain necessary before keeping
it. No production source has changed.

The [sealed archive](data/serialization-citm-row-and-integer-screens.json.gz)
contains **480 process records**, 367 files in 213 deduplicated blobs, all
candidate/control sources and images, correctness logs, inactive-image and
unchanged-rebuild controls, matched profile/native diagnostics, process/VM/power
audits and end-image seals. It also preserves the prototype type/selector
errors separately. Screens use the original classic harness, Apple M4 Max /
arm64 / AC, V8 15.2.20, SIMD/incremental, validation off and cache zero. Shared
host locks cover complete timing batches; concurrent non-timing work remains
visible in the audits. Native qualification is unchanged: **3/9 at 0.90**.

## Closed numeric row borrowing: production qualification

The generated array worker now borrows a closed numeric row while keeping its
owning native array rooted. It is limited to non-generic, top-level leaf schemas
with integer/boolean fields and non-null wide-integer arrays. Custom codecs,
inheritance, conditional omission, lazy storage, uncertain descendants, array
subclasses, instrumentation, foreign GC hooks, shared memory and unverified
runtime implementations retain the established path. Runtime dependencies must
match both reviewed source and semantic AST fingerprints. Generated symbols are
reserved against application identifiers, and emitted type aliases retain their
original bindings.

The final implementation reproduces the screened CITM binary exactly. The other
eight classic binaries are byte-identical to `6f69d211`. All nine complete-model
and retained-GC oracles pass. An independent 12-pair confirmation on Apple M4 Max,
arm64, AC power, with the shared host timing lock measured:

| CITM serialization | Baseline | Candidate | Paired latency change |
|---|---:|---:|---:|
| Median latency | 95.24 µs | 93.62 µs | −1.64% [−2.49%, −0.87%] |

Eleven of twelve pairs favor the candidate. The interval bootstraps paired log
ratios (20,000 resamples); it is not the ratio of the medians. This repeats the
initial −2.02% screen. The original classic harness, fresh owning output,
SIMD/incremental runtime, validation off, JSON_CACHE=0 and source-aligned model
are unchanged. The capture retains power, process and memory audits; the host
was shared, not isolated. This is an AS before/after result, not a refreshed
simdjson ratio. The latest full native gate remains three of nine workloads.

Correctness checks passed: 96 active-row/binding/collision/subclass/fallback
checks; 16 runtime/source/AST/hook selection checks; 90 existing array-root
checks; 36 GC-marking checks; 555 map callback checks; 375 map snapshot-lifetime
checks; 760 strategic serialization checks; 324 packed-consumer operations across
36 configurations; and all 51 warning configurations with AS201 enabled.
The active-row test forces the stock collector at output-buffer growth and
counts collector steps **inside serialization**, after input construction. That
instrumentation is diagnostic only and is absent from the measured binaries.
Typechecking, lint and license checks also pass.

[Raw confirmation, sealed binaries, sources and validation logs](data/serialization-numeric-row-production.json.gz)
retain the final implementation and its exact measured image. The reviewed hash
manifest can be reproduced with `node scripts/update-array-row-runtime.mjs`
after rebuilding the transform; dependency changes require review before
refreshing that certificate.


## Full native refresh at abd0b5db

Measured on `89a92a60`, whose only follow-up is installed-package coverage; the
production implementation is `abd0b5db`. All nine images match the qualified
production candidates exactly. Five alternating fresh-process pairs per corpus,
90 process records, and 58 periodic host/power/memory audits were retained.
Source, input, native model and Wasm seals pass after the final sample. Output
and retained-model oracles pass throughout. The 0.90 gate returns status 1
because six workloads remain below the target, rather than from a runtime or
correctness failure.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 7.40 | 10.64 | 0.69× |
| canada | 0.97 | 1.27 | 0.77× |
| citm_catalog | 5.24 | 10.27 | 0.51× |
| poet | 16.78 | 23.98 | 0.70× |
| github_events | 6.93 | 16.58 | 0.42× |
| gsoc-2018 | 9.39 | 17.05 | 0.55× |
| lottie | 24.81 | 22.09 | 1.12× |
| otfcc | 36.85 | 24.56 | 1.50× |
| fgo | 39.18 | 22.40 | 1.75× |

Conditions: Apple M4 Max/arm64, AC power, V8 15.2.20, AssemblyScript 0.28.20,
SIMD/incremental, compatibility mode, validation off, JSON_CACHE=0. Native is
GCC 16.2.0 with simdjson 5.0.4 at pinned `3b0b2b53`, `-O3 -DNDEBUG -mcpu=native`.
Both writers produce fresh owning output. Native serializes owned C++ structs
into a fresh `std::string`; no output cache is used. Actual UTF-8 output bytes
and source-aligned inputs are unchanged. The shared lock excludes concurrent
timing batches; recorded background work means this is not an isolated host.
Changes from the earlier full native table are not attributed to the patch;
the independent 12-pair AS-before/after confirmation establishes its effect.

The packed-consumer gate was extended to assert selection of the numeric worker
under incremental GC through **both public entrypoints**, and fallback under
minimal/stub. All **360 operations across 36 configurations** pass on the actual
tarball, including exact wide-integer output. Lint and license CI pass on both
implementation and test commits; the full Tests workflows remain in progress
at this checkpoint.

[Raw full native capture and end seals](data/serialization-numeric-row-native.json.gz).
Near parity remains unfinished: three of nine corpora meet 90% of native throughput.
