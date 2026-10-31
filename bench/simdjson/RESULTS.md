# Local qualification status (2026-10-31)

Whole-workload parity is **not achieved**. Current typed owned evidence covers
Canada minified only. The manifest retains every outstanding corpus/layout and
required family; native Twitter's recursive reflection writer still fails to
compile without changing its model.

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
