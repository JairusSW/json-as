# Fast-Path Deserialization

`JSON_USE_FAST_PATH=1` enables a generated direct `__DESERIALIZE` implementation for eligible `@json` / `@serializable` classes.

This path is currently intended for the canonical minified object layout emitted by `json-as` itself. It is not a general-purpose replacement for the slow object parser.

## Requirements

- `JSON_USE_FAST_PATH=1`
- `JSON_MODE=SWAR` or `JSON_MODE=SIMD`
- A fast-path-eligible generated schema

Fast-path-eligible schema means:

- no `@omitif`
- no custom class-level `@deserializer`

`@omitnull` is supported when the schema still follows canonical generated key order and only relies on omitnull-style optional fields.

## Currently Supported

Fast-path deserialization currently supports these generated struct field categories:

- integers: `u8`, `u16`, `u32`, `u64`, `i8`, `i16`, `i32`, `i64`
- floats: `f32`, `f64`
- booleans: `bool`, `boolean`
- strings: `string`, `String`, and nullable string fields
- nested generated structs, including nullable nested structs
- `Array<string>`
- `Array<@json class>`
- other `Array<T>` fields through the array-field helpers

The generated fast object parser also has a generic slice-and-delegate fallback. The dedicated suite currently verifies that path for:

- `Map<K, V>`
- `Set<T>`
- `StaticArray<T>`
- `JSON.Value`
- `JSON.Obj`
- `JSON.Box<T>`
- `JSON.Raw`

The dedicated suite also verifies fast-path deserialization for `@omitnull` schemas with canonical generated ordering.

## Current Limitations

These are the main gaps or constraints today:

- only generated struct deserialization uses the fast path
- `JSON_MODE=NAIVE` does not emit it
- dynamic schemas fall back to the slow generated object parser
- the direct parser expects the exact generated key order
- the direct parser expects minified object syntax with no whitespace around keys, separators, or braces
- extra keys are not accepted by the direct parser
- missing keys are not accepted by the direct parser
- direct specialized field support does not yet exist for:
  - `Date`
  - enums
  - `StaticArray<T>`
  - `Map<K, V>`
  - `Set<T>`
  - `JSON.Value`
  - `JSON.Obj`
  - `JSON.Box<T>`
  - custom field types
  - many non-string array element types

- generated struct deserialization does not currently handle `Date` or enum fields reliably enough to treat them as fast-path-supported

## Dedicated Test Suite

Run the dedicated fast-path deserialization suite with:

```bash
npm run test:fast-path
```

That suite runs with:

- `JSON_USE_FAST_PATH=1`
- `JSON_MODE=SWAR,SIMD`
- a dedicated config file: `as-test.fast-path.config.json`

and focuses on canonical fast-path object inputs only.
