# Deserialization performance plan

Baseline: `e20c9996d9ae74f3d6e20517f46f0053248307fa` on Apple M4 Max, V8
Turbofan, incremental runtime, SWAR mode. The focused benchmarks use fresh
materialization and 300,000 operations per case.

## Measured opportunities

1. **Recover non-canonical typed input first.** Forced slow-path parsing was
   2.0-5.7x slower than the canonical fast path on the tier head-to-head
   structs. A mixed schema with arrays and nested structs parsed reordered input
   in about 808 ns/op and unknown-field input in about 711 ns/op.
2. **Fuse strict validation after the fallback work is stable.** Strict parsing
   was 2.0-5.3x slower than non-strict parsing on the same valid inputs because
   validation walks the complete document before materialization. This is a
   large opportunity, but it crosses every parser and needs RFC-equivalence
   tests before implementation.
3. **Remove nested scan-reset-reparse cycles.** Nested structs and struct-array
   elements can attempt the fast parser, scan the value boundary, reset the
   object, and parse it again through the slow parser. Replace this incrementally
   with cursor-returning keyed parsing, retaining `scanValueEnd` only for unknown
   fields.
4. **Benchmark UTF-8 ingress separately.** A byte API changes the input
   representation and end-to-end boundary. Do not mix its results into the
   existing UTF-16 typed-parser geometric mean.

## First implementation

Extend the existing one-pass keyed fallback to supported collection-bearing
schemas with at most 12 fields. The cap limits generated-code growth while
covering common API response shapes containing arrays, maps, sets, or static
arrays.

On the focused mixed-schema probe, the implementation measured approximately:

| Case | Before | After | Change |
|---|---:|---:|---:|
| Canonical | 404-406 ns/op | 398-404 ns/op | flat |
| Reordered | 808-825 ns/op | 637-651 ns/op | 1.24-1.30x faster |
| Unknown nested key | 711-717 ns/op | 522-530 ns/op | 1.34-1.37x faster |
| Optimized benchmark Wasm | 133,989 B | 136,434 B | +1.8% |

## Second implementation

Extend keyed fallback to scalar-only schemas with at most six fields. Small
objects are common as nested values and array elements, where a reordered child
otherwise triggers a fast attempt, a boundary scan, a reset, and a slow reparse.
Schemas with 7-11 fields remain excluded: enabling that whole range increased
the focused module by 3.4%, while the six-field cap retained the measured child
win for 1.7% incremental growth.

With the collection optimization already applied, the six-field nested probe
measured approximately:

| Case | Before | After | Change |
|---|---:|---:|---:|
| Canonical child | 294 ns/op | 294-302 ns/op | within run variance |
| Reordered child | 551 ns/op | 444-453 ns/op | 1.22-1.24x faster |
| Optimized focused Wasm | 152,267 B | 154,834 B | +1.7% |

The original mixed reordered probe is now 539-551 ns/op, approximately
1.47-1.53x faster than its 808-825 ns/op baseline before either implementation.

## Third implementation

Group keyed-fallback dispatch by encoded key length before comparing key bytes.
The previous generated parser tested every member's length and contents in a
linear chain. The grouped switch removes impossible byte comparisons and also
deduplicates the length checks.

A paired 3,000,000-operation run measured:

| Case | Before | After | Change |
|---|---:|---:|---:|
| Mixed canonical | 401.78 ns/op | 400.75 ns/op | flat |
| Mixed reordered | 549.08 ns/op | 531.89 ns/op | 1.03x faster |
| Mixed unknown key | 526.44 ns/op | 504.73 ns/op | 1.04x faster |
| Six-field, same-length keys | 445.59 ns/op | 446.77 ns/op | -0.3% |
| Optimized focused Wasm | 166,591 B | 166,402 B | -189 B |

The original "lead space" probe did not force tier 2 because the public parser
removes root-leading whitespace. It now puts whitespace after `{`. Late-miss
cases also cover nearly complete tier-1/tier-2 attempts before fallback. One
3,000,000-operation current-branch run measured:

| Case | Latency | Relative to canonical |
|---|---:|---:|
| Mixed canonical | 406.57 ns/op | 1.00x |
| Fully reversed | 541.48 ns/op | 1.33x |
| Unknown key first | 519.49 ns/op | 1.28x |
| Last two fields swapped | 612.92 ns/op | 1.51x |
| Unknown key before final field | 780.45 ns/op | 1.92x |
| Late whitespace deviation | 521.92 ns/op | 1.28x |
| Last two fields swapped, reused output | 279.70 ns/op | 0.69x |

