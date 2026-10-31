# Local qualification status (2026-10-31)

The user revised the goal to **classic workloads, SIMD only, with latency at
most 1.2× native simdjson and no limit on being faster**. SWAR performance and
additional non-classic families are diagnostic. The required classic grid is
16 layouts × owned parse/stringify/full validation = 48 SIMD rows, qualified on
one consistent backend. Older strict-parity, two-mode and extra-family gates
below are historical criteria. The current classic goal remains unachieved.

Whole-workload parity is **not achieved**. Typed owned evidence now covers all
12 layouts of the six fully typed classic corpora plus both Lottie layouts;
validation evidence covers all 16 classic layouts. Native owned raw adapters
now work for Lottie; large OTFCC/FGO owned runs remain outstanding. Additional
families remain available as diagnostics. Twitter now compiles
with public simdjson customization hooks while preserving its complete model.

Historical two-label `compare.py` measurements before `29e59b9` have an ordering
defect: rotation followed by reversal always runs the baseline first. Earlier
descriptions of balanced variant rounds record the intended method, not a
verified balanced order. Those observations and correctness results remain
saved, but performance qualification needs corrected-order reruns. The latest
whitespace results below use the fixed scheduler and still fail their gates.

## Formatter experiment

xjb-as baseline: `3c33c7ba818e7feb71cf915cd95d23cb182d94e8` (unpublished 0.2.0).
Candidate: `df2de3f` in the separate xjb-as worktree. Installed npm 0.1.0 is a
separate baseline and is not being credited to this patch.

Five balanced fresh-process rounds, frozen binaries, strict AS SWAR/SIMD,
incremental GC, four rotating values, eight prior owned outputs retained.
GCC 16.2.0 native ARM64 simdjson 5.0.4 vs V8 15.2.20. Input UTF-8-equivalent
length: 2,090,234 bytes. Complete output/retention oracles pass for both modes
and variants. No builds/tests/oracle jobs overlap the timed processes.

Latest executable `compare.py` run, medians in milliseconds:

| Phase | Native | Original SWAR | Candidate SWAR | Original SIMD | Candidate SIMD |
| --- | ---: | ---: | ---: | ---: | ---: |
| Fresh owned parse | 2.649 | 6.609 | 6.342 | 6.430 | 6.632 |
| Fresh owned stringify | 1.754 | 3.203 | 3.017 | 2.482 | 2.375 |
| Full validation | 1.314 | 1.824 | 1.798 | 1.798 | 1.789 |

Only formatting changes. Parse/validation fluctuations are controls, not claimed
improvements. Candidate stringification throughput improved about 6.2% SWAR and
4.5% SIMD in this run; the preceding independently scheduled run showed 7.1%
and 4.7%. Native remains faster. Microbench cohorts were mixed; this is an
experiment, not a regression-free integration recommendation.

Artifacts: `build/simdjson-parity/comparisons/formatter-final/` and
`build/simdjson-parity/joint-direct/`. xjb-as's `PERFORMANCE_NOTES.md` records
correctness checks, cache/module sizes and limitations. No merge/push/release.

## Profiling lead

A separate named-Wasm profile uses 500 operations per phase. Its whole-process
self samples put allocation/GC helpers (`__new`, TLSF allocation, GC steps and
barriers), numeric pair parsing and float-array serialization among the hottest
functions. This points toward minimizing flat-vs-nested numeric parsing before
changing allocation paths. It does not establish a particular allocation fix.

The raw log has 5,410 samples. The standard Node profile processor warns about
its different V8 version. Wasm function self counts were independently checked
against raw `code-creation` address ranges and tick PCs; native C++ symbol
attribution from the mismatched processor is not used. Artifacts are
`build/simdjson-parity/canada-v8.log`, `canada-wasm-self-profile.json` and the
separate `runs/profile/` binaries/metadata. Profile timings are not speed-gate
measurements.

## Verification

- xjb-as: 323,214 checks across six modes; 3,708 exact power-cache limb checks;
  edge vectors plus 499,730 f64 and 498,009 f32 random oracle values pass.
- json-as integration with the candidate: 116,898 checks across all three modes.
- Generator behavior tests, project typecheck/lint, and an end-to-end fresh
  native/model build and full-output smoke comparison pass.
- The smoke parity gate returns 1 for the actual remaining gaps. Whole-matrix
  coverage remains incomplete.

## w2c2 and array-shape experiments

The user's fork was fast-forwarded to upstream main
`56672df54468f7f57990addae64d873a66d6de42`, then built in an isolated clone.
All 22 CMake tests pass. The original local checkout remains untouched. A C
host runs the exact V8 Wasm binaries, with the same incremental runtime and
full-output/retention oracles. The external SIMDe revision and compiler/host/
binary hashes are recorded. Five balanced fresh-process rounds per comparison
complete before any output-oracle processing.

Frozen Canada baseline (`xjb020direct`), before either prototype, medians in ms
from `comparisons/canada-float-backends/`:

| Execution backend | Owned parse | Owned stringify | Full validation |
| --- | ---: | ---: | ---: |
| Native simdjson | 2.565 | 1.723 | 1.257 |
| V8 SIMD | 6.380 | 2.336 | 1.758 |
| w2c2 SIMD, runtime checks on | 6.897 | 2.964 | 1.954 |
| w2c2 SIMD, default checks off | 5.764 | 2.535 | 1.194 |

w2c2 is not uniformly faster than V8. Default unchecked execution is a distinct
safety configuration, not evidence for the performance of checked execution.
The native validation baseline is DOM parsing, including its internal tape.
The comparison does not establish a fastest possible native lexical validator.

The numeric shape diagnostic holds 8,192 original numeric tokens constant.
Initial SIMD flat-array stringification was 119 us vs native 131 us; grouping
those values into 4,096 pairs raised AS to 186 us vs native 133 us. Parsing also
rose substantially. This isolates a real cost from nesting/allocation rather
than assuming numeric conversion dominates everything.

A fused matrix serializer with a header-sizing pass regressed V8 by roughly
9% on the pair diagnostic and 13% on Canada, despite passing all correctness
checks. It was removed. Its exact source patch, regressions, oracles and failed
performance hypothesis remain in `runs/*-fused/` and
`comparisons/{nested-float,canada-float}-backends/`.

A four-lane digit scanner using full UTF-16 lanes passed exhaustive checks of
all 65,536 code units in every lane at every UTF-16 word alignment: 1,048,576
comparisons per compiled mode. Grouping integer prefixes as well as fractional
and exponent runs regressed V8 validation, so the final prototype leaves the
integer prefix scalar. Materializing number conversion is unchanged.

Final fraction/exponent-only prototype, medians from
`comparisons/fraction-word-backends/`, Canada validation in ms:

