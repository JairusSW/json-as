# Project Walkthrough

This document is the practical, code-oriented counterpart to [ARCHITECTURE.md](./ARCHITECTURE.md). It explains how `json-as` is actually laid out, which files own which responsibilities, and how data moves from user code to generated methods to runtime serialization and deserialization.

## 1. Top-Level Package Shape

`json-as` is really two products shipped together:

- A compile-time AssemblyScript transform implemented in TypeScript under `transform/`
- An AssemblyScript runtime library under `assembly/`

At publish time, the important package entrypoints are:

- `index.ts`
  Re-exports `JSON` from the AssemblyScript runtime.
- `assembly/index.ts`
  The real runtime API and type dispatcher.
- `assembly/index.d.ts`
  Declares decorators like `@json`, `@alias`, `@omit`, `@serializer`, and compile-time globals like `JSON_MODE`.
- `transform/lib/index.js`
  The transform entrypoint used by `asc --transform json-as`.
- `transform/package.json`
  Points Node resolution for the transform package at `./lib/index.js`.

The result is that users write AssemblyScript like:

```ts
@json
class Player {
  name!: string;
}

const out = JSON.stringify<Player>(player);
const back = JSON.parse<Player>(out);
```

and the compiler transform injects generated methods into `Player` so the runtime can treat it like a first-class JSON type.

## 2. Runtime Entry Point

The runtime starts in [assembly/index.ts](/home/port/Code/AssemblyScript/json-as/assembly/index.ts).

That file owns three major responsibilities:

- Public API surface through the `JSON` namespace
- Top-level generic type dispatch for `JSON.stringify<T>` and `JSON.parse<T>`
- Runtime definitions for dynamic JSON types like `JSON.Value`, `JSON.Obj`, `JSON.Box`, and `JSON.Raw`

### `JSON.stringify<T>`

`JSON.stringify<T>` is a large type switch built from AssemblyScript type predicates and runtime `instanceof` checks.

It handles:

- Primitive booleans, integers, and floats directly
- `null` and nullable references
- Strings
- `Date`
- `Array`, `StaticArray`, `Set`, `Map`
- Typed arrays and `ArrayBuffer`
- `JSON.Raw`, `JSON.Value`, `JSON.Obj`, `JSON.Box`
- Any `@json` class that has transform-generated `__SERIALIZE` or `__SERIALIZE_CUSTOM`

The pattern is consistent:

- Pick the right serializer function
- Write bytes into the shared buffer namespace `bs`
- Return a string by calling `bs.out<string>()`

### `JSON.parse<T>`

`JSON.parse<T>` does the inverse:

- It computes the input pointer and byte size
- Dispatches primitives and strings directly
- Detects transform-generated `__DESERIALIZE` or `__DESERIALIZE_CUSTOM` on struct types
- Falls back to container, typed array, date, `JSON.Value`, `JSON.Obj`, `JSON.Raw`, and `JSON.Box` handlers

For `@json` classes, it allocates the destination object with `__new`, optionally runs `__INITIALIZE`, then calls the generated deserializer.

## 3. Buffer and Scratch Space

The serialization and some deserialization helpers depend on [lib/as-bs.ts](/home/port/Code/AssemblyScript/json-as/lib/as-bs.ts).

This file is the shared memory backbone of the runtime.

### `bs` namespace

`bs` owns:

- `buffer`
  An unmanaged backing allocation from `memory.heap`
- `offset`
  The current write cursor
- `stackSize`
  The projected required output size used for growth heuristics
- `typicalSize`
  An exponential moving average of recent output sizes

Core operations:

- `proposeSize(size)`
  Reserve enough space for an expected output size
- `growSize(size)`
  Reserve additional space during incremental writes
- `ensureSize(size)`
  Ensure a concrete upcoming write fits
- `cpyOut<T>()`
  Copy the current buffer slice into a new managed object
- `sliceOut<T>(start)`
  Copy a scratch slice then restore the cursor
- `toField(start, dstFieldPtr)`
  Copy a scratch slice into a pre-existing string field, reusing or renewing memory when possible
- `shrink()`
  Reduce retained capacity after large outputs

