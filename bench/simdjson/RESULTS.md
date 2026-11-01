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

## 2026-11-01 profile refresh and negative screens

Isolated named-Wasm profiles on accepted head `96871ca` change the next
optimization priority:

- Twitter stringify spends 19.2% of whole-process samples in the shared SIMD
  string writer and 8.7% in the generated `Status` writer. Its generated writer
  is 11,742 Wasm bytes. A four-vector/64-byte clean-string loop regressed
  stringify 1.77% in 15 alternating pairs; a packed surrogate-candidate check
  was also neutral-negative. Adding a four-code-unit SWAR clean-copy tail first
  appeared 8.5% faster against an older artifact, but an equal-head/equal-label
  seven-pair control showed it 1.0% slower. The existing paired 32-byte loop and
  scalar short tail remain best; untouched phase movement is treated as code
  layout, not credited to a serializer change.
- A fresh GSOC-minified serialization-only profile after direct Map traversal
  attributes 2,386 of 2,935 Wasm self samples (81.3%) to the shared SIMD string
  writer; Map/root serialization is next at 267 samples. A general prototype
  classifies long clean ASCII prefixes first and hands their copy to Wasm bulk
  memory. Seven equal-label process pairs show that the extra source traversal
  outweighs the bulk copy: GSOC SIMD stringify throughput falls to 0.937x while
  parse and validation controls remain flat. The fused scan/store loop stays.
- Twitter validation spends 20.7% of samples in `skipCursorKey`, 4.2% in
  literal recognition and 32.0% in the inlined grammar loop. Fusing key and
  colon recognition won 12/16 matrix rows but regressed Canada by 1.9%/7.1%.
  Caching the top container lost all 16 rows, and literal inlining won only six.
- CITM fresh parsing is allocator-bound: TLSF insert/remove plus `__new` account
  for 25.7% of samples before GC/linking costs. A fixed 16-element fresh-array
  capacity and both global and cursor-only slot-helper inlining produced mixed
  corpus results, including confirmed Twitter-pretty regressions. Field-level
  capacity knowledge or a lower-allocation construction strategy was required;
  a global fixed hint was not justified. A subsequent bounded per-field learned
  capacity experiment also regressed CITM-minified parse by 1.7%. Isolating the
  hinted reader from the ordinary generic calling convention made the result
  slightly worse at 1.9%, while stringify and validation controls stayed flat.
  Capacity prediction is therefore rejected; the remaining target is less
  array-construction machinery rather than a different initial capacity.
- CITM stringify profiles identify generated object writers, `itoaU64` and the
  shared integer-array writer as the largest named kernels. Forced `itoaU64`
  inlining previously regressed about 20%; a later runtime-generic shortcut
  from small positive `i64[]`/`u64[]` values directly to `itoaU32` regressed
  stringify 2.4% across seven equal-head pairs. Additional formatter dispatch
  is rejected; generated writer integration remains the relevant seam.

All screens used changing rotated inputs, retained independent outputs and
alternating fresh V8 processes. Rejected candidates were reverted. The
checkout already uses `xjb-as` 0.2.0 buffered dtoa/ftoa, including the algorithm
under AssemblyScript PR 3025; there is no older formatter integration to
replace. Profile artifacts are
`build/simdjson-parity/{twitter-serialize,twitter-validate,canada-validate,citm-parse}-profile*`,
`gsoc-map-{serialize,self-profile}*`, and
`comparisons/bulkcopy-gsoc-min/`.

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

## Fresh array capacity and direct element destinations

The initial measurements below predate allocator-reservation fix `6b2a98d`.
They are preserved as experimental evidence, not current native-budget gates.
The corrected comparisons use the `pool-{base,slot}-0001` labels.

A Canada parse-only profile preserves the four changing inputs, preloaded
owned objects and eight retained parse outputs, while removing timed stringify
and validation phases. V8's time-ordered direct-PC profile has 5,020 Wasm self
samples, including 3,311 in allocation/GC runtime routines. This is diagnostic
self-sample attribution, not a backend-independent timing breakdown. The
specialized float-array reader already performs paired conversion, so generic
scalar-number conversion reuse is not the main opportunity for this corpus.

Two independent changes are measured. Fresh SWAR/SIMD float arrays start with
a normal two-element literal, instead of the constructor's minimum capacity of
eight. Empty/single/long arrays still use normal lengths and runtime growth.
Canada has 55,563 numeric pairs: f64 backing capacity falls from 64 to 16 bytes
per pair, saving 2,667,024 payload bytes per parsed graph. A compiled runtime
probe confirms constructor/literal/parsed backing capacities of 64/16/16 bytes.

The generic array reader also publishes a zero slot before decoding each child
directly into its final buffer position. The Array remains the managed owner for
write barriers, matching standard Array element stores. This removes the
intermediate managed CursorSlot and the second meaningful reference store/link.
It does not borrow input, pool output, or change grammar and output types.

Six balanced rounds compare `num-base-0001`, capacity-only `num-pair-0001`, and
combined `num-slot-0001`. Native binaries and rotating inputs match; all forty
complete owned-output/retention comparisons per label/backend pass. SIMD Canada
minified fresh-parse medians, milliseconds:

| Backend | Baseline | Capacity only | Direct destinations too | Combined throughput gain |
| --- | ---: | ---: | ---: | ---: |
| V8 | 6.287 | 5.278 | 5.228 | 1.202× |
| Checked w2c2 | 6.679 | 6.410 | 6.212 | 1.075× |
| Default unchecked w2c2 | 5.597 | 4.910 | 4.712 | 1.188× |

The independent direct-destination increment is 1.009×/1.032×/1.042×. Serialize
and validation controls are recorded in the comparison, not attributed to a
new serializer or validator algorithm. Native owned parsing is about 2.6 ms;
Canada parsing remains outside the 1.2× native budget. These initial results
alone are insufficient; corrected comparisons follow below.

Targeted tests cover f32/f64 lengths zero through eighteen, growth, signed zero,
round trips, separate output identities, nullable references, nested arrays and
Raw values. Child initializers force GC while reference arrays grow and assert
that the cursor path is actually selected. All 2,025 targeted checks, 77,646
strict/RFC checks and 119,283 normal checks pass across all modes; typecheck and
lint pass.

Artifacts under `build/simdjson-parity/`: `num-parse-profile/`,
`canada-float-array-census.json`, `comparisons/direct-destination-canada-min/`,
`fresh-array-broad-build.log`, and the frozen `arr-{base,slot}-0001` runs.

### Allocator reservation defect and regression isolation

The initial broader screen covers Canada pretty, CITM/Twitter/Poet minified,
and flat/nested numeric diagnostics, with six balanced rounds in V8 and default
w2c2. All complete output oracles pass. Classic SIMD parse ratios include
1.162×/1.319× Canada pretty, 1.117×/1.131× CITM, 1.048×/1.001× Twitter and
1.036×/1.000× Poet (V8/default w2c2). However, default-w2c2 nested-pair parsing
slows from 403 to 909 us while V8 improves. These runs do not justify retaining
the change without diagnosis.

Capacity-only builds reproduce the same short-run slowdown, excluding direct
destinations as its cause. Omitting the static zero-data copy with `__newArray`
does not fix it; that initializer is discarded. Parse-only and full-harness
10,000-operation profiles fail to reproduce the slowdown, even with ordinary
non-debug code generation. Those diagnostic measurements are not substituted
for the original comparison.

Sampling the exact frozen short-run binary finds most additional active samples
in `__bzero`, called by allocator growth. A diagnostic host pauses immediately
before the first clock call to let the sampler attach. Separately, a copied
w2c2 header traces growth and host clock-call counts; tracked runtime sources
remain unchanged. The decisive short-run trace is:

| Variant | Growth | Timer state |
| --- | --- | --- |
| Original arrays | 1 GiB → 2 GiB | Before the first clock call |
| Smaller arrays | 1 GiB → 2 GiB | After parse starts, before its end clock call |

The harness's direct `memory.grow` pre-growth did not register the extra pages
with TLSF. Its next allocation-driven growth could therefore zero another
gigabyte inside only one variant's timed loop. Larger warmup counts moved this
growth outside timing, explaining why extended profiles were misleading.

Commit `6b2a98d` reserves memory through the heap allocator in bounded unmanaged
blocks, then frees them in reverse order before measurement. All three runtimes
can reuse that capacity. A regression fixture failed on incremental/minimal
with an unexpected 16-to-32 MiB growth, then passed after the fix; disabled and
idempotent reservation and stub allocation are covered too. All twenty combined
generator/input/preallocation tests, typecheck, lint and formatting pass.
Corrected w2c2 traces show no timed growth in either variant. Actual linear
memory can exceed the reservation request; requested reservation must fit.

Evidence under `build/simdjson-parity/`: `comparisons/fresh-array-*/`,
`fresh-array-broad-summary.json`, `fresh-pair{,-full,-normal}-profile/`,
`frozen-pair-profile/`, `frozen-growth-trace/`, `fixed-growth-trace/`,
`preallocation-{red,green}.log`, and `fixed-pool-qualification.log`.

### Corrected fresh-array comparison

Both baseline and candidate now use allocator-backed reservation from
`6b2a98d`. `pool-base-0001` retains the preceding parser; `pool-slot-0001`
combines the ordinary two-element literal and direct generic array destinations.
Frozen native binaries and all four changing input hashes match. Six balanced
rounds run V8 and unchecked w2c2 separately, without concurrent builds/tests or
oracle processing. Every label/backend passes all forty complete owned-output
and retained-result comparisons. SIMD parse throughput, candidate/baseline:

| Workload | V8 | Default unchecked w2c2 |
| --- | ---: | ---: |
| Canada minified | 1.212× | 1.345× |
| CITM minified | 1.068× | 1.160× |
| Nested numeric pairs (diagnostic) | 1.140× | 1.161× |

Canada parse medians are 6.457 → 5.325 ms in V8 and 5.710 → 4.246 ms in
unchecked w2c2. CITM is 1.590 → 1.489 ms and 1.359 → 1.172 ms respectively.
This qualification retains the array changes, rather than using a longer
warmup to hide the original timing discrepancy. Unchecked execution remains a
separate runtime configuration; checked-w2c2 and the remaining layouts need
fresh qualification before a complete current matrix can be claimed.

The parser changes do not alter serialization or validation algorithms. Their
control rows remain recorded in `comparisons/fixed-pool-*/results.tsv` and must
not be presented as separate formatter/validator optimizations. The full
48-row SIMD native target is still incomplete. Current Canada and CITM owned
parsing exceed the 1.2× native latency budget, and CITM serialization remains
a particularly large measured gap.

The final parser source matches the version with 119,283 normal, 77,646
strict/RFC and 2,025 targeted checks passing across all three modes. The heap
reservation fix is additionally covered by the twenty passing harness tests.
Artifacts: `comparisons/fixed-pool-{numeric_pairs-min,canada-min,citm_catalog-min}/`
and `fixed-growth-trace/`, under `build/simdjson-parity/`.

## Shared serialization dispatch

A refreshed V8 profile keeps the full harness and all retained graphs, extending
only stringification to 10,000 operations. Its 2,531 Wasm self samples include
530 in Area element writing, 353 in integer-array dispatch, 296 in integer
formatting and 228 in SeatCategory element writing. These are whole-process
self samples, not a pure serialization-time breakdown or native-copy profile.
Map snapshot allocation is not the leading measured opportunity.

The generated Wasm exposes duplicated managed-reference frames. The profiled
Area element passes through element, namespace, struct and generated-method wrappers.
After the existing null/custom checks, the element writer can call the generated
method directly. Reference dispatch also moves into JSON.__serialize, which the
public reference fallback now shares; its class branch calls the generated
method directly too. Every original reference branch, payload call and
unsupported-type error is preserved, checked with a whitespace-normalized source
comparison. No corpus, field signature, decimal width, unsafe annotation or
runtime configuration selects the new path.

Both named inspection binaries have code sections byte-identical to their
respective frozen CITM binaries. Area element frames fall from four to two;
its integer-array field frames fall from four to three. The compiler still roots
managed arguments and performs virtual dispatch. A regression test nests a
custom serializer inside a generated element, removes that current object from
its parent array, grows the backing buffer, replaces the following object and
forces collection/allocation before writing the current object's tail. It
checks original iteration extent, replacement visibility and retained output.
The test passes against both baseline and candidate across all three modes.
Additional polymorphism checks cover base-typed arrays, nullable arrays, map
values and public calls holding derived generated/custom serializers.

Six balanced rounds compare `maps-base-0001`, element-only `maps-call-0001`, and
full `maps-full-0001` on CITM minified. SIMD stringification throughput ratios:

| Backend | Element-only / baseline | Full / baseline |
| --- | ---: | ---: |
| V8 | 1.046× | 1.059× |
| Checked w2c2 | 1.071× | 1.147× |
| Default unchecked w2c2 | 1.084× | 1.181× |