| Backend | Previous code | Prototype | Native DOM validation |
| --- | ---: | ---: | ---: |
| V8 SWAR | 1.746 | 1.774 | 1.286 |
| V8 SIMD | 1.791 | 1.744 | 1.286 |
| w2c2 checked SWAR | 1.999 | 1.148 | 1.286 |
| w2c2 checked SIMD | 1.969 | 1.184 | 1.286 |
| w2c2 default SWAR | 1.174 | 1.013 | 1.286 |
| w2c2 default SIMD | 1.209 | 0.995 | 1.286 |

The prototype improves this checked w2c2 validation row beyond the native DOM
median, while V8 is roughly unchanged. Parse/stringify differences are controls,
not attributed gains. The full corpus validation matrix is still required
before recommending broad integration, and typed parsing/stringification
remain behind native. No all-workload parity claim is made.

Final source verification: 117,060 integration checks and 75,123 RFC checks pass
across all three modes; typecheck/lint and six generator tests pass. The C host
ABI test passes in checked/default configurations, including forced memory
growth, multilingual text, embedded NUL, paired and unpaired surrogates. The
discarded fused-writer test remains with its ignored experiment artifacts.

The earlier all-digit prototype's newly added utility was not covered by the
then-tracked-only source patch snapshot; its unchanged source and SHA were saved
separately after build with that timing explicitly recorded in
`generated/additional-source.json`. New preparation now copies and checks
additional untracked TS sources automatically.

## Whole-corpus validation follow-up

The first five-round sweep covers all 16 classic layouts, four changing-value
and changing-length inputs per layout, SWAR/SIMD, V8 and both w2c2 check modes.
It includes valid/invalid preflight cases and verifies 64 setup input checks
per program. Baseline library sources are pinned to `69ecf95`; the scanner
candidate is pinned to `f54c02e`. Exact source patches, inputs, compiler commands,
artifacts and raw samples are in `comparisons/validation-matrix-qualified/`.

The checked-w2c2 validation-family gate fails on 30 of 32 rows. Canada minified
is a win, but the full objective remains far from complete. V8's scanner-candidate
SIMD results exceed native on only one of 16 layouts; default unchecked w2c2
exceeds native on two. Several V8 rows are slower than the pre-scanner baseline,
so the original Canada result is not being generalized.

Pretty layouts expose a larger cost. For example, Lottie pretty takes roughly
1.35 ms in V8 vs 0.33 ms native DOM validation. A packed-space-loop experiment
improves V8 across all 16 SIMD rows, including 23% higher throughput on CITM
pretty and 44% on Lottie pretty, but regresses most w2c2 rows. A wrapper/scan-loop
split retains V8 improvements without removing the w2c2 regressions. Those
variants remain experimental snapshots in `validation-spaces-qualified/` and
`validation-space-split-qualified/`; neither is an integration recommendation.

A smaller three-case regression screen now precedes further whole-matrix runs.
The bitmap whitespace classifier improves V8 canaries but fails a 3% regression
screen on three w2c2 rows. Its measured source and evidence are preserved in
`comparisons/diagnostic-bitmap-qualified/`. This is evidence for rejecting that
variant, not grounds for relaxing the full goal or its coverage requirements.

The scalar OR classifier and explicit SIMD classifier also fail the cross-backend
canary screen. The SIMD variant improves V8 throughput by 15–27%, but slows
checked w2c2 Canada by 16%. The library whitespace implementation is restored;
all experimental patches remain with their frozen artifacts.

## w2c2 constant lowering experiment

An ARM64 GCC 16.2 code-generation check exposes a concrete backend cost:
`simde_wasm_i8x16_const` builds the whitespace vector through byte-lane inserts.
A static byte-array load reduces that construction to a single vector load.
Local w2c2 commit `a1c6f7e` changes the little-endian GNU/Clang macro, retaining
the existing big-endian and other-compiler paths. No remote push or merge.

The direct header check passes under GCC/Clang in C and C++, both with native
SIMD and `SIMDE_NO_NATIVE`, including signed-byte patterns and all 65,536 UTF-16
classification inputs. The initial five WAST suites pass 326 assertions.

Five balanced rounds over three canaries use byte-identical Wasm, inputs and
native baseline. Checked SIMD throughput improves 5.8% Canada, 11.5% CITM pretty,
and 2.5% Lottie pretty. Default unchecked SIMD improves 33.1% CITM and 19.0%
Lottie; Canada is essentially unchanged. The screen reports one 3.4% SWAR
regression, but those two SWAR executables have identical SHA-256 hashes, so
this row measures timing variation rather than changed machine code. These are
canary results, not a full-matrix or whole-goal pass. Evidence:
`comparisons/diagnostic-constant-load-qualified/`.

The subsequent full validation run freezes the existing scalar-whitespace parser
Wasm (`validation-current`) and changes only the w2c2 header. All 24,396 SIMD
WAST assertions pass before timing. Five balanced rounds and all 64-input/16-case
preflight oracles pass; no build/test jobs overlap timing. Checked SIMD improves
14 of 16 layouts by 7.5–80.1%, including GSoc minified 80.1%, GSoc pretty 70.1%,
Poet pretty 42.8% and Twitter pretty 33.5%. Checked Canada minified slows 8.6%
and Canada pretty slows 5.2%. The full 3% regression screen fails. Unchecked
SIMD improves all 16 medians, with 14 gains above 3%. SWAR controls are identical
executables; their small timing shifts are not attributed to the patch.

The candidate exceeds native DOM on only 4 of 32 checked mode/layout rows
(5 unchecked); overall parity remains unmet. SIMD executable size stays 169,752
bytes in the checked full-validation build. Exact medians, hashes, oracle
summaries and compiler provenance:
`comparisons/validation-constant-load-qualified/`. Keep this as an unmerged
backend candidate; investigate the checked Canada regressions before integration.

## Backend follow-up: owned Canada

`comparisons/owned-canada-constant-qualified/` holds five balanced rounds of
owned Canada parsing, stringification and validation, using exact frozen
`canada-fraction4` Wasm and only the w2c2 header change. Complete owned-output
oracles pass. Checked SIMD stringification improves 9.4% (2.803 to 2.562 ms),
while parsing is effectively unchanged (6.627 to 6.662 ms). Checked validation
improves 7.1% here, unlike the loss in the aggregate validation matrix. Default
unchecked SIMD stringification improves 8.1%. The sole 3% screen failure is a
SWAR parsing control whose executable is byte-identical between labels.

GCC assembly probes show static repeated-byte constants become immediate
vector splats; replacing them with explicit splats yields identical code, so a
literal-load explanation for the aggregate Canada regression is rejected. The
full validation-module assembly changes only `_f31`, the string scanner, which
shrinks from 493 to 440 normalized instruction/label lines. This is not a count
of dynamically executed instructions and does not establish code-placement
causality. Keep the aggregate regression as unresolved evidence.

## Fresh implicit collection defaults