The main design choice here is reuse. The library avoids allocating a fresh intermediate buffer for every serialization call. Instead it keeps one reusable unmanaged buffer and copies only the final result into a managed string.

### Adaptive sizing

`bs` does not just double blindly forever. It keeps an exponential moving average of recent output sizes and periodically shrinks if the retained buffer is much larger than current usage. That is why repeated workloads stabilize memory use instead of permanently retaining the largest seen output.

### Saved state and scratch slices

Deserialization of strings sometimes borrows `bs` as scratch space. Functions like `sliceOut` and `toField` let the runtime decode into temporary bytes and then either materialize a string result or write back into an existing object field.

### `sc` namespace

String caching is optional and only active when `JSON_CACHE` is defined. The SWAR and SIMD string serializers check the cache before doing work and populate it afterward. This is an optimization for repeated serialization of the same string object.

## 4. Runtime Module Layout

The runtime is split by behavior first, then optimization mode.

### Dispatch layer

The `assembly/serialize/index/` and `assembly/deserialize/index/` directories are dispatch wrappers.

Examples:

- [assembly/serialize/index/string.ts](/home/port/Code/AssemblyScript/json-as/assembly/serialize/index/string.ts)
  Chooses `NAIVE`, `SWAR`, or `SIMD` string serialization based on `JSON_MODE`.
- [assembly/deserialize/index/array.ts](/home/port/Code/AssemblyScript/json-as/assembly/deserialize/index/array.ts)
  Chooses array parsing logic based on element type and, for integer arrays, optimization mode.
- [assembly/serialize/index/arbitrary.ts](/home/port/Code/AssemblyScript/json-as/assembly/serialize/index/arbitrary.ts)
  Serializes `JSON.Value` by switching on `JSON.Types`.

These files are intentionally thin. They keep mode selection and type routing out of the lower-level algorithms.

### Algorithm layer

The real implementations live in:

- `assembly/serialize/simple/`
- `assembly/serialize/swar/`
- `assembly/serialize/simd/`
- `assembly/deserialize/simple/`
- `assembly/deserialize/swar/`
- `assembly/deserialize/simd/`

The naming means:

- `simple`
  Straightforward scalar implementations
- `swar`
  Packed integer bit tricks over 64-bit loads
- `simd`
  WebAssembly SIMD implementations over `v128`

## 5. String Serialization and Deserialization

String handling is the clearest place to understand the optimization strategy.

### Scalar string serialization

[assembly/serialize/simple/string.ts](/home/port/Code/AssemblyScript/json-as/assembly/serialize/simple/string.ts) is the baseline implementation.

It:

