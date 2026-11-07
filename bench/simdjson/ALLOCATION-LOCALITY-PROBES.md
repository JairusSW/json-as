# Small-allocation locality experiments

These are experiments against production source `6f93cae9`, with documentation
head `7a7173a0`. Neither allocator prototype has been integrated. The public
classic class models, ordinary fresh `JSON.parse<T>()`, old benchmark harness,
incremental runtime, validation-off and cache-off settings are unchanged.

## Single mixed-size stream

The prototype replaces the separate small-block size-class streams with one
8 KiB raw allocation stream for requests through 124 bytes. Each object still
receives an ordinary managed header, participates in the standard collector,
and can be freed individually. An undersized unfinished tail is returned to
the native allocator before another chunk is requested. This is not a graph
arena. RTrace and unsupported runtimes retain their original paths.

The hypothesis was improved parent/child locality and less costly native
free-list insertion during sweeping. Timing alone does not establish which
mechanism caused a change.

Six process pairs per corpus, with alternating launch order, produced the
following throughput changes against frozen production binaries:

| Corpus | Minified | Pretty |
|---|---:|---:|
| Twitter | +4.99% | +2.88% |
| Canada | -3.73% | -3.83% |
| CITM | +9.38% | +5.36% |
| Poet | +8.54% | +4.15% |
| GitHub Events | +12.98% | +8.77% |
| GSOC | -2.03% | -1.10% |
| Lottie | +1.33% | -0.61% |
| OTFCC | -1.62% | — |
| FGO | -1.90% | — |

The 108 process samples preserve binary hashes, individual timings, process
load audits and peak RSS. The initial CITM-only screen inadvertently kept the
control first; the table above uses the subsequent alternating-order run.
Measurements ran on the local ARM64 host under the shared timing lock, on AC
power, with background work recorded. These are not isolated-machine release
qualification results.

All nine complete owning-output oracles passed, retaining an earlier graph
through later parses and collection. Bounded-heap allocation/GC checks passed
all 12 mode/strict/fast configurations, including the fixed-memory tail-release
controls. Instrumented allocation/GC event counts matched the control, and
Minimal/Stub control binaries were byte-identical.

**Decision:** do not integrate the broad policy as-is. It helps the two main
70% gate blockers but regresses Canada and several other payloads. A follow-up
keeps larger small-block allocations in separate size classes. That narrower
policy has passed the same bounded-heap checks and four corpus owning-output
oracles; its performance confirmation remains pending.

Local evidence under `build/perf/classic-native/`:

- `mixed-small-all-preparation.json` and per-corpus owning-oracle logs
- `whitespace/mixed-small-all-controls-{samples,summary}.json`
- `mixed-small-runtime-fallbacks.log`
- `citm-mixed-small-pressure.log` and `mixed-small60-pressure.log`

## Other follow-up probes

The generated string/class array reader can avoid allocating a backing buffer
for a fresh empty array, using the existing independent-header empty-array
factory. A GitHub owning-output oracle and 12 paired control configurations
passed. Constructor counts and reuse behavior match the existing implementation;
contents, subtype identity, independent outputs and growth after collection are
asserted. Timing is still pending.

The first float-capacity probe changed the root float-array allocator. Tracing
its callers showed that Canada's hot nested reader allocates child arrays
itself and invokes the float reader body directly. Root-only timing therefore
does not test the intended hot-path change. Separate two-/four-slot probes now
target those nested allocation sites. Subclasses retain their constructor
fallback, and arrays grow through the ordinary native storage operations.
Neither float-capacity change is integrated or performance-qualified.

## Focused confirmation

The subsequent 90-process, six-pair screen compared both allocator policies
against the same frozen production binaries. The narrower policy mixes only
requests through 60 bytes and retains the existing larger size-class streams.

| Corpus | Broad min / pretty | Narrow min / pretty |
|---|---:|---:|
| Canada | -3.48% / -3.43% | +1.15% / +0.74% |
| CITM | +9.60% / +6.67% | +4.80% / +3.36% |
| GitHub Events | +14.81% / +8.69% | +2.97% / +0.34% |
| FGO | -1.48% / — | +1.99% / — |