Fresh checked object parsing now has a generated initialization capability that
leaves implicit builtin array/map/set defaults unallocated until successful
object completion. Parsed fields construct their actual collection once;
missing fields receive independently owned empty defaults. Eligibility excludes
explicit field initializers, fields marked generic, lazy fields and custom
initializers.
Root and nested objects share this construction policy. The payload is cleared
before allocating children, and deferred reference stores use write barriers.
Legacy/reused parsing retains its initialization behavior.

An initial nested-only prototype improved CITM minified parsing 2.46–2.58×, but
its unchanged validation controls exceeded the 3% screen. It is retained as
`comparisons/fresh-collections-citm-qualified/`, not substituted for final data.
The final root-and-nested implementation uses five balanced fresh-process
rounds, strict syntax, four rotating values and eight retained owned outputs.
All output oracles pass. Final V8 medians in ms:

| Case/mode | Previous owned parse | Candidate owned parse | Throughput ratio | Native owned parse |
| --- | ---: | ---: | ---: | ---: |
| CITM min SWAR | 3.095 | 1.604 | 1.93× | 0.567 |
| CITM min SIMD | 3.236 | 1.561 | 2.07× | 0.567 |
| CITM pretty SWAR | 3.342 | 2.064 | 1.62× | 0.653 |
| CITM pretty SIMD | 3.142 | 2.062 | 1.52× | 0.653 |
| Canada min SWAR | 6.445 | 6.585 | 0.979× | 2.575 |
| Canada min SIMD | 6.374 | 6.503 | 0.980× | 2.575 |

Each campaign passes its 3% regression screen across both modes and all three
measured phases. Canada's approximately 2% slower parse medians are reported,
not rounded into a speedup. Native still wins every listed owned-parse row.
Serialization medians improve on CITM, but its formatting algorithm is unchanged;
no formatter speedup is attributed to this parsing patch. Validation controls
are within roughly 1.3% in the final campaigns. Artifacts:
`comparisons/fresh-root-{citm_catalog-min,citm_catalog-pretty,canada-min}-qualified/`.

Normal suite: 117,129 checks across all modes. Strict/RFC suite: 75,528 checks,
including the initializer-forced-GC test. Transform regression tests,
typecheck and lint pass. Dedicated tests cover empty/partial objects, duplicates,
independent defaults, explicit initializer execution, retained graphs and GC
inside child initialization. Full-corpus typed parsing, other runtime backends,
and all remaining workload families still require qualification.

## Profile-guided array serialization

A separate, named-Wasm CITM stringification profile runs 5,000 operations after
setup. Generated diagnostic sources remove timed parsing/validation and the
unused retained-object output. V8 15.2.20 runs with `--no-liftoff --prof`; these
profile timings are not qualification results. Raw code-creation ranges and
tick PCs yield 1,212 total ticks, 1,004 attributed Wasm self samples: 323 (32.2%)
in typed array-element writers and 101 (10.1%) in a shared array accessor. A
Wasm optimizer may share the accessor across element types, so its `Array<u32>`
name does not mean the original corpus stores u32 arrays. This is a self
profile, not an attribution of native memcpy time or total copied bytes.
Artifacts: `citm-serialize-v8.log`, `citm-serialize-self-profile.json` and
`runs/citm-serialize-profile/profile-only.json` under `build/simdjson-parity/`.

The generic Array serializer now spells out the load performed by Array.__uget.
It rereads `src.dataStart` after every callback; no backing pointer is cached
across user code. A custom serializer regression grows the source to 4,096
slots, forces GC, replaces the next element, and verifies that serialization
uses the replacement while preserving the original iteration extent.

The first five-round experiment separates direct loads and forced element-helper
inlining. Direct loads improve CITM minified stringification by 6.4–7.1% and
Canada by 3.1–4.7%. Inlining adds little and its Canada validation control fails
the 3% regression screen; that annotation is removed. An independent pretty
CITM run confirms 6.9–7.6% higher stringification throughput with direct loads.
Raw comparisons: `array-compose-{citm_catalog-min,canada-min}-qualified/` and
`array-load-citm-pretty-confirm/`. These measurements retain the older
same-length input rotations; the final campaign below varies lengths too.

The first changing-length sweep (`array-vary-*-qualified/`) still improves the
serialization rows but fails controls in CITM minified and pretty. A nine-round
identical-binary calibration finds 2.3% median-side variation in V8 parsing,
1.6% in checked-C parsing, and under 1% in validation/serialization. Those
values do not explain away the larger failed controls. Calibration raw samples,
binary hashes and logs are in `comparisons/array-aa-calibration/`.

The earlier A/B labels have lengths 17 and 20. Embedded artifact paths increase
the candidate Wasm data section by 18 bytes, another possible layout confound.
The controlled follow-up uses `array-equal-base`/`array-equal-test`, both length
16. Their CITM SIMD data sections are both 27,384 bytes; code section sizes are
164,377/164,409 bytes. This controls path-size variation, not every possible
compiler/code-placement effect. `--require-equal-label-length` enforces the
label constraint, and `invocation.json` records comparison flags.

Final nine-round results use changing values/lengths, the equal-length labels,
the same native binary, full owned-output oracles and isolated processes:

| Case/backend | SWAR stringify throughput ratio | SIMD ratio |
| --- | ---: | ---: |
| CITM min / V8 | 1.080× | 1.036× |
| CITM pretty / V8 | 1.063× | 1.056× |
| Canada min / V8 | 1.033× | 1.064× |
| CITM min / checked w2c2 | 1.061× | 1.103× |
| CITM min / unchecked w2c2 | 1.143× | 1.130× |

Every measured V8 and checked-w2c2 row is within the explicit 3% regression
limit. The combined CITM-min screen still **fails**: unchecked SWAR validation
slows 7.5% (candidate/baseline time), with no lexical algorithm change. That
regression remains unresolved; the patch is a local candidate, not a universally
regression-free integration recommendation. Artifact directories:
`comparisons/array-equal-{citm_catalog-min,citm_catalog-pretty,canada-min}-qualified/`.

Verification: 117,138 normal checks and 75,537 strict/RFC checks across all three
modes, full output/retention oracles, input-rotation tests and lint pass. The
forced-inlining annotation is absent from the retained patch. This is an array
serialization improvement; standalone copied-byte measurements, direct owned
output construction, remaining corpora/families and overall simdjson parity are
still open work.

## Managed output experiment and SIMD string scanning

Five new owned-string diagnostics use ordinary string roots: short ASCII,
large clean text, a quote near the end, dense short escapes, and valid mixed
BMP/astral Unicode. Each has four independently allocated inputs with changing
values and lengths. Native owns std::string values; AS owns normal strings.
Both sides retain eight prior results. These diagnostics expand coverage;
they do not certify the complete strings family or whole-goal parity.

