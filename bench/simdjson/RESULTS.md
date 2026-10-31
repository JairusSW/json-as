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
