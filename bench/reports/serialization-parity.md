# Native-struct serialization parity

**Methodology correction:** the historical native rows below used minified
input while the AS classic writers usually serialized a pretty-derived model.
This is materially unequal for Lottie: preserved raw fields make the AS output
about 1.48 MB versus native's 0.30 MB. Historical captures remain available,
but their Lottie throughput and parity ratios are superseded. The runner now
discovers the AS writer's actual initialization input and uses that layout for
native serialization and output-byte accounting. Source-aligned qualification
is reported below; the isolated AS-before/after screens are unaffected.

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