The first experiment makes the staging allocation a rooted managed string,
grows with __renew, restores the original arena at completion, and returns
that allocation. Oversized spare capacity falls back to an exact owned copy.
It passes GC/retention/Unicode tests and all full-output oracles, but fails the
performance screen. Large clean/late-escape strings gain roughly 7–19%; short
strings slow roughly 9–11%, and Unicode SIMD slows about 5%. Forcing public
wrapper inlining does not fix the overall result and slows dense SIMD escaping.
Both versions are rejected and reverted. Their source patches, ownership tests,
binaries and results are saved in `managed-output-experiment/`,
`runs/owned-str-{test,line}/` and
`comparisons/{owned-string,owned-inline}-*-qualified/` under
`build/simdjson-parity/`. No managed-arena API or public-wrapper annotation is
retained in the library.

The retained scanner change uses v128.any_true for the optimistic loop's
boolean event test. The isolated boolean variant changes one Wasm code byte
from the previous bitmask-based predicate. Separately, paired surrogate masks
allow valid UTF-16 pairs to stay on the bulk-copy path. A pair crossing the
vector boundary consumes the next low unit immediately; unpaired units still
enter the established escaped handler. That full variant adds about 153 bytes
to the standalone SIMD module.

Nine balanced fresh-process rounds separate the boolean-only and paired-unit
changes. All input/binary hashes, native baselines, owned-output oracles and
same-length labels are checked. Final SIMD stringify throughput ratios:

| String shape | Boolean-only | With paired-unit scanning |
| --- | ---: | ---: |
| Short | 1.002× | 1.002× |
| Large clean | 1.235× | 1.235× |
| Late quote | 1.231× | 1.226× |
| Dense escapes | 0.995× | 0.996× |
| Mixed Unicode | 0.999× | 2.521× |

The full Unicode screen fails a SIMD validation control (about 4.7% slower),
although the lexical validator is unchanged. All other diagnostic screens pass
for the retained variant. A separate nine-round Unicode backend run measures
2.591× SIMD stringify throughput in V8, 2.121× with checked w2c2 and 1.752× with
unchecked w2c2. Its SWAR V8 stringify control slows about 5.6%; its executable
code section is byte-identical between variants (SHA-256
`c4745ed30c9ee093fa93580321a4c28a82b2f51dcd6a14cdeef801c014d9d008`).
Data-section sizes match and nine bytes change in embedded artifact paths.
This does not turn the failed screen into a pass; it rules out attributing that
row to a changed SWAR executable algorithm.

Classic confirmation with changing-length inputs finds approximately 1% or
less SIMD stringify movement on CITM minified/pretty and Canada. Both CITM
screens pass. Canada fails on an unchanged SWAR stringify control (about 4.7%
slower). Its SWAR code section is also byte-identical between variants (SHA-256
`a75314d291a34a4733e0fb3787bfe46977d668c04106c7e360d8f2ebfa74b157`).
The combined driver serializes during setup and before validation;
isolating phases remains a qualification task for state-dependent controls.
No universal regression-free or native-parity claim is made. Native still
wins the measured stringification rows.

Artifacts: `comparisons/string-scanner-*-qualified/`,
`comparisons/string-pair-unicode-backends/` and
`comparisons/string-scan-{citm_catalog-min,citm_catalog-pretty,canada-min}-qualified/`.
Verification: 117,717 normal checks and 75,537 strict/RFC checks across all modes,
524,288 public/scalar UTF-16 differential cases per mode, explicit vector-tail
and paired/unpaired boundary cases, generator tests, lint and complete
output/retention oracles pass.

## Empty generic array capacity

Fresh strict cursor parsing now returns an ordinary zero-capacity array literal
for an empty generic array, instead of reserving eight elements through the
Array constructor. Each result and its buffer remain independently owned;
growth, tracing and write barriers use the standard runtime. No shared backing
buffer, fabricated runtime header or collector-specific construction is used.
The specialized SWAR/SIMD float-array path is unchanged. Legacy parsing and
reuse behavior are unchanged.

CITM contains 8,695 empty arrays among 10,451 arrays. Canada contains 56,045
arrays and no empty arrays. An initial broader experiment also factors the
float-array prelude, but fails checked-w2c2 SIMD Canada parsing by about 3.6%
and checked-w2c2 SIMD CITM validation by about 3.5%. That float refactor is
reverted. Its source patch is saved as
`build/simdjson-parity/empty-array-broad.patch`, with frozen `array-zero-new`
binaries and `comparisons/array-zero-*-qualified/` evidence.

The retained narrower candidate uses nine balanced fresh-process rounds,
same-length labels (`array-zero-old`, `array-zero-int`), frozen input/binary
hashes, changing string values and lengths, four independently allocated
inputs and eight retained owned results. V8 15.2.20 uses TurboFan; the same
incremental-GC Wasm runs through checked and unchecked GCC 16.2 w2c2 builds.
Builds, tests and profiling do not overlap timing; output oracles run after
timing. Full native/AS output and retention comparisons pass for every backend.

Owned-parse throughput ratios, candidate / baseline:

| Corpus/layout | V8 SWAR | V8 SIMD | Checked C SWAR | Checked C SIMD | Unchecked C SWAR | Unchecked C SIMD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CITM minified | 1.068× | 1.096× | 1.070× | 1.072× | 1.008× | 1.035× |
| CITM pretty | 1.026× | 1.065× | 1.030× | 1.053× | 1.033× | 1.048× |
| Canada minified | 1.009× | 0.996× | 1.005× | 1.015× | 1.014× | 1.009× |

Every V8 and checked-w2c2 row, including stringify and validation controls,
passes the explicit 3% regression screen on all three layouts. Canada's complete
screen passes. Both CITM combined screens still **fail** on unchecked-w2c2 SIMD
controls: minified stringification is about 3.4% slower and pretty validation
about 3.2% slower. No stringify or validator algorithm changed in this patch;
the combined driver constructs objects during setup and runs all phases in one
process. These failures remain unresolved. Phase isolation remains follow-up
work; they are not recategorized as passing results. This is a local parsing
candidate, not a universally regression-free integration recommendation.

Verification: 117,717 normal checks, 75,621 strict/RFC checks across all three
modes, 10 harness checks, typecheck and lint pass. The new 84-check regression
covers independently growing empty arrays across integer widths, floats,
booleans and references, zeroed length growth, GC and later field reuse. A
retained-memory assertion verifies 128 fresh empty i64 arrays consume less
backing-buffer memory than the constructors' 8 KiB of payload capacity alone;
that allocator-specific assertion runs only with incremental GC.

Final artifacts are under
`build/simdjson-parity/comparisons/array-narrow-{citm_catalog-min,citm_catalog-pretty,canada-min}-qualified/`.
The candidate modules grow by roughly 100–156 bytes in their code sections.
Native simdjson remains faster on owned parsing, and the remaining corpora and
families still prevent a whole-workload parity claim.