- Writes the opening quote
- Scans UTF-16 code units one by one
- Copies contiguous safe spans directly
- Escapes `"` and `\`
- Escapes control characters using `SERIALIZE_ESCAPE_TABLE`
- Rewrites unpaired surrogates as `\uXXXX`
- Writes the closing quote

This file is also the easiest reference for intended correctness.

### SWAR string serialization

[assembly/serialize/swar/string.ts](/home/port/Code/AssemblyScript/json-as/assembly/serialize/swar/string.ts) processes 8 bytes at a time with `u64` loads.

Its key ideas:

- Copy a whole `u64` block into the output optimistically
- Compute a mask of lanes that need escaping with `detect_escapable_u64_swar_safe`
- Patch only the lanes that actually need special handling
- Fall back to scalar logic for the tail

This is why the file looks unusual: it is not building the output sequentially byte by byte. It writes a speculative copy first, then adjusts the buffer cursor when an escape expands the output.

### SIMD string serialization

[assembly/serialize/simd/string.ts](/home/port/Code/AssemblyScript/json-as/assembly/serialize/simd/string.ts) uses `v128` loads and lane comparisons against:

- `"` (`0x22`)
- `\` (`0x5c`)
- control characters `< 0x20`
- surrogate-range candidates

The structure mirrors the SWAR version but over 16-byte chunks. It is the highest-throughput path when the program is compiled with `--enable simd`.

### String deserialization

There are three matching implementations:

- [assembly/deserialize/simple/string.ts](/home/port/Code/AssemblyScript/json-as/assembly/deserialize/simple/string.ts)
- [assembly/deserialize/swar/string.ts](/home/port/Code/AssemblyScript/json-as/assembly/deserialize/swar/string.ts)
- [assembly/deserialize/simd/string.ts](/home/port/Code/AssemblyScript/json-as/assembly/deserialize/simd/string.ts)

The shared pattern is:

- Strip the surrounding quotes
- Fast-path raw strings with no backslashes
- Only allocate scratch space once an escape is encountered
- Decode short escapes through `DESERIALIZE_ESCAPE_TABLE`
- Decode `\uXXXX` through `hex4_to_u16_swar`

The field-oriented helpers are important. The runtime does not always create a new string. For generated struct fields it often reuses or renews the destination field storage in place.

## 6. Struct and Object Parsing

There are two distinct object stories in this codebase.

### Generated struct parsing

[assembly/deserialize/simple/struct.ts](/home/port/Code/AssemblyScript/json-as/assembly/deserialize/simple/struct.ts) is the generic scanner for `@json` classes.

It does not know the schema itself. Instead, it:

- Verifies outer braces
- Scans for keys and value boundaries
- Tracks nested object and array depth
- Skips over quoted strings safely with `scanStringEnd`
- Calls the generated `out.__DESERIALIZE(...)` with pointers for:
  - key start/end
  - value start/end
  - destination object pointer

That generated method is where field matching happens.

This separation is one of the main architectural decisions in the repo:

- The runtime scanner understands JSON structure
- The transform-generated method understands the target schema

### Dynamic object parsing

[assembly/deserialize/simple/object.ts](/home/port/Code/AssemblyScript/json-as/assembly/deserialize/simple/object.ts) performs a similar scan for `JSON.Obj`, but instead of delegating to generated code it builds a dynamic map of keys to `JSON.Value`.

It eagerly decides whether a value is:

- string
- number
- object
- array
- boolean
- null

and stores it into `JSON.Obj`.

### Dynamic values

`JSON.Value` in [assembly/index.ts](/home/port/Code/AssemblyScript/json-as/assembly/index.ts) is the dynamic tagged union for arbitrary JSON. Its `type` field stores a `JSON.Types` discriminator and `storage` holds either the primitive value bits or a pointer.

For custom structs, `JSON.Value` stores `idof<T>() + JSON.Types.Struct` and uses `JSON.Value.METHODS` for indirect serialization of those dynamic struct values.

## 7. Arrays, Maps, Sets, Typed Arrays, and Numbers

The rest of the runtime follows the same pattern: a generic type router plus specialized implementations.

### Arrays

- [assembly/deserialize/index/array.ts](/home/port/Code/AssemblyScript/json-as/assembly/deserialize/index/array.ts)
- [assembly/deserialize/simple/array.ts](/home/port/Code/AssemblyScript/json-as/assembly/deserialize/simple/array.ts)

These dispatch based on `valueof<T>` and hand off to specialized parsers for string arrays, integer arrays, float arrays, nested arrays, struct arrays, `JSON.Value[]`, and so on.

### Typed arrays and `ArrayBuffer`

- [assembly/serialize/index/typedarray.ts](/home/port/Code/AssemblyScript/json-as/assembly/serialize/index/typedarray.ts)
- [assembly/deserialize/index/typedarray.ts](/home/port/Code/AssemblyScript/json-as/assembly/deserialize/index/typedarray.ts)

Serialization of typed arrays is runtime-typed. The code inspects the runtime id and picks the concrete typed-array serializer.

### Numbers

Low-level number helpers live in:

- [assembly/deserialize/integer.ts](/home/port/Code/AssemblyScript/json-as/assembly/deserialize/integer.ts)
- [assembly/deserialize/unsigned.ts](/home/port/Code/AssemblyScript/json-as/assembly/deserialize/unsigned.ts)
- [assembly/deserialize/float.ts](/home/port/Code/AssemblyScript/json-as/assembly/deserialize/float.ts)
- [assembly/util/atoi.ts](/home/port/Code/AssemblyScript/json-as/assembly/util/atoi.ts)
- [assembly/custom/util.ts](/home/port/Code/AssemblyScript/json-as/assembly/custom/util.ts)
- [assembly/util/snp.ts](/home/port/Code/AssemblyScript/json-as/assembly/util/snp.ts)

The repo contains multiple integer and scientific-notation parsing helpers. Some are hot-path runtime dependencies, and some are retained as lower-level experimental or supporting utilities.

### Tables and constants

[assembly/globals/tables.ts](/home/port/Code/AssemblyScript/json-as/assembly/globals/tables.ts) centralizes precomputed data for:

- escape sequence encoding
- escape sequence decoding
- hex decoding
- powers of ten

[assembly/custom/chars.ts](/home/port/Code/AssemblyScript/json-as/assembly/custom/chars.ts) centralizes numeric constants for JSON punctuation and common literal words, including packed `u64` constants used for fast literal comparisons like `true`, `false`, and `null`.

## 8. The Compile-Time Transform

The second half of the project lives under `transform/`.

### Transform entrypoint

[transform/src/index.ts](/home/port/Code/AssemblyScript/json-as/transform/src/index.ts) is the core of the compiler plugin.

It is responsible for:

- Discovering classes decorated with `@json` or `@serializable`
- Resolving inherited fields
- Resolving type aliases and imported types
- Building a `Schema` object for each decorated class
- Detecting decorators like `@alias`, `@omitnull`, `@omitif`
- Detecting custom `@serializer` and `@deserializer` methods
- Emitting generated methods such as:
  - `__SERIALIZE`
  - `__DESERIALIZE_SLOW`
  - `__DESERIALIZE_FAST`
  - `__DESERIALIZE_CUSTOM`
  - `__INITIALIZE`

The transform decides whether it can emit the fast struct deserializer using:

- current optimization mode
- whether `JSON_USE_FAST_PATH=1`
- whether the schema is static enough to support fast-path assumptions

### Transform type model

[transform/src/types.ts](/home/port/Code/AssemblyScript/json-as/transform/src/types.ts) defines the internal model the transform reasons over.

Important types:

- `Property`
  One field in a schema, including aliasing and omit flags
- `Schema`
  One decorated class, its members, dependencies, parent schema, and custom behavior flags
- `Src`
  A per-source-file index of classes, enums, imports, aliases, and namespace-qualified names
- `SourceSet`
  A cache of `Src` wrappers for AssemblyScript `Source` objects

`Schema.getMinLength()` is especially relevant to fast-path code generation. It estimates the minimum possible serialized size of a struct and helps the transform decide how aggressive it can be.

### AST infrastructure

Three files support the transform:

- [transform/src/visitor.ts](/home/port/Code/AssemblyScript/json-as/transform/src/visitor.ts)
  A generic AST visitor over AssemblyScript node kinds
- [transform/src/builder.ts](/home/port/Code/AssemblyScript/json-as/transform/src/builder.ts)
  Reconstructs text from AST nodes
- [transform/src/util.ts](/home/port/Code/AssemblyScript/json-as/transform/src/util.ts)
  Parsing helpers, source manipulation helpers, stdlib detection, and cloning utilities

These files are infrastructure. They are not JSON-specific by themselves, but the transform depends on them heavily.

### Linkers

`transform/src/linkers/` contains smaller focused helpers:

- `alias.ts`
  Tracks and resolves type aliases
- `imports.ts`
  Collects import statements
- `custom.ts`
  Rewrites `JSON.stringify` / `JSON.parse` calls inside custom serializer and deserializer methods so they use the internal namespace safely during generated execution

That custom-call rewriting is important because custom serializer code may itself invoke JSON operations.

## 9. How Generated Structs Integrate with the Runtime

The contract between the transform and runtime is simple and strict.

For any supported decorated class, the transform injects methods that the runtime already knows how to probe for:

- `__SERIALIZE`
- `__SERIALIZE_CUSTOM`
- `__DESERIALIZE`
- `__DESERIALIZE_CUSTOM`
- `__INITIALIZE`

At runtime:

- `JSON.stringify<T>` checks whether a value exposes generated serialization hooks
- `JSON.parse<T>` checks whether the type exposes generated deserialization hooks
- generic struct scanners pass raw key/value pointer spans into generated struct code

This means the runtime never needs a reflective schema table. The schema is compiled into each type as direct code.

## 10. Public API Surface in Practice

The important user-facing runtime types all live in [assembly/index.ts](/home/port/Code/AssemblyScript/json-as/assembly/index.ts).

- `JSON.Raw`
  Wraps already-serialized JSON text so it is inserted verbatim
- `JSON.Box<T>`
  Allows nullable primitive-like values in AssemblyScript code that would otherwise be illegal
- `JSON.Obj`
  Dynamic object keyed by strings and storing `JSON.Value`
- `JSON.Value`
  Dynamic tagged JSON value container
- `JSON.Memory.shrink()`
  Public hook to release oversized retained buffer memory after large payloads

These types are what make the runtime useful even outside fully static `@json` schemas.

## 11. Tests

The core test surface lives in `assembly/__tests__/`.

The suite is organized by behavior:

- primitives: `bool`, `integer`, `float`, `null`, `string`
- containers: `array`, `staticarray`, `typedarray`, `set`, `map`
- dynamic/runtime features: `arbitrary`, `raw`, `json-runtime`, `containers-runtime`
- transform features: `decorators`, `custom`, `namespace`, `hierarchy`, `generics`, `resolving`, `override`
- robustness and coverage sweeps: `roundtrip-matrix`, `tiny-payloads`, `whitespace`, `swar`

[as-test.config.json](/home/port/Code/AssemblyScript/json-as/as-test.config.json) is critical because it runs the same suite in three modes:

- `naive`
- `swar`
- `simd`

with `simd` additionally compiling with `--enable simd`.

In the current checked worktree, `npm test` passes:

- 30 spec files
- 7,251 tests
- 3 modes

That broad matrix is the main evidence that the optimization variants are intended to behave identically.

## 12. Benchmarks and Performance Tooling

The benchmark system is separate from the test suite.

### JavaScript-side harness

Under `bench/`:

- [bench/lib/bench.js](/home/port/Code/AssemblyScript/json-as/bench/lib/bench.js)
  Runs benchmark loops and records result metadata
- [bench/lib/chart.ts](/home/port/Code/AssemblyScript/json-as/bench/lib/chart.ts)
  Builds grouped SVG charts from benchmark logs
- [bench/*.bench.ts](/home/port/Code/AssemblyScript/json-as/bench/)
  Payload-specific benchmark definitions

### AssemblyScript runner

[bench/runners/assemblyscript.js](/home/port/Code/AssemblyScript/json-as/bench/runners/assemblyscript.js) loads compiled WebAssembly benchmark modules, wires up host imports, and starts execution.

### Shell helpers

- `scripts/run-bench.as.sh`
- `scripts/run-bench.js.sh`
- `scripts/build-charts.sh`
- `scripts/publish-benchmarks.sh`

The main developer entrypoints for those flows are exposed through `package.json` scripts:

- `npm run bench`
- `npm run bench:as`
- `npm run bench:js`
- `npm run build:charts`
- `npm run bench:publish`

These scripts drive the full benchmark workflow and chart publication.

## 13. Supporting and Developer-Oriented Files

- `assembly/test.ts`
  A local manual example for compiling transformed AssemblyScript directly.
- `test.ts`
  A plain TypeScript example payload at the repo root.
- `tools/`
  Local ESLint and formatting helpers.
- `scripts/`
  Chart-building helpers used by the benchmark publication workflow.
- `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `LICENSE`
  Standard project metadata and maintenance docs.

## 14. Current State Notes

This walkthrough matches the current local repository state inspected on 2026-03-30.

At inspection time the git worktree was dirty in a few files, including:

- `assembly/test.ts`
- `assembly/__tests__/whitespace.spec.ts`
- `package.json`
- `transform/src/index.ts`
- generated transform outputs under `transform/lib/`

That matters because this document describes the present code in the workspace, not a claim about any specific upstream commit.

## 15. Working Mental Model

If you need one compact mental model for the whole project, use this:

1. User code marks classes with `@json`.
2. The transform turns those classes into schema-specific encoder and decoder methods.
3. The runtime provides shared buffer management, generic scanners, dynamic JSON types, and optimized primitive/container/string algorithms.
4. `JSON_MODE` picks the low-level implementation strategy.
5. Tests verify that all three optimization modes preserve the same semantics.

That is the core design of `json-as`: compile type knowledge into direct methods, then run those methods on a heavily optimized runtime.