The final broad screen compares `disp-base-0001` and `disp-full-0001` over seven
more classic layouts, six balanced rounds each. Native binaries, changing input
hashes and toolchain settings match. Every label/backend passes forty complete
output and retention comparisons. SIMD stringification throughput ratios:

| Layout | V8 | Default unchecked w2c2 |
| --- | ---: | ---: |
| Canada minified | 1.037× | 1.071× |
| CITM pretty | 1.065× | 1.166× |
| Twitter minified | 1.026× | 1.065× |
| Poet minified | 1.021× | 1.003× |
| GitHub events minified | 0.995× | 1.050× |
| GSOC minified | 1.026× | 1.084× |
| Lottie minified | 0.989× | 0.996× |

The initial unchecked-w2c2 Poet parse control is 0.947× despite unchanged parser
algorithms. A separate six-round confirmation is 1.001× for parsing and 1.031×
for stringification; both artifacts remain recorded. This does not establish
zero code-generation/timing variability, and no Poet-specific path is added.
Other parse/validation controls remain in the full result tables, not promoted
as new parsing or validation algorithms.

No previously qualifying SIMD row drops outside the native budget in the broad
screen. The selected 21 rows contain 5 V8 or 7 unchecked-w2c2 rows within budget,
unchanged in count. These are partial screens, not the 48-row completion gate.
CITM stringification and many other rows remain substantially slower than
native. Remaining classic layouts still need qualification on a single selected
backend; checked-w2c2 claims beyond the canary remain unverified.

Verification: 119,301 normal checks, 77,676 strict/RFC checks across all three
modes, twenty harness checks, typecheck, lint, formatting and diff checks pass.
SWAR receives the shared implementation but does not gate native parity.
No builds/tests/oracle processing overlap timings.

Artifacts under `build/simdjson-parity/`: `maps-serialize-profile/`,
`direct-dispatch-codegen/{baseline/identity,identity,reference-dispatch-identity}.json`,
`comparisons/direct-{writer,dispatch}-citm-min/`, `comparisons/dispatch-*/`,
`dispatch-broad-summary.json`, `dispatch-final-source-identity.json`, and
`dispatch-{full-suite,final-rfc,final-check}.log`.

## Rejected shared-validator experiments

Two general changes are measured against `ece500e`, then removed. Neither
recognizes corpus names, schemas, numeric widths or fixture values. Both use
six balanced rounds over the complete sixteen-layout validation matrix,
four independently changing inputs per layout, identical native binaries and
the existing runtime/compiler policies. Builds and correctness checks finish
before timing; full oracle comparisons run after timing.

First, `ival-word-000001` uses the existing checked word scanner for discarded
integer runs, matching the existing fraction/exponent strategy. Initial-digit
and leading-zero checks remain. Its Canada minified SIMD throughput ratios are
0.886× baseline on V8, 0.882× on checked w2c2 and 0.766× on default w2c2.
Lottie minified reaches only 0.830× on default w2c2. Selected integer-heavy
layouts improve, but these regressions reject the shared implementation.
The scalar integer loop is restored. It passes 120,453 normal and 77,676
strict/RFC checks across all three modes before rejection.

Second, `stat-regs-000001` keeps the current discard-container state local,
saving/restoring only suspended parents in the same bounded static stack.
It removes ordinary transition loads/stores for all arrays and objects.
SIMD validation throughput ratios, candidate / `ival-base-000001`:

| Layout | V8 | Checked w2c2 | Default unchecked w2c2 |
| --- | ---: | ---: | ---: |
| Canada minified | 1.061× | 0.955× | 1.060× |
| Canada pretty | 1.042× | 0.999× | 1.020× |
| CITM minified | 0.999× | 0.993× | 1.032× |
| CITM pretty | 0.990× | 1.046× | 1.004× |
| FGO minified | 0.989× | 1.011× | 1.010× |
| GitHub events minified | 1.002× | 0.979× | 1.014× |
| GitHub events pretty | 1.005× | 1.007× | 1.020× |
| GSOC minified | 1.011× | 0.972× | 1.017× |
| GSOC pretty | 0.987× | 0.977× | 0.991× |
| Lottie minified | 1.008× | 1.049× | 0.986× |
| Lottie pretty | 0.994× | 0.932× | 1.016× |
| OTFCC minified | 0.986× | 1.002× | 1.031× |
| Poet minified | 0.993× | 0.990× | 1.007× |
| Poet pretty | 1.021× | 0.987× | 0.993× |
| Twitter minified | 0.995× | 0.978× | 1.006× |
| Twitter pretty | 1.015× | 0.963× | 1.007× |

Geometric means across layouts are 1.006×, 0.990× and 1.013× respectively;
they do not replace individual native-latency gates. The checked-w2c2
regressions and small mixed aggregate result do not justify retaining this
change. It passes 123,057 normal and 77,676 strict/RFC checks across all three
modes, including expanded independent-validator mutations, before rejection.

Both experiments pass all 64-input validation oracle comparisons on every
backend. Neither adds a qualifying SIMD layout: baseline and both candidates
qualify two V8 layouts, four checked-w2c2 layouts and four default-w2c2 layouts
in their respective runs. Default w2c2 still misses twelve validation rows;
owned parse/stringify and the full 48-row target remain incomplete. SWAR is
measured diagnostically and does not gate native parity. No layout-specific
selector is added to retain a favorable subset. Production runtime source
returns exactly to `ece500e`; additional grammar controls and negative
experiment records remain.

Artifacts under `build/simdjson-parity/`:
`comparisons/{integer-word,local-state}-full-validation/`,
`integer-word-{full-tests,rfc-tests,check}.log`,
`local-state-{full-tests,rfc-tests,check,format}.log`, and
`validator-controls-final-{normal,rfc}.log`.

## Rejected shared array-dispatch variants

All runtime changes in this experiment are removed. The retained test exercises
empty/nonempty/empty transitions across sixteen primitive, string, nullable,
nested-array and Date cases, keeping earlier results alive across collection.
It passes against the original runtime before and after the experiments.

The empty-check-only variant moves the common empty return ahead of type
dispatch and passes the entry's length to seven private kernels. The outlined
variant additionally inlines the entry and moves the generic loop into a private
function. The fused variant keeps that loop inside the inlined entry instead.
Every variant operates on shared Array<T> dispatch with ordinary output and GC
semantics. None recognizes corpus names, schema signatures or decimal widths.

A first six-round CITM comparison uses four changing strings of equal lengths:
empty-check-only SIMD stringification throughput ratios are 1.058× on V8,
0.959× on checked w2c2 and 1.032× on default w2c2. Those valid fixed-length
results remain separate from subsequent length-varying results. Control
preflight detects the missing --vary-length flag before any mismatched-input
timing. The rebuilt controls use exactly the older baselines' input hashes.

The accepted length-varying screen compares original `arrv-base-0001` on CITM
and `disp-full-0001` on Canada/Twitter against empty-check-only `arrv-fast-0001`,
outlined `arrv-call-0001`, and fused `arrv-flat-0001` in separate runs. Frozen
Canada/Twitter baseline runtime patches match `f499704`. CITM uses a freshly
built original runtime because its older frozen candidate also changes reference
dispatch. Native binaries, schemas, four input hashes, operation counts and
toolchains match per comparison. Six balanced rounds run on V8 and both w2c2
check policies. Builds, tests and inspection finish before timing; complete
oracles are checked afterwards.

SIMD stringification throughput ratios, candidate / original:

| Layout | Variant | V8 | Checked w2c2 | Default unchecked w2c2 |
| --- | --- | ---: | ---: | ---: |
| CITM minified | Empty check | 1.081× | 0.971× | 1.131× |
| CITM minified | Outlined | 1.064× | 0.974× | 1.209× |
| CITM minified | Fused | 1.035× | 0.997× | 1.057× |
| Canada minified | Empty check | 0.943× | 1.001× | 1.030× |
| Canada minified | Outlined | 0.902× | 1.063× | 1.044× |
| Canada minified | Fused | 0.921× | 0.995× | 1.007× |
| Twitter minified | Empty check | 1.010× | 1.015× | 0.973× |
| Twitter minified | Outlined | 1.022× | 1.021× | 0.995× |
| Twitter minified | Fused | 1.004× | 1.079× | 0.999× |

A separate six-round V8 Canada confirmation gives 0.923× outlined
stringification throughput. A separate six-round CITM confirmation gives
1.021× V8, 1.021× checked-w2c2 and 1.086× default-w2c2 throughput. Both initial
and confirmation results remain; the 1.209× result is not a stable gain estimate.
Other phases remain in the raw tables. For example, fused CITM parse controls
are 0.942× on V8 and 0.953× on default w2c2 despite unchanged parsing algorithms.
These are measured controls, not new parser improvements.

Named inspection binaries have code sections identical to the frozen Wasm.
The representative integer-array namespace writer drops from three GC frame
setups to two in the outlined variant. A nested generic-array element instead
changes frame sizes from [4, 4, 12] to [4, 8, 12] bytes. Static TurboFan code
summaries grow that nested function from 1,912 to 1,944 instruction bytes, while
the primitive float-array function shrinks from 14,856 to 14,656 instruction
bytes. These observations establish code-generation changes; they do not isolate
the cause of the slowdown. Removing the outline does not fix V8 Canada.

All candidates pass 123,345 normal and 77,676 strict/RFC checks across all three
modes, including custom callbacks that mutate parent arrays and force GC.
Every accepted label/backend passes forty complete owned-output and retention
comparisons. Typecheck, lint and formatting pass. No additional native-budget
row is gained: the nine screened rows pass one V8, two checked-w2c2 or three
default-w2c2 rows before and after. This is partial evidence; the full 48-row
classic target remains incomplete. SWAR measurements are diagnostic.

Artifacts under `build/simdjson-parity/`:
`comparisons/array-entry-citm_catalog-min/`,
`comparisons/array-inline-{citm_catalog-min,canada-min,twitter-min}/`,
`comparisons/array-inline-{canada-v8-confirm,citm-confirm}/`,
`comparisons/array-fused-{citm_catalog-min,canada-min,twitter-min}/`,
`array-{inline,inline-canada}-codegen/`,
`array-entry-baseline-source-identity.json`,
`array-dispatch-experiment-summary.json`, and
`array-{entry,inline,fused}-{full-tests,rfc-tests,check}.log`.

To recover space, completed immutable comparison oracle copies with identical
bytes share hardlinks. All 2,501 paths and their original bytes are preserved
and verified before/after replacement; 23 unique contents replace about 2.25 GB
of duplicate logical bytes. Frozen run oracles and inputs are excluded. The
per-file identity manifest is `array-oracle-storage-identity.json`. Copy these
completed evidence files before modifying them. Final original-runtime controls
are recorded in `array-dispatch-final-controls.log`.

## Retained isolated array-entry inlining

The runtime change is only @inline on the shared serializeArray entry. Original
helper signatures, length loads, empty handling, conversions, output allocation
and callback behavior remain. The compiler can merge redundant GC frame setup
into the caller. The representative integer-array namespace writer changes from
three frame setups to two; named inspection and frozen measurement Wasm have
identical code sections. No corpus, schema, decimal-width or fixture-value
selector is added. This shared implementation also reaches NAIVE and SWAR;
only SIMD gates native parity.

Six balanced rounds compare `arrv-mini-0001` with an exact-original CITM baseline
(`arrv-base-0001`) and verified equivalent frozen baselines (`disp-full-0001`)
for the other layouts. Four inputs change string values and lengths. Input,
schema, native-binary, dependency and toolchain checks match. Full owned results
and eight retained objects/strings remain. Builds, tests and code inspection
finish before timing; complete oracle processing follows timing.

SIMD stringification throughput ratios, candidate / baseline:

| Layout | V8 | Default unchecked w2c2 |
| --- | ---: | ---: |
| CITM minified | 1.056× | 1.040× |
| Canada minified | 1.020× | 1.022× |
| CITM pretty | 1.029× | 1.091× |
| Twitter minified | 1.029× | 1.014× |
| GitHub events minified | 0.999× | 1.009× |
| GSOC minified | 0.959× | 1.007× |
| Poet minified | 0.992× | 1.037× |
| Lottie minified | 1.009× | 1.006× |

A separate six-round GSOC confirmation gives 0.996× on V8 and 1.002× on
default w2c2. Both runs are retained; the initial V8 slowdown is not reproduced.
Small ratios around one should not be interpreted as established wins on every
layout. Checked w2c2 is additionally measured on the two initial canaries:
1.060× CITM and 1.017× Canada stringification. Broader checked-w2c2 performance
is not qualified. Other phases and SWAR results remain in the raw tables.

The source passes 123,345 normal and 77,676 strict/RFC checks across all three
modes, including callback mutation, polymorphism, retained output and GC
controls. Typecheck, lint, formatting and diff checks pass. Every accepted
label/backend passes forty complete output/retention comparisons. All eight
frozen runtime patches and xjb dependency hashes match the retained source and
its original baselines. The two canary SIMD Wasm files shrink by 150 and 120
bytes respectively.

