# Change Log

## 2025-05-23 - 1.1.3

- feat: group properties of structs before code generation
- fix: break out of switch case after completion
- ci: make compatible with act for local testing

## 2025-05-22 - 1.1.2

- fix: correct small typos in string value deserialization port

## 2025-05-22 - 1.1.1

- fix: remove random logs

## 2025-05-22 - 1.1.0

- fix: change _DESERIALIZE<T> to _JSON_T to avoid populating local scope

## 2025-05-22 - 1.0.9

- fix: [#132](https://github.com/JairusSW/json-as/issues/132)
- feat: allow base classes to use their child classes if the signatures match
- perf: rewrite struct deserialization to be significantly faster
- fix: [#131](https://github.com/JairusSW/json-as/issues/131) Generic classes with custom deserializer crashing
- fix: [#66](https://github.com/JairusSW/json-as/issues/66) Throw error when additional keys are in JSON

## 2025-05-21 - 1.0.8

- fix: inline warnings on layer-2 serialize and deserialize functions
- feat: fully support `JSON.Obj` and `JSON.Box` everywhere
- fix: temp disable SIMD
- feat: write fair benchmarks with `v8` using `jsvu`

## 2025-05-14 - 1.0.7

- merge: pull request [#128](https://github.com/JairusSW/json-as/pull/128) from [loredanacirstea/nested-custom-serializer-fix](https://github.com/loredanacirstea/nested-custom-serializer-fix)

## 2025-05-12 - 1.0.6

- fix: support zero-param serialization and make sure types are consistent
- fix: [#124](https://github.com/JairusSW/json-as/issues/124)

## 2025-05-11 - 1.0.5

- feat: add sanity checks for badly formatted strings
- fix: [#120](https://github.com/JairusSW/json-as/issues/120) handle empty `JSON.Obj` serialization
- feat: add SIMD optimization if SIMD is enabled by user
- fix: handle structs with nullable array as property [#123](https://github.com/JairusSW/json-as/pull/123)
- fix: struct serialization from writing to incorrect parts of memory when parsing nested structs [#125](https://github.com/JairusSW/json-as/pull/125)
- chore: add two new contributors

## 2025-04-07 - 1.0.4

- fix: paths must be resolved as POSIX in order to be valid TypeScript imports [#116](https://github.com/JairusSW/json-as/issues/116)

## 2025-03-24 - 1.0.3

- fix: make transform windows-compatible [#119](https://github.com/JairusSW/json-as/issues/119?reload=1)

## 2025-03-19 - 1.0.2

- fix: include check for nullable types for properties when deserialization is called internally [#118](https://github.com/JairusSW/json-as/pull/118)

## 2025-03-10 - 1.0.1

- docs: add comprehensive performance metrics

## 2025-03-09 - 1.0.0

- fix: relative paths pointing through node_modules would create a second Source
- feat: move behavior of `--lib` into transform itself
- fix: object with an object as a value containing a rhs bracket or brace would exit early [3b33e94](https://github.com/JairusSW/json-as/commit/3b33e9414dc04779d22d65272863372fcd7af4a6)

## 2025-03-04 - 1.0.0-beta.17

- fix: forgot to build transform

## 2025-03-04 - 1.0.0-beta.16

- fix: isPrimitive should only trigger on actual primitives

## 2025-03-04 - 1.0.0-beta.15

- fix: deserialize custom should take in string

## 2025-03-04 - 1.0.0-beta.14

- fix: reference to nonexistent variable during custom deserialization layer 2

## 2025-03-04 - 1.0.0-beta.13

- fix: forgot to actually build the transform

## 2025-03-04 - 1.0.0-beta.12

- fix: build transform

## 2025-03-04 - 1.0.0-beta.11

- fix: wrongly assumed pointer types within arbitrary deserialization
- fix: wrong pointer type being passed during map deserialization

## 2025-03-04 - 1.0.0-beta.10

- fix: transform not generating the right load operations for keys
- fix: whitespace not working in objects or struct deserialization
- fix: JSON.Raw not working when deserializing as Map<string, JSON.Raw>

## 2025-03-03 - 1.0.0-beta.9

- rename: change libs folder to lib

## 2025-03-03 - 1.0.0-beta.8

- docs: add instructions for using `--lib` in README

## 2025-03-03 - 1.0.0-beta.7

- fix: add as-bs to `--lib` section
- chore: clean up transform
- refactor: transform should import `~lib/as-bs.ts` instead of relative path

## 2025-03-01 - 1.0.0-beta.6

- fix: import from base directory index.ts

## 2025-03-01 - 1.0.0-beta.5

- fix: revert pull request [#112](https://github.com/JairusSW/json-as/pull/112)

## 2025-02-25 - 1.0.0-beta.4

- fix: warn on presence of invalid types contained in a schema [#112](https://github.com/JairusSW/json-as/pull/112)

## 2025-02-25 - 1.0.0-beta.3

- feat: change `JSON.Raw` to actual class to facilitate proper support without transformations
- fix: remove old `JSON.Raw` logic from transform code

## 2025-02-25 - 1.0.0-beta.2

- feat: add support for custom serializers and deserializers [#110](https://github.com/JairusSW/json-as/pull/110)

## 2025-02-22 - 1.0.0-beta.1

- perf: add benchmarks for both AssemblyScript and JavaScript
- docs: publish preliminary benchmark results
- tests: ensure nested serialization works and add to tests
- feat: finish arbitrary type implementation
- feat: introduce `JSON.Obj` to handle objects effectively
- feat: reimplement arbitrary array deserialization
- fix: remove brace check on array deserialization
- feat: introduce native support for `JSON.Obj` transformations
- feat: implement arbitrary object serialization
- fix: deserialization of booleans panics on `false`
- fix: `bs.resize` should be type-safe
- impl: add `JSON.Obj` type as prototype to handle arbitrary object structures
- chore: rename static objects (schemas) to structs and name arbitrary objects as `obj`
- tests: add proper tests for arbitrary types
- fix: empty method generation using outdated function signature
- docs: update readme to be more concise

## 2025-02-13 - 1.0.0-alpha.4

- feat: reintroduce support for `Box<T>`-wrapped primitive types
- tests: add extensive tests to all supported types
- fix: 6-byte keys being recognized on deserialize
- perf: take advantage of aligned memory to use a single 64-bit load on 6-byte keys
- fix: `bs.proposeSize()` should increment `stackSize` by `size` instead of setting it
- fix: allow runtime to manage `bs.buffer`
- fix: memory leaks in `bs` module
- fix: add (possibly temporary) `JSON.Memory.shrink()` to shrink memory in `bs`
- perf: prefer growing memory by `nextPowerOf2(size + 64)` for less reallocations
- tests: add boolean tests to `Box<T>`
- fix: serialization of non-growable data types should grow `bs.stackSize`

## 2025-01-31 - 1.0.0-alpha.3

- fix: write to proper offset when deserializing string with \u0000-type escapes
- fix: simplify and fix memory offset issues with bs module
- fix: properly predict minimum size of to-be-serialized schemas
- fix: replace as-test with temporary framework to mitigate json-as versioning issues
- fix: fix multiple memory leaks during serialization
- feat: align memory allocations for better performance
- feat: achieve a space complexity of O(n) for serialization operations, unless dealing with \u0000-type escapes

## 2025-01-20 - 1.0.0-alpha.2

- fix: disable SIMD in generated transform code by default
- fix: re-add as-bs dependency so that it will not break in non-local environments
- fix: remove AS201 'conversion from type usize to i32' warning
- fix: add as-bs to peer dependencies so only one version is installed
- fix: point as-bs imports to submodule
- fix: remove submodule in favor of static module
- fix: bs.ensureSize would not grow and thus cause memory faults
- fix: bs.ensureSize triggering unintentionally

## 2025-01-20 - 1.0.0-alpha.1

- feat: finish implementation of arbitrary data serialization and deserialization using JSON.Value
- feat: reinstate usage of `JSON.Box<T>()` to support nullable primitive types
- feat: eliminate the need to import the `JSON` namespace when defining a schema
- feat: reduce memory usage so that it is viable for low-memory environments
- feat: write to a central buffer and reduce memory overhead
- feat: rewrite the transform to properly resolve schemas and link them together
- feat: pre-allocate and compute the minimum size of a schema to avoid memory out of range errors
