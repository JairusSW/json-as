# Changelog

## Unreleased

### perf: SIMD string fast path for object deserialization
- Added a SIMD string-field deserializer for fast-path object deserialization.
- Updated transform codegen to emit mode-specific string field helpers and route generic array fields through the shared array-field helper.
- Relaxed fast-path `false` validation and fixed fast-path generation to respect `JSON_MODE=naive`.

### perf: optimize direct integer array deserialization
- Added direct SWAR and SIMD integer-array deserializers with reusable-storage fast paths and shared whitespace-correct slow fallback.
- Split SWAR array field deserializers by element kind and added dedicated direct array throughput benches for SWAR and SIMD.