The preceding array-dispatch comparisons demonstrate why the hint
is isolated from helper refactoring. Inlining alone avoids their repeated
Canada V8 regressions. The current 24-row screen has four V8 or seven default-
w2c2 rows within the native budget, unchanged in count; no qualifying row is
lost. Other classic layouts still require exact-runtime qualification, and the
full 48-row goal remains incomplete.

Poet's first attempt completes timing but runs out of disk during oracle copying.
It remains unqualified in `comparisons/array-minimal-poet-min/`; its samples are
not substituted for the accepted six-round retry. Oracle storage is fixed
separately: APFS clones have independent writable inodes, portable ordinary-copy
fallback, atomic destination replacement and a pinned helper hash. Six storage
tests pass, including an ENOSPC partial-write regression that fails with the
old direct copy2 behavior. Scheduler and goal-policy tests also pass. The
fresh Poet retry and Lottie comparison pass the complete oracles through the
new copier. This changes post-timing storage, not timed parser work.

Artifacts under `build/simdjson-parity/`:
`comparisons/array-minimal-{citm_catalog-min,canada-min,citm_catalog-pretty,twitter-min,github_events-min,gsoc-2018-min,poet-retry,lottie-min,gsoc-confirm}/`,
`array-minimal-codegen/identity.json`, `array-minimal-source-identity.json`,
`array-minimal-summary.json`, `array-minimal-{full-tests,rfc-tests,check}.log`,
`oracle-storage-{atomic-red,green}.log`, and
`array-oracle-cow-storage-identity.json`. The latter records byte-preserving
storage consolidation, with independent copy-on-write clones for mutable
producer files and hardlinks restricted to completed immutable evidence.

## Retained size-adaptive direct owned output

Top-level non-primitive stringification now learns one result through the
established unmanaged builder. Outputs of at least 8 MiB then serialize into a
rooted managed string and return that allocation, removing the final
whole-document copy. Activation depends only on the preceding output byte size;
there are no corpus, schema, field, or value signatures. Ordinary outputs keep
the established builder. Large downward size changes copy into an exact result
so a small string cannot retain a large physical allocation. Nested and custom
serialization continue to use the existing save/restore stack.

This change also fixes a large-output correctness failure. Frozen OTFCC baseline
Wasm completes parse, reaches serialization at 50,512 pages, grows by 2,091
pages per owned output after its first two reusable holes, and corrupts static
data on the tenth transient result near the Wasm32 limit. Checked w2c2 reports
an out-of-bounds table access; exact frozen Wasm reports the same table failure
in V8. The callback table words change from 1/2/3 to UTF-16 output bytes. The
failure is therefore in shared Wasm memory behavior, not w2c2 translation.

The final candidate stabilizes instead of wrapping. Six balanced default-w2c2
rounds use four independently allocated, changing input strings, 100 operations
per phase, eight retained object graphs, eight retained strings, and all full
fields. All twenty complete owned-output comparisons pass.

| OTFCC minified phase | Native ns/op | SIMD ns/op | SIMD/native latency |
| --- | ---: | ---: | ---: |
| Parse owned | 90,105,320 | 92,309,830 | 1.024× |
| Serialize owned | 2,948,160 | 2,658,700 | 0.902× |
| Validate | 53,689,790 | 89,410,215 | 1.665× |

Parse and serialization meet the 1.2× native-latency target; validation remains
the only OTFCC gap. A six-round V8 CITM control remains on the ordinary builder
and is approximately neutral: candidate/baseline throughput is 0.994× parse,
0.988× serialize, and 0.993× validate. An earlier unconditional prototype is
rejected: cumulative worst-case reservations made Canada serialization 0.541×
baseline throughput, and direct ownership perturbed CITM parse to 0.943×. Cursor-
local reservations remove the Canada serialization regression; size-adaptive
activation removes the smaller-workload parse tradeoff.

The retained source passes 123,360 normal and 77,676 strict/RFC checks across
NAIVE, SWAR, and SIMD, including a >8 MiB ownership/size-swing regression,
dynamic raw-slice passthrough, custom/nested serialization, GC stress, retained
prior outputs, and `JSON.Memory.shrink`. Typecheck, lint, formatting and diff
checks pass. SIMD alone gates native parity; the implementation is shared with
the other modes.

Artifacts under `build/simdjson-parity/`:
`comparisons/owned-otfcc-direct-final001/`,
`comparisons/direct-owned-citm-v8-0005/`,
`owned-otfcc-direct-final001.log`, the frozen
`runs/direct-owned-final001/` build, and the rejected/intermediate
`direct-owned-{canada,citm}-v8*.log` comparisons.

## Retained generated-primitive dispatch inlining

Generated serializers reserve their complete fixed primitive capacity before
writing fields. Their integer and boolean fields nevertheless passed through a
small generic `JSON.__serializePrimitiveUnsafe` call before reaching the
reservation-free writer. Marking only this shared dispatcher `@inline` lets the
compiler fold its compile-time type branch and call the existing writer
directly. The formatting algorithms, capacity rules, field generation, GC
roots and public dispatch remain unchanged. There are no corpus, schema,
numeric-width or runtime selectors.

Fresh post-relocation controls and candidates use equal-length labels, four
changing input strings and six balanced process pairs. Every completed
comparison passes twenty full owned-output and retention checks. SIMD
stringification throughput ratios, candidate / baseline:

| Layout | V8 | Default w2c2 |
| --- | ---: | ---: |
| Canada minified | 1.004× | 0.991× |
| CITM minified | 1.009× | 1.024× |
| Twitter minified | 1.013× | 1.069× |
| GitHub events minified | 0.995× | 0.995× |
| Poet minified | 1.002× | — |
| GSOC minified | 0.998× | — |
| Lottie minified | 1.060× | 1.083× |

The initial default-w2c2 Twitter control moved parsing to 0.963× despite an
unchanged parser. A separate six-round confirmation gives 0.992× parsing,
1.043× stringification and 0.995× validation, so the larger control movement is
not treated as a parser regression. Other phase controls remain in the result
tables. This hint is a small broad improvement rather than a new parity row;
the larger serializer gaps still require an algorithmic change.

The retained source passes 123,360 normal and 77,676 strict/RFC checks across
NAIVE, SWAR and SIMD. A focused four-file run additionally passes 1,464 integer,
array, generated-dispatch and round-trip checks. Typecheck, lint and diff checks
pass before commit. SIMD remains the native-performance gate; the shared hint
also reaches NAIVE and SWAR.

Artifacts under `build/simdjson-parity/`:
`runs/prim-{base000001,inline0001}/` and
`comparisons/prim-inline-*/`. Rejected whole-generated-serializer and 64-bit
formatter-inline prototypes were removed after paired V8 and default-w2c2
measurements showed only small wins or regressions.

## Retained reservation-free generated float fields

Generated object serializers already reserve their complete estimated output
capacity before emitting fields. Extend their existing reservation-free
integer/boolean path to non-nullable `f32` and `f64` fields, avoiding a repeated
128-byte capacity check and stack-size update per float. Float conversion,
special-value handling and output bytes are unchanged; there is no corpus,
schema or value-shape selector.

Six balanced process pairs compare exact-current frozen baseline and candidate
Wasm in V8 and default w2c2. Each completed backend/variant passes twenty full
owned-output comparisons. Candidate/baseline SIMD stringify throughput:

| Layout | V8 | Default w2c2 |
| --- | ---: | ---: |
| Lottie minified | 1.023× | 1.026× |
| Twitter minified | 1.001× | 1.009× |
| GSOC minified | 1.000× | 1.000× |
| Canada minified | 1.000× | 0.993× |
| CITM minified | 0.995× | 0.996× |

No measured phase regresses by 5%; the largest unrelated phase movement is
2.2%. This is a small float-heavy win rather than a new native-parity row.
The retained source passes all 123,360 normal and 77,676 strict/RFC checks
across NAIVE, SWAR and SIMD. Formatting, typecheck, lint and diff checks pass.

Artifacts under `build/simdjson-parity/`:
`runs/float{base00001,unsafe001}/` and
`comparisons/floatunsafe-{lottie,canada,citm-catalog,twitter,gsoc-2018}-*-001/`.

## Retained generated local output cursor

Generated object serializers now keep their output cursor in a local across
fixed key stores and primitive values, then commit it at allocation-capable or
reentrant boundaries. Cursor-returning boolean, integer and float writers make
that region explicit. Strings, arrays, nested objects, lazy values and custom
serializers still receive `bs.offset` before the call and reload the local after
it, preserving relocation, GC and callback behavior. This applies to every
generated object; it has no corpus, schema-signature or value selector.

Six balanced process pairs compare equal-length, exact-current frozen labels
with four changing inputs. All twenty complete owned-output comparisons pass
for each variant/backend. SIMD stringify throughput, candidate / `5b1cf18`:

| Layout | V8 | Default w2c2 |
| --- | ---: | ---: |
| CITM minified | 1.027× | 1.014× |
| Lottie minified | 1.004× | 1.202× |
| Canada minified | 1.003× | 1.011× |
| Twitter minified | 0.995× | 1.159× |

No phase crosses the 5% regression guard. Canada's otherwise unchanged V8
validation moves to 0.967× in the final direct screen; default w2c2 validation
is 1.005× and a prior eight-pair confirmation placed the first cursor variant
at 0.954×/1.011×. Treat this as V8 code-layout sensitivity, not a validation
gain or loss, and keep it visible in later whole-matrix qualification.

The final source passes 123,360 normal and 77,676 strict/RFC checks across
NAIVE, SWAR and SIMD. Typecheck, lint, formatting and diff checks pass. The
first non-inlined cursor adapters are rejected in favor of the final tiny
inlined adapters; direct candidate-to-candidate screens show an additional
1.032× default-w2c2 CITM and 1.040× Lottie stringify improvement.

Artifacts under `build/simdjson-parity/`:
`runs/{floatunsafe001,localcursor001,localcursor002}/` and
`comparisons/localcursor-{final,inline}-*/`.

## Retained specialized object-element inlining

A fresh post-local-cursor V8 profile extends only CITM stringification to
10,000 operations. Of 2,131 Wasm self samples, generated object-element writers
account for 742 (Area 370, SeatCategory 264, Price 55, Performance 53), ahead of
integer-array dispatch at 292 and integer formatting at 358 combined. Named
Wasm shows the generated serializer already folded into the element writer,
but the specialized array loop still calls that writer through a separate
managed frame.

Marking the shared element writer inline fuses it into each statically typed
array loop while preserving its nullable, string, primitive, custom,
polymorphic and fallback branches. The type tests fold at compile time. There
is no corpus, schema, field or value selector. Final SIMD binaries are unchanged
to 0.07% smaller across the seven measured families, rather than gaining speed
through code growth.

Six balanced process pairs compare exact-current frozen labels in V8 and
default w2c2; Canada additionally has an eight-pair confirmation. Every
variant/backend passes twenty complete owned-output comparisons. SIMD
stringify throughput, candidate / `d966699`:

| Layout | V8 | Default w2c2 |
| --- | ---: | ---: |
| CITM minified | 1.039× | 1.089× |
| Canada minified, confirmation | 1.011× | 1.014× |
| Twitter minified | 0.999× | 1.001× |
| GitHub events minified | 1.013× | 1.042× |
| Poet minified | 1.008× | 0.991× |
| GSOC minified | 1.003× | 1.003× |
| Lottie minified | 0.996× | 0.994× |

An initial six-pair Canada run reports 0.902× default-w2c2 stringification;
the independent eight-pair confirmation reports 1.014× with all other rows
inside 1.2%, so the first movement is retained as a timing outlier rather than
used to introduce a Canada-specific exception. No accepted broad-screen row
regresses by 1%.

The retained source passes 123,360 normal and 77,676 strict/RFC checks across
NAIVE, SWAR and SIMD. The focused array/custom/reentrancy suite passes 4,605
checks across all modes. Formatting, typecheck, lint and diff checks pass.

Artifacts under `build/simdjson-parity/`:
`postcursor-serialize-profile/`, `runs/{elembase000001,eleminline0001}/`, and
`comparisons/eleminline-*/`.

## Retained direct generated array dispatch

A fresh post-element-inlining CITM profile attributes 265 of 1,972 Wasm self
samples to the generic `JSON.__serialize<Array<i64>>` entry. Generated code
already knows the exact field type, so non-nullable `Array<T>` fields now call a
small inline array entry directly. This bypasses only the generic reference
dispatcher; the established array and element writers still implement null,
custom, polymorphic and fallback behavior. Nullable arrays remain on the
generic entry so their null semantics are unchanged. The transform rule applies
to every non-nullable array field and has no corpus, schema or value selector.

Six balanced process pairs compare equal-length frozen labels in V8 and default
w2c2. Every variant/backend passes twenty complete owned-output comparisons.
SIMD stringify throughput, candidate / `382c81c`:

| Layout | V8 | Default w2c2 |
| --- | ---: | ---: |
| CITM minified | 1.012× | 1.032× |
| Canada minified | 1.012× | 0.996× |
| Twitter minified | 0.978× | 1.024× |
| GitHub events minified | 1.039× | 0.988× |
| Poet minified | 1.019× | 0.994× |
| GSOC minified | 0.999× | 1.048× |
| Lottie minified | 1.019× | 1.004× |

No measured parse, stringify or validation row crosses the 5% regression
guard. A focused array/custom/nullable suite passes 4,749 checks across all
three modes; the nullable coverage caught and rejected an initial rule that was
too broad before qualification. The retained source passes all 123,369 normal
and 77,676 strict/RFC checks across NAIVE, SWAR and SIMD. Transform tests,
typecheck, lint, formatting and diff checks pass.

Artifacts under `build/simdjson-parity/`:
`postelem-serialize-profile/`, `runs/{eleminline0001,arraydirect001}/`, and
`comparisons/arraydirect-*-002/` (plus the independent CITM comparison).

## Retained direct generated string dispatch

Generated serializers now route concrete `string`, `String` and their nullable
forms through a small inline string entry. The entry preserves the established
`null` word and delegates non-null values to the same string kernel; it only
removes the generic primitive/custom/reference/container type cascade. This
rule applies to every generated string field and does not inspect its schema,
value, length or source corpus.

Six balanced process pairs compare equal-length frozen labels in V8 and default
w2c2. Twitter and GitHub events additionally use independent eight-pair
confirmations because their default-w2c2 gains are unusually large. Every
variant/backend passes twenty complete owned-output comparisons. SIMD stringify
throughput, candidate / `823eef1`:

| Layout | V8 | Default w2c2 |
| --- | ---: | ---: |
| CITM minified | 1.011× | 1.048× |
| Canada minified | 1.005× | 1.012× |
| Twitter minified, confirmation | 1.053× | 1.415× |
| GitHub events minified, confirmation | 1.086× | 1.443× |
| Poet minified | 0.990× | 1.027× |
| GSOC minified | 0.991× | 1.004× |
| Lottie minified | 1.000× | 0.993× |

No measured phase crosses the 5% regression guard. The focused string,
nullable, custom and struct suite passes 5,490 checks across all three modes.
The retained source passes 123,360 normal and 77,676 strict/RFC checks across
NAIVE, SWAR and SIMD. Transform tests, typecheck, lint, formatting and diff
checks pass.

A separate integer-array pointer/end loop is rejected. Replacing the optimized
indexed address with an explicit advancing source pointer moves CITM SIMD
stringify throughput to 0.994× V8 and 0.981× default w2c2. Exact outputs pass,
so this is a measured code-generation loss rather than a correctness failure.

Artifacts under `build/simdjson-parity/`:
`postarray-serialize-profile/`, `runs/{arraydirect001,stringdirect01,arrayptr000001}/`,
and `comparisons/{stringdirect-*,integerptr-citm-001}/`.

## Retained direct generated object dispatch

Generated serializers now route non-nullable, transform-known concrete object
fields through a small inline object entry instead of the complete generic
reference dispatcher. The entry preserves runtime custom serializers for
subclass instances, then calls the existing generated virtual serializer.
Nullable, generic and transform-known custom fields keep the established path.
The rule applies to every qualifying generated field and does not inspect
corpus, key set, value shape or object identity.

Six balanced process pairs compare the exact preceding commit in V8 and
default w2c2. Every variant/backend passes twenty complete owned-output and
retention comparisons. SIMD stringify throughput, candidate / `95c3cda`:

| Layout | V8 | Default w2c2 |
| --- | ---: | ---: |
| CITM minified | 0.995× | 0.991× |
| Canada minified | 0.999× | 1.001× |
| Twitter minified | 1.015× | 1.000× |
| GitHub events minified | 1.006× | 1.066× |
| Poet minified | 1.011× | 1.015× |
| GSOC minified | 1.003× | 0.977× |
| Lottie minified | 0.994× | 0.987× |

No measured parse, stringify or validation row crosses the 5% regression
guard. Focused hierarchy, custom, nullable, production-safety, fast-path and
struct coverage passes 4,845 checks across all three modes. Complete suite
results are recorded with the retained commit.

Artifacts under `build/simdjson-parity/`:
`runs/objectdirect01/` and `comparisons/objectdirect-*/`.

## Retained two-vector clean SIMD string loop

The post-object-dispatch GitHub-events red loop reproduces the remaining
parity gap in 0.57 seconds: SIMD owned stringification takes 21.30 us versus
3.79 us for native simdjson, while all forty complete output and retention
comparisons pass. An isolated serialization-only V8 profile attributes 158 of
239 Wasm self samples to the shared string serializer. The input contains 752
strings averaging 50 UTF-16 units; only five require JSON escaping.

The optimistic SIMD serializer now checks and copies two adjacent 16-byte
blocks per loop branch. Both blocks use the established quote, backslash,
control and Unicode candidate predicates. A candidate in either block exits to
the unchanged one-vector and exceptional paths. The rule applies to every
SIMD string and does not inspect corpus, schema, field, length or content
signatures.

Six balanced pairs compare equal-length frozen labels. Every variant/backend
passes twenty complete owned-output and retention comparisons. SIMD stringify
throughput, candidate / `7be2cb5`:

| Layout | V8 | Default w2c2 |
| --- | ---: | ---: |
| GitHub events minified | 1.030x | 1.024x |
| GSOC minified | 1.081x | 1.025x |
| Lottie minified | 0.977x | 1.016x |
| Poet minified | 0.991x | 0.997x |
| Twitter minified | 1.002x | - |
| CITM minified | 0.997x | - |
| Canada minified | 0.992x | - |

No measured parse, stringify or validation row crosses the 5% regression
guard. Focused string, escape, fuzz, tail and exhaustive surrogate-boundary
coverage passes 53,737 checks across NAIVE, SWAR and SIMD. The GitHub row is
still far outside the native +20% latency target; this is a retained local
improvement, not a parity claim. The complete source passes all 123,360 normal
and 77,676 strict/RFC checks across all three modes; transform regressions,
typecheck, lint and diff checks also pass.

Artifacts under `build/simdjson-parity/`:
`github-profile-{v8.log,self.json}`, `runs/{githubprof001,stringunroll01}/`, and
`comparisons/stringunroll-*/`.

## Retained two-vector checked SIMD input scan

The shared checked UTF-16 scanner now checks two adjacent 16-byte blocks per
loop branch. Both blocks use the existing full-lane quote, backslash and
control predicates. The first event exits to the unchanged one-vector and
escape/tail handling. This applies uniformly to validation, generated typed
parsing, dynamic parsing, keys and checked raw/lazy traversal; it does not
select a corpus, schema, field, string length or content signature.

Five balanced process pairs compare equal-length frozen labels in V8 and
default w2c2. Every variant/backend passes twenty complete owned-output and
retention comparisons. Candidate / `baa109c` SIMD throughput:

| Layout and phase | V8 | Default w2c2 |
| --- | ---: | ---: |
| GSOC parse-owned | 1.073× | 1.050× |
| GSOC validate | 1.097× | 1.110× |
| GitHub events parse-owned | 0.965× | 1.055× |
| GitHub events validate | 1.050× | 1.020× |
| Lottie parse-owned | 0.995× | 0.993× |
| Lottie validate | 1.015× | 0.974× |
| Canada parse-owned | 0.992× | 0.999× |
| Canada validate | 1.044× | 0.974× |

No measured parse, stringify or validation row crosses the 5% regression
guard. The complete retained source passes all 123,360 normal and 77,676
strict/RFC checks across NAIVE, SWAR and SIMD; transform regressions,
typecheck, lint and diff checks also pass.

Artifacts under `build/simdjson-parity/`:
`runs/{stringunroll01,inputunroll001}/` and
`comparisons/inputunroll{gh,gw,lt,lw,gs,gsw,ca}*/`.

## Retained combined clean-input SIMD event branch

The two-vector checked input loop now combines both event vectors and performs
one clean-pair test. When either vector contains a quote, backslash or control
code unit, the unchanged one-vector loop identifies the first exact event.
Clean 32-byte pairs avoid two bitmask reductions and the branch between blocks.
This only changes shared scanner control flow and introduces no corpus, schema,
field, length or content selector.

Five balanced process pairs compare equal-length frozen labels in V8 and
default w2c2. Every variant/backend passes twenty complete owned-output and
retention comparisons. Candidate / `5bd7432` SIMD throughput:

| Layout and phase | V8 | Default w2c2 |
| --- | ---: | ---: |
| GSOC parse-owned | 1.140× | 1.016× |
| GSOC validate | 1.426× | 1.002× |
| GitHub events parse-owned | 1.065× | 0.989× |
| GitHub events validate | 1.148× | 0.994× |
| Lottie parse-owned | 0.986× | 1.006× |
| Lottie validate | 0.983× | 1.032× |
| Canada parse-owned | 0.995× | 0.994× |
| Canada validate | 1.012× | 0.995× |

No measured parse, stringify or validation row crosses the 5% regression
guard. The exact retained source passes all 123,360 normal and 77,676
strict/RFC checks across NAIVE, SWAR and SIMD; transform regressions,
typecheck, lint and diff checks also pass.

Artifacts under `build/simdjson-parity/`:
`runs/{inputunroll001,inputanytrue01}/` and
`comparisons/inputany{gh,ghw,gs,lt,ca}*/`.

## Retained inline buffer-reservation fast check

The shared buffer now inlines its ordinary `requiredSize <= bufferSize` check
and keeps growth plus relocation outlined. This removes a managed Wasm call
when capacity already suffices and applies to every serializer, mode, output
representation and value type. It introduces no corpus, schema, field, length
or content selector.

Five balanced process pairs compare equal-length frozen labels in V8 and
default w2c2. Every variant/backend passes twenty complete owned-output and
retention comparisons. Candidate / `26b20ff` SIMD stringify throughput:

| Layout | V8 | Default w2c2 |
| --- | ---: | ---: |
| GitHub events minified | 1.059× | 1.010× |
| GSOC minified | 1.017× | 1.011× |
| Lottie minified | 1.000× | 1.006× |
| Canada minified | 1.004× | 0.996× |

No measured parse, stringify or validation row crosses the 5% regression
guard. The exact retained source passes all 123,360 normal and 77,676
strict/RFC checks across NAIVE, SWAR and SIMD; transform regressions,
typecheck, lint and diff checks also pass.

Artifacts under `build/simdjson-parity/`:
`runs/{inputanytrue01,resinline00001}/` and
`comparisons/resinline{gh,gs,lt,ca}*/`.

## Retained inline output-size proposal path

The post-reservation GitHub serialization-only profile runs 100,000 changing
owned outputs on the exact retained source. Of 911 Wasm self samples, 571 are
in shared string serialization and 23 remain in the outlined
`bs.proposeSize` helper. The proposal path now inlines its stack-size update and
the already-inlined capacity check; actual growth and relocation stay outlined.
This applies to every serializer, mode, output representation and value type.

Five balanced process pairs compare equal-length frozen labels in V8 and
default w2c2. Every variant/backend passes twenty complete owned-output and
retention comparisons. Candidate / `7321b76` SIMD stringify throughput:

| Layout | V8 | Default w2c2 |
| --- | ---: | ---: |
| GitHub events minified | 1.015× | 1.045× |
| GSOC minified | 1.009× | 1.072× |
| Lottie minified | 1.009× | 1.000× |
| Canada minified | 1.009× | 1.016× |

No measured parse, stringify or validation row crosses the 5% regression
guard. The exact retained source passes all 123,360 normal and 77,676
strict/RFC checks across NAIVE, SWAR and SIMD; transform regressions,
typecheck, lint and diff checks also pass.

Artifacts under `build/simdjson-parity/`:
`github-serialize-{v8-003.log,self-003.json}`,
`runs/{githubprof003,resinline00001,propinline0001}/`, and
`comparisons/propinline{gh,gs,lt,ca}*/`.

## Retained scalar entry for checked SIMD keys

OTFCC token census shows 5,863,445 object keys in its 66,408,808-byte minified
input; 3,311,936 of all strings contain at most one payload byte. The checked
SIMD key scanner now tests its first two UTF-16 code units directly before
paying for the wider event mask. Longer, escaped and invalid keys retain the
same full-lane and checked handling. The rule is shared by every checked
discard traversal and does not select a corpus, schema or field.

Five balanced process pairs compare equal-length frozen labels across all 16
classic validation layouts. All RFC preflight checks and 64 changing-input
oracles pass. Candidate / `d2b1ed2` SIMD validation throughput:

