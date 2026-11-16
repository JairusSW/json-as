# Native-struct serialization parity

**Methodology correction:** the historical native rows below used minified
input while the AS classic writers usually serialized a pretty-derived model.
This is materially unequal for Lottie: preserved raw fields make the AS output
about 1.48 MB versus native's 0.30 MB. Historical captures remain available,
but their Lottie throughput and parity ratios are superseded. The runner now
discovers the AS writer's actual initialization input and uses that layout for
native serialization and output-byte accounting. Source-aligned qualification
is reported below; the isolated AS-before/after screens are unaffected.

Latest full qualification: [nested-record refresh](#full-native-refresh-after-nested-record-accounting). Four of nine workloads meet the 90% gate; near parity remains unmet.

Latest implementation comparison: [nested record reservations](#nested-record-reservations), with lower Twitter and GitHub latency. This AS-before/after capture does not replace the native table.

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

## Nested numeric row proof

A completed closed-row proof can now support a parent containing arrays of
that row type. The existing proof excludes callbacks throughout the child;
nullable child elements use the established null branch. Unproved, recursive,
custom-codec and inherited children retain the ordinary path. This adds only
a constant-time lookup during field eligibility, without graph expansion.

The generated CITM writer now selects `SeatCategory` as well as `Price` and
`Area`. Two independent 12-pair captures compare with `abd0b5db`'s exact binary:

| Capture | Baseline median | Candidate median | Paired latency change | 95% interval | Pairs faster |
|---|---:|---:|---:|---:|---:|
| Initial screen | 94.135 µs | 93.565 µs | −0.77% | −1.41% to −0.37% | 12/12 |
| Independent confirmation | 94.07 µs | 93.76 µs | −0.60% | −0.98% to −0.30% | 12/12 |

All nine final images reproduce the screened candidates. The eight non-CITM
images remain byte-identical to the preceding production version. Original
classic harness, Apple M4 Max/arm64/AC, SIMD/incremental, validation off and
cache zero; each batch uses a separate shared timing-lock hold with process,
VM and power audits. These are shared-host AS-before/after measurements, not
an updated native table or proof of isolated-host performance.

The expanded row suite passes **156 checks**, including forced stock collection
inside nested output growth, nullable grandchildren, forward declarations,
self-recursive fallbacks and effectful children. Existing roots **90**, safety
**16**, packed-consumer **360/36**, all nine model/retained-GC oracles,
typecheck, lint and licenses pass. The selection assertion fails on the prior
implementation and passes on this one. Final images match both captures.

[Raw sources, images, checks and 48 timing records](data/serialization-nested-numeric-rows.json.gz).
The latest full native gate remains **3/9**; near parity is still unfinished.

## Lazy output reservation accounting

Before tightening numeric reservations, a regression probe found that generated
lazy writers could forward a large saved range without adding it to `stackSize`.
A following `bs.proposeSize` could therefore reserve less than the actual cursor
plus its requested bytes. The probe uses `JSON.__serialize` followed by a 1 MiB
whitespace append and stops on a capacity assertion **before** an unsafe write.
It fails on the preceding implementation.

Saved ranges and absent-null branches now propose their actual byte length.
Materialized values already account for their bytes through the ordinary typed
writer, so lazy slots no longer add a fixed integer-slot estimate to the object's
entry reservation. Keys and punctuation remain pre-reserved once. This restores
the same cumulative-budget contract for deferred and materialized values.

The new suite passes **108 checks** across all three backends and runtimes with
strictness off/on. It forces explicit deferral and checks materialized strings,
scalar/wide integer defaults, boolean/float defaults, both missing and materialized
nulls, size transitions, exact output and capacity for the following write.
The full strategic serializer suite passes **760 checks / 38 configurations**.
All nine classic images are **byte-identical** and their model/retained-GC oracles
pass. Typecheck, lint and licenses pass. This correctness fix makes no timing
claim and does not alter the native table.

[Reproducer, generated sources, unchanged images and validation logs](data/serialization-lazy-budget.json.gz).
The numeric reservation-tightening prototype remains separate and unretained.

## Retire unused numeric row reservations

A completed, callback-free borrowed row now retains its caller's outstanding
reservation and replaces only its own conservative estimate with bytes actually
written. Relative offsets survive buffer growth. Nullable rows and proved nested
rows use the same accounting. This relies on the preceding lazy-budget fix so
forwarded ranges participate in the cumulative budget too.

An allocation-policy probe on the real CITM schema found 1,359,480 reserved bytes
for 1,000,250 output bytes, selecting staging plus a copy. The candidate reduces
the reserved count to 1,053,194 and learns a 1,068,822-byte owned allocation. Warm
outputs are then produced directly as fresh managed strings. Twitter and Poet
already use owned output and their probe results are unchanged. These instrumented
observations establish the policy switch, not its individual cycle cost.

| Capture | Baseline median | Candidate median | Paired latency change | 95% interval | Pairs faster |
|---|---:|---:|---:|---:|---:|
| Initial screen | 93.515 µs | 84.68 µs | −9.41% | −10.11% to −8.73% | 12/12 |
| Independent final confirmation | 94.31 µs | 85.275 µs | −9.78% | −10.59% to −9.19% | 12/12 |

The final images match the initial prototype even after the lazy-budget fix.
All eight non-CITM images are byte-identical to the preceding production version.
All nine full-model and retained-GC oracles pass. Original classic harness,
Apple M4 Max/arm64/AC, SIMD/incremental, validation off, cache zero; separate
shared-lock holds with source/image seals and host/power/memory audits. These
are shared-host AS-before/after captures, not a refreshed native comparison.

The expanded reservation suite passes **162 checks** across backends, runtimes
and strictness: large deferred/materialized prefixes followed by numeric rows,
future typed fields, and a caller holding a 1 MiB reservation across the writer.
It validates exact output and capacity before the following append. A direct
unused-row-budget assertion fails with the preceding writer and passes here.
The **156** row suite retains forced GC inside output growth. Strategic **760/38**,
packed **360/36**, map callback **555**, map lifetime **375**, the owned-output
allocation/retention controls across nine configurations, source-safety **16**,
typecheck, lint and licenses pass.

[Sources, policy probes, images, checks and 48 timing records](data/serialization-row-reservation-accounting.json.gz).
The previous full native table remains authoritative at **3/9** until refreshed.


## Full native refresh at 4dc112c8

The final accounting implementation completes **90 process records**, five
alternating fresh-process AS/native pairs per corpus, with **58 periodic host
and memory audits**. All source, Wasm, native-model and input seals pass after
capture. Complete model outputs and retained-GC oracles pass. Every prepared
Wasm image matches the independently qualified candidate.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 7.31 | 10.65 | 0.69× |
| canada | 0.96 | 1.23 | 0.78× |
| citm_catalog | 5.76 | 10.23 | 0.56× |
| poet | 16.48 | 23.07 | 0.71× |
| github_events | 6.92 | 16.71 | 0.41× |
| gsoc-2018 | 9.45 | 17.18 | 0.55× |
| lottie | 25.04 | 22.90 | 1.09× |
| otfcc | 36.54 | 24.41 | 1.50× |
| fgo | 38.99 | 22.55 | 1.73× |

Same original classic owning-model harness, Apple M4 Max/arm64/AC, V8 15.2.20,
AssemblyScript 0.28.20, SIMD/incremental, compatibility mode, validation off and
JSON_CACHE=0. Native uses GCC 16.2.0, `-O3 -DNDEBUG -mcpu=native`, simdjson 5.0.4
at pinned `3b0b2b53`. Source-aligned inputs and actual UTF-8 output bytes remain
the throughput denominator. Both writers return fresh owning output without
output caching. These are shared-host measurements with recorded background
activity, not isolated-host results.

The accounting change's **−9.78%** paired latency confirmation establishes its
AS-only effect; movements between the full-table snapshots are not individually
attributed to it. The other eight AS images remain byte-identical to the prior
implementation. The 90% native gate still returns status 1 for **six below-target
workloads**, rather than for a runtime or correctness failure. **3/9** clear the
gate, so near parity remains unfinished.

Lint and License headers pass on `4dc112c8`; full hosted Tests are still running
at this checkpoint. Earlier baseline `89a92a60` has all three hosted gates green.
[Full raw native capture and end seals](data/serialization-row-accounting-native.json.gz).

## Array-only multiply-ten rounding

The stock buffered `Array<f64>` writer now uses a private formatter clone whose
two multiply-ten-plus-carry operations use bounded 32-bit limbs. The result is
exactly the high 64 bits of `a * 10 + carry`. Scalar writers retain their existing
formatter. This scope avoids the Poet regression seen with the earlier global
arithmetic experiment; it does not change Float64Array or StaticArray dispatch.

Selection requires known source and AST fingerprints, including the formatter's
helper, and follows the actual array import through named/star/local reexports.
An application-supplied wrapper is preserved. Unknown sources and non-JSON
compiler aliases decline selection; generated identifiers avoid application
names. Both raw and previously clamp-specialized stock formatters are supported.

| Capture | Canada baseline median | Candidate median | Paired latency change | 95% interval | Pairs faster |
|---|---:|---:|---:|---:|---:|
| Initial array-only screen | 2129.470 µs | 2035.935 µs | −5.12% | −5.79% to −4.50% | 12/12 |
| Independent guarded confirmation | 2140.320 µs | 2052.455 µs | −4.67% | −5.42% to −4.01% | 12/12 |

Twitter has no resolved change: initial paired latency −0.10% (95% −1.00% to
+0.75%); confirmation +0.50% (−0.37% to +1.55%). Seven other corpus images and
a scalar-only control are byte-identical to the preceding production version.
The guarded production images match the initial prototype. A clone-only control
also leaves all nine images unchanged, so cloning by itself does not explain
the screen result; arithmetic can still influence compiler inlining and layout.

Both captures use separate shared-lock holds on Apple M4 Max/arm64/AC, original
classic harness, SIMD/incremental, compatibility mode, validation off and cache
zero. Every process sample and host/memory audit is retained. These are
shared-host AS-before/after measurements, not isolated-host or peak-RSS claims.

Validation includes 68 source/AST/binding/hygiene/fallback/idempotence checks;
1,684,200 exact BigInt comparisons and 1,848 arrays / 239,736 numeric values
across 21 backend/runtime/diagnostics/control configurations. f64 output matches
the JavaScript canonical oracle exactly; f32 checks numeric round trips and
unchanged baseline formatting. The prototype also passed 400,100 arithmetic
cases per version and 448 baseline/candidate array comparisons with 113,376
numeric values per version. Explicit boundaries include signed zero,
subnormals, notation thresholds, extreme finite values and non-finite nulls.

All nine complete-model and retained-GC oracles pass. Existing row/GC 156,
reservation/default/capacity 162, strategic serialization 760/38 configurations,
packed consumer 360/36 and warning 51 configurations pass. AS201 remains enabled.
Typecheck, lint, licenses and focused formatting pass. All three hosted gates
are green on parent `581f7f2c`; candidate `a189859c` has its own CI run.

[Sources, binaries, controls, paired samples and native refresh](data/serialization-array-dtoa.json.gz).

## Full native refresh at a189859c

The guarded array-only rounding implementation completes **90 process records**,
five alternating fresh-process AS/native pairs per corpus, with **57 periodic
host and memory audits**. All source, Wasm, native-model and input seals pass
after capture. Every prepared image matches the independently confirmed candidate.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 7.41 | 10.74 | 0.69× |
| canada | 1.03 | 1.27 | 0.81× |
| citm_catalog | 5.93 | 10.51 | 0.56× |
| poet | 16.86 | 23.93 | 0.70× |
| github_events | 6.95 | 16.64 | 0.42× |
| gsoc-2018 | 9.46 | 17.09 | 0.55× |
| lottie | 25.32 | 23.03 | 1.10× |
| otfcc | 35.57 | 24.52 | 1.45× |
| fgo | 39.16 | 22.37 | 1.75× |

Apple M4 Max/arm64/AC, original classic owning-model harness, V8 15.2.20,
AssemblyScript 0.28.20, SIMD/incremental, compatibility mode, validation off and
JSON_CACHE=0. Native uses GCC 16.2.0, `-O3 -DNDEBUG -mcpu=native`, simdjson 5.0.4
at pinned `3b0b2b53`. Source-aligned models and actual UTF-8 output bytes remain
the throughput denominator. Both writers return fresh owning output without
output caching. Shared-host load and power audits accompany the raw samples;
this is not an isolated-host comparison.

The independent **−4.67% Canada latency** confirmation establishes the AS-only
change. Movements in the other full-table rows are not attributed to this patch;
seven AS images are unchanged and Twitter has no resolved paired difference.
The native gate exits 1 because **six workloads remain below 90%**, with no
runtime, model-oracle or seal failure. **3/9** meet the gate; near parity is still
unfinished. Lint and License headers pass on `a189859c`; hosted Tests are running.

[All 186 paired/native process records, controls and end seals](data/serialization-array-dtoa.json.gz).

## Skip zero cached-power low limbs in array formatting

The private stock `Array<f64>` formatter skips `umul64hi(pLo, y)` when `pLo`
is zero. The product is then exactly zero. Original scalar functions remain
unchanged. An untimed counter build observes **222,160 zero low limbs out of
222,160 opportunities** in the Canada model oracle's two layouts; Twitter
never enters this array rounding route in that census. Counters are absent
from the measured images.

| Capture | Canada baseline median | Candidate median | Paired latency change | 95% interval | Pairs faster |
|---|---:|---:|---:|---:|---:|
| Initial screen | 2037.535 µs | 1971.690 µs | −3.26% | −3.97% to −2.66% | 12/12 |
| Independent production confirmation | 2035.625 µs | 1968.120 µs | −3.63% | −4.89% to −2.76% | 12/12 |

Twitter remains unresolved: screen −0.13% (95% −0.35% to +0.08%); confirmation
+0.18% (−0.07% to +0.47%). Seven other corpus images and a scalar-only control
are byte-identical to the preceding implementation. Final production matches
the screened prototype. Separate shared-lock holds, original classic harness,
Apple M4 Max/arm64/AC, SIMD/incremental, compatibility, validation off, cache zero;
source/image seals and host/power/memory audits accompany all samples.

The formatter matrix passes **1,684,200** exact arithmetic comparisons and
**1,848 arrays / 239,736 values across 21 configurations** before helper-binding
hardening. All nine complete-model and retained-GC oracles pass. The unit suite
checks both zero-limb sites and unchanged originals. A separate output-budget
census at parent `e1b98813` finds that all nine warm workloads already use direct
owned output; it does not support attributing this gain to removal of staging
copies. Those probes are untimed and preserve their instrumentation separately.

### Resolved helper-import proof

A further regression exposed that rendered source/AST fingerprints do not cover
an import's resolved module path. A prior transform could redirect the stock
formatter's helper import while the original helper source remained present.
Both the array specialization and the earlier decimal-clamp optimization now
require that resolved import to select the verified helper source.

The AST reproducer fails before the fix. A real compiler control redirects the
import to a helper with an invocation counter. Its effects now match the
unspecialized reference exactly. **76 array guard checks**, **86 decimal-clamp
checks**, **1,844,600 arithmetic comparisons**, **2,024 arrays / 262,568 values
across 23 configurations**, and **324,990 existing decimal-clamp runtime checks**
pass. All nine benchmark images rebuilt at `33bdeaab` are byte-identical to the
captured `ff771e31` images. Typecheck, lint, licenses and focused formatting pass;
compiler diagnostics are checked in the runtime/image builds. The raw archive
includes the measured source versions as well as the final hardened sources.

## Full native refresh at ff771e31

The accepted independent repeat completes **90 process records**, five
alternating AS/native pairs per corpus, with **57 periodic host/memory audits**.
Its source, Wasm, native model and input end seals pass. Production images were
reused from the independently rebuilt, model/retained-GC-checked candidate;
native hashes were verified unchanged. The preparation and proof are retained.

The first complete native capture is preserved but excluded from this table.
It overlaps heavy compiler/test/editor activity, and native Canada spans
**1.665–2.846 ms**. The repeat's native Canada range is **1.646–1.693 ms**.
Selection of the repeat was made because of the observed interference before
its results were known. It is still a shared-host capture with background
audits, not an isolated-host or per-engine peak-RSS measurement.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 7.44 | 10.46 | 0.71× |
| canada | 1.04 | 1.25 | 0.83× |
| citm_catalog | 5.92 | 10.41 | 0.57× |
| poet | 16.77 | 23.44 | 0.72× |
| github_events | 6.98 | 16.58 | 0.42× |
| gsoc-2018 | 9.38 | 16.77 | 0.56× |
| lottie | 25.04 | 23.21 | 1.08× |
| otfcc | 36.90 | 24.38 | 1.51× |
| fgo | 38.88 | 22.51 | 1.73× |

Apple M4 Max/arm64/AC, original classic owning-model harness, V8 15.2.20,
AssemblyScript 0.28.20, SIMD/incremental, compatibility, validation off,
JSON_CACHE=0. GCC 16.2.0, `-O3 -DNDEBUG -mcpu=native`, simdjson 5.0.4 at
`3b0b2b53`. Source-aligned models and actual UTF-8 output bytes; fresh owning
output from both writers, with no serialized-output caching.

The independent paired **−3.63% Canada latency** result establishes the AS-only
change. Other full-table movements are not individually attributed to it.
**3/9** workloads meet the 90% native gate; six remain below target. The gate
returns 1 for that unmet target, with no runtime, oracle or seal failure. Near
parity remains unfinished. Lint and License headers pass on `ff771e31` and
`33bdeaab`; their full hosted Tests workflows are still running at this checkpoint.

[All 276 process records, both native captures, counters, guard regressions,
sources, images and end seals](data/serialization-array-zero-limb.json.gz).

## Build-time exponent metadata for private array formatting

The regular-normal path of the verified `Array<f64>` formatter now reads
precomputed exponent preparation instead of recalculating it for each value.
The irregular and subnormal paths retain their existing code. The table stores
power high/adjusted-low limbs, decimal exponent, shift and `h`; the original
`gPow10Hi` effect is preserved. Scalar formatting remains unchanged.

The table covers all 2,048 exponent encodings in **64 KiB**. It is calculated
when building the transform, with a reproducible generator checked against the
stock formatter's known source version. A consumer compilation decodes immutable
bytes once, then creates fresh AST nodes and bindings per program. Known source,
AST, import-target and compiler-alias guards remain required. Generated names
include the new table in collision checks.

A single static literal carries the binary UTF-16 payload. This reduces generated
expressions from 8,192 integers to one literal, and the data is absent from the
scalar-only and seven inactive corpus images. The affected classic binaries grow
by about 65 KiB. No per-value output or serialized JSON is cached. The static
literal's pointer is used for binary reads, with no runtime table construction.

| Capture | Canada baseline median | Candidate median | Paired latency change | 95% interval | Pairs faster |
|---|---:|---:|---:|---:|---:|
| Initial numeric-table screen | 1972.575 µs | 1775.790 µs | −10.32% | −11.16% to −9.51% | 12/12 |
| Interleaved single-literal comparison | 1943.480 µs | 1772.350 µs | −8.53% | −8.99% to −7.95% | 12/12 |
| Independent production confirmation | 1958.395 µs | 1773.690 µs | −9.87% | −10.48% to −9.28% | 12/12 |

The interleaved three-way comparison found the numeric representation about
0.54% faster on Canada, while the single-literal float-array fixture compiled
about 3.06% faster than that numeric prototype. Final generation moves the BigInt
work out of consumer compilations. It was selected for its much smaller AST and
confirmed runtime gain. Twitter's final paired result is unresolved: −0.18%
(95% −0.37% to approximately 0.00%). Seven other corpus images and the scalar-only
control are byte-identical to the preceding implementation.

All captures use separate shared-lock holds, Apple M4 Max/arm64/AC, original
classic harness, SIMD/incremental, compatibility mode, validation off and cache
zero. Every execution and compiler sample is retained with host/memory audits.
Compiler RSS is the Darwin child measurement, distinct from runtime-engine RSS.

### Final compiler cost

The final implementation is compared with a frozen `49b15495` transform bundle
using twelve alternating fresh CLI-process pairs per fixture and common explicit
`assembly/index` binding. Scalar-only compiled output is byte-identical between
versions. There is **no resolved compiler-cost change** in either fixture:

| Fixture | Baseline median | Candidate median | Paired wall-time change | 95% interval |
|---|---:|---:|---:|---:|
| Scalar-only | 794.571 ms | 793.446 ms | −0.01% | −0.31% to +0.30% |
| Float arrays | 932.929 ms | 931.282 ms | −0.14% | −0.49% to +0.21% |

Earlier prototype and pre-final compiler captures are preserved separately.
They are not substituted for these final results.

### Correctness and emission

**52,864 independent checks** compare all 618 stock cached powers with exact
normalized BigInt powers, all 2,048 exponent rows and 8,192 cells with the actual
Wasm calculations, and the emitted byte layout across incremental/minimal/stub
runtimes. The **99** source/AST/binding/hygiene/fallback checks include a collision
with the table name, unknown cached sources, and UTF-8 source emission of the
literal. Existing formatter checks pass **1,844,600** arithmetic comparisons and
**2,024 arrays / 262,568 values across 23 configurations**. The larger array oracle
also compares **448 outputs and exported formatter state**, with 113,376 numeric
values per version. Source aliases and redirected helper effects retain fallback.

The literal required preserving lone UTF-16 units when emitting quoted source
through UTF-8. Eight round trips include every UTF-16 unit; three tagged-template
raw-part controls prevent the fix from changing raw template text. Final images
rebuilt after that scope check match every independently measured candidate image.
All nine complete-model and retained-GC oracles pass. Packed consumer **360/36**
and compiler warnings **51 configurations** pass; AS201 remains enabled. Typecheck,
lint, licenses, generator reproducibility and focused formatting pass.

## Full native refresh at f6f0fb99

**90 process records**, five alternating fresh-process AS/native pairs per corpus,
complete with **56 periodic host/memory audits**. Source, Wasm, native model and
input end seals pass. Qualified model/retained-GC-checked images are reused and
native model/input hashes are unchanged. Canada AS spans 1.742–1.769 ms and
native 1.600–1.634 ms in this batch.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 7.55 | 10.92 | 0.69× |
| canada | 1.19 | 1.29 | 0.92× |
| citm_catalog | 5.95 | 10.51 | 0.57× |
| poet | 16.67 | 24.09 | 0.69× |
| github_events | 6.99 | 16.80 | 0.42× |
| gsoc-2018 | 9.44 | 17.09 | 0.55× |
| lottie | 25.49 | 23.20 | 1.10× |
| otfcc | 36.27 | 24.65 | 1.47× |
| fgo | 37.92 | 22.09 | 1.72× |

Apple M4 Max/arm64/AC, original classic owning-model harness, V8 15.2.20,
AssemblyScript 0.28.20, SIMD/incremental, compatibility, validation off,
JSON_CACHE=0. GCC 16.2.0, `-O3 -DNDEBUG -mcpu=native`, simdjson 5.0.4 at
`3b0b2b53`. Source-aligned models and actual UTF-8 output bytes; both writers
return fresh owning output without output caching. Shared-host conditions and
background activity are recorded, rather than claimed isolated.

**Canada now meets the 90% gate at 92.4% of native.** Together with Lottie,
OTFCC and FGO, that makes **4/9**. The gate still exits 1 for five below-target
workloads, with no runtime/oracle/seal failure. The independent AS-only result
establishes the Canada change; other full-table movements are not attributed
to this implementation. Near parity across all nine remains unfinished.

Hosted Lint and License pass on `f6f0fb99`. Tests caught a canonical-shard command
registration error before the new suite ran. Test-only revision `e5b5b4e6` moves
regeneration inside its canonical test module. The metadata suite, three shard
tests, and all 47 benchmark-tooling tests pass locally after correction. Runtime
and compiled transform code are unchanged by that fix. Final hosted Tests are
pending. Parent `49b15495` has all hosted gates green.

[All 426 process records, representations, compiler comparisons, stock proofs,
float/state/model controls, sources, images and end seals](data/serialization-array-exponents.json.gz).

## Current GitHub profile and rejected marking-inline screen

A fresh serialization-only profile on `788a1866` repeats the earlier split:
27.6% of samples in the SIMD range string writer, 26.7% in `__visit`, 9.8%
in the output allocator's sweep interrupt, and 6.3% in member traversal.
These are sampled function locations, not independent causal costs. The V8
profile decoder warns of a version mismatch; native-symbol labels are not used.
The model is parsed once from the recorded pretty input, then each operation
returns fresh owning output. This diagnostic does not replace the classic
native throughput table.

An isolated prototype adds `@inline` to the existing stock `__visit` after the
retained marking-body expansion. It leaves GC pacing, roots, list transitions,
and output ownership unchanged. Complete owning-model and retained-GC oracles
pass for CITM, GitHub Events and Poet. The three images grow by 1.2–2.3 KiB.
A four-pair screen alternates fresh baseline/candidate processes under the
shared host lock:

| Corpus | Baseline µs | Candidate µs | Median latency delta |
|---|---:|---:|---:|
| citm_catalog | 84.615 | 84.980 | +0.43% |
| github_events | 8.310 | 8.265 | −0.54% |
| poet | 195.985 | 198.275 | +1.17% |

This small screen does not establish a useful improvement, and the prototype
is **not retained**. Apple M4 Max/arm64/AC, original classic owning-model
harness, SIMD/incremental, validation disabled, JSON_CACHE=0, and the same
compiler/engine settings as the native refresh above. Background processes and
memory audits are preserved; no isolated-host claim is made. All baseline and
candidate image end seals pass. The production implementation and full native
table remain unchanged at **4/9** above the 90% gate.

[Raw profile, 24 paired-screen process records, prototype, model oracles,
audits, sources and sealed images](data/serialization-visit-inline-screen.json.gz).

## Packed scanning in exceptional string suffixes

The exceptional string writer previously continued clean runs through the
Unicode copier, whose packed loop also computes exact surrogate masks. A new
private continuation first uses the existing initial writer's cheaper packed
classification. Conservative hits and partial vectors retain the original
Unicode copier. The caller advances its output cursor by the consumed source
bytes. Source bounds, capacity accounting, escape expansion, managed roots and
output ownership remain unchanged; no output or classification cache is added.

The retained implementation is the simple bounds-hardened continuation.
An independent eight-pair all-nine confirmation alternates fresh processes
against `245543f4`, with every sample retained:

| Corpus | Paired geometric latency delta | Paired 95% interval |
|---|---:|---:|
| canada | −0.06% | −0.47% to +0.37% |
| twitter | +0.00% | −0.84% to +0.57% |
| citm_catalog | +0.10% | −0.11% to +0.28% |
| github_events | +0.43% | −0.03% to +0.96% |
| poet | +0.41% | −1.81% to +2.43% |
| gsoc-2018 | **−7.31%** | **−7.75% to −6.82%** |
| lottie | −0.41% | −0.85% to −0.09% |
| otfcc | −0.53% | −2.53% to +0.81% |
| fgo | −1.10% | −3.34% to +0.62% |

GSoC is faster in all eight pairs. No slowdown resolves in the other corpora;
Poet remains noisy, with four pairs faster and four slower. The earlier
four-pair all-nine screen agrees on the GSoC improvement. Intervals use 20,000
deterministic paired bootstrap resamples of process log-ratios. These are
shared-host implementation comparisons, not replacement native ratios or
isolated-host results.

Two alternatives are rejected. A nibble-table classifier passes all 65,536
UTF-16 unit comparisons and string/model oracles, but its four-pair screen
regresses GitHub, Poet and GSoC by approximately 7–10% median latency. Restricting
suffix entry to sparse actual expansions and returning immediately on another
hit reduces the GSoC gain to 3.92% and causes a resolved Poet regression of
2.18% (95% +1.16% to +3.28%, slower in all eight pairs). Neither is retained.
No specific register-allocation or instruction-layout cause is inferred.

The retained source passes all nine complete-model and retained-GC oracles,
**2,016** exact string-oracle checks across all backends/strictness/fast settings,
**324** callback/GC checks across nine backend/runtime configurations, **90**
array-root checks, **360** packed-consumer operations across **36** configurations,
and all **51** compiler-warning configurations. AS201 stays enabled. The expanded
string oracle adds 864 long clean suffixes followed by controls, quotes,
backslashes, BMP text and paired/unpaired surrogates at every vector-tail size.
Typecheck, lint, licenses and focused formatting pass.

## Full native refresh with suffix continuation

Five alternating fresh-process AS/native pairs per corpus produce **90 records**
with **57 periodic host/memory audits**. The qualified candidate images are reused;
all nine Wasm images, compiler-source hash, native models and input end seals pass.
The scalar-only control remains byte-identical. Both writers emit fresh owning
output on every operation; serialized output caching remains disabled.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 7.44 | 10.89 | 0.68× |
| canada | 1.17 | 1.25 | 0.94× |
| citm_catalog | 5.92 | 10.49 | 0.56× |
| poet | 16.61 | 23.78 | 0.70× |
| github_events | 7.01 | 16.61 | 0.42× |
| gsoc-2018 | **10.16** | **17.06** | **0.60×** |
| lottie | 24.17 | 22.46 | 1.08× |
| otfcc | 36.31 | 24.55 | 1.48× |
| fgo | 37.83 | 22.39 | 1.69× |

Apple M4 Max/arm64/AC, V8 15.2.20, Node 26.4.0, AssemblyScript 0.28.20,
original classic owning-model harness, SIMD/incremental, validation off and
JSON_CACHE=0. GCC 16.2.0, `-O3 -DNDEBUG -mcpu=native`, simdjson 5.0.4 at
`3b0b2b53`. Actual UTF-8 output bytes and matched initialization layouts are
preserved. Background activity is audited; this is not an isolated-host or
per-engine peak-RSS measurement. The independent AS-before/after capture
establishes the GSoC improvement; other full-table shifts are not attributed
to the implementation.

**4/9** still meet the 90% gate: Canada, Lottie, OTFCC and FGO. The gate's exit
status 1 reflects the five remaining below-target corpora, with no runtime,
oracle or seal failure. Near parity across all nine remains unfinished.

[All 610 measurement records, rejected variants, UTF-16 proof, validation logs,
sources, images and end seals](data/serialization-escape-suffix.json.gz).

## Nested record reservations

Generated records reserve worst-case numeric widths before emitting values.
Completed nested writers now retire only their unused estimates, preserving
all caller credits and computing positions relative to the current buffer.
This extends the existing numeric-row accounting to mixed nested records.
Eligibility uses resolved field/collection references and the existing verified
runtime/source/alias gate. Custom, deferred and generic writers retain their
original handling. Pure string records and standalone records gain no extra
bookkeeping. Existing borrowed numeric workers retain their original accounting.
No output cache, new managed metadata, tracing or GC pacing change is introduced.

An untimed policy probe on the unrestricted prototype reduced warmed owned
capacities from 898,070 to 840,762 bytes for Twitter, 1,068,822 to 1,016,386 for
CITM, and 124,940 to 118,598 for GitHub. Each still uses one learned owning
allocation rather than repeated growth. Smaller capacity alone is not a speed
claim: CITM subsequently shows no resolved throughput improvement.

The unrestricted prototype also changes the standalone benchmark result writer.
Its independent eight-pair screen resolves a small Poet slowdown (+1.12%,
95% +0.08% to +2.16%), although the timed Poet string records are unchanged.
That version is **not retained**; no instruction-layout cause is asserted.
The retained version restricts accounting to nested record declarations.
Canada, Poet, GSoC, OTFCC and FGO then remain **byte-identical** to `1fc04dc9`.

Eight independent alternating fresh-process pairs for each changed image:

| Corpus | Before GB/s | After GB/s | Paired geometric latency delta | Paired 95% interval |
|---|---:|---:|---:|---:|
| twitter | 7.409 | 7.516 | **−1.57%** | **−2.19% to −1.16%** |
| citm_catalog | 5.930 | 5.937 | −0.06% | −0.28% to +0.21% |
| github_events | 7.008 | 7.397 | **−5.29%** | **−6.01% to −4.42%** |
| lottie | 25.404 | 25.437 | −0.27% | −0.78% to +0.21% |

Twitter and GitHub are faster in all eight pairs. GB/s uses median process
latency and actual UTF-8 output bytes; paired intervals use 20,000 deterministic
bootstrap resamples of log-ratios. Apple M4 Max/arm64/AC, original classic owning
models and harness, V8 15.2.20, AssemblyScript 0.28.20, SIMD/incremental,
validation off and JSON_CACHE=0. Fresh owning output on every operation.
Host/memory audits and power state are preserved; this is shared-host evidence,
not an isolated-host or per-engine peak-RSS claim. All image end seals pass.
The production transform reproduces the exact measured images on all nine
corpora. **No new native ratios are claimed**; the last full native gate is 4/9.

The permanent regression first fails on the parent with 40,024 excess reserved
bytes. It now passes **162** output/reservation/capacity-transition/mutation/
retained-GC checks across nine backend/runtime configurations. It is registered
in `test:transform`. Current checks also pass: **760** strategic serialization
checks across 38 configurations, **90** array-root checks, **156** numeric-row
checks, **16** row-safety checks, **555** graph/alias/callback/GC checks,
**360** actual-tarball consumer operations across 36 configurations, and **51**
warning configurations with AS201 enabled. Typecheck, lint, licenses and focused
formatting pass. Hosted final-commit CI remains a separate gate.

Two additional prototypes are rejected. Mixed string-row borrowing passes model
oracles but its four-pair screen changes Twitter by +0.40%, CITM by +7.45%, and
GitHub by −0.24% median latency. Paired large-schema array iteration changes
Twitter by +0.12%, CITM by −0.15%, GitHub by +0.06%, and Lottie by −0.37%; it
establishes no useful gain, and no successful outlining mechanism is inferred.
A synthetic Binaryen control confirms that the installed native optimizer does
not honor the newer serialized inline hint. No shared toolchain is changed.

A separate stress case shrinks a managed-reference array, collects, then grows
its length before overwriting old slots. It aborts on the parent, the prototype,
and plain AssemblyScript without json-as or its transform. Those reproducers
are retained for upstream diagnosis, not claimed fixed here. The reservation
regression appends initialized rows instead.

[Raw 336 process records, rejected prototypes, policy observations, source/image
seals, correctness logs and plain-AS control](data/serialization-record-reservations.json.gz).
The previous complete native inputs/outputs remain in the hash-linked suffix
archive above.

## Full native refresh after nested-record accounting

The retained `be2c3d81` images pass a fresh five-pair AS/native comparison for
all nine corpora: **90 process records and 57 periodic host/memory audits**.
Complete model/output oracles, compiler sources, native inputs/models and all
nine AS image seals pass after capture. The gate exits 1 solely because five
corpora remain below 90%; no runtime or oracle failure occurs.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 7.50 | 10.76 | 0.70× |
| canada | 1.17 | 1.27 | 0.92× |
| citm_catalog | 5.89 | 10.49 | 0.56× |
| poet | 16.39 | 22.76 | 0.72× |
| github_events | 7.39 | 16.54 | 0.45× |
| gsoc-2018 | 10.21 | 16.71 | 0.61× |
| lottie | 25.11 | 22.97 | 1.09× |
| otfcc | 35.79 | 24.10 | 1.49× |
| fgo | 38.76 | 22.24 | 1.74× |

Apple M4 Max/arm64/AC, V8 15.2.20, Node 26.4.0, AssemblyScript 0.28.20,
SIMD/incremental, validation off, JSON_CACHE=0, original classic owning-model
harness. Native: GCC 16.2.0, `-O3 -DNDEBUG -mcpu=native`, simdjson 5.0.4 at
`3b0b2b53`. Models use matched initialization layouts, and GB/s counts actual
UTF-8 output bytes. Both writers produce fresh owning strings every operation;
neither caches serialized output. Shared-host background load is audited;
this is not an isolated-host or per-engine peak-RSS claim. Only the independent
AS comparison above establishes the nested-record implementation's Twitter
and GitHub gains; shifts in other full-table rows are not attributed to it.
**4/9** still pass: Canada, Lottie, OTFCC and FGO.

### Current serialization-only attribution

Three named classic modules match **every non-custom Wasm section** of the
qualified GitHub, CITM and Poet images. A copy of the original JS runner starts
and stops V8's CPU profiler at the serialization benchmark's log boundaries.
Thus deserialization samples are excluded without changing the AS program,
model, code layout or benchmark loops. Three fresh-process captures per corpus
use 100-microsecond sampling and retain power/process/memory audits. These
profiles diagnose work; their elapsed times are not throughput evidence.
The sampled interval includes the existing serialization warmup and completion
reporting, rather than claiming instruction costs for the timed loop alone.

| Corpus | Samples across three captures | Main sampled work |
|---|---:|---|
| github_events | 7,531 | Shared string writer 42.60%; generated array dispatcher 20.59% |
| citm_catalog | 7,953 | Generated `Citm.__SERIALIZE` 64.98%; integer-array writer 3.76% |
| poet | 4,549 | Shared string writer 65.44%; short-string writer 13.76%; array dispatcher 15.67% |

Mark, sweep and member-visit frames together account for approximately 17% of
GitHub samples, substantially less than the older isolated serialization
fixture suggested. That earlier fixture remains archived but should not guide
claims about the current classic loop. No C++ symbol attribution from a
version-mismatched tick processor is used here. Source inspection also confirms
that stock `Object.isPointerfree` already handles String/ArrayBuffer IDs before
an RTTI lookup, ruling out a redundant marking special case.

A separate same-process native-PC/code-cache capture verifies 159 functions and
628,128 compiled bytes. The actual `Citm.__SERIALIZE` is function 156, with
41,464 instruction bytes and 1,761 directly sampled PCs. Its hot locations
include numeric-row fields and array-header loads interleaved with literal
construction and integer width handling. This identifies locations, not memory
stall cycles or a single dominant operation; no hardware-counter claim is made.

### Three rejected follow-up probes

The old paired-array experiment still called a shared inline element helper.
A new variant duplicates the helper's dispatch directly at the two call sites.
It retains nullable/custom/subtype handling and backing-pointer reloads, and
emitted Wasm now contains a separate `Performance.__SERIALIZE` function where
the baseline inlines it. All nine model/retained-GC oracles and 90 forced
root/callback checks pass. Its four-pair median changes are Twitter +0.71%,
CITM +0.65%, GitHub −0.88%, and Lottie −0.35%. Actual outlining does not establish
a useful improvement; this version is rejected.

A global nine/ten-digit-first width ladder changes only dispatch order, retaining
all original arithmetic. It passes **85,995 exact integer comparisons** across
nine backend/runtime configurations and all nine model/GC oracles. The
four-pair all-nine screen improves CITM median latency by 1.76% but regresses
Poet by 3.08%, so it is rejected. A possible next experiment is private,
proof-gated field formatting that leaves standalone and pure-string modules
unchanged; no such implementation is included in this capture.

Finally, a preload variant moves field loads to the start of already-proved
callback-free numeric row workers, retaining the managed owner and per-row
reservation accounting. Only CITM changes; the other eight images remain
byte-identical. All nine model/GC oracles and **156 row/forced-collection checks**
pass, but the four-pair screen is 0.93% slower. It is also rejected.

The production tree retains none of these three probes. The verified native
result remains **4/9**, and the full near-parity objective is unfinished.
Hosted [Tests](https://github.com/JairusSW/json-as/actions/runs/43757607219),
[Lint](https://github.com/JairusSW/json-as/actions/runs/43757607397) and
[License headers](https://github.com/JairusSW/json-as/actions/runs/43757607180)
all pass on the retained implementation commit `be2c3d81`.

[Raw 202 measurement process records, ten diagnostic captures, prototypes,
current executable images, profiles, native instructions, correctness logs,
audits and seals](data/serialization-record-native.json.gz). Large native
inputs and outputs are SHA-256 checked against the hash-linked earlier suffix
archive rather than duplicated.

## Integer-row width dispatch: rejected after countercases

The next probes isolate the nine/ten-digit shortcut inside generated writers.
They preserve the original formatting arithmetic, output ownership, callbacks,
and allocation behavior. Each timing capture alternates fresh V8 processes
under the shared host lock on Apple M4 Max/arm64, AC power, with the original
owning-model harness, validation off and cache zero. Raw host/memory audits,
image hashes, complete-model/retained-GC checks and prototypes are retained.
These are AS-to-AS experiments, not new native throughput qualifications.

A broad nested-field variant changes four classic images. Its four-pair
geometric latency changes are Twitter **+0.92%**, CITM **−1.92%**, GitHub
**+0.69%**, and Lottie **+0.81%**. It is rejected.

Restricting the shortcut to already-certified numeric row workers changes only
CITM; the other eight classic images are byte-identical. A separate twelve-pair
confirmation improves CITM latency by **2.04%**, with all twelve pairs faster.
However, a 10,000-row countercase using three integer fields in the range 0–9
regresses **14.98% for i32** and **7.41% for i64** over four pairs each.
A corpus win does not justify those regressions; this variant is also rejected.

The final variant retains the original 0–99 branches before testing long widths:

| Capture | Pairs | Paired geometric latency change |
|---|---:|---:|
| CITM, complete owning model | 6 | +0.13% |
| i32 rows, values 0–9 | 4 | −0.20% |
| i64 rows, values 0–9 | 4 | −0.05% |
| i32 rows, values 123–10,122 | 4 | +0.12% |
| i64 rows, values 123–10,122 | 4 | +1.15% |

This removes the large tiny-number regression but establishes no useful CITM
improvement. None of the new writer implementations is retained. Canonical
runtime binding, foreign-module and fresh-symbol controls passed during the
prototype; exact formatting passed **114,660 comparisons** across all three
backends and runtimes. The retained tests now exercise numeric row serialization
as well as root/field/array routes, and serialization during repeated compiler
invocations. After removing the experimental writer, **114,660** integer,
**156** row/GC and **189** declaration/configuration checks pass, together with
build, typecheck, lint, licenses and focused formatting. The full native gate
remains **4/9**; near parity is unfinished.

[Raw 124 measurement process records, rejected source variants, images,
correctness logs, host audits and seals](data/serialization-row-width-rejected.json.gz).
The preceding native archive supplies hash-linked unchanged baseline images.

## Overlapping clean-string tails on the current writer

The earlier tail experiment was rejected on its original baseline. A recheck
against `be2c3d81` now establishes a useful result with the later string-writer
and generated-record changes. The main packed scan is unchanged. When it has
consumed a clean prefix and fewer than 32 bytes remain, classify the final
32 source bytes once and copy both vectors on a clean result. Both loads stay
inside the payload; conservative hits retain the existing Unicode/escape path.
The source and destination overlap only with their own already-copied prefixes.
No output or classification cache is introduced.

An initial four-pair screen is followed by an independent eight-pair all-nine
confirmation, with **144 alternating fresh-process records**. Negative numbers
below mean lower serialization latency:

| Corpus | Paired geometric latency delta | 95% paired bootstrap interval |
|---|---:|---:|
| canada | −0.36% | −1.46% to +0.78% |
| twitter | **−2.13%** | **−2.84% to −1.60%** |
| citm_catalog | −0.79% | −1.69% to −0.10% |
| github_events | **−5.04%** | **−6.01% to −4.09%** |
| poet | +0.19% | −2.05% to +2.78% |
| gsoc-2018 | **−2.39%** | **−2.75% to −2.02%** |
| lottie | +0.13% | −0.43% to +0.56% |
| otfcc | −1.04% | −2.30% to +0.36% |
| fgo | −0.98% | −2.32% to +0.08% |

Twitter, GitHub and GSoC improve in all eight pairs. Poet remains noisy, and
no other corpus has a resolved slowdown. CITM's preceding four-pair screen
was +0.15%, so its small confirmation change is not promoted as an independent
major improvement. All captures use the original classic owning-model harness,
Apple M4 Max/arm64/AC, V8 15.2.20, AssemblyScript 0.28.20,
SIMD/incremental, validation off and JSON_CACHE=0. The shared timing lock covers
each batch; raw process/VM/power audits preserve background activity. These are
AS-to-AS implementation comparisons, not a refreshed native table.

The production source reproduces **all nine measured Wasm images exactly**.
The expanded oracle adds lengths 47–49 to the existing control/surrogate checks
at every position. **2,016** root/field/reuse checks across twelve configurations,
**324** callback/reservation/GC checks across nine configurations, **156** numeric
row checks and **90** array-root/lifetime checks pass. **360** actual-tarball
consumer operations across **36** configurations and **51** warning configurations
also pass, with AS201 enabled, as do typecheck, lint, licenses and formatting.

A separate local escape-cursor prototype aggregates per-block expansion and
publishes the output cursor once. It passes the model/string/GC controls, but
its four-pair screen establishes no useful gain: CITM −0.04%, GitHub +0.34%,
Poet +0.95%, and GSoC +0.17%. It is rejected rather than combined with the tail
change. This isolation keeps the retained result attributable to the tail.

[Raw 208 process records, prototypes, production images, source/image seals,
complete-model and correctness logs, host audits and statistics](data/serialization-overlap32-retained.json.gz).
The preceding native archive supplies hash-linked baseline images. The latest
full native qualification still measures `be2c3d81` at **4/9**; this change needs
its own native refresh, and the all-nine near-parity objective remains open.

## Full native refresh after bounded tails

The exact retained implementation `7e84db95` now has its own full native
qualification: **90 process records**, five alternating fresh-process AS/native
pairs per corpus, and **56 periodic host/memory audits**. All nine complete-model
and retained-GC oracles passed before capture; source, input, Wasm and native
image seals pass afterward. The gate exits 1 because **4/9**, rather than all
nine, reach 90% of native throughput. There is no runtime or oracle failure.

| Corpus | json-as GB/s | simdjson GB/s | Ratio |
|---|---:|---:|---:|
| twitter | 7.533 | 10.719 | 0.703× |
| canada | 1.169 | 1.261 | 0.927× |
| citm_catalog | 5.953 | 10.507 | 0.567× |
| poet | 16.789 | 24.115 | 0.696× |
| github_events | 7.752 | 16.568 | 0.468× |
| gsoc-2018 | 10.440 | 17.051 | 0.612× |
| lottie | 25.463 | 23.278 | 1.094× |
| otfcc | 36.849 | 24.622 | 1.497× |
| fgo | 39.225 | 22.471 | 1.746× |

Apple M4 Max/arm64/AC, V8 15.2.20, Node 26.4.0, AssemblyScript 0.28.20,
SIMD/incremental, compatibility, validation off and JSON_CACHE=0. Native uses
the unchanged GCC 16.2.0 `-O3 -DNDEBUG -mcpu=native` images and simdjson 5.0.4
at `3b0b2b53`. Inputs match the classic initialization layout, usually pretty;
OTFCC and FGO use minified input. Both writers consume owning native models
and return fresh owning output each operation. Throughput uses actual UTF-8
output bytes. No serialized-output caching or GC pacing change is introduced.

The separate paired AS comparison above isolates the bounded-tail effect.
Changes between this native table and an older table also include host/run
variation in both engines and are not attributed entirely to the tail. Poet
illustrates the distinction: json-as measures 16.79 GB/s here while native
measures 24.12 GB/s, so its ratio is lower than in the preceding capture even
though neither this cross-batch change nor the noisy paired Poet result proves
a serializer regression.

[Raw 90 process records, host audits, sources, native and Wasm images,
complete outputs and end seals](data/serialization-overlap32-native.json.gz).
Large unchanged input/output files are hash-linked to the earlier suffix
archive. Shared-host audits are preserved; this is not an isolated-host or
per-engine RSS claim. The all-nine near-parity objective remains unfinished.

## Tiny strings and Unicode routing: global variants rejected

Two additional families were measured against the retained bounded-tail
implementation. None is included in production.

An exact SIMD classifier for two/three UTF-16 units passes **672** SIMD
root/field/reuse checks, **108** callback/reservation/GC checks and all nine
complete-model/retained-GC oracles. The independent eight-pair all-nine capture
(144 records), following a separate four-corpus screen (32 records), finds:

| Corpus | Tiny-string latency delta | 95% paired interval |
|---|---:|---:|
| twitter | **+0.52%** | +0.31% to +0.77% |
| github_events | **+0.63%** | +0.23% to +0.99% |
| poet | **−4.56%** | −6.95% to −2.24% |

Other six intervals cross zero. The Poet improvement does not justify slowing
the shared writer for the other two workloads. A three-character-only variant
also passes the string/GC controls and five complete-model oracles, but its
40-record screen encounters substantial late timing variability alongside
browser/GPU/window-server activity in the host audits. It is inconclusive;
no causation or qualified benefit is inferred from that screen.

The next family addresses long BMP strings: the signed packed main classifier
can flag ordinary U+8000–D7FF, after which the 16-byte loop can keep copying a
long run without entering the existing 32-byte exact Unicode helper. One
variant routes the remaining run through that helper after a clean block.
A second also replaces the helper's classifier with low/high-byte unzips,
masking ASCII tests by a zero high byte and testing surrogate high bytes.
Each passes **672** string checks, **108** callback/reservation/GC checks and
five complete-model/retained-GC oracles before timing.

A separate balanced capture uses all six orders of baseline, routing and
routing-plus-unzip: **90 fresh-process records** across five corpora.
Negative values below mean lower serialization latency:

| Corpus | Routing delta (95% interval) | Routing plus unzip (95% interval) |
|---|---:|---:|
| twitter | −0.94% (−2.07% to +0.19%) | −1.10% (−2.65% to +0.30%) |
| citm_catalog | **+1.52% (+0.40% to +2.73%)** | **+0.99% (+0.03% to +2.39%)** |
| github_events | **−1.48% (−2.55% to −0.61%)** | **−1.54% (−2.76% to −0.31%)** |
| poet | −0.83% (−2.88% to +1.20%) | −1.36% (−3.77% to +1.05%) |
| gsoc-2018 | −0.08% (−1.72% to +1.75%) | −0.59% (−2.10% to +0.35%) |

All direct unzip-versus-routing intervals cross zero. Both global variants
are rejected because of the CITM regressions; fewer classifier expressions do
not establish lower whole-model cost. No native-code or hardware-cycle cause
is inferred from these results.

These are AS-to-AS experiments on Apple M4 Max/arm64/AC, V8 15.2.20,
AssemblyScript 0.28.20, SIMD/incremental, validation off and cache zero, using
the original classic owning-model harness. Each timing batch holds the shared
host lock and retains host/memory audits and end-image seals. The production
source and current native table remain unchanged at **4/9**.

[Raw 306 process records, prototypes, executable images, correctness logs,
statistics, host audits and seals](data/serialization-tiny-and-unicode-rejected.json.gz).

## Private text-record helpers: array scope works, kernels remain unretained

The next experiment avoids changing the shared short-string writer. Generated
static records with at least three direct native string fields receive private
helpers. The first variant clones the SIMD pointer entry; the second preserves
the index wrapper's original short/long dispatch. A balanced six-order capture
compares both with baseline over the three changed corpora (**54 processes**).

The dispatch-preserving variant improves Poet by **4.66%** (95% paired interval
**−6.12% to −3.35%**, faster in 6/6 groups), but slows Twitter by **0.34%**
(+0.13% to +0.53%). GSoC has no resolved change. The simpler pointer-entry
variant improves Poet by 2.64% with a wider interval and resolves no Twitter or
GSoC improvement. Neither broad variant is retained.

Restricting selection to records used as array elements changes **only Poet**;
the other eight images become byte-identical to the qualified baseline. Poet
itself remains byte-identical to the previously measured dispatch-preserving
variant. This demonstrates code-generation isolation without using corpus or
class names. It does not establish that the kernel is universally beneficial.

The targeted positive oracle asserts actual helper selection and passes
**5,364 exact record/reuse checks across incremental, minimal and stub**, with
retained outputs checked after collection. The initial prototype adapter had
source/destination arguments reversed; the positive oracle and model checks
caught that before timing. The corrected adapter passes those controls.
Generic string checks alone did not exercise this new path.

Countercases serialize arrays of 1,000 three-field records with ten string
patterns, using six alternating fresh-process pairs per implementation. Each
process reports ten benchmarks and verifies every complete output. Four
successive kernels were tested (**48 processes / 480 benchmark records**):

- The original private three-character shortcut improves clean ASCII/BMP
  three-character fields by approximately 8%, but regresses two-character
  fields by 4.08% and a quoted three-character value by 8.08%.
- A bounded zero-through-three-character dispatch removes the extra scalar
  rescan after a failed vector check, but does not establish acceptable
  behavior across the countercases.
- Forcing that private helper inline improves several tiny-string countercases
  by roughly 17–20%, yet an independent **twelve-pair Poet confirmation** is
  **6.04% slower** (95% +4.67% to +7.26%, slower in 12/12 pairs).
- A hybrid keeps tiny scalar cases inline and the vector kernel out of line.
  Empty/one-/two-character countercases improve, but three-character, quoted,
  and seven-character cases slow by roughly 3–4%. Its separate **twelve-pair
  Poet confirmation** is **12.33% slower** (+10.40% to +14.28%, 12/12 slower).

All four pass the positive oracle. The inlined and hybrid variants also pass
all nine complete-model/retained-GC oracles, with eight byte-identical controls.
The two real-workload confirmations add **48 processes**. Synthetic gains,
fewer calls, and smaller scope are insufficient evidence of a whole-model
improvement. No register-allocation, instruction-cache, or frame-cost cause is
claimed without a matched native-code diagnosis.

All captures use Apple M4 Max/arm64/AC, V8 15.2.20, AssemblyScript 0.28.20,
SIMD/incremental, validation off and cache zero, fresh owning output and the
original classic harness. Separate shared-lock holds cover independent
batches; raw process/VM/power audits and end-image seals are preserved.
Production is unchanged at the `7e84db95` implementation, and the native gate
remains **4/9**.

[Raw 150 measurement processes / 582 benchmark records, source variants,
positive controls, adapter diagnostic, countercases, images, model/GC checks,
audits, statistics and seals](data/serialization-private-text-probes.json.gz).

## Matched-code diagnosis of the private-helper regressions

Named diagnostic modules reproduce **every non-custom Wasm section** of the
measured baseline, simple private helper, forced-inline and hybrid images.
This disproves the initial hypothesis that the regressions add a separate
`Poem.__SERIALIZE` call: all four keep record serialization inside the array
writer. Instead, the array writer itself becomes substantially larger.

| Variant | Array writer Wasm bytes | Native instruction bytes | Native stack slots | Static Wasm call sites |
|---|---:|---:|---:|---:|
| Baseline | 921 | 4,904 | 16 | 16 |
| Simple private helper | 921 | 4,904 | 16 | 16 |
| Forced inline | 2,822 | 12,852 | 20 | 25 |
| Hybrid | 1,803 | 8,428 | 16 | 25 |

Native code is captured by compiling the matched modules with TurboFan,
without instantiating them or executing the benchmarks. The pinned V8 cache
reader verifies function counts, total native-code bytes, offsets and trailing
budgets before disassembly. These are code-shape observations, not measured
cycles, dynamic call counts, cache misses or proof of a unique slowdown cause.
The hybrid's unchanged stack-slot count alone already prevents attributing
both regressions solely to a larger frame.

A final bounded leaf kernel stays out of line and handles lengths zero through
seven without expanding the array writer. It passes the positive **5,364**
record/reuse checks across three runtimes and all nine model/retained-GC
oracles. Only Poet changes; the other eight images remain byte-identical.
Its matched array writer retains **921 Wasm bytes**, **4,904 native instruction
bytes**, **16 stack slots** and **16 static call sites**.

The leaf kernel is still not retained. Its separate six-pair size countercases
(**12 processes / 120 benchmarks**) are mixed, and an independent twelve-pair
Poet confirmation (**24 processes**) establishes no gain: **+1.80%** paired
latency, 95% interval **−0.30% to +3.83%**, faster in only 4/12 pairs.
Preserving the caller's size and frame is insufficient qualification.

The compile-only diagnostics run without a timing hold; no module startup or
model serialization is executed. The countercase and confirmation captures
use separate shared-lock holds on Apple M4 Max/arm64/AC, V8 15.2.20,
AssemblyScript 0.28.20, SIMD/incremental, validation off and cache zero, with
fresh owning output and raw host/memory audits. Source/image seals pass.
Production remains unchanged; the full native gate is still **4/9**.

[Matched modules, complete executable-section proofs, native caches/disassembly,
call-site maps, bounded-leaf source/model/GC controls and 36 measurement
processes / 144 benchmark records](data/serialization-private-text-diagnosis.json.gz).

## Nine-digit triplets for wide numeric rows

The retained follow-up changes the arithmetic for nine-digit magnitudes in
resolved `i64`/`u64` fields of already-verified numeric array rows. It keeps
all width checks and the other widths unchanged, and leaves standalone and
narrower integer writers alone. Three immutable UTF-16 triplets replace four
digit-pair loads plus a leading digit. The private table is **6,002 bytes**,
including one padding code unit for the last bounded load; it has no managed
startup allocation or output cache. Overlapping stores stay inside the
existing 20-byte magnitude reservation. Large `u64` trailing groups retain the
original writer. CITM Wasm grows from 239,165 to 244,611 bytes: a net
**5,446-byte** increase, including the table and private code.

An initial six-pair CITM screen improves latency by **5.54%**, interval
**5.16–5.98%**, with 6/6 pairs faster. A separate balanced confirmation uses
all six baseline/inline/outlined execution orders twice, **36 fresh processes**:

| Variant | Paired CITM latency delta | 95% interval | Faster pairs |
|---|---:|---:|---:|
| Retained inline triplets | **−5.19%** | −5.65% to −4.69% | 12/12 |
| Unretained outlined triplets | −5.08% | −5.52% to −4.59% | 12/12 |

The outlined variant establishes no advantage. Production reproduces the
retained measured image exactly on all nine corpora; only CITM changes.
The other eight remain byte-identical to the parent.

This is a tradeoff, not a claim that every integer distribution improves.
A balanced same-source countercase batch (**18 processes / 90 benchmarks**)
compares all three variants. For the retained wide-field writer:

| Row magnitudes | Paired latency delta | 95% interval |
|---|---:|---:|
| 0–9 | +0.96% | −0.27% to +2.11% |
| Around 1,000 | +0.76% | +0.01% to +1.90% |
| Around 100,000,000 | **−12.77%** | −13.16% to −12.32% |
| Around 1,000,000,000 | +1.82% | +0.91% to +2.85% |
| Around 1,000,000,000,000 | +0.13% | −0.97% to +1.25% |

Each row contains three fields with mixed positive/negative values. The
scoped implementation retains the existing 32-bit writer: its small-i32
counter image is byte-identical to its control. The initial broader prototype
changed i32 fields too and regressed its small-i32 counter by 1.94%; it is
not retained. Separate initial wide-only and outlined counter captures remain
in the archive, including their smaller countercase regressions.

The permanent suite passes **403,832 exact-output/guard assertions across
11 configurations**, covering all modes and runtimes, signed minima, unsigned
maxima, every decimal boundary, random values, triplet-table endpoints,
colliding helper names, and observable effects from an AST-modified formatter.
Four configurations positively select the private helper and actively test
its output reservations. The test injects guards using the actual emitted
helper name after analysis. Initial prototype guards incorrectly named a
helper that the collision-avoidance pass then renamed; their `isDefined`
fallback meant they did not exercise bounds. Those initial runs provide
output comparisons only, and are superseded by the permanent positive guards.
All nine complete-model/retained-GC oracles, the 16 row-safety checks and 156
row/forced-GC checks pass. Actual-tarball consumers pass **360 operations
across 36 configurations**; all **51 warning configurations** pass with AS201
enabled. Transform build, typecheck, lint, license headers and focused
formatting pass.

Captures use Apple M4 Max/arm64/AC, V8 15.2.20, AssemblyScript 0.28.20,
SIMD/incremental, validation off and cache zero, original classic models,
fresh owning output and the shared timing lock. Raw host/memory audits,
source/image seals, full counter outputs and paired bootstrap statistics are
retained. The new evidence isolates AS implementation changes; it does **not**
refresh the native throughput table. That table's gate is still **4/9**, and
the all-nine near-parity objective remains unfinished.

[Triplet prototypes, measured and production images, corrected guard tests,
model/GC controls, countercases, 114 measurement processes / 282 benchmark
records, audits and seals](data/serialization-row-triplets.json.gz).


## Wide-row triplet native refresh

The complete refresh on **`d1f322e8`** retains **90 fresh process records**
(five alternating AS/native pairs per corpus) and **56 host/memory audits**.
All source, input, native, Wasm and output end seals pass. Exit status 1 is
solely the unchanged **4/9** threshold result, not an oracle or runtime failure.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 7.608 | 10.689 | 0.712× |
| canada | 1.175 | 1.271 | 0.925× |
| citm_catalog | 6.246 | 10.509 | 0.594× |
| poet | 17.052 | 22.548 | 0.756× |
| github_events | 7.732 | 16.589 | 0.466× |
| gsoc-2018 | 10.436 | 17.084 | 0.611× |
| lottie | 25.306 | 22.910 | 1.105× |
| otfcc | 36.324 | 24.483 | 1.484× |
| fgo | 39.073 | 22.505 | 1.736× |

CITM now measures **6.246 GB/s**, or **59.4%** of native throughput. The
independent balanced AS-to-AS confirmation above, rather than cross-batch
absolute times, establishes its **5.19% lower latency**. Other eight images
remain byte-identical to the parent. In particular, Poet's changed native
ratio is not attributed to the integer formatter: both engines' absolute
results vary across captures.

Conditions remain Apple M4 Max/arm64/AC, original source-aligned classic
owning-model harness, V8 15.2.20, AssemblyScript 0.28.20,
SIMD/incremental/compatibility, validation off and cache zero. Native remains
GCC 16.2.0 with `-O3 -DNDEBUG -mcpu=native`, simdjson 5.0.4 at `3b0b2b53`.
Rates use actual UTF-8 output bytes; every operation produces fresh owning
output. The shared-host audits are not an isolated-host or peak-RSS claim.
The five under-threshold corpora still require further improvement.

[Full 90-process native refresh, 56 host audits, source/input/native/Wasm/output
seals, current sources and images](data/serialization-row-triplet-native.json.gz).

## Private SIMD entry for flat text-array records

A private generated-field entry handles exactly three UTF-16 code units with
one bounded `u32` load and one bounded `u16` load. It builds a SIMD classifier
from those six source bytes, copies clean text, and sends escapes or surrogates
to the complete existing writer. Other lengths retain the original public
short-string caller. There is no new classification or serialized-output cache.

Selection is limited to closed, top-level, non-generic static schemas with
3–64 resolved native string fields and a proven native array use in a schema
field or top-level typed declaration/call. Custom codecs, lazy/conditional
fields, inheritance/subtypes, uncertain bases and unknown runtime hooks retain
the original path. The existing stock incremental-runtime proof is reused;
eight additional string/helper sources must match both raw source and normalized
semantic AST before rewriting. Generated names are collision-checked. Borrowed
string-row loops and changes to Map traversal are **not** part of this change.

The initial balanced five-variant capture uses ten orders, followed by an
independent eight-order four-variant confirmation. Both retain the original
classic Poet program and fresh owning output:

| Capture | Private-entry latency delta | 95% paired interval |
|---|---:|---:|
| Initial ten-order comparison | **−3.56%** | −4.83% to −2.43% |
| Independent eight-order confirmation | **−3.49%** | −6.09% to −1.27% |

The production Poet image matches the confirmed prototype exactly. The other
eight production images remain byte-identical to the preceding implementation.
An eight-pair countercase capture covers empty, one-, two-, three-, seven-,
sixteen-, 64- and 256-unit values, Chinese text, and quoted three-unit text.
ASCII/Chinese three-unit rows improve 6.23%/5.97%; empty/one-/two-unit intervals
cross zero. Quoted three-unit rows are +1.09% with an unresolved interval of
−0.22% to +2.36%. Longer countercases improve, but their shifts are not attributed
to the fixed-size branch, which they do not execute.

### Rejected alternatives

- A four-digit integer table improves CITM 1.64% in its screen, but adds about
  74 KiB over triplets and slows small integer rows 1.56%; it is rejected.
- A global version of the three-unit entry slows Twitter 0.33% and GitHub 0.59%
  in its four-pair screen. A shared ASCII predicate split slows Twitter 2.19%
  (95% interval +1.85% to +2.57%) in the six-pair full-corpus screen. Neither is
  retained; the private caller leaves those corpus images unchanged.
- Hoisting Map entries establishes no useful gain. That controlled-input
  diagnostic also lacks a sufficient proof against foreign scalar/unmanaged
  codec callbacks; it is not eligible for production.
- Borrowed string-row loops and removing their reservation retirement establish
  no reliable gain. A whole-array string-size prepass is 5.96% slower initially
  and 7.11% slower in confirmation. Keeping the output cursor across that whole
  array is 8.27% slower (95% interval +4.96% to +11.11%). All are rejected.

### Validation and measurement scope

**1,370,388 exact record/reuse checks across eleven configurations** pass,
including all backends/runtimes, positive helper selection, generated-name
collisions, modified-string-writer callback preservation, retained outputs
across collection, exhaustive three-unit code positions, edge products and
random triples. The nine complete owning-model/retained-GC oracles pass.
The existing suites add **16** row-source safety checks, **156** row checks,
**90** array/receiver/GC checks, **360** packed-consumer operations across
**36** configurations and **51** warning-free configurations with AS201 enabled.
Build, typecheck, lint, headers and focused formatting pass.

Apple M4 Max/arm64/AC, V8 15.2.20, Node 26.4.0, AssemblyScript 0.28.20,
SIMD/incremental/compatibility, validation off and JSON_CACHE=0. Every timing
batch takes the shared host lock; process/memory/power audits and raw samples
are retained. These are shared-host AS-to-AS measurements, not an isolated-host
or per-engine peak-RSS claim. The latest full native table remains the preceding
**4/9** qualification; no refreshed simdjson ratio is claimed here. The full
all-nine near-parity goal remains unfinished.

[Raw 412 process records / 892 benchmark records, prototypes, production images,
source proofs, correctness logs, audits and statistics](data/serialization-text-records.json.gz).

## Full native refresh after private text records

The committed implementation **`6d45901f`** was rebuilt on all nine corpora
and qualified in **90 fresh process records**: five alternating AS/native pairs
per corpus, with **57** periodic host/memory audits. All complete-model and
retained-GC oracles, source/input/native/Wasm/output end seals pass. The gate
exits 1 solely because **4/9**, rather than all nine, meet the 90% threshold.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|
| twitter | 7.564 | 10.602 | 0.713× |
| canada | 1.160 | 1.261 | 0.920× |
| citm_catalog | 6.193 | 10.382 | 0.596× |
| poet | 17.342 | 23.411 | 0.741× |
| github_events | 7.630 | 16.439 | 0.464× |
| gsoc-2018 | 10.242 | 16.821 | 0.609× |
| lottie | 24.475 | 22.625 | 1.082× |
| otfcc | 36.262 | 24.266 | 1.494× |
| fgo | 38.479 | 22.258 | 1.729× |

Poet improves in the independent AS-to-AS confirmation above, but its native
ratio is lower in this capture because native throughput also moves between
captures. The paired comparison establishes the implementation's **3.49% lower
latency**, not a cross-batch ratio subtraction. No changes in the eight
byte-identical images are attributed to the text entry. Canada, Lottie, OTFCC
and FGO still pass; the five other corpora remain below target.

Conditions remain Apple M4 Max/arm64/AC, V8 15.2.20, Node 26.4.0,
AssemblyScript 0.28.20, SIMD/incremental/compatibility, validation off and
JSON_CACHE=0, original source-aligned classic owning-model harness. Native:
GCC 16.2.0, `-O3 -DNDEBUG -mcpu=native`, simdjson 5.0.4 at `3b0b2b53`.
Both engines produce fresh owning output. Actual UTF-8 output bytes determine
the rates. Shared-host power/process/memory audits are preserved; this is not
an isolated-host or per-engine peak-RSS measurement. The all-nine near-parity
goal remains unfinished.

[Current native samples, 57 audits, committed source snapshot, native/Wasm
images, compiler/power metadata and end seals](data/serialization-text-record-native.json.gz).

## Verified Unicode scan for flat text-array records

The private text entry now checks the first eight code units of long strings
with two payload-bounded `u64` loads. When that prefix contains an upper-BMP
unit, a private reader uses an exact two-vector escape/control/surrogate mask.
This avoids the ordinary signed-packed classifier's conservative Unicode hit.
ASCII prefixes retain the existing public range writer; short/medium paths,
Unicode fallback, buffer ownership, GC pacing and output freshness remain.
There is no new classification or serialized-output cache. Existing resolved
schema, native-array reference, stock-runtime/source and alias/hook guards apply.

An executable installed-runtime probe returns `STRING_METADATA_MASK=0` and
`STRING_SIZE_MASK=0xffffffff`: the optional clean-string metadata is disabled
on AssemblyScript 0.28.20. A bulk-copy probe failed its positive-execution
assertion and was **not timed**. The retained change targets the active scanner.

### Production qualification

The prototype's eight-pair confirmation improves Poet 6.71% (95% interval
−8.49% to −4.62%), faster in 8/8 pairs. Production reorders the short and long
helpers, so it is measured independently rather than assumed byte-equivalent:

| Actual production comparison | Paired latency delta | 95% interval | Faster pairs |
|---|---:|---:|---:|
| Poet, twelve balanced orders | **−6.03%** | −7.57% to −4.59% | **12/12** |

All nine production model/retained-GC oracles pass; the other eight corpus
images remain byte-identical to the preceding qualified implementation.
The production countercase capture uses eight alternating fresh-process pairs:

| Three-string row values | Paired latency delta | 95% interval |
|---|---:|---:|
| Three ASCII units | +0.56% | −0.48% to +1.60% |
| Three Chinese units | +0.07% | −1.06% to +1.07% |
| Quoted three-unit text | **+2.02%** | +0.30% to +3.77% |
| Sixteen ASCII units | **+5.16%** | +4.60% to +5.79% |
| 64 ASCII units | **+3.00%** | +2.54% to +3.44% |
| 256 ASCII units | **+1.55%** | +1.37% to +1.75% |

This is a documented tradeoff, not a universally faster string path. The
complete native refresh below independently qualifies this production
implementation at **4/9**; the remaining five corpora are still below the 90% target.

### Alternatives rejected

Both global medium-string packed classifiers pass 1,012,404 output checks and
all nine model oracles each. Their balanced 162-process screen provides no
useful broad gain: one regresses Poet 0.91%, Canada 0.72% and OTFCC 1.66%; the
other regresses Poet 1.50%. Neither is retained.

Global conservative-hit verification also passes 1,012,764 output checks and
all nine model oracles per variant. Its separate 162-process screen improves
Poet 6.24%, but regresses GitHub 0.90% and GSoC 1.27%. Extending verification to
post-escape suffixes regresses GitHub 1.37% and GSoC 2.61%. Both are rejected.
Private always-exact, loop-routing, vector-setup, shorter-prefix and length-gated
variants are preserved as diagnostics; none replaces the measured production.
Initial parallel private-oracle/model batches shared scratch outputs. Those
checks are excluded; isolated paths and reruns provide qualification.

### Validation and conditions

**2,457,142 exact checks across thirteen configurations** pass. They include
all three modes/runtimes, generated-name collision, modified short/long writer
callbacks, retained-output collection, exhaustive code units at long-vector
boundaries, and actual forced collection in each long field of temporary arrays
(**966** collections in the three explicit lifetime cases). The reusable-row
fixture uses a real global array rather than an unused type declaration.

The existing row-source safety, row and array-root suites pass **16 / 156 / 90**
checks. **360** actual-tarball consumer operations across **36** configurations
and **51** warning configurations pass, with AS201 enabled. Build, typecheck,
lint, headers and focused formatting pass.

Apple M4 Max/arm64/AC, V8 15.2.20, Node 26.4.0, AssemblyScript 0.28.20,
SIMD/incremental/compatibility, validation off, JSON_CACHE=0, original classic
owning-model harness. Each timing batch holds the shared host lock, preserves
raw process/memory/power audits, and verifies image seals. No isolated-host,
per-engine peak-RSS or new native-throughput claim is made. The all-nine
near-parity objective remains unfinished.

[Raw 626 process records / 1,508 benchmark records, sources, images, independent
production confirmation, countercases, oracles, exclusions and audits](data/serialization-unicode-routing.json.gz).

## Committed Unicode implementation: full native refresh

Fresh builds of committed `f02a5194` pass all nine complete-output and
retained-GC model oracles. Five alternating AS/native pairs per corpus retain
**90 fresh-process records**. Source, input, native-model, Wasm and complete
output seals pass after capture. The threshold gate exits 1 solely because
**4/9** corpora meet 90%; no execution or oracle failure is hidden by that exit.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio | 90% gate |
|---|---:|---:|---:|---|
| twitter | 7.527 | 10.541 | 0.714× | Below target |
| canada | 1.159 | 1.257 | 0.922× | Pass |
| citm_catalog | 6.170 | 10.411 | 0.593× | Below target |
| poet | 18.261 | 23.751 | 0.769× | Below target |
| github_events | 7.640 | 16.351 | 0.467× | Below target |
| gsoc-2018 | 10.296 | 16.905 | 0.609× | Below target |
| lottie | 24.553 | 22.706 | 1.082× | Pass |
| otfcc | 35.957 | 24.418 | 1.473× | Pass |
| fgo | 38.558 | 22.099 | 1.745× | Pass |

This is a fresh native comparison, not an AS-to-AS delta against the preceding
capture. Poet's independently paired production improvement remains **6.03%**
lower latency; the native ratio here is **0.769×**. The documented ASCII
countercase regressions remain applicable.

Apple M4 Max / arm64 / AC, V8 15.2.20, Node 26.4.0, AssemblyScript 0.28.20,
SIMD/incremental/compatibility, validation off and `JSON_CACHE=0`. Original
classic owning-model/owning-struct harnesses produce fresh output per operation;
GB/s uses actual UTF-8 output bytes. Native: GCC 16.2.0,
`-O3 -DNDEBUG -mcpu=native`, simdjson 5.0.4 at `3b0b2b53`. Shared-host capture
holds the timing lock and retains **57 host/power/memory audits**;
this is not an isolated-host or per-engine peak-RSS claim.

[All 90 process records, audits, committed sources, images and end seals](data/serialization-unicode-native.json.gz).

### Experimental wide-integer array reuse

A separate probe reuses the already-generated verified row integer formatter
for native `i64[]`/`u64[]` writes. It adds no new table and leaves narrower
writers, native storage access, output reservation and GC ownership unchanged.
It changes only CITM's model image; the other eight match committed production.

**706,706 exact output/bounds checks across eleven configurations** pass,
including signed/unsigned extremes, random values, native subclass storage,
retained collection, generated-name collisions and modified-formatter effects.
All nine model/retained-GC oracles pass. The initial twelve alternating pairs
show CITM latency **−0.75%**, paired 95% interval **−1.26% to −0.24%**, faster in
**10/12** pairs. The independent reverse-order twelve-pair repeat is **−0.67%**,
interval **−1.61% to +0.33%**, faster in **10/12** pairs; it does not independently
resolve a CITM improvement. A separate six-pair native-array counter screen
checks complete outputs for every process:

| Array magnitudes | Paired latency delta | 95% interval |
|---|---:|---:|
| One digit | +0.90% | −0.16% to +2.13% |
| Four digits | −0.36% | −1.46% to +0.87% |
| Nine digits | **−15.77%** | −16.65% to −14.78% |
| Ten digits | +0.19% | −1.55% to +2.06% |
| Thirteen digits | +0.12% | −1.43% to +1.83% |

The synthetic nine-digit benefit is real within this screen, but the targeted
CITM gain remains small and independently unresolved. **The probe is not
retained in production and is not included in the native table.**

[Experimental source, images, full-model oracles, exact checks, 60 fresh-process
records / 108 benchmark records and host audits](data/serialization-triplet-array-probe.json.gz).

## Remove bookkeeping when clean-string metadata is unavailable

The installed AssemblyScript 0.28.20 runtime exposes a zero clean-string flag.
The SIMD root and pointer writers still checked the completed output length
and could write the unchanged size back into each clean source string. Two
compile-time guards now eliminate that check/store when the flag is zero.
The scanner, escaping, reservation, GC pacing and output ownership remain
unchanged. Nonzero metadata behavior is preserved; no new cache or state is
introduced. Text-record source/semantic-AST fingerprints are refreshed for
these exact source changes.

### Current baseline attribution

Nine serialization-only profiles use named GitHub/Twitter/GSoC images whose
non-custom Wasm sections match their qualified baseline images exactly. Across
three captures per workload:

| Workload | Samples | Largest sampled frames |
|---|---:|---|
| GitHub | 7,366 | String range writer 38.15%; array dispatcher 23.45%; GC visit 11.16% |
| Twitter | 6,364 | Status writer 33.63%; string range writer 27.34%; GC visit 8.82% |
| GSoC | 7,069 | String range writer 73.66%; Org dispatcher 9.17%; Map dispatcher 5.15% |

These locate sampled work; they are not additive causal costs, post-change
profiles, throughput evidence or hardware-counter measurements. The profiler
starts/stops at the serialization log boundaries, including existing warmup
and completion reporting while excluding parsing benchmarks.

### Independent production comparison

All nine production binaries match the first screened prototype byte for byte.
Two independent eight-pair all-nine captures retain **288 fresh-process records**.
The second reverses baseline/candidate order and verifies a complete current
source hash before/after capture, in addition to image seals. Both retain
power, process and memory context.

| Corpus | First paired latency delta | Independent production delta | Production 95% interval |
|---|---:|---:|---:|
| canada | +0.23% | +0.13% | -0.99% to +1.30% |
| twitter | -2.07% | -2.17% | -2.41% to -1.84% |
| citm_catalog | -0.55% | -0.50% | -1.04% to -0.11% |
| github_events | -5.28% | -5.71% | -6.48% to -5.18% |
| poet | -6.86% | -1.00% | -3.26% to +1.48% |
| gsoc-2018 | -3.32% | -3.39% | -3.74% to -3.10% |
| lottie | -6.54% | -6.52% | -7.72% to -4.59% |
| otfcc | -0.04% | +0.24% | -0.65% to +1.17% |
| fgo | +0.74% | +0.08% | -0.66% to +0.83% |

GitHub, Twitter, GSoC and Lottie improve in every production-confirmation pair.
CITM repeats a smaller improvement (6/8 faster pairs). Poet's large first-screen
change does **not** resolve in the independent repeat; no Poet improvement is
claimed for this guard. Canada, OTFCC and FGO also remain unresolved. No corpus
has a statistically resolved regression in these captures.

The same guard was rejected on an older implementation because it regressed
Poet. The current private text writer and code layout differ; these results
qualify the current production images and do not invalidate that older result.

### Correctness and conditions

The new regression is red without the guards and passes **114 output/header/
emission checks across twelve builds**. With flag zero, scalar and field output
survives collection and source header sizes remain unchanged. With a synthetic
nonzero flag, guarded/control Wasm images are byte-identical in all three
runtimes. That is an emission-preservation control, **not** a claim that stock
AssemblyScript can execute metadata-tagged strings.

**1,012,764** prototype string/reuse checks across three runtimes and all nine
model/retained-GC oracles pass. Production additionally passes **2,457,142**
text-record checks across thirteen configurations, **2,016** string-oracle checks,
**16 / 156 / 90 / 162** safety/row/root/reservation checks, **360** actual-tarball
operations across **36** configurations and **51** warning-free configurations
with AS201 enabled. Build, typecheck, lint and license checks pass. The new
metadata regression is registered in the transform suite.

Apple M4 Max/arm64/AC, V8 15.2.20, Node 26.4.0, AssemblyScript 0.28.20,
SIMD/incremental/compatibility, validation off, `JSON_CACHE=0`, original classic
owning-model harness and fresh output per operation. Each timing batch holds
the shared host lock. Shared-host activity is audited; no isolated-host or
per-engine peak-RSS claim is made. The full native qualification below
includes these guards and remains **4/9**.

[Production and prototype sources/images, 288 process records, nine diagnostic
profiles, exact checks, model oracles, controls, audits and seals](data/serialization-zero-metadata.json.gz).

## Zero-metadata guard: committed full native refresh

The native refresh qualifies committed `77ee0cd6` with **90 fresh-process records**:
five alternating AS/native pairs per corpus. Source, input, native models, all
nine Wasm images and complete output seals pass after capture. All production
images are the exact ones qualified by the model/retained-GC oracles and the
independent AS confirmation above. The 90% threshold gate exits 1 solely because
**4/9** pass; no execution, coverage or integrity failure is hidden by that exit.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio | 90% gate |
|---|---:|---:|---:|---|
| twitter | 7.733 | 10.435 | 0.741× | Below target |
| canada | 1.156 | 1.262 | 0.916× | Pass |
| citm_catalog | 6.078 | 10.403 | 0.584× | Below target |
| poet | 19.544 | 23.178 | 0.843× | Below target |
| github_events | 8.121 | 16.457 | 0.493× | Below target |
| gsoc-2018 | 10.751 | 16.990 | 0.633× | Below target |
| lottie | 26.607 | 22.780 | 1.168× | Pass |
| otfcc | 36.089 | 24.364 | 1.481× | Pass |
| fgo | 38.617 | 22.315 | 1.731× | Pass |

This table is a fresh native comparison, not an AS-to-AS causal delta against
the preceding table. Only the independent comparisons above establish the
metadata guard's implementation changes. In particular, Poet's higher observed
native ratio does not turn its unresolved AS confirmation into a proven guard
improvement. GitHub, CITM, GSoC, Twitter and Poet remain below the 90% goal.

Apple M4 Max/arm64/AC, V8 15.2.20, Node 26.4.0, AssemblyScript 0.28.20,
SIMD/incremental/compatibility, validation off, `JSON_CACHE=0`, original classic
owning-model/owning-struct harnesses and fresh owning output every operation.
GB/s counts actual UTF-8 output bytes. Native: GCC 16.2.0,
`-O3 -DNDEBUG -mcpu=native`, simdjson 5.0.4 at `3b0b2b53`. The shared timing
hold finished normally and retained **57 host/power/memory audits**;
this is not an isolated-host or per-engine peak-RSS claim.

[All 90 process records, audits, committed source snapshot, images and end seals](data/serialization-zero-metadata-native.json.gz).

## Narrow overlapping string tails: rejected

A separate probe handles at most sixteen remaining bytes after the clean
32-byte loop with one payload-bounded overlapping `v128` load/store, retaining
the existing 32-byte tail for larger remainders. Public writers use the packed
classifier; private text-record writers retain their exact surrogate/control
mask. Opening/closing quotes, output length, reservation and exceptional fallback
remain unchanged. No output or classification cache is added.

**1,405,980 exact record/reuse checks across three runtimes** pass. They cover
every UTF-16 unit at tail boundaries, edge/random surrogate combinations and
retained-output GC. Separate counters positively verify public execution in
all runtimes and private execution only in the eligible incremental runtime.
All nine complete-model/retained-GC oracles also pass.

A six-pair all-nine screen retains **108 fresh-process records** and verifies
complete source, prototype and binary seals before/after timing:

| Corpus | Paired latency delta | 95% paired interval |
|---|---:|---:|
| canada | -0.86% | -2.04% to +0.22% |
| twitter | -0.88% | -2.11% to +0.34% |
| citm_catalog | +0.43% | +0.01% to +0.87% |
| github_events | +0.00% | -0.66% to +0.64% |
| poet | -1.82% | -5.24% to +1.40% |
| gsoc-2018 | +0.11% | -0.55% to +0.76% |
| lottie | -0.57% | -1.30% to +0.21% |
| otfcc | +0.42% | -0.33% to +1.43% |
| fgo | -0.03% | -0.75% to +0.64% |

No workload establishes a useful gain. CITM's +0.43% screen has a marginal
positive lower endpoint near benchmark print precision; it is not a reason
to retain this change. The probe is **rejected**, and production source/binaries
remain unchanged. This is a negative optimization screen, not a new native
qualification or an explanation of machine-code costs.

Apple M4 Max/arm64/AC, V8 15.2.20, AssemblyScript 0.28.20,
SIMD/incremental/compatibility, validation off, `JSON_CACHE=0`, original classic
owning-model harness and fresh owning output. The shared timing hold finished
normally; process/memory/power context and all seals are retained. No
isolated-host or per-engine peak-RSS claim is made. The committed production
native gate remains **4/9**, as qualified above.

[Probe source/images, 108 samples, model/GC oracles, exhaustive boundary checks,
positive execution controls, audits and seals](data/serialization-tail16-screen.json.gz).

## Borrow children from closed generated record owners

A generated child's default serializer receives its storage pointer explicitly.
On qualified closed graphs its implicit receiver is unused, but ordinary managed
calls still introduce duplicate shadow-stack stores. A bounded compile-time
proof now permits fresh child loads to call a private pointer entry while the
managed owner keeps the complete child graph traced. No output or classification
cache, runtime state, public decorator, or reader change is added.

The proof requires verified runtime/string sources and plain generated fields;
it rejects unmanaged classes, inheritance/known descendants, manual/custom
serializers, deferred fields, omission predicates, uncertain bindings, floats,
unsupported native references, recursive/forward-unknown graphs, and excessive
analysis depth/work. Nullable preloaded locals retain rooted dispatch. Caller
and loaded child types must resolve to the same known declaration; emitted type
spellings remain in their original scope. Generated runtime receiver use also
forces the original path.

The unmanaged exclusion is necessary: a prototype that borrowed through an
unmanaged owner traps after forced collection and replacement allocations.
The identical rooted control passes. The guarded prototype passes 1,200
unmanaged-owner stress checks across twelve configurations; the original unsafe
probe remains deliberately red. This was an unpublished prototype defect, not
an existing-library regression.

The GitHub named-image audit removes fourteen static shadow-stack store sites
from the array dispatcher (57 to 43). These are static sites, not executed
instruction counts. Named baseline/candidate non-custom Wasm sections match the
actual screened images. Only Twitter, GitHub and GSoC change; the other six
corpus images remain byte-identical. Wasm sizes decrease by 114, 208 and 68
bytes respectively.

Two independent eight-pair captures, with reversed variant order in the second,
retain **96 fresh-process records**, power/process/memory audits and complete
source/prototype/image seals. They compare the guarded prototype against
`fdf9abc2`'s production implementation (runtime equivalent to `77ee0cd6`).
Negative percentages below mean lower serialization latency.

| Corpus | First latency delta | Independent repeat | Repeat paired 95% interval |
|---|---:|---:|---:|
| twitter | -0.30% | -0.41% | -0.84% to -0.02% |
| github_events | -1.23% | -0.62% | -1.05% to -0.17% |
| gsoc-2018 | -0.72% | +0.08% | -0.47% to +0.73% |

Twitter and GitHub repeat small improvements; GSoC remains unresolved. These
are shared-host Apple M4 Max/arm64/AC results, not isolation claims. Conditions
remain SIMD/incremental/compatibility, validation off, `JSON_CACHE=0`, original
classic owning-model harness, fresh owning output each operation, V8 15.2.20 /
Node 26.4.0 / AssemblyScript 0.28.20. No native throughput is inferred from these
AS-only comparisons; the preceding full-native 4/9 gate remains the latest
qualified native table until refreshed.

Final production transform images match the measured guarded prototype on all
nine corpora, and all complete-model/retained-GC oracles pass. The permanent
borrowed-record suite passes **8,064 output checks across eighteen configurations**
(NAIVE/SWAR/SIMD, incremental/minimal/stub, O0/O3), including 4,608 collections
at borrowed entries, additional leaf-allocation stress, unmanaged-owner
fallbacks, nullable children and arrays. Separate prototype controls cover
custom mutations, modified runtime helpers, aliases, receiver shadowing and
inherited dispatch. Full text-record, integer-row, root/reservation, Map callback
and installed-consumer validation is retained with the raw evidence.

The final local gates pass: **2,457,142** text-record checks, **403,832** integer
oracle comparisons, **16/90/162** safety/root/reservation checks, **555/375** Map
callback/lifetime checks, **360** actual-tarball operations across **36** consumer
configurations, and **51** warning-free native/WASI/test configurations. AS201
remains enabled. Transform build, typecheck, lint and license headers pass.

[Raw paired samples, audits, exact images, generated-code audit, GC counterexample,
controls and production validation](data/serialization-borrowed-records.json.gz).