The narrow policy avoids the observed Canada regression, but loses most of
GitHub's benefit. FGO's median peak RSS was approximately 8.5 MiB higher than
the control. Neither policy has been selected for integration.

The generated empty string/class-array proposal changed GitHub throughput by
-0.31% minified and -1.74% pretty. It is rejected for this performance work.
Its corrected control suite passed all 12 configurations and matched existing
constructor/reuse behavior; correctness alone does not justify the change.

The root-only float-buffer probes showed no compelling hot-path gain. Lottie's
binaries were byte-identical and were omitted from timing. Canada's nested
allocation sites still used the existing eight-slot factory. The next capacity
experiment targets those sites explicitly and requires retained-output and
length/growth/sharing controls before measurement.

Local evidence: `whitespace/mixed60-inline-float-controls-{samples,summary}.json`,
`mixed60-inline-float-controls-paired.log`, `inline-empty-arrays-paired-controls.log`,
and `float-capacity-preparation.json`. These focused samples have the same
background-load and qualification limitations as the earlier screen.

The actual nested-capacity probes subsequently passed 36 optimized incremental
configurations: the production control and capacities two/four, each across
three modes, strict on/off, and fast on/off. Checks cover f32/f64 lengths
0, 1, 2, 3, 4, 7, 8, 9, 15, 16, 17, 64 and 129; nested/root/shared/reused
outputs; retained values after collection and growth; and subtype identity,
initialization and constructor count. Full corpus builds/oracles and timing
for these actual nested allocation sites are still pending.

## Nested float-buffer measurement

The actual nested allocation changes passed all four Canada/Lottie complete
owning-output oracles. Lottie's binaries were unchanged, so only Canada needed
timing: six alternating process pairs for each variant, 18 process samples.

| Variant | Minified us/parse | Pretty us/parse | Throughput delta min / pretty | Median peak RSS |
|---|---:|---:|---:|---:|
| Production control | 3662.345 | 3688.830 | — | 325.73 MiB |
| Two initial slots | 3227.755 | 3277.440 | +13.46% / +12.55% | 335.76 MiB |
| Four initial slots | 3505.775 | 3570.200 | +4.47% / +3.32% | 343.77 MiB |

Smaller per-array backing buffers did not reduce peak process RSS in this
workload: allocation/sweep scheduling matters as well. The two-slot variant
improved throughput with approximately 10.0 MiB more median peak RSS.

The production candidate applies that initial capacity to the root float-array
helper and the two float-child allocation sites in the nested array reader.
The general factory still defaults to eight slots, generated reference fields
retain their existing reservation, and subclasses/other runtimes retain their
constructor fallback. The permanent regression covers all 36 combinations of
runtime, backend, strictness and fast-path setting; those configurations passed.
Production qualification passed all 55 transform scripts, 252 packed-consumer
operations across 36 configurations, and all nine retained owning-output
oracles. The production Canada binary exactly matches the measured two-slot
prototype. Seven other corpus binaries are byte-identical to production control.
Twitter also changed; its six-pair check was effectively flat (+0.10% minified,
-0.32% pretty). Source fingerprint:
`888b76936949c769df55e7570b6a1b9cf1aedb8fdafddfc8de6dead25bb999ca`.
The broad mixed-allocation policies remain unintegrated.

Evidence: `whitespace/nested-float-capacity-controls-{samples,summary}.json`,
`nested-float-capacity-preparation.json`, `nested-float-capacity-growth-controls.log`,
and the production qualification logs under `build/perf/classic-native/`.


## Mixed stream plus scoped sweep coalescing: integration candidate

A complete six-pair screen (162 processes: nine corpora, production control,
128-byte policy and 512-byte policy) selects the 512-byte mixed stream coupled
to a library-owned incremental sweep. It preserves ordinary per-object managed
registration and identity. Only physically adjacent, already-dead native blocks
are merged, and pending runs are returned to TLSF before each collector interrupt
returns. Application allocation and explicit collection retain their original
collector functions. The pool reserves 8 KiB only from existing free capacity.

| Corpus | Minified throughput change | Pretty throughput change |
|---|---:|---:|
| Twitter | +32.96% | +26.79% |
| Canada | +14.08% | +14.67% |
| CITM | +31.89% | +22.85% |
| Poet | +37.47% | +32.41% |
| GitHub Events | +30.06% | +25.60% |
| GSOC | +12.53% | +13.65% |
| Lottie | +2.20% | +3.58% |
| OTFCC | -0.56% | — |
| FGO | +0.94% | — |