| Layout | V8 | Checked w2c2 | Default w2c2 |
| --- | ---: | ---: | ---: |
| OTFCC minified | 1.021× | 1.040× | 1.117× |
| FGO minified | 1.024× | 1.028× | 1.023× |
| GSOC minified | 1.031× | 1.039× | 1.047× |
| GSOC pretty | 1.032× | 0.996× | 1.042× |
| Poet minified | 1.098× | 1.126× | 1.097× |
| Poet pretty | 1.072× | 1.106× | 1.083× |
| GitHub events minified | 1.013× | 1.008× | 1.020× |
| GitHub events pretty | 1.011× | 1.018× | 1.020× |

No row exceeds the 5% regression guard. The largest default-w2c2 tradeoff is
Canada minified at 0.961×; Canada remains faster than native. CITM is
0.971–0.974× on that backend. OTFCC default-w2c2 validation falls from
57.1924 ms to 51.1905 ms against native's 49.0101 ms, changing its latency
ratio from 1.167× to 1.045× and meeting the 1.2× target. Checked w2c2 improves
65.1269 ms to 62.6297 ms but remains at 1.237× native latency; V8 remains a
larger gap at 1.957× despite its 2.1% gain.

The exact retained source passes all 123,360 normal and 77,676 strict/RFC
checks across NAIVE, SWAR and SIMD; transform regressions, typecheck, lint and
diff checks also pass.

Artifacts under `build/simdjson-parity/`:
`runs/{keybase0000001,keyscalar00001,currentd2b1ed2}/` and
`comparisons/keyscalar-validation-{v8,w2c2,w2c2-checked}/`.

## Retained four-unit checked SIMD key entry

Classic key-length census shows this is not an OTFCC-only opportunity: Lottie
keys average 1.5 UTF-16 units, Poet 3.3, GitHub events 6.9, GSOC 7.0 and FGO
7.5. The checked SIMD key scanner now performs four direct UTF-16 event checks
before its wider mask. Longer, escaped, invalid and bounded-tail cases keep the
existing scanner and grammar behavior.

Five balanced process pairs compare frozen `keyscalar00001` and
`keyscalar40001` labels across all 16 validation layouts. All RFC preflight
checks and 64 changing-input oracles pass. Candidate / `7f382b3` SIMD
validation throughput:

| Layout | V8 | Checked w2c2 | Default w2c2 |
| --- | ---: | ---: | ---: |
| Canada minified | 1.024× | 0.987× | 1.009× |
| Canada pretty | 1.026× | 0.998× | 1.009× |
| Twitter minified | 0.982× | 0.978× | 1.034× |
| Twitter pretty | 0.993× | 0.974× | 1.030× |
| CITM minified | 1.070× | 1.038× | 1.110× |
| CITM pretty | 1.063× | 0.992× | 1.088× |
| GitHub events minified | 1.014× | 1.028× | 1.081× |
| GitHub events pretty | 0.994× | 0.994× | 1.077× |
| Poet minified | 0.992× | 1.050× | 1.062× |
| Poet pretty | 0.988× | 1.004× | 1.061× |
| GSOC minified | 1.003× | 1.014× | 1.035× |
| GSOC pretty | 0.998× | 1.000× | 1.013× |
| Lottie minified | 1.041× | 1.040× | 1.078× |
| Lottie pretty | 1.015× | 1.007× | 1.041× |
| OTFCC minified | 1.011× | 1.017× | 1.037× |
| FGO minified | 1.016× | 1.040× | 1.082× |

No row exceeds the 5% regression guard. On default w2c2, OTFCC falls from
50.7788 ms to 48.9786 ms against native's 48.9453 ms, reaching 0.999× native
latency. The improvement is additive to the preceding two-unit entry change.

The exact retained source passes all 123,360 normal and 77,676 strict/RFC
checks across NAIVE, SWAR and SIMD; transform regressions, typecheck, lint and
diff checks also pass.

Artifacts under `build/simdjson-parity/`:
`runs/{keyscalar00001,keyscalar40001}/` and
`comparisons/keyscalar4-validation-{v8,w2c2,w2c2-checked}/`.

## Retained pointer entry for generated array fields

Generated serializers already keep their containing object rooted. Passing a
non-nullable `Array<T>` field as another managed argument therefore creates a
redundant shadow-stack frame. The transform now loads the field pointer and
calls a small pointer entry that reuses the established array serializer. This
applies to every generated primitive, string, nested and object array field;
nullable arrays retain the generic null-aware path. There is no corpus, schema,
field-name, value or length selector.

Six balanced process pairs compare equal-length frozen `strptr00000001` /
`ptrtest0000001` baselines with `arrptr00000001`. Every variant/backend passes
twenty complete owned-output and retention comparisons. Candidate / baseline
SIMD stringify throughput:

| Layout | V8 | Default w2c2 |
| --- | ---: | ---: |
| Canada minified | 0.996x | 1.002x |
| Canada pretty | 1.008x | 1.015x |
| Twitter minified | 1.006x | 1.015x |
| Twitter pretty | 1.009x | 1.004x |
| CITM minified | 1.023x | 1.009x |
| CITM pretty | 1.001x | 1.029x |
| GitHub events minified | 0.993x | 0.999x |
| GitHub events pretty | 1.007x | 1.000x |
| Poet minified | 0.995x | 1.020x |
| Poet pretty | 1.000x | 1.003x |
| GSOC minified | 0.980x | 1.018x |
| GSOC pretty | 1.015x | 1.007x |
| Lottie minified | 1.012x | 1.005x |
| Lottie pretty | 1.003x | 1.024x |
| OTFCC minified | 0.970x | 1.036x |
| FGO minified | 0.988x | 0.997x |

The initial six-pair Lottie-pretty default-w2c2 result regressed stringify by
9.8%, while V8 was flat and minified Lottie improved. An independent twelve-pair
confirmation reports 1.024x default-w2c2 and 1.003x V8 stringify throughput;
all other rows are within 1.0%. Twitter pretty also received a twelve-pair
confirmation and reports 1.004x/1.009x. These confirmations replace the initial
outliers rather than introducing input-specific handling.

The two huge corpora were run one backend at a time with full retained-output
oracles. OTFCC improves 1.036x on default w2c2 and trades 3.0% on V8. FGO has no
generated class and serves as an inactive control. Checked-w2c2 six-pair controls
report 1.007x CITM-minified stringify and 0.980x Lottie-pretty stringify; no
checked parse, stringify or validation row crosses the 5% regression guard.

A dedicated regression forces collection and output growth while generated
string and object arrays are reachable only through their owner. The focused
array suite passes 813 checks across all three modes. The exact retained source
passes 123,369 normal and 77,676 strict/RFC checks across NAIVE, SWAR and SIMD;
transform regressions, typecheck, lint and diff checks also pass.

Artifacts under `build/simdjson-parity/`: `runs/arrptr00000001/`,
`comparisons/arrptr-*`, and the independent
`arrptr-{lottie,twitter}-pretty-confirm` comparisons.

## Pointer-only generated wide-integer array kernels

The generated array-field pointer entry now sends `i16[]`/`u16[]` and wider
integer arrays directly to the specialized integer writer. That writer reads
Array layout through `offsetof<T>("length_")` and
`offsetof<T>("dataStart")`, avoiding a managed conversion and its shadow-stack
frame. The generated containing object is already rooted for the entire call.
One-byte LUT arrays and other element types retain their existing paths. This
is selected only by the compile-time element type; there is no corpus, schema,
field-name, value or length recognition.

Six balanced process pairs compare equal-length frozen `arrptr00000001` and
`intptr00000001` artifacts on V8 and default w2c2. Every backend/variant passes
twenty complete retained-output comparisons per layout, including OTFCC and
FGO. Candidate / baseline SIMD stringify throughput:

| Layout | V8 | Default w2c2 |
| --- | ---: | ---: |
| Canada minified | 0.993x | 1.002x |
| Canada pretty | 1.012x | 1.009x |
| Twitter minified | 1.000x | 1.028x |
| Twitter pretty | 1.008x | 1.005x |
| CITM minified | 1.082x | 1.237x |
| CITM pretty | 1.079x | 1.213x |
| GitHub events minified | 1.006x | 0.999x |
| GitHub events pretty | 1.015x | 0.988x |
| Poet minified | 0.995x | 1.019x |
| Poet pretty | 1.003x | 0.998x |
| GSOC minified | 1.007x | 1.034x |
| GSOC pretty | 1.017x | 1.006x |
| Lottie minified | 1.039x | 1.025x |
| Lottie pretty | 1.000x | 1.005x |
| OTFCC minified | 1.011x | 0.961x |
| FGO minified | 1.054x | 1.000x |

No parse, stringify or validation row exceeds the 5% regression guard. The
largest intended win is CITM: 1.082x/1.237x minified and 1.079x/1.213x pretty.
The profiling driver falls from 224.80 to 182.87 us/op in V8. Checked-w2c2
controls report 1.162x CITM-minified stringify and 0.999x Lottie-pretty
stringify. OTFCC and zero-schema FGO do not use the new generated kernel; their
movement is retained as inactive-control noise rather than credited to it.

A forced-collection regression grows the output while a 2,048-element `i64[]`
is reachable only through its generated owner. The focused suite passes 816
checks across all modes. The exact commit passes 123,372 normal and 77,676
strict/RFC checks across NAIVE, SWAR and SIMD; transform regressions, typecheck,
lint, benchmark-tooling tests and diff checks also pass.

Artifacts under `build/simdjson-parity/`: `runs/intptr00000001/`,
`comparisons/intptr-*`, and the profile-only
`runs/{arrprof0000001,intarrptr0000001,rawintarr0000001}/` artifacts.

## Pointer-only generated object-array loops

Generated non-string reference arrays now stay raw through the shared array
loop, and generated object elements dispatch from their raw pointer. The
containing generated object remains rooted for the complete call. Nulls, custom
serializers and generic fallbacks keep their prior behavior, and `dataStart` is
reloaded after callbacks. This removes redundant array/element shadow-stack
spills based only on the compile-time element category; no corpus, schema,
field-name, value or length recognition is present.

Six balanced process pairs compare equal-length `intptr00000001` and
`objptr00000001` artifacts on V8 and default w2c2. Every backend/variant passes
twenty complete retained-output comparisons per layout. An initial inactive
FGO V8 sample barely failed the 5% guard, but an independent 12-pair
confirmation reverses it to 1.025x stringify throughput with all phases green.
The initial CITM-pretty w2c sample was also noisy; its independent 12-pair
confirmation reports 1.056x. Confirmed candidate / baseline SIMD stringify:

| Layout | V8 | Default w2c2 |
| --- | ---: | ---: |
| Canada minified | 0.982x | 0.991x |
| Canada pretty | 0.988x | 1.012x |
| Twitter minified | 1.003x | 1.075x |
| Twitter pretty | 1.022x | 1.018x |
| CITM minified | 1.049x | 1.050x |
| CITM pretty | 1.027x | 1.056x |
| GitHub events minified | 1.017x | 1.000x |
| GitHub events pretty | 1.002x | 0.992x |
| Poet minified | 1.003x | 0.993x |
| Poet pretty | 1.010x | 0.989x |
| GSOC minified | 1.003x | 0.992x |
| GSOC pretty | 1.007x | 1.020x |
| Lottie minified | 1.001x | 1.016x |
| Lottie pretty | 0.991x | 1.009x |
| OTFCC minified | 0.991x | 1.020x |
| FGO minified | 1.025x | 1.010x |

The focused CITM profile falls from 184.54 to 174.66 us/op in V8. Checked-w2c2
controls report 1.072x CITM-minified stringify and 1.003x Lottie-pretty
stringify. No retained comparison has a confirmed phase beyond the 5%
regression guard.

The focused array/custom-codec suites pass 990 checks across all modes. The
exact commit passes 123,372 normal and 77,676 strict/RFC checks across NAIVE,
SWAR and SIMD; transform regressions, typecheck, lint, benchmark-tooling tests
and diff checks also pass.

Artifacts under `build/simdjson-parity/`: `runs/objptr00000001/`,
`comparisons/objptr-*`, and profile-only
`runs/{objarr00000001,objraw00000001}/` artifacts.

## Direct insertion-order Map serialization

The shared Map serializer now walks AssemblyScript's insertion-order entry
buffer directly instead of allocating complete `keys()` and `values()` arrays
before every serialization. Deleted entries are skipped using the runtime's
entry tag. The loop reloads the Map's backing buffer after every key or value
callback, roots the current pair first, and bounds traversal by the initial
entry extent, so a reentrant serializer can force collection and rehashing
without leaving a stale unmanaged pointer live. This is generic Map machinery;
there is no corpus, schema, key, value or entry-count recognition.

Six balanced process pairs compare equal-length frozen `mapbase0000000001` and
`mapfinal000000001` artifacts on V8. The committed candidate and its exact
parent use 100 operations per phase and one byte-identical native executable.
Every variant passes twenty complete retained-output comparisons per layout.
Candidate / baseline SIMD stringify throughput:

| Layout | V8 |
| --- | ---: |
| CITM minified | 1.096x |
| CITM pretty | 1.094x |
| GSOC minified | 1.137x |
| GSOC pretty | 1.131x |
| Twitter minified | 0.996x |
| GitHub events minified | 1.005x |

No parse, stringify or validation row exceeds the 5% regression guard. The two
inactive controls remain within 0.5% of their parent. A separate seven-pair
shorter-run CITM comparison, retained to expose allocation sensitivity, reports
1.218x SIMD and 1.226x SWAR stringify throughput. The sustained 100-operation
measurements above are the conservative production result.

Map deletion-order coverage and a custom-serializer regression force a rehash,
replace a future value and collect while serialization is active. The focused
Map/Raw suites pass 390 checks across all modes. The exact commit passes 123,636
normal and 77,919 strict/RFC checks across NAIVE, SWAR and SIMD; transform
regressions, typecheck, lint and diff checks also pass.

Artifacts under `build/simdjson-parity/`: runs
`map{base0000000001,final000000001}/`, comparisons `mapfinal-*`, and the
shorter-run `comparisons/mapsafe-citm-isolated/`.

## Compact generated SIMD string fields

Generated string fields now route values shorter than eight UTF-16 code units
through a compact scalar clean-string writer. Quotes, backslashes, controls and
surrogates fall back to the complete shared SIMD writer, preserving identical
escaping and Unicode behavior. The shared entry point remains unchanged for
root strings, Map keys and generic string serialization. Selection depends only
on the generated field type and runtime string length; it contains no corpus,
schema, field-name or string-content signature.

Balanced fresh-process pairs compare equal-length frozen baselines and the
exact committed candidate on V8. Every layout passes twenty complete retained-
output comparisons. Candidate / baseline SIMD stringify throughput:

| Layout | V8 |
| --- | ---: |
| Poet minified | 1.072x |
| CITM minified | 1.005x |
| CITM pretty | 1.023x |
| GSOC minified | 0.991x |
| GSOC pretty | 1.001x |
| Twitter minified | 1.009x |
| GitHub events minified | 1.025x |

All parse, stringify and validation rows remain inside the 5% regression
guard. A root-short-string control, which deliberately cannot use the generated
field helper, is neutral at 0.996x. The broader prototype that also routed root
and generic strings improved Poet but regressed that tiny root control by 3.3%,
so the committed form isolates the win to generated fields.

Two larger-copy experiments were rejected on the same changing-input GSOC
workload. Pre-scanning a string and then using `memory.copy` produced 0.937x
stringify throughput, while a separate four-vector loop for strings of at least
256 physical bytes produced 0.974x. These results rule out simple extra-pass and
wider-unrolled variants; future string work should instead reduce exceptional-
character and call/cursor dependencies.

Focused string tests pass 40,585 checks across all modes. The exact commit
passes 123,636 normal and 77,919 strict/RFC checks across NAIVE, SWAR and SIMD;
transform regressions, typecheck, lint and diff checks also pass.

Artifacts under `build/simdjson-parity/`: runs
`{shortbase00000001,fieldstr000000001}/`, comparisons `fieldstr-*`, rejected
long-string runs `longscan000000001/` and `comparisons/longscan-gsoc-min/`, and
the exploratory `shortstr*` and `shortinl*` artifacts.

## Canonical SIMD string event masks

The exceptional SIMD string loop now retains one event bit per UTF-16 unit.
Previously, each `i16x8` ASCII comparison set both constituent byte bits, so a
quote, backslash or control character was visited twice and counted twice in
the worst-case growth reservation. The canonical mask keeps the low-byte bit
for ASCII escapes and the high-byte bit for conservative surrogate candidates.
This is a representation-level optimization shared by every SIMD string; it
does not recognize a corpus, schema, field, string value or length.

Seven alternating fresh-process V8 pairs compare equal-length frozen
`fieldstr000000001` and `lanemask000000001` artifacts. Every layout passes
twenty complete retained-output comparisons. Candidate / baseline SIMD
stringify throughput:

| Layout | V8 |
| --- | ---: |
| CITM minified | 1.002x |
| CITM pretty | 1.003x |
| GSOC minified | 1.043x |
| GSOC pretty | 1.034x |
| Twitter minified | 1.017x |
| GitHub events minified | 1.028x |
| Poet minified | 1.040x |
| Root short-string control | 1.009x |

No parse, stringify or validation row exceeds the 5% regression guard. Five
latest-main w2c2 pairs independently report 1.018x GSOC stringify with runtime
checks and 1.037x without them; their other phases remain within 1%.

Two related hypotheses were rejected and reverted. Compacting blocks with
multiple ASCII escapes through one scalar cursor measured 1.005x on GSOC and
0.997x on GitHub, so grouped expansion needs a genuinely vectorized algorithm
to justify its complexity. Routing Map keys through the pointer-only string
entry measured 1.009x on GSOC and 0.998x on CITM, below the acceptance
threshold. The accepted result instead removes provably redundant event work.

Focused string tests pass 40,585 checks across all modes. Exact commit
`da6cfd6` passes 123,636 normal and 77,919 strict/RFC checks across NAIVE, SWAR
and SIMD; transform regressions, typecheck, lint and diff checks also pass.

Artifacts under `build/simdjson-parity/`: runs
`{fieldstr000000001,lanemask000000001}/`, comparisons `lanemask-*`, rejected
grouped-escape run `groupesc000000001/` and comparisons `groupesc-*`, and
rejected Map-key run `mapkeypt000000001/` and comparisons `mapkeypt-*`.

## Reused signed-narrow string classification

The 32-byte clean-string loop already narrows sixteen UTF-16 units to signed
bytes for ASCII classification. Negative `i16` lanes, including every
surrogate, saturate to `-128`; the loop now reuses that result for its
conservative Unicode event check instead of comparing both original vectors
byte-wise and ORing the results. Candidate blocks still enter the established
whole-code-unit verifier, so escaping semantics are unchanged. This applies to
every sufficiently long SIMD string and contains no corpus or schema signal.

Seven alternating V8 pairs compare equal-length frozen `lanemask000000001` and
`signsatx000000001` artifacts. Every layout passes twenty complete retained-
output comparisons. Candidate / baseline SIMD stringify throughput:

| Layout | V8 |
| --- | ---: |
| GSOC minified | 1.013x |
| Twitter minified | 0.999x |
| GitHub events minified | 1.027x |
| Poet minified | 1.016x |
| CITM minified control | 0.998x |
| Root short-string control | 0.997x |

Three nine-pair Unicode stress controls cover full-width text, mixed surrogate
pairs and the U+7FFF/U+8000 transition. Their stringify ratios are 0.994x,
0.998x and 0.995x respectively. Five latest-main w2c2 pairs report 0.983x
GSOC stringify with checks and 0.991x without; both remain inside the 5%
cross-runtime guard. V8 remains the classic parity backend, where the active
ASCII-heavy layouts improve and all controls are neutral.

The post-mask GSOC profile attributes 3,099 of 3,929 Wasm self samples (78.9%)
to the shared string writer, confirming that this loop remains the main
serialization target. A scalar sign-bit-mask variant was rejected: it measured
0.981x GSOC, 0.980x Twitter and 0.969x GitHub stringify throughput. Outlining
the complete escape writer into a cold continuation was also rejected: it
measured 0.979x GSOC, 1.003x Twitter, 1.015x GitHub and 0.998x Poet. The added
continuation edge costs more than the smaller hot function saves.

Focused string tests pass 40,585 checks across all modes. Exact commit
`6c0eb8f` passes 123,636 normal and 77,919 strict/RFC checks across NAIVE, SWAR
and SIMD; transform regressions, typecheck, lint and diff checks also pass.

Artifacts under `build/simdjson-parity/`: runs
`{lanemask000000001,signsatx000000001,satbasex000000001,signmask000000001}/`,
comparisons `signsatx-*` and `signmask-*`, and profile artifacts
`lane-mask2-{serialize-v8.log,serialize-run.log,self-profile.py,self-profile.json}`
plus `runs/laneprof000000001/`; rejected outline artifacts are
`runs/coldoutx000000001/` and comparisons `coldoutx-*`.

## Rejected parsed-string provenance

A generated-object prototype retained the exact managed string reference for
each unescaped strict input token. When that reference still matched the field
at serialization time, a reduced SIMD writer checked only surrogate pairing
instead of rescanning for quotes, backslashes and controls. Escaped input,
nullable values, legacy/reuse parsing and reassigned fields used the complete
writer. The marker was a traced reference rather than a raw pointer so allocator
address reuse could not forge identity. Selection depended only on parser
provenance and object identity; it contained no corpus or schema signature.

Seven alternating V8 pairs compare equal-length frozen `signsatx000000001` and
`rawprv3x000000001` artifacts. Every variant passes twenty complete retained-
output comparisons. Candidate / baseline SIMD throughput:

| Layout | Parse | Stringify |
| --- | ---: | ---: |
| GSOC minified | 0.966x | 1.003x |
| GitHub events minified | 0.965x | 1.039x |
| Twitter minified | 0.973x | 1.012x |
| Poet minified | 0.976x | 0.962x |
| CITM minified | 1.005x | 0.997x |

The extra object slots, marker stores and GC links consistently cost parsing
throughput, while the reduced scan produced only one material win and regressed
Poet stringification. The runtime prototype and its focused correctness tests
were therefore reverted. This rejects per-field managed provenance; future
round-trip work must avoid expanding every parsed object or adding write
barriers to the parse path.

Artifacts under `build/simdjson-parity/`: successful run
`rawprv3x000000001/`, comparisons `rawprov-*`, and the preserved failed build
attempts `rawprovx000000001/` and `rawprv2x000000001/`.

## Folded signed SIMD string classification

The paired 32-byte SIMD string loop narrows UTF-16 lanes with signed saturation.
Controls become `0..31`, ordinary positive non-ASCII units saturate to `+127`,
and `U+8000..FFFF` (including every surrogate) saturate to `-128`. One signed
`bytes < 0x20` comparison therefore covers both the JSON control range and the
conservative high-Unicode candidate that previously needed a separate equality
plus OR. Quotes and backslashes keep their exact comparisons, and candidate
blocks still enter the established whole-code-unit verifier. The reduction is
shared by every sufficiently long SIMD string and contains no corpus, schema,
field or value signature.

Seven alternating V8 pairs compare equal-length frozen `signsatx000000001` and
`signltxx000000001` artifacts. Every variant passes twenty complete retained-
output comparisons. Candidate / baseline SIMD stringify throughput:

| Layout | V8 |
| --- | ---: |
| GSOC minified | 1.014x |
| GitHub events minified | 0.995x |
| Poet minified | 1.055x |
| Twitter minified | 1.000x |
| CITM minified | 1.002x |

Three nine-pair Unicode controls use 5,000 operations per phase. Full-width
text and surrogate pairs are exactly neutral at 1.000x; the forced
`U+7FFF/U+8000` transition improves 1.021x. No control phase moves beyond 2.1%.

Latest-main w2c2 also passes every retained-output oracle. Checked execution
reports 1.011x GSOC and 1.006x Poet stringify. Default execution reports 1.022x
Poet; an initial seven-pair GSOC sample was 0.930x, but the isolated balanced
12-pair confirmation is 1.001x with every phase inside 1.2%. The confirmation
supersedes the noisy first screen.

Exact commit `82c875c` passes 123,636 normal and 77,919 strict/RFC checks across
NAIVE, SWAR and SIMD. Transform regressions, typecheck, lint and all eleven
benchmark-tooling tests pass.

A separate output-ownership experiment lowered the general direct-managed-
string threshold from 64 KiB to 16 KiB. Nine V8 pairs improved the 53 KiB
GitHub stringify row only 1.014x and left the rest of the tested range unchanged.
That narrow size-band tradeoff was reverted rather than retained as a
corpus-subset optimization.

A generated-field-only prototype also added a compact one-vector writer for
8--15-unit strings, a band represented by GSOC, Twitter, CITM, GitHub and Poet.
It passed 16,380 focused SIMD escape, tail and surrogate assertions plus every
retained-output oracle. Seven V8 pairs improved GSOC 1.023x, Twitter 1.017x and
GitHub 1.006x, but regressed Poet to 0.956x. A 12-pair CITM confirmation was
0.992x. Duplicating classification/setup in generated writers is therefore
rejected; the existing shared writer remains preferable beyond the retained
seven-unit scalar entry.

Artifacts under `build/simdjson-parity/`: runs
`{signltxx000000001,signlt2x000000001,own64kbx00000001,own16kbx00000001,midstrxx000000001}/`,
comparisons `signlt-*`, `signlt2-*`, `own16kb-*`, `midstr-*`, and the preserved
first 100-operation Unicode candidate inside `signltxx000000001/`.

## Rejected checked integer-array cursor specialization

A checked-cursor prototype recognized integer arrays once at the array boundary
and called the established signed or unsigned SWAR cursor reader directly for
each element. This removed the generic `readCursorValue<valueof<T>>` call from
the source while preserving the same strict leading-zero checks, destination
stores and returned cursors. It applied to every checked SWAR/SIMD integer array
and contained no corpus, schema or value signature.

