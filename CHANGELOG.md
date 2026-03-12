# Changelog

## Unreleased

### perf: SIMD string fast path for object deserialization
- Added a SIMD string-field deserializer for fast-path object deserialization.
- Updated transform codegen to emit mode-specific string field helpers and route generic array fields through the shared array-field helper.
- Relaxed fast-path `false` validation and fixed fast-path generation to respect `JSON_MODE=naive`.

### perf: optimize direct integer array deserialization
- Added direct SWAR and SIMD integer-array deserializers with reusable-storage fast paths and shared whitespace-correct slow fallback.
- Split SWAR array field deserializers by element kind and added dedicated direct array throughput benches for SWAR and SIMD.

### refactor: add serialize/deserialize index dispatchers
- Added `assembly/serialize/index/*` and `assembly/deserialize/index/*` entrypoints to centralize mode selection.
- Routed the public API through the new index dispatch layer and added top-level barrel exports for both serialize and deserialize.

### perf: speed up float field deserialization
- Replaced linear power-of-ten loops in the handwritten float deserializers with a bitwise power-of-ten path and batched fractional parsing.
- Switched `deserializeFloat` from `f64.parse(ptrToStr(...))` to the handwritten parser path.
- Improved object fast-path throughput substantially on payloads with exponent-form float fields.
