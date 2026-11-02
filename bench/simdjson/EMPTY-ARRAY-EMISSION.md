# Reserved empty-array emission

Generated object writers that reserve a complete wide-integer array bound now
emit an empty array directly through their local output cursor. The inlined
entry checks the array length and stores `[]` without entering the outlined
integer-array loop. Nonempty arrays retain that loop. The destination already
has four bytes reserved for the empty result; output ownership, buffer growth
and integer conversion are unchanged.

This is a general type/content fast path, with no corpus, schema, key name,
input identity or value signature selector. Correctness covers all three
modes; native performance qualification remains SIMD-only.

## Verification

- 123,956 normal checks and 78,024 strict/RFC checks pass across all modes.
- The focused array/struct run passes 4,437 checks across all modes.
- Typecheck and lint pass.
- The measured production patch SHA-256 is
  `349657093bbf2fbc507e81f774822fad4ac44cb403dc467bc4a03b0e8935cdd7`.

Frozen baseline `cursorpack00001` includes the generated expected-order cursor
tier. Candidate `emptyemit000001` differs only by this empty-array branch.
Both labels have equal length and use the same AssemblyScript revision
`670f0653` and pinned native simdjson 5.0.4. Alternating fresh V8 processes run
with `--no-liftoff`; builds, tests and profiles do not overlap timing. Each phase
uses 500 operations except OTFCC/FGO at 100. CITM minified uses seven pairs;
other layouts use five.

All six priority layouts (Canada, CITM and GitHub Events, minified and pretty)
pass twenty complete owned-output and retained-result comparisons per label.
No phase crosses the 3% regression guard. Serialization throughput ratios are
baseline latency / candidate latency; above one improves:

| Corpus | Minified | Pretty |
| --- | ---: | ---: |
| Canada | 0.997x | 1.002x |
| CITM | 1.055x | 1.097x |
| GitHub Events | 1.004x | 1.004x |

Eight additional Twitter, GSOC, Lottie and Poet layouts also pass the same
complete oracles and phase regression screen. At the user's direction,
OTFCC/FGO qualification was stopped to focus on Canada, CITM and GitHub.
No complete sixteen-layout qualification is claimed. These are incremental
gains, not native parity: CITM and GitHub serialization remain substantially
behind native.

## Profile motivation

A separate serialization-only CITM diagnostic at `e75da33`, optimized with the
qualification Binaryen flags, attributes 42.9% of samples to the public
stringifier with inlined generated writers, 33.7% to `itoaU64` and 8.8% to the
outlined integer-array writer. Its sustained 20,000-operation timing is a
diagnostic and is not used as an A/B speedup claim. The empty-array branch
removes unnecessary calls from that generated-writer boundary while retaining
the established formatter.

Artifacts under `build/simdjson-parity/`: frozen runs `cursorpack00001/` and
`emptyemit000001/`; comparisons `empty-emission-citm-v8/` and
`empty-emission-<layout>-v8/`; diagnostic
`citm-serialize-e75da33-opt-profile.txt`. Regenerable oracle JSON files are
removed only after complete comparisons pass; metadata, binaries, inputs,
individual timing logs and summary results remain.

## Rejected broader generated empty-field branch

A second prototype extended local empty-token emission to other nonnullable
Array fields of static generated schemas, excluding lazy-field schemas. The
normal nonempty path retained the established writer. It passed 4,437 focused
checks across all modes, the transform suite (including 1,416 parser checks
over twelve configurations), typecheck and lint.

Five alternating fresh V8 pairs on all six priority layouts passed twenty
complete output/retention comparisons per revision. Serialization throughput
ratios against `90ac4e7` were Canada 0.997x/0.989x, CITM 0.965x/1.009x and
GitHub Events 0.977x/1.015x (minified/pretty). The CITM-minified screen crossed
the 3% regression guard; the other results supply no consistent gain. The
prototype is fully reverted rather than retained or tuned to individual
corpora. These are five-pair screening results, not a confirmed estimate of
the regression's size. Artifacts: frozen `emptyfield00001/`, comparisons
`empty-field-<layout>-v8/`.

The user's priority is now Canada, CITM and GitHub Events. Current priority
gaps against native remain largest in CITM/GitHub serialization (roughly
2.7x/2.2x native latency); Canada needs work in parsing (about 1.4x),
serialization (about 1.3x) and validation (about 1.2x). The narrower accepted
branch is an incremental improvement and does not close these gaps.
