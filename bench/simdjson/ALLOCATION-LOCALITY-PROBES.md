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