Seven alternating V8 pairs compare equal-length frozen `signltxx000000001` and
`intcurxx000000001` artifacts. Every variant passes twenty complete retained-
output comparisons. Candidate / baseline SIMD parse throughput:

| Layout | Parse |
| --- | ---: |
| CITM minified | 0.997x |
| GSOC minified | 1.007x |
| Twitter minified | 1.024x |
| Poet minified | 0.990x |

The primary integer-array workload did not improve, and the cross-corpus result
was mixed. The generated Wasm/compiler already appears to eliminate enough of
the generic specialization overhead that duplicating the array loop is not
worth its code size. The prototype was reverted.

Focused strict cursor-array, nested-array and empty-array tests pass. The normal
integer suite passes 525 checks across NAIVE, SWAR and SIMD. Artifacts under
`build/simdjson-parity/`: run `intcurxx000000001/` and comparisons `intcur-*`.

## Rejected adaptive fresh-Map capacity

A checked-parser prototype remembered the last successful entry count for each
generated type/field pair and used it only to size the next fresh Map's standard
bucket and entry buffers. First parses used the ordinary constructor, collisions
only discarded or replaced a performance hint, and all grammar, hashing and
Map insertion still used the standard implementation. The bounded predictor
contained no corpus, key, schema signature or value recognition.

Seven alternating V8 pairs compare equal-length frozen `signltxx000000001` and
`maphintx000000001` artifacts. Every variant passes twenty complete retained-
output comparisons. Candidate / baseline SIMD throughput:

| Layout | Parse | Stringify | Validate |
| --- | ---: | ---: | ---: |
| CITM minified | 1.000x | 1.000x | 1.006x |
| GSOC minified | 0.998x | 0.993x | 1.000x |
| Twitter minified | 1.018x | 1.010x | 0.985x |
| Poet minified | 0.994x | 1.000x | 0.996x |

CITM is the Map-heavy target and remains exactly neutral after warmup. Rehash
growth is therefore not a material contributor to its present owned-parse gap;
the adaptive state and direct Map-layout construction were reverted. Focused
strict Map/object tests pass before measurement.

Artifacts under `build/simdjson-parity/`: run `maphintx000000001/` and
comparisons `maphint-*`.

## Current latest-main w2c2 SIMD screen

The frozen `signltxx000000001` artifact contains the current production code;
later commits only record rejected experiments. Latest-main w2c2 translates
that exact Wasm, and its default configuration disables Wasm bounds/table
checks while retaining JSON syntax checks. Seven fresh-process pairs use the
same native executables, rotating inputs and twenty complete retained-output
comparisons as V8. Native / json-as SIMD throughput:

| Layout | Parse | Stringify | Validate |
| --- | ---: | ---: | ---: |
| CITM minified | 0.499x | 0.327x | 0.662x |
| GSOC minified | 0.785x | 0.414x | 0.969x |
| Twitter minified | 1.768x | 0.593x | 0.614x |
| Poet minified | 1.423x | 0.460x | 1.566x |

w2c2 materially improves these parse rows over V8 and puts GSOC parsing close
to the 1.2x native-latency boundary, but it does not change the primary
direction: all four stringification rows and CITM parsing/validation remain
outside budget. Backend selection alone cannot complete the classic target.

Artifacts under `build/simdjson-parity/`: translated binaries beneath
`runs/signltxx000000001/w2c2/` and comparisons
`signlt-current-w2c2-*`.

## Retained generated integer-array output fusion

A generated object containing exactly one non-nullable `i16[]`/`u16[]` or
wider integer array now includes that array's established worst-case bound in
the object's single capacity reservation. Its serializer keeps the destination
cursor local and calls the unchanged integer formatter through a cursor-
returning entry. This removes an array-boundary reservation, shared cursor
publication/reload and wrapper work. Selection uses only compile-time field
types and count; it has no corpus, schema name, field name or value-range rule.

The transform deliberately excludes schemas with several qualifying arrays.
Summing several worst-case bounds could retain much more capacity than the
previous per-boundary growth policy. A three-way nine-pair comparison confirms
that the safe single-array form retains nearly all of the measured speedup.

Candidate / `signltxx000000001` SIMD stringify throughput:

| Layout | V8 | Default w2c2 |
| --- | ---: | ---: |
| CITM minified | 1.103x | 1.048x |
| GSOC minified | 1.017x | - |
| Twitter minified | 1.000x | - |
| Poet minified | 0.994x | - |

The unrestricted exploratory form measured 1.119x V8 and 1.050x default-w2c2
on CITM, only about 1.5% ahead of the retained bounded policy. It is rejected
because that small difference does not justify compounded peak capacity.
Every comparison passes twenty complete retained-output checks and no phase in
the broad screen exceeds the 5% regression guard. CITM stringification remains
outside native budget; the retained change moves it materially closer.

Exact commit `7d0c388` passes 123,636 normal and 77,919 strict/RFC checks across
NAIVE, SWAR and SIMD. It also passes 1,416 transform regressions, typecheck,
lint and all eleven benchmark-tooling tests. The existing generated-array
regression forces collection and output growth while a 2,048-element `i64[]`
is reachable only through its owner. SIMD alone gates native parity; the shared
implementation also reaches SWAR and NAIVE.

Artifacts under `build/simdjson-parity/`: runs
`{arrfusex000000001,arronexx000000001}/` and comparisons `arrfuse-*`,
`arrone-*` and `arrone-w2c2-*`.

A follow-up kept the safe outer fusion and routed additional wide-integer
arrays through the cursor writer after reserving at each individual boundary.
Nine V8 pairs improve CITM stringification only 1.006x over the retained form,
while its unchanged parse control is 0.995x. The extra generated branch is
reverted; artifact `arrmultx000000001/` and comparison `arrmult-*` retain the
negative result.

## Rejected speculative clean-string stores

The paired SIMD clean-string loop was tested with both 16-byte stores issued
before the special-character classification branch. A block containing an
escape left the destination cursor unchanged, so the established exceptional
path safely overwrote the provisional bytes. The change applied to every
string reaching the 32-byte loop and contained no corpus, schema or value
signature.

Seven alternating V8 pairs compare equal-length `arronexx000000001` and
`specstrx000000001` artifacts. Every candidate passes twenty complete retained-
output comparisons. Candidate / baseline SIMD stringify throughput:

| Layout | Stringify |
| --- | ---: |
| GitHub Events minified | 1.010x |
| GSOC minified | 1.015x |
| Poet minified | 0.996x |
| CITM minified | 1.004x |
| Twitter minified | 0.993x |

The result is mixed and too small to distinguish from ordinary run variation;
the extra stores on exceptional blocks are not justified. The prototype was
reverted after 49,468 focused checks across NAIVE, SWAR and SIMD, including
fast tails, escapes and surrogate block boundaries. Artifacts under
`build/simdjson-parity/`: run `specstrx000000001/` and comparisons `specstr-*`.

## Retained single-field generated string reservation

Static generated objects now fold even one direct string field's payload into
the object's existing capacity reservation. The earlier threshold required two
strings. Lowering it removes the field's separate capacity check and keeps the
output cursor local across that boundary; it neither changes the total byte
bound nor selects a corpus, schema, field name, length or string content.

Seven alternating fresh-process pairs compare equal-length
`arronexx000000001` and `onestrxx000000001` artifacts. Every variant passes
twenty complete retained-output comparisons. Candidate / baseline SIMD
stringify throughput:

| Layout | V8 | Default w2c2 |
| --- | ---: | ---: |
| GitHub Events minified | 1.018x | 1.011x |
| GSOC minified | 1.005x | - |
| Twitter minified | 1.003x | - |
| Poet minified | 0.997x | 1.007x |
| CITM minified | 0.998x | - |

No measured row crosses the 5% regression guard. Exact commit `ff7cc58`
passes 123,645 normal and 77,928 strict/RFC checks across NAIVE, SWAR and SIMD,
including explicit one-string and nullable one-string escape-growth coverage.
It also passes 1,416 transform regressions, typecheck, lint and diff checks.
The shared generated-code improvement reaches all modes; SIMD alone gates
native parity.

Artifacts under `build/simdjson-parity/`: run `onestrxx000000001/` and
comparisons `onestr-*` and `onestr-w2c2-*`.

## Rejected nested full-write zero initialization

A generated-parser prototype extended the fresh-root full-write contract to
new nested objects and new struct-array elements. Types whose fast parser writes
every field started from zeroed reference-safe storage instead of constructing
their declared defaults; optional types retained normal initialization, and
every fast miss initialized fully before the slow retry. The rule depended only
on the generated type capability and contained no corpus or schema signature.

Seven alternating V8 pairs compare equal-length `onestrxx000000001` and
`nestzerx000000001` artifacts. Every variant passes twenty complete retained-
output comparisons. Candidate / baseline SIMD parse throughput:

| Layout | Parse |
| --- | ---: |
| CITM minified | 0.993x |
| GSOC minified | 1.010x |
| Twitter minified | 1.006x |
| GitHub Events minified | 1.008x |
| Poet minified | 0.994x |

The allocator-bound CITM target did not improve, and Poet stringification also
moved to 0.976x despite being semantically untouched. The added capability
branch/code layout is not justified by the small mixed parse changes, so the
prototype was reverted. Before measurement it passed 12,633 focused nested,
struct, nullable and production-safety checks across all modes.

Artifacts under `build/simdjson-parity/`: run `nestzerx000000001/` and
comparisons `nestzero-*`.

## Rejected fresh Map-value zero initialization

A follow-up applied the full-write zeroed-payload contract specifically to
fresh generated objects stored as Map values. This covers CITM's
`Map<string, CitmEvent>`: it avoids constructing default arrays that the
generated complete parser immediately replaces, while optional types and every
slow fallback keep normal initialization. Generic specialization resolves the
capability per value type; there is no corpus or schema selector.

Nine V8 pairs on CITM and seven on the controls compare equal-length
`onestrxx000000001` and `mapzerox000000001` artifacts. All retained-output
oracles pass. Candidate / baseline SIMD parse throughput:

| Layout | Parse |
| --- | ---: |
| CITM minified | 1.000x |
| GSOC minified | 0.996x |
| Twitter minified | 1.001x |
| Poet minified | 1.001x |

The required Map, key, string and final-container allocations dominate; the
temporary defaults are not measurable. Poet stringification also moved to
0.981x despite being semantically untouched. The prototype was reverted after
1,176 focused Map, GC and production-safety checks passed across all modes.

Artifacts under `build/simdjson-parity/`: run `mapzerox000000001/` and
comparisons `mapzero-*`.

## Retained fused fresh-Map key hashing

Fresh string-key Maps now compute the runtime's exact XXHash while checking the
source key for JSON escapes, then copy the proven unescaped key and insert it
with that hash. Previously the decoder scanned the source for escapes, copied
it, and `Map.set` scanned the managed string again to hash it. Escaped keys,
reused Maps, non-string keys and capacity-growth boundaries retain the standard
decoder/Map paths. Direct insertion preserves bucket collision chains,
duplicate replacement, insertion order and GC links.

The rule is selected solely by fresh string-key Map semantics and contains no
corpus, schema, key name, length or value signature. Inactive Twitter and Poet
SIMD Wasm artifacts remain byte-identical to baseline; GSOC shrinks 447 bytes,
while map-heavy CITM grows 1,307 bytes.

Nine alternating V8 pairs on CITM and seven on the broad controls compare
equal-length `onestrxx000000001` and `prehashx000000001` artifacts. Every
variant passes twenty complete retained-output comparisons. Candidate /
baseline throughput:

| Layout | SIMD parse | SWAR parse |
| --- | ---: | ---: |
| CITM minified | 1.016x | 1.009x |
| GSOC minified | 0.997x | 1.005x |
| Twitter minified | 1.005x | - |
| Poet minified | 1.001x | - |

Default w2c2 is neutral-positive on CITM parse at 1.002x. No measured phase on
either mode/backend crosses the 5% regression guard. V8 remains the classic
parity backend; SWAR is diagnostic and receives the same general improvement.

Exact commit `e3e5cfb` passes 123,891 normal and 77,928 strict/RFC checks across
NAIVE, SWAR and SIMD. New coverage spans empty and 1/4/8/16-byte hash
boundaries, BMP and surrogate text, escaped keys, duplicate replacement,
bucket chains and several Map growth/rehash boundaries. Transform regressions,
typecheck, lint, formatting and diff checks also pass.

Artifacts under `build/simdjson-parity/`: run `prehashx000000001/` and
comparisons `prehash-*`, `prehash-swar-*` and `prehash-w2c2-*`.

## Rejected cursor-local Map key writer

A serialization prototype reserved each string key's payload at the Map loop,
called the existing cursor-returning string writer, emitted the colon through
that local cursor and published builder state once. Non-string keys and all
escaping/growth semantics were unchanged. The rule applied to every string-key
Map without corpus or schema selection.