## Broader owned classic coverage and Poet profile

Nine new layout comparisons add GitHub-events, Twitter, Poet and GSOC in both
layouts plus Canada pretty. Together with the existing Canada-minified and
CITM-minified/pretty evidence, all 12 fully typed classic layouts have paired
owned-model evidence. The four layouts containing JSON.Raw remain outstanding;
the generator still refuses to substitute borrowed/unvalidated native slices.

The benchmark generator now maps @optional's actual deserialization-only
semantics: absent fields keep defaults, while serialization still emits the
field. Native unique_ptr readers require non-null input, so nullable AS class
fields get an explicit null check through the public tag_invoke deserialization
hook. Non-null values retain the full owned class. A public with<Adapter>
annotation and outlined writer break Twitter's recursive size-bound/inlining
cycle without specializing private simdjson internals or reducing the schema.
This is an adapter-based native Twitter baseline, not an unmodified automatic
reflection writer. The original compile failure is retained in
`build/simdjson-parity/coverage-twitter-native-build.log`.

The first GitHub-events run rejects an incorrectly modeled field:
Issue.assignee is an object or null, not a string or null. Both generated models
now use the complete GhUser type. GSOC's manifest classification is corrected
from raw to fully typed, matching its actual Sponsor and Author fields. New
tests check every provided field and value type in all six fully typed corpus
fixtures and keep raw classifications consistent with source schemas.

Five alternating fresh-process rounds per layout use V8 15.2.20 TurboFan,
incremental GC, strict parsing, no string cache, four independently allocated
inputs with changing string values and lengths, and eight retained owned
results. Each phase has 100 operations per process. Native is GCC 16.2 ARM64,
simdjson 5.0.4, using the same model and policies. No compilation, testing or
profiling overlaps timing. AS UTF-8-to-UTF-16 decoding, native padding and setup
are excluded; this is not a byte-ingestion result. Complete owned-output and
retention oracles pass all nine layouts (40 comparisons per layout). Every layout's combined parity gate
still fails; wins in individual cells do not satisfy the goal.

Ratios below are native latency / json-as latency; greater than one favors
json-as. These are current baseline comparisons, not speedups from the new
benchmark adapters or incremental parser optimizations.

| Layout | Parse SWAR | Parse SIMD | Stringify SWAR | Stringify SIMD | Validate SWAR | Validate SIMD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| github_events-min | 0.885 | 0.972 | 0.162 | 0.190 | 0.345 | 0.432 |
| github_events-pretty | 0.794 | 0.860 | 0.160 | 0.181 | 0.301 | 0.348 |
| twitter-min | 1.191 | 1.305 | 0.227 | 0.297 | 0.397 | 0.465 |
| twitter-pretty | 1.022 | 1.091 | 0.224 | 0.287 | 0.327 | 0.358 |
| poet-min | 0.584 | 1.049 | 0.159 | 0.177 | 0.358 | 1.047 |
| poet-pretty | 0.572 | 1.019 | 0.156 | 0.175 | 0.356 | 0.937 |
| gsoc-2018-min | 0.491 | 0.575 | 0.137 | 0.189 | 0.396 | 0.523 |
| gsoc-2018-pretty | 0.468 | 0.543 | 0.138 | 0.191 | 0.389 | 0.479 |
| canada-pretty | 0.405 | 0.408 | 0.574 | 0.742 | 0.560 | 0.561 |

A separate Poet serialization-only profile removes timed parsing/validation and
unused retained-object output from its generated diagnostic source, preserves
eight owned string results, and runs 3,000 operations. Original and modified
source hashes are recorded in `runs/coverage-prof/profile-only.json`. Profile
timings are not qualification results. Time-ordered V8 code ranges and direct
tick PCs yield 1,858 total samples, 1,488 Wasm self samples, and 1,394 samples
(93.7% of Wasm self samples) in the inlined string writer. This does not resolve
time within that inlined function or attribute native memcpy/GC time to it.

A separate UTF-16 mask census changes the next hypothesis: Poet's 26,713 BMP
strings contain no ASCII escapes. Among their 140,843 full eight-unit blocks,
68,803 trigger the conservative byte-level surrogate test, while none require
escaping or contain surrogates. Ordinary fullwidth text causes these false
positives. Another 89 strings with non-BMP/surrogate units are excluded from
that census. Testing exact or adaptive UTF-16 event classification is the next
experiment; the census itself is not a speedup measurement.

Artifacts under `build/simdjson-parity/`: `runs/coverage-owned/`,
`coverage-owned-summary.json`, `coverage-*-paired.log`,
`poet-serialize-v8.log`, `poet-serialize-self-profile.json`,
`poet-self-profile.py`, and `poet-mask-census.{py,json}`.
All 13 benchmark generator/input checks, native and AS corpus builds, complete
output oracles, typecheck and lint pass. No production parser or formatter
algorithm changes in this coverage commit.

## Adaptive UTF-16 serialization scanning

The initial exact-mask experiment replaces the optimistic loop's conservative
byte-level surrogate test with an exact UTF-16 test. It passes the string
correctness suite and improves Poet SIMD stringification 1.607×, but slows
large clean/late-escape ASCII stringification about 12%. It is rejected. Its
source is preserved in `utf16-unconditional.patch`, its binaries in
`runs/utf16-mask-001/`, and its six nine-round screens in
`comparisons/utf16-exact-*/` under `build/simdjson-parity/`.

The retained candidate leaves the cheap ASCII loop intact. After a conservative
candidate proves to be ordinary BMP text, it copies that block and continues
with a bounded exact UTF-16 loop. Valid surrogate pairs remain copyable,
including pairs crossing vector boundaries; escapes and unpaired units return
to the existing encoder at the current cursor. Clean vectors after an escape
use the same loop, keeping their output cursor local. Calls are skipped when
no full vector remains. The helper allocates nothing and owns no shared state.

