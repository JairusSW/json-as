# Local qualification status (2026-10-31)

Whole-workload parity is **not achieved**. Typed owned evidence covers Canada
minified and CITM minified/pretty; validation evidence covers all 16 classic
layouts. The manifest retains every outstanding corpus/layout and required
family. Native Twitter's recursive reflection writer still fails to compile
without changing its model.

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
