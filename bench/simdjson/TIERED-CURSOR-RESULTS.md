# Generated expected-order cursor tier

The checked generated object parser now tries a straight-line expected-order
tier before its existing cursor state machine. Each hot field compares the
encoded key and colon together with bounded packed loads, then calls its
concrete checked reader directly. A key/layout miss retains the current
cursor and destination and enters the normal keyed cursor tier. Completed
fields are not parsed again. Whitespace before colons, escaped keys, reordered
or missing fields, and duplicate keys keep their established fallback rules.

The hot tier is limited to schemas with at most sixteen fields to bound code
growth. This is a schema compiler policy, without corpus names, key names,
input identities or value signatures. Larger schemas retain the existing
state machine. All modes pass correctness tests; performance qualification
below is for SIMD, the only mode gated against native simdjson.

## Verification

- Transform tests pass, including 1,416 parser checks over twelve configs.
- 123,956 normal and 78,024 strict/RFC checks pass across all three modes.
- All test files rebuilt; typecheck and lint pass.
- New handoff regression cases cover canonical/reordered keys, whitespace
  before colons, escaped keys and duplicate keys (commit `fd5f12d`).
- All sixteen classic layouts pass twenty complete owned-output and retained-
  result comparisons per revision. No measured phase exceeds the 3% regression
  guard in the final screen.
- The final production source patch hash matches the frozen candidate metadata:
  `7f90bafc361db109104896052d46c0fd3d80597a7afa0aad0b0503a4dc28c40a`.

Five alternating fresh V8/native process pairs cover all layouts; the CITM
minified result uses a fifteen-pair confirmation. Both revisions use corrected
sub-millisecond timing and identical operation counts: 500 per phase except
OTFCC/FGO at 100. Ratios are baseline latency / candidate latency, equivalently
candidate throughput / baseline throughput; values above one improve.

| Layout | Parse throughput change |
| --- | ---: |
| Canada min / pretty | 0.992x / 1.000x |
| Twitter min / pretty | 1.011x / 1.018x |
| CITM min / pretty | 1.035x / 1.063x |
| GitHub min / pretty | 1.055x / 1.071x |
| Poet min / pretty | 1.003x / 1.024x |
| GSOC min / pretty | 1.014x / 1.017x |
| Lottie min / pretty | 1.004x / 0.998x |
| OTFCC min | 1.005x |
| FGO min | 1.012x |

The cost is larger generated Wasm: Canada +4.8%, CITM +12.7%, GitHub +15.6%,
Twitter +11.1% and GSOC +11.5% in these drivers. This is a measured structured
parse improvement, not completion of the native parity goal. Significant
serialization, validation and some parsing gaps remain; see the complete
[baseline matrix](BASELINE-2026-11-02.md).

Artifacts under `build/simdjson-parity/`: frozen baseline `paritycurrent01/`,
candidate `cursorpack00001/`, comparisons `packed-tier-<layout>-v8/` and
`cursor-pack-citm-v8-15/`. Large generated oracle JSON files were removed only
after their complete comparison verdicts; binaries, inputs, manifests, logs,
individual timings and median TSVs remain.

## Earlier prototypes

Batch reservation for arrays of primitive-only generated records, guarded by
exact runtime type IDs to preserve subclass behavior, was neutral on CITM:
0.996x serialization in seven pairs. It is reverted (`recordbound0001/`,
`record-bound-citm-v8/`). A straight-line tier with separate key/colon checks
was also mixed: CITM 1.015x, Canada 0.988x, GSOC 0.987x and Twitter 1.010x.
Its frozen driver is `cursortier00001/`; only the packed key/colon version is
retained.