These are paired AS-versus-AS screens under background load, not a fresh native
parity gate. The production integration is still under qualification; do not
apply these gains to a native baseline as if that were a measured paired result.
The 128-byte alternative improved Canada slightly more but lost substantial
Twitter, Poet and GSOC gains. Neither policy changes models or the parse API.

The integrated transform enables the mixed stream only with recognized stock
collector/common/TLSF source hashes, unchanged collector function bodies and
library-owned allocation clones. Unknown layouts and allocator aliases fall
back. RTrace, collector tracing/profiling and finalizer builds keep the original
allocation/sweep policy. Permanent tests check these guards, both interrupt
flush exits, activation under GC pressure, retained owning outputs and binary
identity for disabled configurations.

Screen evidence: `build/perf/classic-native/whitespace/sweep-run-all-controls-{samples,summary}.json`
and `sweep-run-all-controls-paired.log`. Integrated qualification evidence is
written separately under the `sweep-production-` prefix.

Integrated functional qualification passed all **57 transform scripts**, including
960 capability checks, the 12-configuration allocation-pressure matrix and
fixed-heap controls. All 24 instrumented/other-runtime/finalizer comparisons
preserved exact binaries and runtime events/counts. The untimed observer records
96,800 reclaimed objects in 21,542 native frees while retained outputs remain
correct. The packed artifact passed 252 operations across 36 configurations,
and all nine complete owning-output oracles passed. Every optimized production
benchmark binary is byte-identical to the selected measured prototype.

Evidence: `sweep-production-qualification.json`,
`sweep-production-transform/results.json`, `sweep-production-equivalence.json`,
and the pressure/runtime/packed/prepare logs. A fresh paired native gate follows
this integration; the earlier screen alone does not establish native parity.


## Verified fresh-object clearing

Generated deferrable child/array-item readers issued an explicit payload clear
after their allocation helper. The installed incremental allocator already
zeroes that payload, so the extra clear survives compilation as redundant work.
The minimal allocator does not make the same guarantee; unconditional removal
would be unsafe. Production instead uses a clear helper whose default is the
original memory fill. Only an exact verification of the actual library-owned
zeroing allocator permits elision. Unknown bodies and other runtimes retain the
clear; RTrace and alternate pointer layouts retain it as well. Reused-object
initialization remains unchanged.

The first six-pair CITM screen measured +2.85% minified / +1.10% pretty
throughput. The six-changed-corpus confirmation (72 processes; FGO, OTFCC and
Poet byte-identical) measured +3.49% / +2.06% for CITM, with other changes between
-1.34% and +1.00%. Every process completed within six seconds and the largest
between-process gap was 27 ms, unlike the sleep-interrupted earlier key probe.
Eight integrated binaries match this prototype exactly. Canada differs by two
bytes of local-variable scheduling; its independent six-round three-way
confirmation is effectively flat versus the qualified control (-0.12% minified,
-0.22% pretty), and +0.44% / -0.02% versus the prototype.

Functional qualification passed all **58 transform scripts**, the packed
artifact's 252 operations/36 configurations, and all nine complete retained
owning-output oracles. The new test passes 18 runtime/backend/strict settings,
exercises poisoned recycled minimal-runtime memory, and verifies that removing
the fallback fails its negative control. The allocator-proof unit also declines
optimization when the actual scoped allocator was changed despite an unchanged
original allocator. The 12-configuration allocation-pressure matrix and its
fixed-memory controls passed.

Source fingerprint:
`4030c5bc96afe7ad88a7258ba57b8279c5424ea32a798a84f8904f34de238c81`.
Evidence under `build/perf/classic-native/`: `clear-production-qualification.json`,
`clear-production-transform/results.json`, `clear-production-equivalence.json`,
`no-double-clear-all-preparation.json`,
`whitespace/no-double-clear-all-controls-{samples,summary}.json` and
`whitespace/clear-production-canada-controls-{samples,summary}.json`, plus their
paired logs. These screens precede a fresh full owning-native threshold sweep;
they alone do not establish an 80% milestone or parity.
