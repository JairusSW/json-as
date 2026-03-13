# Changelog

## Unreleased

### fix: tighten default-path runtime correctness
- Fixed `JSON.Value` signed integer tagging and stringification so negative integer values no longer serialize as unsigned.
- Fixed `@omitif("...")` to use the same omit semantics as the callback form during transform-generated serialization.
- Hardened the default deserializers for objects, structs, maps, sets, and raw/string arrays so escaped backslashes and quotes are scanned correctly.
- Implemented `JSON.Obj.from(...)` for serializable object-shaped inputs and aligned `JSON.Box<bool>` with the runtime behavior already exercised by the test suite.
- Added regression coverage for signed `JSON.Value`, decorator omission behavior, escaped nested strings, and raw-array string handling.

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

### fix: avoid pulling SIMD code into non-SIMD bench builds
- Removed unconditional SIMD imports from generic string and array dispatchers so naive and SWAR builds do not emit SIMD ops.
- Made benchmark temp-file cleanup tolerant of missing temporary outputs after `asc --converge`.