A one-call-site variant gains 1.617× on Poet but slows dense escaping about
14%; it is rejected and saved in `utf16-adaptive-single-call.patch` and
`runs/utf16-adap-001/`. Sharing the scan with escaped-string continuation also
keeps it as a separate function in the optimized module. This agrees with
[Binaryen 130's single-use inlining heuristic](https://github.com/WebAssembly/binaryen/blob/version_130/src/passes/Inlining.cpp#L142).
The intermediate shared variant still fails late-escape ASCII by about 3.3%;
its source and results are preserved in `utf16-shared-helper.patch` and
`comparisons/utf16-shared-*/`. No compiler flags or benchmark caches change.

Final qualification uses same-length labels `utf16-base-001` and
`utf16-final001`, byte-identical native baseline executables, frozen input/source/
binary hashes and nine balanced fresh-process rounds. All 12 fully typed
classic layouts and ten ordinary owned-string diagnostics are measured. Four
diagnostics exercise fullwidth text, and an additional transition case forces
both helper entry paths before processing mixed surrogate pairs. Every layout
and backend passes complete owned-output and retained-result checks. Builds,
tests, profiling and output-oracle processing do not overlap timed processes.

V8 SIMD owned-stringify throughput ratios, candidate / baseline:

| Workload | Ratio | Workload | Ratio |
| --- | ---: | --- | ---: |
| Canada minified | 1.006× | Canada pretty | 0.981× |
| Twitter minified | 0.999× | Twitter pretty | 0.993× |
| CITM minified | 1.026× | CITM pretty | 0.985× |
| GitHub-events minified | 0.995× | GitHub-events pretty | 0.992× |
| Poet minified | 1.595× | Poet pretty | 1.598× |
| GSOC minified | 0.954× | GSOC pretty | 1.007× |
| Short ASCII | 1.004× | Large clean ASCII | 1.000× |
| Late ASCII quote | 1.008× | Dense escapes | 0.986× |
| Mixed Unicode | 1.031× | Short fullwidth | 0.994× |
| Clean fullwidth | 1.388× | Escaped fullwidth | 1.010× |
| Fullwidth with pairs | 1.022× | Forced transition | 4.033× |

Checked/unchecked w2c2 comparisons use the same frozen Wasm, incremental runtime,
SIMDe/header/translator pins and GCC 16.2 flags. Owned-stringify ratios:

| Workload | V8 | Checked w2c2 | Unchecked w2c2 |
| --- | ---: | ---: | ---: |
| Poet minified | 1.595× | 1.394× | 1.490× |
| Dense escapes | 0.986× | 0.997× | 1.014× |
| Fullwidth with pairs | 1.022× | 1.025× | 0.992× |
| Forced transition | 4.033× | 2.983× | 2.408× |

The full regression qualification is **not clean**: 18 of 22 workload screens
pass the explicit 3% limit. The six failing rows are:

- GSOC-minified V8 SIMD stringify: 4.85% slower.
- Twitter-pretty V8 SIMD parse: 3.40% slower.
- Dense-escape V8 SIMD parse: 3.15% slower.
- Dense-escape checked-w2c2 SWAR validation: 3.26% slower.
- Fullwidth/pairs checked-w2c2 SWAR validation: 3.10% slower.
- Fullwidth/pairs unchecked-w2c2 SWAR validation: 5.81% slower.

All 21 initially measured SWAR Wasm code sections are byte-identical between
variants. The SWAR native text sections are also byte-identical for all six
initial checked/unchecked executable pairs. Hash reports are saved in
`utf16-swar-{code,native-code}-identity.json`. That rules out changed SWAR
instructions; it does not turn the failed controls into passes. The GSOC
serialization regression remains unresolved in this adaptive candidate. The
packed-loop follow-up below measures its recovery. Its minified and pretty inputs
have identical values and map order, while its pretty stringify row is roughly
flat. Phase/state isolation and generated machine-code inspection remain
necessary before a universal integration recommendation.

Verification: 117,720 normal checks and 75,621 strict/RFC checks across all three
modes, 13 harness checks, typecheck and lint pass. Two public/scalar differential
sweeps cover 1,048,576 UTF-16 lane cases per mode, including entry after a
fullwidth prefix; existing vector-tail and output-boundary guards also pass.
The candidate is local and unpushed. Native simdjson still wins every measured
owned-stringify row; these gains are not whole-workload parity.

Final artifacts under `build/simdjson-parity/`: `runs/utf16-{base-001,final001}/`,
`comparisons/utf16-final-*/`, `utf16-final-gates.json`, and
`utf16-final-*-paired.log`. The earlier rejected variants remain available.

## Packed clean-run scanning

The clean-run helper now scans two UTF-16 vectors before copying either one.
Signed saturating narrowing packs their units into sixteen bytes for shared
ASCII quote/backslash/control checks. ASCII is unchanged; all other UTF-16
units become bytes at least 127. Both original full-width vectors still get
surrogate checks. An event stops the packed prefix and resumes the established
16-byte loop at the current block. The ordinary ASCII entry loop is unchanged.
All loads and stores remain within the source/output ranges already reserved.

The saved proposal's unsigned-narrowing suggestion is corrected: both narrowing
forms interpret their source lanes as signed, so unsigned saturation would
turn high UTF-16 values into zero. The implementation uses signed saturation,
consistent with the [WebAssembly numeric semantics](https://webassembly.github.io/spec/core/exec/numerics.html#op-narrow).
No runtime mode switch, additional allocation, result cache or compiler-flag
change is introduced.

All eight initial diagnostic/GSOC/Poet screens pass nine-round V8 comparisons.
The final source expands checking to all 22 measured workloads, with identical
native executables and same-length labels `utf16-final001` (adaptive baseline)
and `utf16-packF001` (candidate). Four workloads also compare checked and
unchecked w2c2, using the same frozen Wasm, incremental GC, GCC 16.2 flags and
backend pins. Input values and lengths change across four independent inputs;
eight owned results remain retained. Full native/AS output and retention
oracles pass every workload/backend. Timing does not overlap builds, tests,
profiling or oracle processing.

SIMD stringify throughput ratios, candidate / adaptive baseline:

| Workload | V8 | Checked w2c2 | Unchecked w2c2 |
| --- | ---: | ---: | ---: |
| GSOC minified | 1.126× | — | — |
| GSOC pretty | 1.078× | — | — |
| Poet minified | 1.034× | 1.044× | 1.099× |
| Poet pretty | 1.042× | — | — |
| Clean fullwidth | 1.309× | — | — |
| Escaped fullwidth | 1.021× | — | — |
| Short fullwidth | 1.003× | — | — |
| Fullwidth with pairs | 0.981× | 0.986× | 0.970× |
| Forced transition | 0.982× | 1.014× | 1.008× |
| Dense escapes | 1.010× | 1.008× | 0.961× |

All remaining V8 stringify ratios are within about 2% of baseline. Every
measured V8 and checked-w2c2 stringify row passes the explicit 3% regression
limit, but that does not make the complete qualification clean.

The GSOC comparisons include three revisions in the same nine-round run:
the pre-adaptive baseline (`utf16-base-001`), adaptive baseline, and packed
candidate. V8 SIMD stringify medians, microseconds:

| Layout | Pre-adaptive | Adaptive | Packed |
| --- | ---: | ---: | ---: |
| Minified | 1036.66 | 1083.01 | 962.24 |
| Pretty | 1016.21 | 1028.12 | 953.42 |

The packed candidate recovers the earlier GSOC regression: throughput is
1.077× minified and 1.066× pretty relative to the pre-adaptive implementation.
These are direct same-run comparisons, not products of ratios from earlier
runs. Native stringify remains faster (about 191–196 microseconds).

The full screen still **fails**: 17 of 22 workload screens pass. Eight rows
exceed the 3% time limit:

- Short-fullwidth V8 SIMD validation: 3.85% slower.
- Fullwidth/pairs V8 SIMD validation: 3.29% slower.
- Fullwidth/pairs unchecked-w2c2 SIMD stringify: 3.13% slower.
- Dense-escape V8 SIMD validation: 3.39% slower.
- Dense-escape unchecked-w2c2 SIMD stringify: 4.10% slower.
- Poet-pretty V8 SIMD validation: 3.06% slower.
- Short-ASCII V8 SWAR parse: 3.32% slower.
- Short-ASCII V8 SIMD validation: 3.08% slower.

Those parsing/validation algorithms are unchanged. All 22 SWAR code-body
arrays match bit-for-bit, as do all eight SWAR native-text executable pairs.
Each classic SIMD module changes one function body; the small string modules
also change function ordering/references. Reports are saved as
`pack32-code-body-diff.json` and `pack32-swar-native-identity.json`. Code identity
does not recategorize a failed screen as passing. The unchecked-w2c2 stringify
regressions remain unresolved, including cases that do not execute the packed
loop. Backend code generation and phase/state isolation require follow-up.
This is a local candidate, not a universal integration recommendation.

Verification: 118,107 normal checks, 75,621 strict/RFC checks across all three
modes, 13 harness checks, typecheck and lint pass. Public/scalar comparisons
include 1,114,112 exhaustive UTF-16 lane cases per mode, critical-value checks
in all sixteen packed positions, and surrogate/tail boundaries through forty
units. No production parser changes or API changes accompany the scanner.
Native parity across all workloads remains unachieved.

## Owned raw corpus coverage

The native generator now maps `JSON.Raw` to owned `std::string` lexemes,
including nullable fields, arrays and root maps. A full simdjson DOM validation
pass runs before raw capture on every root parse, inside parse timing; its
storage is reused. On-Demand `raw_json()` alone does not establish full validity.
Generated models without raw fields omit the prepass at compile time.

Serialization uses public `with<Adapter>` annotations and a public root
serialization hook. The pinned native builder cannot serialize a custom raw
type nested inside reflection/containers through its top-level hook alone;
the saved first failed build documents that limitation. No private builder
internals or borrowed output replace owned results. The transient root view
only directs serialization; the result is an independently owned string.

This conservative benchmark adapter is not an arbitrary-input acceptance
equivalence claim. DOM rejects oversized integers, overflowing exponents and
isolated escaped surrogates that AS raw syntax can retain. Those restrictions
are tested explicitly. Exact lexemes (including internal whitespace, exponent
spelling and escapes) survive overwritten/freed input and parser reuse. Tests
also cover nullable values, root maps with escaped keys, scalar/container root
ranges, and eleven malformed skipped subtrees rejected before output mutation.

Five alternating fresh-process native/V8 rounds, label `raw-owned-001`, use the
existing combined-phase driver: four independently allocated changing inputs,
eight retained objects and eight retained strings, strict parsing, incremental
GC, 100 operations per phase. No builds/tests/profiling/oracle processing overlap
timing. Both layouts pass 40 complete owned-output comparisons each.
V8 15.2.20 TurboFan vs GCC 16.2 native ARM64 simdjson 5.0.4, medians in us:

| Layout / phase | Native | SWAR | SIMD |
| --- | ---: | ---: | ---: |
| Lottie min / parse | 478.60 | 526.22 | 566.27 |
| Lottie min / stringify | 22.71 | 51.84 | 52.44 |
| Lottie min / validate | 235.88 | 450.25 | 491.37 |
| Lottie pretty / parse | 659.02 | 1407.19 | 1473.82 |
| Lottie pretty / stringify | 68.74 | 182.11 | 170.11 |
| Lottie pretty / validate | 322.85 | 1261.40 | 1285.59 |

Every row remains a parity gap. No json-as production algorithm changed in this
step, and no improvement is claimed against older runs. Artifacts are under
`build/simdjson-parity/runs/raw-owned-001/`; native adapter test source, logs and
binary are under `raw-adapter-tests/`. The benchmark metadata explicitly records
the native raw prevalidation policy.

Verification: all 15 harness checks, including compiled native raw and non-raw
controls, pass; formatting, lint and diff checks pass. The non-raw control proves
the DOM validator remains unallocated. This change only affects qualification
infrastructure; production AS sources and kernels are unchanged.

OTFCC (~63 MB) and FGO (~47 MB) need a memory feasibility check before applying
this driver's simultaneous source/retained-object/retained-string graph. Eight
owned results per API must remain retained; reducing that count would change
the workload. Separate phase processes are a possible follow-up and would need
consistent native/AS treatment and their own baseline. Neither huge layout is
credited as owned coverage yet, and remaining required families remain open.

## Rejected long-indentation scanner

The production scalar whitespace implementation is retained. A new guarded
block-scanning candidate has useful gains but fails the complete regression
screen, including compact-input regressions. It is not committed as a runtime
change or recommended for integration.

The isolated Lottie-pretty validation profile collects 3,054 direct-PC samples:
2,829 in the validation entry with inlined grammar and 165 in skipCursorString
(2,994 Wasm self samples total). This does not attribute time to individual
inlined instructions or native symbols. The input census finds 1,200,350
whitespace units in 1,489,279 UTF-16 units; 1,174,027 of those whitespace units
belong to runs of at least eight. Minified Lottie has no layout whitespace.
Profile source, commands, hashes, log and reader are saved under
`build/simdjson-parity/raw-validation-profile/`; the census is
`lottie-whitespace-census.json`.

The candidate enters block scanning only after proving four consecutive UTF-16
spaces. Its initial SIMD lane-bitmask loop passes correctness but fails a V8
owned stringification control. A boolean XOR/any-true variant plus bounded
word/scalar tails improves SIMD scanning substantially. Both retain the exact
four-character RFC whitespace predicate. No allocation, source caching or
validation weakening is introduced. Binaryen can inline the helper; a separate
source function does not establish a separate machine-code hot path.

During checking, the comparison scheduler's per-round label rotation followed
by reversal was shown to always put the baseline first for two labels. The
regression test first fails with 12 baseline-first rounds; the corrected
scheduler passes four tests, reverses adjacent rounds, and rotates between
pairs. New comparison artifacts include comparison/scheduler source hashes.
Historical runs and their failures remain saved. The results below rerun the
same frozen binaries with corrected, balanced order.

Six complete rounds over all 16 validation layouts compare fresh baseline
`val-long-base001` and candidate `val-long-test001`. Twelve rounds per owned
Lottie layout compare `raw-owned-001` and `ws-anyt-00001`. Native executables,
inputs, compiler settings and label lengths match within each comparison.
V8 15.2.20 TurboFan and checked/unchecked GCC 16.2 w2c2 use the existing pins and
incremental-GC Wasm. No builds, tests, profiling or oracle processing overlap
timing. All 64-input validation and complete owned/retention oracles pass.

Candidate / baseline validation throughput ratios:

| Backend / mode | CITM pretty | Lottie pretty |
| --- | ---: | ---: |
| V8 SWAR | 1.440× | 1.902× |
| V8 SIMD | 1.421× | 1.904× |
| Checked w2c2 SWAR | 1.396× | 1.831× |
| Checked w2c2 SIMD | 1.409× | 1.762× |
| Unchecked w2c2 SWAR | 1.665× | 2.186× |
| Unchecked w2c2 SIMD | 1.402× | 1.924× |

Owned Lottie-pretty parsing improves 1.833×/1.806× in V8 SWAR/SIMD,
1.697×/1.658× in checked w2c2 and 1.907×/1.794× unchecked. Native remains faster
on both V8 and checked-w2c2 parsing rows. The validation-family native-parity
gate still reports **26 gaps across 32 checked-w2c2 rows**.

The complete balanced regression screens **fail**:

- Full validation: 12 of 96 rows exceed 3% time regression. These include V8
  CITM/OTFCC minified, V8 SIMD FGO minified, checked-w2c2 SWAR Poet pretty,
  GSOC minified and Lottie minified, and unchecked-w2c2 Canada/CITM/Poet rows.
  Checked-w2c2 SWAR GSOC minified is about 8% slower.
- Owned Lottie pretty: V8 SWAR stringification is about 3.5% slower.
- Owned Lottie minified: six of 18 rows fail, covering V8 SWAR parse/stringify/
  validate, V8 SIMD parse, and checked-w2c2 SWAR parse/validate. The slowdowns
  are roughly 3–6%.

The pretty SWAR serializer's complete 35-function direct-call closure has
byte-identical Wasm bodies and no indirect calls; this does not turn its failed
measurement into a pass. Module/code-generation/context effects remain an
unresolved control issue. A prefix heuristic plus statically separate compact
and indentation traversals is a possible next experiment, not a measured fix.

Artifacts: `comparisons/ws-long-balanced-{validation,owned-pretty,owned-min}/`,
`ws-long-balanced-gates.json`, `ws-long-code-body-diff.json`,
`ws-long-serialize-body-closure.json`, and rejected `ws-any-candidate.patch` in
the ignored parity build directory. The first lane-mask patch and unbalanced
runs are also preserved.

The rejected candidate passes 119,283 normal checks, 75,621 strict/RFC checks,
15 harness checks, typecheck, lint and formatting. Boundary tests now retain
the earlier alignment cases and add all 65,536 UTF-16 units in 32 long-run
positions, mixed whitespace, bounded prefixes and public grammar checks.
Production is restored to the existing scanner; all 1,245 targeted checks pass
against that restored code across three modes. Whole-workload parity remains
unachieved.

## Static discard state storage

The retained runtime change replaces the checked discard traversal's lazy
`StaticArray<u8>` with 256 bytes of static module storage and direct byte loads
and stores. Existing depth bounds and grammar transitions are unchanged. The
discard reader cannot invoke user code; its shared synchronous scratch lifetime
is unchanged. No per-value allocation, cache, new grammar policy or runtime flag
is introduced. The scalar whitespace loop remains in production.

Before this change, two layout-selection experiments improve pretty validation
but slow checked-w2c2 Canada. The root-only selector folds both grammar paths
into a large validation function. Compact-subtree delegation retains a separate
compact function with two real callers and independent parent scratch, but does
not remove the checked-backend slowdown. Named inspection binaries have
byte-identical code sections to their frozen measured counterparts. These
experiments are saved, not included in this runtime patch. Their older relative
regression screens are diagnostic under the user's revised absolute budget.

The static-storage result compares `val-long-base001` with `val-static-00001`
over all 16 layouts in six balanced rounds. Native binaries, inputs, label
lengths and compiler settings match. V8 15.2.20 TurboFan and both pinned GCC 16.2
w2c2 configurations run the same incremental-GC Wasm; all 64-input validation
oracles pass. No build, test, profile or oracle processing overlaps timing.
SIMD validation throughput ratios, candidate / baseline:

| Workload | V8 | Checked w2c2 | Unchecked w2c2 |
| --- | ---: | ---: | ---: |
| Canada min | 1.049× | 1.081× | 1.008× |
| CITM pretty | 1.001× | 1.142× | 1.181× |
| Poet min | 1.101× | 1.005× | 0.997× |
| Poet pretty | 1.110× | 1.007× | 1.008× |
| Lottie pretty | 0.995× | 1.117× | 1.186× |

No SIMD validation row across the full 16-layout, three-backend screen regresses
more than 3%. That is a diagnostic observation, not an extra user-goal gate.
The current native budget is met by 2/16 V8, 4/16 checked-w2c2 and 4/16 unchecked
validation rows. Twelve checked-w2c2 validation rows still exceed 1.2× native
latency; the validation target remains incomplete.

Owned Lottie min/pretty comparisons use `raw-owned-001` and `st-byte-00001`,
six balanced rounds per layout and all three backends. Forty complete
output/retention comparisons pass per label/backend. Checked-w2c2 SIMD parsing
improves 1.077× minified and 1.132× pretty. Minified parsing meets the native
budget in all three backends; its stringify and validation phases still miss.
All three checked-w2c2 pretty phases remain outside the native budget.

The V8 pretty stringification control slows about 3.3% (0.968× throughput),
although no serialization algorithm changed. Other SIMD owned stringification
ratios in this screen range from 0.982× to 1.035×. The control is recorded, not
reclassified as a pass or described as proof of a universal improvement.

Verification: 119,283 normal checks, 75,621 strict/RFC checks, 1,656 targeted
cursor/bounds checks, 15 native/generator/input harness checks, four scheduling
and four goal-policy tests pass. Typecheck, lint, formatting and diff checks pass.
Normal and strict correctness continue to cover all three library modes; SWAR
performance does not gate the revised native target.

Artifacts: `comparisons/static-stack-{full-validation,owned-min,owned-pretty}/`,
`static-stack-full-summary.json`, `static-stack-owned-summary.json` and their
raw logs under `build/simdjson-parity/`. The larger canary improvements (up to
22% checked-w2c2 SIMD validation) are not substituted for full-matrix results.
This is progress toward the classic SIMD goal, not completion; large OTFCC/FGO
owned runs and native gaps remain outstanding.

Artifacts under `build/simdjson-parity/`: `runs/utf16-pack-001/` for the initial
experiment, `runs/utf16-packF001/` for final qualification,
`comparisons/pack32-final-*/`, `pack32-final-gates.json`, and
`pack32-final-*-paired.log`. GSOC's directories contain all three frozen
revisions and their complete output evidence.
