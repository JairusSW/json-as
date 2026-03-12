# Changelog

## Unreleased

### perf: SIMD string fast path for object deserialization
- Added a SIMD string-field deserializer for fast-path object deserialization.
- Updated transform codegen to emit mode-specific string field helpers and route generic array fields through the shared array-field helper.
- Relaxed fast-path `false` validation and fixed fast-path generation to respect `JSON_MODE=naive`.