Nine alternating V8 pairs on the two Map-heavy layouts and seven on controls
compare equal-length `prehashx000000001` and `mapcurxx000000001` artifacts.
Every retained-output oracle passes. Candidate / baseline SIMD stringify:

| Layout | Stringify |
| --- | ---: |
| GSOC minified | 0.982x |
| CITM minified | 1.012x |
| Twitter minified | 1.001x |
| Poet minified | 0.990x |

The shared call already compiles efficiently for GSOC; moving its reservation
and cursor boundary trades performance between layouts instead of removing
work. The prototype was reverted after 1,146 focused Map and GC checks passed
across all modes.

Artifacts under `build/simdjson-parity/`: run `mapcurxx000000001/` and
comparisons `mapcursor-*`.

## Rejected staged fresh-Map bucket construction

A fresh string-key Map prototype appended entries plus their already-computed
hashes without building bucket chains or invoking runtime rehash at each growth
boundary. At the closing brace it allocated the final bucket array once,
resolved duplicates in insertion order and restored the ordinary runtime Map
layout. Staged entries remained traced through every allocation, and escaped
keys safely finalized early into the established Map path. The algorithm was
generic over every fresh string-key Map.

Nine alternating V8 pairs compare equal-length `prehashx000000001` and
`mapstage000000001` artifacts. All retained-output oracles pass. Candidate /
baseline SIMD throughput:

| Layout | Parse | Stringify | Validate |
| --- | ---: | ---: | ---: |
| CITM minified | 1.007x | 1.015x | 0.998x |
| GSOC minified | 0.996x | 0.995x | 0.995x |

After fused key hashing, repeated runtime rehash is not a dominant remaining
cost. The 0.7% CITM parse change does not justify a second temporary buffer,
deferred duplicate resolution and duplicated Map-layout machinery, so the
prototype was reverted. Hash-boundary, duplicate, multi-growth, Map, GC and
production-safety suites passed across all modes before measurement.

Artifacts under `build/simdjson-parity/`: run `mapstage000000001/` and
comparisons `mapstage-*`.

## Retained eight-unit scalar entry for checked SIMD keys

The checked SIMD key scanner now checks its first eight UTF-16 code units
directly before entering the wider SWAR/SIMD event-mask path. The preceding
four-unit entry still handles short keys without extra work; keys ending in
units five through eight avoid mask construction and reduction. Longer,
escaped, invalid and bounded-tail keys retain the established checked scanner.
The rule is shared by all checked discard traversal and selects no corpus,
schema, key name or value.

Five balanced fresh-process V8 pairs compare equal-length frozen
`keyscalar4base001` and `keyscalar80000001` artifacts across all sixteen
classic validation layouts. Every RFC preflight and all 64 changing-input
oracles pass. Candidate / baseline SIMD validation throughput:

| Layout | Throughput |
| --- | ---: |
| Canada minified | 0.998x |
| Canada pretty | 1.010x |
| Twitter minified | 1.016x |
| Twitter pretty | 1.049x |
| CITM minified | 1.024x |
| CITM pretty | 1.019x |
| GitHub Events minified | 1.024x |
| GitHub Events pretty | 1.011x |
| Poet minified | 1.106x |
| Poet pretty | 1.058x |
| GSOC minified | 1.072x |
| GSOC pretty | 1.032x |
| Lottie minified | 1.010x |
| Lottie pretty | 1.007x |
| OTFCC minified | 0.995x |
| FGO minified | 1.015x |

No row exceeds the 5% regression guard. Seven-pair complete-phase controls on
Twitter, CITM, GSOC and Poet keep parse and stringify within 1.0% while
validation improves 1.029x, 1.027x, 1.063x and 1.092x respectively. The full
matrix still has twelve V8 validation rows outside the native +20% latency
budget, so this is retained progress rather than a parity claim.

Exact runtime commit `41fc1b1` passes 123,891 normal and 77,928 strict/RFC
checks across NAIVE, SWAR and SIMD, 1,416 transform regressions, eleven
benchmark-tooling tests, typecheck, lint and diff checks. Artifacts under
`build/simdjson-parity/`: runs `keyscalar4base001/` and
`keyscalar80000001/`, comparisons `keyscalar8-validation-v8/` and
`keyscalar8-{twitter,citm-catalog-min,gsoc-2018-min,poet-min}/`.

## Retained sixteen-unit scalar entry for checked SIMD keys

Post-eight-unit profiling still attributes 34.6% of Twitter validation samples
to `skipCursorKey`. Extending the same exact UTF-16 scalar event checks through
the first sixteen code units avoids mask setup and scalar-tail replay for more
medium keys. Keys terminating earlier return at the same check as before;
longer, escaped, invalid and bounded-tail keys keep the shared checked scanner.
The path remains SIMD-only and has no corpus, schema, key-name or value rule.

Five balanced fresh-process V8 pairs compare equal-length frozen
`keyscalar08val001` and `keyscalar16val001` artifacts across all sixteen
classic validation layouts. Every RFC preflight and all 64 changing-input
oracles pass. Candidate / baseline SIMD validation throughput:

| Layout | Throughput |
| --- | ---: |
| Canada minified | 0.995x |
| Canada pretty | 1.001x |
| Twitter minified | 1.012x |
| Twitter pretty | 1.019x |
| CITM minified | 1.105x |
| CITM pretty | 1.091x |
| GitHub Events minified | 1.024x |
| GitHub Events pretty | 1.009x |
| Poet minified | 0.992x |
| Poet pretty | 0.990x |
| GSOC minified | 1.000x |
| GSOC pretty | 1.000x |
| Lottie minified | 0.993x |
| Lottie pretty | 0.997x |
| OTFCC minified | 1.021x |
| FGO minified | 1.072x |

No layout exceeds the 5% regression guard; the largest loss is 1.0% and the
largest gains are the two CITM layouts and FGO. Seven-pair complete-phase
controls on Twitter, CITM, GSOC and Poet keep every parse/stringify phase within
1.0%; their validation ratios are 1.012x, 1.090x, 1.015x and 0.997x. Twelve V8
validation layouts remain outside the native +20% budget, so this is another
general improvement rather than a parity claim.

Exact runtime commit `9317ed7` passes 123,891 normal and 77,928 strict/RFC
checks across NAIVE, SWAR and SIMD, plus typecheck, lint and diff checks.
Artifacts under `build/simdjson-parity/`: runs `keyscalar{08,16}val001/`,
`keyscalar8base001/` and `keyscalar16000001/`; comparisons
`keyscalar16-validation-v8/`, `keyscalar16-twitter-fresh/` and
`keyscalar16-{citm-catalog-min,gsoc-2018-min,poet-min}/`; profile files
`twitter-key8-validate-profile*` and run `twitterkey8prof1/`.

## Retained thirty-two-unit scalar entry for checked SIMD keys

A complete decoded-key census confirms that the next interval is broadly
relevant: Twitter has 3,818 keys longer than sixteen units, CITM 909, GSOC
1,264 and FGO 46,171. Poet and nearly all Lottie keys terminate in the already
established short entry. A post-sixteen-unit Twitter profile still attributes
34.3% of samples to `skipCursorKey`.

The checked SIMD key scanner now extends its exact scalar event checks through
the first thirty-two UTF-16 units before entering the wider scanner. Earlier
keys return at the same comparison as before. Longer, escaped, invalid and
bounded-tail keys keep the shared checked path. This changes only SIMD code and
contains no corpus, schema, key-name or value selector.

Five balanced fresh-process V8 pairs compare equal-length frozen
`keyscalar16val002` and `keyscalar32val001` artifacts across all sixteen
classic validation layouts. Every RFC preflight and all 64 changing-input
oracles pass. Candidate / baseline SIMD validation throughput:

| Layout | Throughput |
| --- | ---: |
| Canada minified | 1.028x |
| Canada pretty | 1.020x |
| Twitter minified | 1.027x |
| Twitter pretty | 1.037x |
| CITM minified | 1.018x |
| CITM pretty | 1.018x |
| GitHub Events minified | 1.017x |
| GitHub Events pretty | 1.011x |
| Poet minified | 1.014x |
| Poet pretty | 1.020x |
| GSOC minified | 1.028x |
| GSOC pretty | 1.016x |
| Lottie minified | 1.018x |
| Lottie pretty | 1.010x |
| OTFCC minified | 1.000x |
| FGO minified | 1.002x |

No layout regresses and fourteen improve 1.0–3.7% by median. Seven-pair
complete-phase controls keep every parse/stringify row within 0.6%; Twitter,
CITM, GSOC and Poet validation ratios are 1.035x, 0.994x, 1.008x and 0.998x.
The complete matrix is authoritative over those narrower canaries. Twelve V8
validation layouts remain outside the native +20% budget, so the overall goal
is still incomplete.

Exact runtime commit `2fbcdb5` passes 123,891 normal and 77,928 strict/RFC
checks across NAIVE, SWAR and SIMD, plus typecheck, lint and diff checks.
Artifacts under `build/simdjson-parity/`: runs `keyscalar16val002/`,
`keyscalar32val001/`, `keyscalar16000001/` and `keyscalar32000001/`;
comparisons `keyscalar32-validation-v8/` and
`keyscalar32-{twitter,citm-catalog-min,gsoc-2018-min,poet-min}/`; profile files
`twitter-key16-validate-profile*` and run `twitterkey16prof/`.

## Retained outer bounds proof for checked SIMD keys

The thirty-two-unit entry previously repeated a tail-bounds comparison before
each two-unit scalar block. A single sixty-four-byte outer guard now proves the
entire unrolled entry safe, allowing the optimized SIMD artifact to omit those
dependent checks. Keys near the document boundary fall back to the established
bounded scanner. The change remains SIMD-only and selects no corpus, schema,
key name or value.

Five balanced fresh-process V8 pairs compare equal-length frozen
`keybase32val00001` and `keyguardval000001` artifacts across all sixteen
classic validation layouts. Every RFC preflight and all 64 changing-input
oracles pass. Candidate / baseline SIMD validation throughput:

| Layout | Throughput |
| --- | ---: |
| Canada minified | 1.005x |
| Canada pretty | 1.016x |
| Twitter minified | 1.001x |
| Twitter pretty | 1.023x |
| CITM minified | 1.019x |
| CITM pretty | 1.028x |
| GitHub Events minified | 1.034x |
| GitHub Events pretty | 1.035x |
| Poet minified | 1.023x |
| Poet pretty | 1.019x |
| GSOC minified | 1.030x |
| GSOC pretty | 1.028x |
| Lottie minified | 1.028x |
| Lottie pretty | 1.032x |
| OTFCC minified | 1.020x |
| FGO minified | 1.019x |

All sixteen layouts improve and no row exceeds the 5% regression guard.
Seven-pair complete-phase canaries keep all parse and stringify controls within
1.0%; their validation ratios range from 0.987x to 1.012x, so the broader
validation matrix is authoritative. A smaller one-line early-fallback form was
also measured and rejected: it lost 0.2–2.2% on most layouts relative to the
retained outer proof. Twelve V8 validation layouts remain outside the native
+20% latency budget, so the overall goal remains incomplete.

Exact runtime commit `37ded05` passes 123,891 normal and 77,928 strict/RFC
checks across NAIVE, SWAR and SIMD, 1,416 transform regressions, eleven
benchmark-tooling tests, typecheck, lint and diff checks. The formatted source
compiles to the exact qualified SIMD artifact after normalizing its equal-length
artifact label. Artifacts under `build/simdjson-parity/`: runs
`keybase32val00001/`, `keyguardval000001/`, `keyguardearly0001/` and
`keyguardcommit001/`; comparisons `keyguard-validation-v8/`,
`keyguard-early-vs-outer-v8/` and
`keyguard-{twitter,citm-catalog-min,gsoc-2018-min,poet-min}/`.

## Rejected proven-opening-quote key entry

A retained-head profile attributes 38.6% of Twitter validation samples to
`skipCursorKey` and 45.4% to the inlined grammar loop. The next prototype moved
the opening-quote check to the object grammar and entered key scanning after
that proven quote, reusing the first member's already-loaded code unit. The
change remained general and preserved malformed-key rejection.

Five balanced fresh-process V8 pairs across all sixteen validation layouts pass
every RFC preflight and all 64 changing-input oracles. The candidate improves
CITM-pretty 1.010x, both GitHub layouts 1.012x and OTFCC 1.013x, but loses eleven
layouts. Twitter-minified falls to 0.992x, Poet-pretty to 0.988x and
Lottie-pretty to 0.992x. The source is therefore reverted; moving the check
across the call boundary is not a general improvement.

Artifacts under `build/simdjson-parity/`: profile run `twitterguardprof/` and
`twitter-keyguard-validate-profile2.log`; runs `keyguardbase0001/` and
`keypayload000001/`; comparison `keypayload-validation-v8/`.