The late unknown-key case is the worst observed fallback shape and should remain
an explicit regression target rather than being hidden by favorable early
misses.

## Rejected experiment

Calling the nested slow parser directly with the enclosing object's end looked
like it could remove `scanValueEnd`. It instead let the child parser consume
into its parent, so the parent fast path failed and restarted. The focused
reordered-child case regressed from about 320 ns/op to 749 ns/op. Keep the
boundary scan until the slow parser has an explicit composable/end-returning
entry point.

## Reverted strict-validation experiment

The experiment fused strict validation with materialization for the subset of
non-nullable numeric/boolean-only typed structs that also have keyed fallback.
The transform emitted an explicit self-validating marker only for those
schemas; nullable fields, containers, nested objects, lazy fields, and custom
deserializers retain the standalone whole-document validator.

This required fixing the generated fast parser first. Numeric field scanners
previously returned the prefix they consumed, so malformed forms such as `01`
and `1.` could look successful when the standalone validator was bypassed.
Strict numeric dispatch now validates each consumed token and generated code
propagates a zero failure cursor. Marked schemas also convert a fast miss into
the public recoverable parse error instead of entering the legacy strict slow
parser, whose error branches can abort.

Repeated 3,000,000-operation SWAR runs measured:

| Case | Before | After | Change |
|---|---:|---:|---:|
| Strict telemetry, canonical | 349.98 ns/op | 98.39-99.95 ns/op | 3.50-3.56x faster |
| Strict telemetry, reordered | 494.04 ns/op | 272.82-277.34 ns/op | 1.78-1.81x faster |
| Optimized focused Wasm | 67,010 B | 59,035 B | -11.9% |

The safety regression exercised malformed signs, leading zeros, fractions,
exponents, types, separators, keys, trailing bytes, and unknown fields directly
against the generated fast method and through public `JSON.parse` in NAIVE,
SWAR, and SIMD modes.

The optimization was reverted before merge. Complete scalar-token validation
did not prove that every generated structural/key load was bounded by `srcEnd`,
and progressive writes were not failure-atomic for reused output objects. Keep
the standalone RFC validator until those contracts are explicit and tested.

## Reverted strict-string extension

The follow-up extended fused strict validation to non-nullable string fields. The backend field
scanner still performs materialization, then a strict-only token validator
checks the exact quote-inclusive range it consumed. Generated code propagates a
zero cursor only in strict builds. This deliberately scans each string value a
second time, but avoids rescanning every key and rerunning the document state
machine; non-strict builds eliminate both additions at compile time.

Repeated 3,000,000-operation SWAR runs on a 12-field, long-key/string record
measured:

| Case | Before | After | Change |
|---|---:|---:|---:|
| Strict string record, canonical | 703.18-714.95 ns/op | 521.86-531.04 ns/op | 1.32-1.37x faster |
| Optimized focused Wasm | 81,480 B | 74,987 B | -8.0% |

The new regression covered valid escapes and rejected raw control characters,
invalid escapes, unterminated values, and wrong value types through both the
generated fast method and public `JSON.parse` in NAIVE, SWAR, and SIMD modes.
This extension was reverted with the parent experiment; the measurements remain
as evidence for a future fully bounded implementation.

## Rejected validator experiment

Unrolling the standalone strict string validator from 8-byte to 16-byte blocks
changed an eight-field string record from 461.87 ns/op to 460.54 ns/op while
adding 274 bytes of optimized Wasm. The sub-percent movement was noise-sized,
so the unroll was reverted in favor of removing redundant document validation
for schemas whose field helpers can prove correctness while materializing.

## Gates for subsequent work

- Use repeated before/after runs from the same source revision and runtime.
- Report latency and generated Wasm size; reject broad wins bought with
  unbounded per-schema code generation.
- Keep canonical regressions below 2% on repeated measurements.
- Run fast-path tests in SWAR and SIMD modes, the RFC/strict matrix, transform
  tests, strict public tests with fast generation both disabled and enabled,
  type checking, and lint before landing parser-codegen changes.
- Add a representative benchmark before optimizing a fallback shape.
