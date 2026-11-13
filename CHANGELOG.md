# Changelog

## Unreleased

- Keep parsing eager inside generic scopes where type parameters could shadow model declarations, and bound helper expansion during access analysis to avoid excessive compilation work.

- Preserve parsed values used through assignment expressions, respect hoisted `var` shadowing during access analysis, and validate preserved numeric and Boolean aliases against their actual target types in strict parsing.

- Preserve call argument evaluation order and conservatively handle rest parameters in access analysis. Bound control-flow path growth and fall back to eager parsing when the limit is reached. Correct signed and unsigned narrow values eagerly decoded into packed lazy slots.

- Keep access-based parsing eager when values can cross conditional assignments, loop iterations, module or namespace boundaries, function-scoped `var` bindings, or omitted helper arguments. Track template and `void` expression reads. Restore lazy startup sentinels and the affected runtime decorators.

- Specialize ordinary `@json` readers at visible parse sites by default. Proven-unused supported fields are scanned without decoding; full reads and uncertain or escaping uses retain eager behavior. Set `JSON_ACCESS_SPECIALIZATION=false` to disable this optimization.

- Parse array-typed fields eagerly, including `JSON.Arr` fields using lazy markers or class-wide lazy modes. Dynamic `JSON.Arr` retains its existing deferred-element behavior.

- Add opt-in `@json({ lazy: "strategic" })` parse-site specialization. Analyze guaranteed and conditionally weighted field reads, compare estimated eager/lazy costs, and generate compile-time reader plans without allocating strategy objects. Preserve ordinary explicit-lazy timing unless `JSON_STRATEGIC_LAZINESS=true` is enabled.

- Keep generated fast readers enabled for lazy fields with pure defaults. Analyze the original field initializer and resolved native defaults instead of generated storage expressions; retain non-speculative parsing for application constructors and effectful defaults.

## 2026-11-09 - v2.0.0

This release includes all changes since v1.6.3. The planned v1.7.0 release was never published; its changes are included in v2.0.0 below.

### Upgrading from 1.x

- License project code under MPL-2.0, with SPDX notices in source and generated transform files. Preserve third-party licenses and attribution.

- Reused parse destinations restore omitted fields to their declared defaults. Present members can still reuse their existing buffers; do not rely on a previous document's omitted values being retained.
- Undecorated built-in subclasses use native JSON storage operations consistently. Overrides of Array indexing/push, Map/Set enumeration and mutation, or Date setters do not redefine their built-in JSON representation. Use custom codecs when a subtype needs a different wire format.
- Dynamic composite assignment preserves sharing consistently, including previously deferred values. Nullable dynamic-array elements remain actual null references.

### Parsing and validation

- Recognize unshadowed standard-library numeric constants in field defaults at compile time, retaining generated fast readers without treating application getters as pure.

- Use native array storage when parsing subclasses with overridden length accessors, preserving fresh/reused contents, constructor state, growth, and managed-reference barriers across backends.
- Clear deferred object slots when the allocator does not guarantee zeroed memory, including minimal-runtime array and Map parsing after collection.
- Reject incompatible field-value kinds consistently in strict parsing with fresh and reused destinations, including object values supplied to scalar fields.
- Add opt-in `JSON_DIAGNOSTICS=false` builds that trap on library and generated-reader failures while preserving checks and application errors. Detailed diagnostics remain enabled by default.
- Correct decimal-power tables and exponent parsing, validate packed narrow-array digit lanes and delimiters, and require complete string quote framing. Preserve legacy empty-run behavior in low-level integer scan helpers.
- Propagate recursive reader failures to checked parse boundaries, including zero-returning Map and array child readers.
- Bound vector string suffix copies and array delimiter/fraction probes at source ends.
- Preserve null elements in generated object-array fields, including mixed arrays and reused slots transitioning between objects and null.
- Add `JSON.validate(data)` for complete JSON syntax validation without materializing values, independent of the `JSON_STRICT` setting.
- Fuse strict validation with generated checked-cursor parsing for supported fresh objects and containers. Preserve document prevalidation for reused destinations and custom deserializers, so malformed syntax is rejected before either is modified or invoked. `JSON_STRICT=true` remains opt-in; the default compatibility mode is unchanged.
- Continue checked object parsing after reordered keys instead of restarting from the beginning, preserving aliases, duplicate-key handling, defaults, and lazy source ranges. Improve expected-order key dispatch and checked string, whitespace, and discarded-value scanning.
- Reject malformed complete numeric, boolean, string, array, and map tokens consistently across NAIVE, SWAR, and SIMD paths. Fix fractional/exponent input for integer targets, trailing documents, trailing commas, invalid escapes, and incomplete tokens; accept valid trailing whitespace after integers and nullable `null` ([#229](https://github.com/JairusSW/json-as/pull/229), [#234](https://github.com/JairusSW/json-as/pull/234)).
- Make decimal-to-float conversion consistent across roots, fields, arrays, and reused destinations, including long mantissas, cancelling exponents, subnormals, overflow, and signed zero. Resolve decimal-to-`f32` midpoint ties directly rather than double-rounding through `f64`.
- Preserve `number`, `usize`, `isize`, enum, and aliased scalar values in generated readers and writers. Disable exact-default shortcuts for constructor-dependent or value-changing cast initializers, so whitespace and fast-path selection cannot substitute a different default for supplied JSON.
- Preserve the fast path for schemas exceeding 32 fields by retaining successful inner-loop exits when generated parsers are split into helpers. Extend bounded, collision-safe packed-key dispatch to wide objects ([#238](https://github.com/JairusSW/json-as/pull/238)).

### Types, inheritance, and decorators

- Classify generated schema fields by their resolved declaration before applying native container rules. Preserve object parsing and serialization for user classes named `Uint8Array` or `Array<T>`, including custom writers, while keeping native array fast paths unchanged.
- Preserve native-reference aliases when expanding them would bind to a different declaration in the consumer, including native Date aliases alongside user-defined Date models.
- Distinguish user schemas named `Date` from the native Date type in nested readers. Reset inferred backend selection for each programmatic compiler invocation, so SIMD and fallback builds can share one Node process.
- Restrict standard-library exclusions to their actual library paths, so application files named `security.ts`, `memory.ts`, or under `util/` still receive generated codecs.
- Resolve aliases using declaration identity and lexical context. Preserve caller bindings for supplied generic arguments, keep class type parameters bound, apply default generic arguments, and accept finite nested uses of the same alias while retaining definition-cycle protection. Fix `f32` fields being serialized as integer bit patterns after alias expansion.
- Follow renamed imports, namespace imports, named and wildcard re-exports, and barrel modules when resolving classes, enums, custom codecs, and lazy markers. Preserve consumer exports and canonical runtime imports across relative, virtual, pnpm, workspace, linked, and package-entry layouts ([#246](https://github.com/JairusSW/json-as/pull/246)).
- Preserve private implementation types behind public aliases, including arrays, enums, generic classes, and lazy aliases. Generate legal type bindings for inherited fields across modules and namespace scopes instead of reinterpreting their names in the child context. Keep chained aliases classified by their resolved declarations even when renamed imports share an implementation name.
- Merge inherited metadata across decorated and undecorated classes, including generic bases and undecorated intermediates. Track ancestor declarations rather than repeated local import names, preserve inherited scalar types, and keep overridden fields from appearing twice.
- Apply shadowing before filtering wire fields: an overriding `@omit` still suppresses the ancestor's field. Preserve empty `@alias("")` keys and correctly escape unusual keys and generated comments. Emit slow-reader resets directly at successful return sites so alias text cannot alter generated control flow.
- Separate object initialization from JSON field participation. Preserve omitted, private, and protected defaults through the full ancestry, including undecorated bases, in compatibility and checked-cursor parsing; retain declaration order and declaring-module bindings. Reinitialize reused Map values for each parse without evaluating fresh defaults twice. Restore omitted fields to their declared defaults on reused roots and nested children, including cached lazy values, while retaining buffers for present fields.
- Propagate initializer effects through the full inheritance chain. Prevent speculative fallback from replaying observable function calls, constructors, getters, overloaded indexing, binary operators, or unary operators.
- Build inherited omission helpers from untouched declaration decorators, preserving generic parameters across child specializations, declaration orders, and intermediate generic bases.
- Evaluate inherited omission predicates in their declaring scope. Support named predicates, zero-parameter arrows, combined omission conditions, and quoted string expressions; preserve outer serialization state when a predicate performs nested JSON operations.
- Allocate generated runtime imports and lazy backing fields without colliding with application declarations, inherited members, renamed `JSON` imports, or namespace-local helpers. Rebind generated runtime references in initialization, omission, and backing-field expressions while preserving copied user expressions.

### Lazy fields and custom codecs

- Apply lazy-over-lazy inheritance shadowing by the original property identity, preserving overriding defaults, parsed values, and changed wire aliases across undecorated intermediates.
- Preserve lazy aliases, omission/optional metadata, defaults, scalar classification, nullability, source anchors, and materialized values through dependency revisits and generic inheritance. Propagate lazy source ownership through undecorated intermediate classes. Handle eager/lazy override combinations and distinguish the library's `JSON.Lazy` marker from unrelated classes named `Lazy`.
- Resolve lazy markers through the same scope-aware alias machinery as ordinary types, preserving namespace arguments and class type parameters instead of capturing unrelated outer aliases.
- Use the same type-aware implicit-default construction for `@lazy`, `JSON.Lazy<T>`, and class-level lazy modes. Support Date, Raw, Box, typed-array, and dynamic-value defaults and preserve requested Date/Raw subclass identity.
- Dispatch generic fields through the full typed reader, including custom number, string, boolean, null, array, and object representations and built-ins such as Date and Set. Preserve actual null references in nullable Raw/Value fields and nested containers.
- Give custom/generated codecs precedence over inherited built-in representations in arrays, StaticArrays, Maps, and dynamic boxing, including decorated Raw and Box subclasses ([#232](https://github.com/JairusSW/json-as/pull/232)).
- Track custom-reader, custom-writer, and generated fast-reader capabilities separately. Nested generic fields, arrays, and pretty readers call only methods their element types provide. Initialize newly allocated generic children before slow-reader fallback so omitted defaults survive. Serializer-only classes keep their generated object readers.
- Invoke inherited custom deserializers through a valid receiver. Track effectful codec dependencies through nested containers so layout fallback cannot execute callbacks twice.
- Validate codec signatures by resolved type identity, accepting qualified self types, local/imported/generic aliases, forwarded aliases, composed return types, and the equivalent native `String` spelling. Preserve `JSON.parse(data, out)` when calls inside custom serializers are redirected through the internal API.
- Preserve custom array instances when retrieving Struct-tagged values through `get`, `as`, and dynamic-container typed getters, including classes with required constructor arguments.

### Reuse, collections, and dynamic values

- Claim typed-array backing allocations as well as wrappers before reuse, preventing distinct or overlapping views and ArrayBuffer/view defaults from overwriting earlier fields.
- Share numeric-to-boolean normalization between dynamic getters and `Box.fromValue`/`asBox`, including nonzero integers whose low byte is zero.
- Allocate writable output when a supplied stringify destination is a static literal, including scalar and internal stringify paths. Keep shared boolean/null literals unchanged.
- Preserve shallow reference sharing in dynamic-array `slice`, `concat`, `copyWithin`, and `splice`, regardless of whether a deferred child was read before copying.
- Clear constructor-seeded Map entries through native size accessors when parsing Array and StaticArray elements, bypassing overridden public size getters.
- Track composite ownership across each public parse so shared child objects, Maps, native arrays, StaticArrays, nested rows/planes, and Raw wrappers cannot overwrite another logical destination. Retain normal repeated-key behavior and avoid allocating ownership bookkeeping on unrelated scalar parses.
- Preserve supported container subtype identity and construction across fresh/reused parsing, fields, nested containers, and dynamic typed getters. Cover Array, Map, Set, typed-array, Date, Raw, and Box subclasses; replace constructor-seeded collection contents with the supplied JSON. Preserve typed-array element kind, signedness, length, and subviews through dynamic boxing.
- Construct omitted generic defaults through the shared type-aware factory, preserving Date calendar fields, typed-array buffers, and collection subclass initializers. Pass the actual parsed element count to typed-array subclass constructors instead of an input-length capacity estimate.
- Fill native array storage consistently across backends, bypassing overridden `push` and index setters for both existing and appended slots, including dynamic typed getters. Read native elements once during dynamic conversion, preserving wire values regardless of destination capacity or overloaded accessors.
- Use native collection operations consistently inside parsing and serialization, bypassing Map/Set enumeration, lookup, and mutation overrides while retaining callback-mutation snapshots. Normalize nullable string Map keys to the JSON key `"null"`.
- Insert parsed Map entries consistently without invoking overridden `set` methods, including escaped keys and reused outputs. Keep `JSON.Obj.from(MapSubclass)` consistent with direct serialization instead of invoking overridden key/value enumeration.
- Make reused Date parsing update base Date state without invoking an overridden `setTime`, preserving the decoded timestamp, output identity, and constructor count.
- Add missing ArrayBuffer array/container dispatch and align StaticArray element dispatch with ordinary arrays. Preserve nested-array token boundaries and nullable string, Raw, Value, struct, and float-row behavior ([#228](https://github.com/JairusSW/json-as/pull/228), [#237](https://github.com/JairusSW/json-as/pull/237), [#243](https://github.com/JairusSW/json-as/pull/243), [#244](https://github.com/JairusSW/json-as/pull/244), [#245](https://github.com/JairusSW/json-as/pull/245)).
- Invalidate cached string/object traces and clean-string classification whenever public stringify output reuse overwrites a source or decoded-field allocation. Bound trace retention and release it on fresh parsing or `JSON.Memory.shrink()` ([#231](https://github.com/JairusSW/json-as/pull/231)).
- Preserve string escape parity across reused buffers, escaped backslash runs, and SWAR/SIMD boundaries. Respect live payload sizes and separate aliased string destinations ([#225](https://github.com/JairusSW/json-as/pull/225), [#242](https://github.com/JairusSW/json-as/pull/242)).
- Materialize native arrays from dynamic values without losing subtype identity; preserve actual null elements when converting nullable Value arrays. Make `Value.set` share composite values consistently, regardless of a prior lazy read or strict-mode selection ([#227](https://github.com/JairusSW/json-as/pull/227)).
- Honor custom serializers and supported value representations in `JSON.Obj.from(Map)`. Convert ordinary Map subclasses directly through native accessors, retaining integer slot tags and exact wide-integer values after later mutations. Route unsupported direct boxing types, including primitive arrays and Dates, through conversion fallback rather than replacing them with zero.
- Convert Box numeric values according to their stored tag, including exact wide-integer paths. Align `Value.getType` with represented values, pointer-sized integers, and custom container representations. Dynamic numeric getters convert using native AssemblyScript casts without allocating a wrapper, preserve exact integer-to-integer reads, and reject nonnumeric payloads. Parsed dynamic numbers use `f64`; `Box.fromValue<T>()` remains available for nullable boxed results. Escape reference-value string conversion while retaining scalar float display.
- Preserve callback mutation semantics across dynamic objects/arrays, map rehashing, array shrinking, reverse traversal, sorting, joins, and nested serialization. Keep callback-capable values rooted across buffer growth and garbage collection ([#230](https://github.com/JairusSW/json-as/pull/230)).
- Guard typed dynamic-array reads and writes by live length, decode escaped object keys before storage, and delete every occurrence of duplicate parsed keys ([#233](https://github.com/JairusSW/json-as/pull/233), [#239](https://github.com/JairusSW/json-as/pull/239), [#240](https://github.com/JairusSW/json-as/pull/240)).
- Keep managed payloads rooted across NaN-boxed slot publication and buffer growth, including array appends, object insertion, raw-slot handoffs, and value-wrapper allocation under incremental GC.
- Trace Raw and dynamic reference payloads correctly and link managed writes during incremental collection. Release unnecessary source anchors after materialization, copies, replacement, deletion, or clearing ([#236](https://github.com/JairusSW/json-as/pull/236)).
- Preserve signed expanded Date years in serialization and parsing, including canonical negative-year round trips and source-buffer reuse ([#226](https://github.com/JairusSW/json-as/pull/226)). Serialize non-finite floats as JSON `null` and avoid typed-array `NaN` membership false positives.
- Correct owned-output reservations and callback-relative cursor restoration. Reserve custom fragments and dynamic fields after callback boundaries, preventing out-of-bounds string, float, and composite writes ([#247](https://github.com/JairusSW/json-as/pull/247)).

### Performance and allocation

- Hoist the bounded word-scan limit in generated whitespace readers for small numeric rows. Keep the general scanner and instrumentation paths unchanged; preserve mixed whitespace and source-end behavior.

- Reduce SIMD composite-scanner bracket classification with an exact subtraction/mask predicate. Preserve UTF-16, escape, nesting and source-boundary behavior; paired ARM64 runs improve raw-heavy corpus parsing without adding speculative branches.

- Keep newly created empty-array references in generated reader locals until their existing GC publication barrier. Reload reused fields after callbacks and preserve instrumentation paths; no allocation or barrier is removed.

- Reuse normalized key lookahead across omitted fields in generated whitespace readers. Refresh it after a present field, avoiding repeated comma/indentation scans without extra runtime flags; preserve traced load sequences.

- Add bounded nine-digit integer-field shortcuts in SWAR and SIMD, preserving typed stores and source-end checks. Paired ARM64 classic runs improve CITM by about 2–4%; five unaffected corpus binaries remain identical.

- Avoid clearing newly allocated generated objects twice when the actual library-owned allocator is verified to zero its full payload. Retain explicit clearing for unknown allocators, other runtimes, instrumentation, and alternate pointer layouts; preserve reused-object initialization.

- Classify quote parity across bounded SIMD composite-scan batches, skipping structural events inside strings without walking every quote. Preserve escape-run handling across batch boundaries, short tails, range limits, and allocation-free scanning.

- Improve small-object allocation locality and coalesce adjacent dead native blocks during library-triggered incremental sweeps. Keep per-object GC registration, flush pending frees before returning to application code, and retain existing paths for unknown runtime layouts, instrumentation, finalizers, allocator overrides, and other collectors.

- Reduce initial backing storage for newly allocated floating-point arrays in accelerated readers to two slots, including nested arrays. Preserve ordinary growth, destination reuse, subtype constructors, and independent managed storage.
- Defer safe defaults for fresh generated Map values until needed, reducing temporary container allocations while preserving effects, shared defaults, inherited state, and reused destinations.
- Preserve default initialization before manual reader and cursor lifecycle hooks throughout a schema's dependency graph, including defaults that read shared state changed by a child reader.
- Keep null composite destinations on an inline return path before ownership claiming, reducing fresh-parse call overhead.
- Inline library-owned GC publication in generated readers and container construction, retaining the installed runtime's marking behavior and fallback paths.
- Match common colon-space separators and already-present commas directly in generated whitespace readers. When a bounded lookahead proves the value starts without more whitespace, proceed directly to its typed decoder. Retain general spacing and the original tracing read sequence.
- Keep in-capacity native-array appends local to generated readers, preserving ordinary growth and GC barriers and bypassing subclass mutation hooks consistently.
- Extend the library-owned small-block allocation path to decoded strings across all three backends.
- Specialize ordinary native-array construction while retaining ordinary growth, independent managed buffers, subclass constructors, and runtime fallbacks. Keep known generated children on the whitespace tier once their parent tiers down; each new parse still starts at the compact tier.
- Accelerate longer indentation runs with bounded four-character whitespace loads while preserving scalar behavior for mixed whitespace and range boundaries.
- Batch small native backing-block acquisition when free capacity permits, while preserving per-object GC registration and fresh identities. Fall back under pressure and return unassigned tails before heap growth. Keep native allocation events unchanged under RTrace.
- Specialize library-owned schema allocations with the installed incremental runtime allocator body, exposing constant sizes while retaining its GC operations. Keep application calls and other runtime allocation paths unchanged.
- Avoid backing-buffer allocations for empty native-array fields. Preserve independent array identities, constructor behavior for subtypes, normal growth, and GC ownership across all runtimes.
- Skip redundant static-buffer visits for exact native `i64[]` instances during library-triggered incremental marking. Enable this only for schemas already using that array type and a recognized Array implementation; preserve heap-backed arrays, subclass fields, collector pacing, and instrumentation/finalizer fallbacks.

- Keep concrete generic built-ins such as nullable `JSON.Box<i64>` on generated fast readers instead of disabling an entire schema through an unresolved declaration lookup. Accept absent `@optional` fields in the compact tier without replaying already decoded children.
- Start each generated compatibility fast-reader invocation at the compact tier, then fall through to whitespace-tolerant and keyed readers locally. Separate compact and whitespace code without remembering a demotion across calls. Commit omitted-field defaults only after a tier succeeds, preserving present containers during fallback. Defer default child graphs in eligible fresh fast parses until a field is absent, retaining initialization on fallback and for effectful or shared-reference defaults. Retain GC write barriers for newly decoded references.
- Delay SIMD exact-source trace recording until the same input/destination pair repeats, avoiding discarded cache metadata for changing requests while retaining subsequent cache hits.
- Reduce reuse bookkeeping with a fixed 128-claim ownership table, constant-time generation resets, and a Map fallback for larger graphs. Keep active input protection and shared-destination checks across nested parses. Avoid empty trace-array resets and the root ownership Map entry.
- Keep serializer pause depth in a scalar and separate owned-output allocation from its common entry checks, reducing small-output overhead without changing nested callback behavior.
- Upgrade the float-formatting backend to `xjb-as` 1.0.0.
- Optimize SIMD/SWAR clean-string classification, copying, escapes, short/medium strings, and exact-end stores while preserving BMP characters, surrogate pairs, and Unicode boundaries. Reuse safe clean-string classifications and invalidate them on output mutation.
- Keep generated serialization cursors local, dispatch strings/arrays/objects directly by pointer, inline primitive formatter selection, combine field reservations, and fuse integer-array and composite-array output loops. Use a single separator shape for Map and composite-array serialization.
- Write large and medium outputs directly into owned strings with bounded growth/slack. Avoid clearing pointer-free string payloads that are immediately overwritten, and reduce over-reservation for floating-point output and empty arrays.
- Use scoped allocation and incremental-GC batching for eligible fresh checked graphs while retaining independently managed results. Defer implicit nested/collection defaults until a missing field needs them and append fresh checked array slots directly.
- Keep ordinary nested `JSON.Obj` serialization linear and avoid materializing every key for proven callback-free children. Exclude manual/custom serializers from generated purity certificates. Compute callback key identities once and rebuild indexed occurrence lookup only after structural mutation.
- Serialize primitive dynamic slots and materialized strings without temporary Value wrappers; join materialized strings without per-element boxes or quadratic prefix copying ([#241](https://github.com/JairusSW/json-as/pull/241)).
- Remove the unused `f64` fallback string copy, avoid primitive Set snapshots, retain Set capacity during reuse, and skip redundant fresh-Set clearing. Preserve snapshot handling where serializers can execute callbacks.
- Reuse eligible string and struct elements in StaticArrays without rebuilding them through a temporary dynamic array. Remove redundant local identity sets from reused struct arrays while retaining parse-wide alias protection.
- Bound fresh numeric-array capacity, count reusable numeric elements with exact SWAR masks, and avoid redundant validation scans for built-in reference arrays. Sample top-level keys for `JSON.Obj` reservations so large values do not imply large metadata buffers.
- Keep string metadata, uninitialized allocation, and allocation-batching optimizations optional, with fallbacks for published AssemblyScript runtimes. Disabled experimental string caches allocate no arena; regular `JSON.stringify` does not use that cache.

### Declaration and compiler integration fixes

- Discover default-exported schema declarations and preserve their inherited fields and custom-codec type identities through default imports and re-exports.
- Exclude function-valued fields before planning serializers and initialization; function-only schemas emit `{}`, and omitted callback initializers survive parsing.
- Refresh strictness, diagnostics, fast-path, cache, and debug configuration for every compiler invocation, including repeated programmatic builds in one Node process.
- Keep function-local type aliases out of the module alias index, align omitted lazy-override planning with lowering, and rewrite custom-codec calls only when their receiver binds to the json-as runtime.
- Correct the nullable/dynamic example, debug environment variable, and exact-byte cache-size example.

- Preserve embedded NUL characters and Unicode line separators when regenerating string defaults, including direct property reads after parsing.
- Read native array length consistently during serialization and dynamic conversion, preserving stored elements when subclasses override the public getter.
- Re-export `JSONMode`, `toRaw`, `fromRaw`, and `toBox` from the package root to match the advertised type entrypoint; exercise both entrypoints in the packed-consumer matrix.

### Package-manager and publishing compatibility

- Bundle the required `xjb-as` sources and licenses so AssemblyScript can resolve them in pnpm installations without consumer hoisting or direct implementation dependencies.
- Declare the supported AssemblyScript compiler as a peer dependency and exercise actual tarballs in default pnpm projects and isolated linked workspaces, including renamed package installations.
- Keep the publish helper compatible with macOS system Bash and classify preview tags as GitHub prereleases.

### Benchmarks, testing, and release tooling

- Standardize chart typography on overview, restore concise one-line sidebars, and keep detailed recorded provenance in metadata files. Verify owning simdjson serializers reconstruct fresh output after field mutations.

- Combine each object/string throughput sweep into one chart with ten single-document sizes from about 100 KiB to 8 MiB. Build growing-object input with repeated serialization into one output buffer, retain identical JS/AS bytes, and display actual encoded sizes and GB/s.

- Use log axes for wide or mixed throughput ranges, keep built-in JSON first and SIMD/native references last, and use one growing JSON object with the same 1,024-byte row fixture across both object chart ranges, replacing the legacy switch between repeated 55-byte and 1,049-byte records.

- Keep compiler warnings enabled instead of globally suppressing them with an empty warning list. Fix pointer-width conversions in ownership metadata, Raw reuse, native-array appends, generated allocator code, and benchmark helpers; initialize generic cursor slots explicitly and type null test inputs. Ignore only intentional recursive/virtual-inlining and type-export diagnostics (AS217/AS228/AS235), including WASI builds, and external as-test definite-assignment hints (AS906) in test builds. Add a compiler-warning regression gate.
- Add owned-output simdjson/native comparisons, retained-output checks, changing-input workloads, classic corpus screens, and independent backend checks. Keep native-parity results separate from classic charts and distinguish validation, fresh/reused parsing, lazy access, materialized serialization, and untouched dynamic forwarding.
- Record benchmark source hashes, compiler/standard-library provenance, strict/fast settings, input/workload identity, and the selected runtime executable/version. Build chart labels from recorded provenance rather than the current checkout, keep captions readable across source snapshots and runtime version banners, and reject stale, incomplete, or mismatched captures ([#235](https://github.com/JairusSW/json-as/pull/235)).
- Generate pinned simdjson 5.0.4 owning native-struct/string baselines for classic, library, and overview datasets, plus built-in JS on classic datasets. Add staged classic deserialization throughput gates, full-field oracles, and fresh results on both sides. Check input hashes and output oracles, preserve raw samples and runtime provenance, and identify Raw-backed classic schemas.
- Refresh ARM64 benchmark charts with the v1.6.1 JS and AssemblyScript harnesses for historical comparison, including the JS per-operation microtask-checkpoint `eval` overhead and the original timing floor. Retain zero-operation and frame-progress guards. Keep lazy/source forwarding outside full-serialization comparisons.
- Add V8 JSON/Date differential oracles, exact `f32` midpoint checks, malformed-input and RFC matrices, GC/allocation budgets, and composition regressions across modes, strictness, fast paths, imports, inheritance, callbacks, and reused destinations.
- Execute packed npm artifacts in isolated consumers across both import entry points and incremental, minimal, and stub runtimes. Include that consumer gate in release CI alongside fast/slow tests, strict public/RFC tests, transform/oracle suites, lint/type checks, and benchmark-tooling tests.
- Keep the development self-link on v2 while locking the compatible nested json-as 1.x and xjb-as 0.x dependencies required by wipc-js, so clean `npm ci` and release CI can install the full graph.
- Commit the reproducible dependency graph, refresh development dependencies and patched transitive versions, and support published AssemblyScript runtime capabilities in CI. Validate package contents and tag/package-version agreement, and generate GitHub release notes from the exact versioned changelog section.
- Remove obsolete implementation-reference documents and broken README references; clarify strict parsing and dynamic numeric access in the primary API documentation.

## 2026-11-04 - v1.6.3

- Fix generated runtime imports in virtual-source builds, including relative imports and nested `@json` classes ([#246](https://github.com/JairusSW/json-as/pull/246)).
- Correct composite reuse across nested arrays, nullable struct arrays, StaticArrays, typed-array views, and Date decoding.
- Preserve dynamic-array callback mutation semantics, typed access bounds, native-array materialization, and source-anchor lifetimes.
- Decode escaped dynamic-object keys consistently and delete all occurrences of duplicate parsed keys.
- Fix nullable string, Raw, and custom-codec collection parsing and serialization, trailing whitespace handling, and extended Date years.
- Preserve string escape parity and Unicode boundaries when output buffers are reused; improve dynamic string scanning, wide-key dispatch, and primitive-slot serialization.
- Improve runtime benchmark isolation and provenance.

## 2026-10-15 - v1.6.2

- perf(deserialize): extend the generated one-pass keyed fallback to bounded scalar and collection-bearing schemas, and group fallback dispatch by encoded key length. Focused reordered mixed payloads improve by roughly 1.5x and unknown-field payloads by roughly 1.4x, with canonical input remaining flat.
- fix(strict): make generated numeric and string field parsers reject malformed complete tokens without trapping, including leading zeros, incomplete fractions/exponents, raw string control characters, invalid escapes, and unterminated strings; float fallbacks now consume complete long exponents. Standalone RFC validation remains ahead of generated parsing.
- bench/test: add tiered fallback and strict typed-parser benchmarks, direct generated-parser safety regressions, full public-boundary malformed-input coverage, and a measured deserialization performance plan.
- perf(dynamic): bound `JSON.Obj` parse reservations so large deferred values do not cause oversized backing buffers, while allowing wide objects and long keys to grow safely ([#220](https://github.com/JairusSW/json-as/pull/220)).
- perf(dynamic): assemble `JSON.Arr.join` output without quadratic prefix copying, preserving element snapshots when custom serializers mutate the array ([#221](https://github.com/JairusSW/json-as/pull/221)).
- fix(dynamic): cache nested object and array access so repeated reads preserve identity and nested mutations survive serialization ([#222](https://github.com/JairusSW/json-as/pull/222)).
- fix(transform): compare odd-length key tails correctly in generated deserializers, preventing similarly prefixed keys from matching the wrong field ([#223](https://github.com/JairusSW/json-as/pull/223)).
- test(dynamic): add regressions for bounded object reservations, buffer growth and GC safety, repeated nested access, join scaling, and serializer side effects; compare large strings before asserting to avoid expensive assertion formatting.
- bench: replace the WARP runtime comparison with a pinned Wago WASI runner and remove the Warpo compiler comparison tooling and dependency. Runtime charts include Wago results and identify the runtime, package version, and source revision.
- bench: add `--wago` and `--wazero` to `bench:as` for individual benchmarks and directories, with combinable runtime flags, shared WASI builds, and separate result logs per runtime.
- tooling: support runtime-only benchmark chart publication with `charts:publish -- --runtimes`, preserve other charts when publishing runtime results, and make README chart URL updates work across platforms.
- ci(release): gate releases on transform regressions, both fast and slow parser suites, slow-path strict public tests, and the full fast-path strict suite.

## 2026-09-01 - v1.6.1

- fix(transform): preserve exports from a consumer's default `assembly/index.ts` while retaining `JSON.Value`'s custom GC visitor; direct-source builds now identify json-as's library entry explicitly with `JSON_AS_LIBRARY_SOURCE` instead of inferring it from host filesystem paths ([#217](https://github.com/JairusSW/json-as/pull/217)).
- test(transform): compile a consumer entry with the real transform and assert its exports remain in the generated WebAssembly module; run the transform regression suite in CI.

## 2026-08-03 - v1.6.0

- perf: much faster deserialization by using default values as a cache.
- fix(transform): resolve imported nested custom types across source-file dependencies and invoke their custom deserializers, including for nullable and reordered fields ([#215](https://github.com/JairusSW/json-as/pull/215)).
- chore: add Guillermo Diez to the contributor list.

## 2026-06-10 - v1.5.0

- perf(dynamic): **`JSON.Obj`, `JSON.Value`, and `JSON.Arr` are now lazy by default** - a near-alloc-less, simdjson On-Demand-style rework of dynamic parsing. `JSON.parse<JSON.Obj>` no longer eagerly materializes the whole tree: each nested value stores its raw source slice and is parsed only on first access (`.get<T>()` / `.getAs<T>()` / `.at(i)`), then cached - a value you never read is never parsed, and an untouched value re-serializes by copying its original source bytes verbatim. `JSON.Obj` is backed by a `StaticArray<u64>` value-slot buffer plus a length-prefixed key buffer (keys emit straight from their slice - no per-key string materialization), and a new buffer-backed `JSON.Arr` mirrors it (`.at(i)` → `JSON.Value`, `.getAs<T>(i)`, `.push<T>`, `.set<T>`, `.length`). Deferred composites reuse the NaN-boxed `JSON.Value` slot, and the SIMD/SWAR value scanners gained a vectorized composite (`{}`/`[]`) scan. Net for proxy / filter / forward workloads over large payloads: dynamic deserialize is several× faster with far fewer allocations, and untouched round-trips are byte-exact passthrough. A new `dynamic-interop` suite covers `Map`, `Date`, `JSON.Box`, `JSON.Raw`, and nested-struct interop
- perf(`JSON.Obj`): **faster dynamic key access.** `indexOf` now linear-scans objects with ≤ 6 keys (the common case) instead of allocating and hashing a key index - small objects pay no index build/probe cost, and a dynamic-access workload that touches only a few keys never builds an index it won't reuse; larger objects keep the open-addressed hash index. The per-lookup key comparison (`utf16Equals`, shared by the linear scan and the hash probe) is widened to 8 code units per step on the SIMD build (one `v128`) and 4 per step on naive/swar (one `u64`), each load bounded by the key length so it never over-reads. Warm long-key lookups **+37–133%**, short keys **+10–20%**, no cold-path change
- perf(swar): the string-field clean pre-scan (`deserializeStringField_SWAR`) tests its first 8-byte word before loading the second - short values and keys close or escape within that first word, so the common case skips the wasted load while a clean run still advances 16 bytes at a time (**+1.5%** on string-heavy eager deserialize)
- fix(dynamic): hardened the buffer-backed dynamic types against three latent faults found while validating the rework - (1) the open-addressed key index could fill to 100% and spin forever in `indexOf` (a 3rd `set` on a fresh object was enough); it's now invalidated past half load with a wrap-guarded probe. (2) `JSON.Obj.__visit` didn't trace the key-offset array (`_kpos`), so a GC between parse and access freed it and faulted on the next lookup. (3) `__INITIALIZE` seeded a ref lazy field's slot to the materialized state but not its value, so an _absent_ field with a declared default serialized `null as T` and trapped (hit by `github_events` / `gsoc-2018` lazy serialize). Also fixed the SWAR value scanner mis-reading an escaped backslash before a closing quote (`"x\\"`) as still-escaped, which over-scanned past the value and faulted
- test(dynamic): three robustness suites for the buffer-backed types, each verified to catch its bug class by reverting the fix - `gc-stress` (forces `__collect()` between parse and access across `JSON.Obj`/`Arr`/`Value`, large values, and nested peels; catches an untraced backing buffer), `objindex-property` (random set/delete/lookup vs a reference `Map` straddling the linear↔hash threshold; catches the index spin-loop), and `roundtrip-fuzz` (random valid JSON → `parse<JSON.Value>` → `stringify` must be byte-exact across all three scanners; caught the SWAR escape bug on its first run)
- feat: **`@optional` decorator** - annotate a field as optional for intent and tooling (documented in the README)
- deps: float serialization backend swapped to **`xjb-as`** (replaces the previous `zmij-as` dependency). The `dtoa_buffered` / `ftoa_buffered` writer API is byte-identical - UTF-16 written straight into the `bs` buffer, returning the code-unit count - so the swap is a drop-in across the value (`assembly/index.ts`), scalar (`serialize/naive/float.ts`), and array (`serialize/naive/array.ts`) serialize paths; `xjb-as` is the productized successor of the same xjb64 / Schubfach shortest-decimal core. Verified across the full suite (10,767 tests, all three modes) plus a `canada.json` round-trip (`JSON.stringify(JSON.parse(canada)) === canada.min.json`, byte-for-byte) on both the SIMD and SWAR digit kernels
- bench: object throughput gains **eager-vs-lazy** coverage. `assembly/__benches__/throughput/obj-{serialize,deserialize}.lazy.bench.ts` mirror the eager sweeps with `@json({ lazy: "auto" })` classes (dumped as `obj-lazy-*`): lazy deserialize measures the scan-and-record-ranges fast path (deferred fields never read), lazy serialize measures the raw-passthrough path (parse once, then re-serialize untouched). Wired into `scripts/build-chart{09,10}.ts` as a dashed AS-only series (JS has no lazy mode), and into the per-payload bars of `scripts/build-chart{01,02}.ts` as a distinct faded-copper bar at 0.8 fill opacity to flag that lazy defers work (not strictly apples-to-apples; only the 5 payloads with a `*.lazy.bench.ts` get a bar)
- bench: sub-1MB throughput sweeps step every **100 kB** instead of 50 kB (1 kB baseline + 100–900 kB + 1–10 MB) - half the sub-1MB points, same coverage shape. Applied across the AS benches (`assembly/__benches__/throughput/{str,obj}-{serialize,deserialize}.bench.ts`), their JS counterparts (`bench/throughput/`), and the chart payload lists (`scripts/build-chart{07,08,09,10}.ts`)
- fix(bench): restore the lazy **access-pattern** benchmark dropped when `lazy.bench.ts` was split into per-concern files. `assembly/__benches__/lazy/access-pattern.bench.ts` re-emits the `lz-access` suite (eager read-all baseline + lazy read-none / read-one / read-all / passthrough on a medium struct) that `scripts/build-chart15.ts` reads for `lazy-access-pattern.svg` - the chart had been aborting with ENOENT on `lz-access.eager`
- tooling: `bun run playground:tmp` builds and runs the transform-generated `assembly/playground.tmp.ts` directly (no transform) under the v8 bench runner, for hand-tuning the generated codec. `assembly/playground.ts` is now a fast-path (non-lazy, eager) deserialize micro-bench - a direct `__DESERIALIZE_FAST` into a reused object with a min-over-rounds timer
- tooling: `npm run bench:all` (`scripts/bench-all.sh`) runs the full benchmark matrix in one shot - root files plus `multilib/`, `throughput/`, `prim/` (AS + JS) and `classic/`, `lazy/` (AS-only) - forwarding flags (`--mode`, `--v8`, `--wavm`) to the AS runner and continuing past a failing category (non-zero exit if any failed). `npm run charts:publish` (`scripts/publish-benchmarks.sh`) now publishes by default even with a dirty/untracked working tree - chart output only ever commits to a separate `docs` worktree, never your main tree - with `PUBLISH_REQUIRE_CLEAN=1` to restore the old refuse-if-dirty guard
- fix(lazy/dynamic): a `null` value for a **nullable string** field on the lazy/dynamic path was mis-decoded. `JSON.__deserialize` (used by lazy-field materialization, `JSON.parse<JSON.Value>`, and `JSON.Obj`/`Arr` value slots) tested `isString<T>()` - which is `true` for `string | null` - before the `null`-literal check, so a bare `null` was parsed as a quoted string: an abort (`Invalid JSON string: missing surrounding quotes`) under NAIVE, silent garbage under SWAR/SIMD. The `null` check now precedes the string branch, matching the eager `parseInternal` path. Surfaced as a crash materializing absent-as-`null` string fields in the `classic/citm_catalog.lazy` benchmark
- perf(dynamic): **re-serializing a dynamic string emits via `memory.copy` when it needs no escaping.** A materialized `JSON.Value` / `JSON.Obj` / `JSON.Arr` string caches a 2-bit escape class in two otherwise-unused bits of its NaN-box payload (a wasm32 pointer is 32 of the 45 payload bits); it's classified once on first serialize, then reused - AS strings are immutable, so the verdict never goes stale. A clean string then round-trips as `"` + one `memory.copy` + `"` instead of a per-character escape scan: **~3×** faster re-serialize (3.8 → 11.5 GB/s on a 1 MB string). `JSON.Obj`/`Arr` persist the class back into their flat value slot so the win carries across re-serializes; typed struct `string` fields (no box to cache in) are unchanged
- perf(dynamic): rebalanced the lazy value-slot packing from **22/22 to 23/21 bits** (offset/length). Object/array fields are usually small while the document can be large, so offset overflow - a field late in a big doc - is the realistic trigger; widening the offset field lifts the compact (no-rescan) range from ~8 MB to **~16 MB** of source, at the cost of single field values over ~4 MB falling back to the existing absolute (scan-on-demand) slot form
- test(dynamic): `dynamic-string-class` (clean / escaped / surrogate / empty strings round-tripped through `JSON.Value` and re-serialized, plus `JSON.Obj`/`Arr` slot-class caching) and `lazy-slot-encoding` (the packed slot's compact↔absolute boundary, previously untested) suites
- bench/docs: benchmark chart scripts renamed from `chartNN` to descriptive names (`overview-` / `string-` / `object-` / `primitive-` / `library-{serialize,deserialize}`); every chart now emits both SVG and PNG; the README switched fully to SVG with the real-world payload charts promoted to the top of the Performance section and a "browse the full chart set" link that the publish script re-pins per release. String throughput charts gained a `JSON.Value` (dynamic) series, and the classic charts got vertical value labels

## 2026-06-05 - v1.4.0

- feat(lazy-fields): **on-demand (lazy) field parsing.** Mark a field `@lazy`, wrap its type as `JSON.Lazy<T>`, or set a class-wide default with `@json({ lazy: "auto" | "all" })` (and opt individual fields back out with `@eager`). A lazy field stores its raw JSON slice at parse time and parses it into the field's type only on first access (then caches); a field you never read is never parsed, and an untouched field round-trips by copying its original source bytes - never re-parsed or re-serialized. `auto` defers the expensive-to-parse fields (strings, arrays, maps/sets, `JSON.Value`/`Obj`/`Raw`, non-trivial nested structs) and keeps cheap ones eager (primitives, enums, `Date`, tiny all-scalar structs); `all` defers every field (best for proxy / filter / forward over large payloads). Skipping or forwarding fields is several× faster than eager and the win grows with payload size. The slot is a single `u64` - `0` = absent, `u64.MAX_VALUE` = materialized, otherwise a packed `(start<<32)|end` source range; a ≤32-bit scalar packs its value into the slot directly (no traced memo field). `@omitnull` / `@omitif` work on lazy fields (null-ness is read from the slot without materializing). A class with a custom `@serializer`/`@deserializer` can't have lazy fields (the transform reports an error). See the Lazy Fields guide for the full API and trade-offs
- perf(transform): the generated fast-path deserializer (`__DESERIALIZE_FAST`) is split into ~32-field chunk helper methods instead of one unrolled function - for both the straight-line tiers and the `seenAny`-stateful `@omitnull`/`@omitif` tiers (the latter threads `seenAny` across chunk boundaries through the call ABI, packed into the `u64` return alongside `srcStart`). A wide struct previously emitted a single function large enough to crash the Binaryen optimizer ("crashed during optimize") a few hundred fields in; chunked, the fast path stays compilable at any width (verified to 1000 fields) and optimizes faster, since Binaryen's per-function passes are superlinear
- perf(codegen): dropped `@inline` from the (de)serialize worker functions and removed every `inline.always()` call-site directive. They forced each worker to be copied into every dispatch / call site; as plain shared calls the generated module shrinks (~18% on the all-lazy `large` struct) and the Binaryen `optimize` phase eases. Dispatchers and genuinely small helpers keep `@inline`
- fix(lazy-fields): the lazy serialize path now `ensureSize`s before the structural key literals, not just the value passthrough. A wide struct (~150 fields, long keys) could overrun the output buffer once a passthrough left it nearly full - `JSON.stringify(JSON.parse<T>(...))` trapped with `unreachable`. The passthrough reserves exactly the slice bytes (unlike eager string serialize, which over-reserves for quotes/escaping), so the key writes that follow needed their own bounds check
- fix(lazy-fields): a *constructed* (not parsed) instance keeps its declared field defaults. Lazy lowering replaced each field with a slot and dropped its initializer, so `new T()` serialized the type default (`null` / `0`) instead of e.g. `"x"` from `name: string = "x"`; the slot is now seeded in the materialized-default state. `JSON.parse` (which builds via `__new`, skipping field initializers) is unaffected
- fix(serialize): `@omitnull` / `@omitif` fields emit a **leading** comma gated on a runtime "wrote" flag, not a trailing one. Optional fields sort to the front, so a present field followed by omitted ones - or an all-optional struct - left a dangling trailing comma, i.e. invalid JSON like `{"a":"1",}`. Added a regression test (first / last / gap / all-absent / all-present, plus the mixed-with-regular case)
- feat: `JSON.Value` moved to a NaN-boxed representation, and its value scanning now runs through the SWAR / SIMD scanners (~60% faster on value-heavy input)
- bench: committed eager-vs-lazy benchmarks under `assembly/__benches__/lazy/` (deserialize / round-trip / serialize) + `lazy:"auto"` variants of small/medium/large/token/vec3, and a `lazy` json-as struct in the multi-library comparison (`__benches__/multilib/`); charting in `scripts/build-chart15.ts` and the multilib charts
- docs: Lazy Fields guide + performance charts (eager-vs-lazy by payload size and a multi-library throughput comparison), full JSDoc for the decorators in `assembly/index.d.ts`, and a single shared chart colour palette (`scripts/lib/palette.ts`)

- feat: `JSON.parse<T>(data, out)` - deserialize into an existing object graph instead of allocating a fresh one, symmetric with the existing `JSON.stringify<T>(data, out)`. On the fast path every field is reused in place (nested structs threaded as `dst`, strings `__renew`d only when the byte length changes, arrays keeping capacity), so a steady-state re-parse of the same shape allocates **nothing** after the first call - ~4× on SWAR (~720k → ~2.8M ops/s) and ~4.5× on SIMD on the multilib struct payload, heap `totalDelta` 1,034,240 B → 0. Backward compatible: `out` defaults to a type-correct zero via `__zero<T>()` (branches on `isReference`/`isManaged` at compile time, since a bare `changetype<T>(0)` is a size mismatch for value types like `bool`/`f64`)
- feat: `JSON.stringify<T>(data, out)` now reuses `out` for composite values (structs, arrays, strings), not just the scalar/`Date` fast paths. The reference serialize branches route their final write through a new `bs.outTo<T>(target)` that overwrites the existing string in place - or `__renew`s when the length differs - instead of `__new`-ing a fresh one via `bs.out`. Zero-alloc serialize on reuse: SWAR ~2.31M → ~2.61M ops/s (~+13%), heap `totalDelta` 882,000 B → 0
- perf: the fast path (`__DESERIALIZE_FAST`) is now generated for **NAIVE** mode. It was disabled for naive (`requestedFastPath = USE_FAST_PATH && codegenMode !== JSONMode.NAIVE`), so naive always ran `__DESERIALIZE_SLOW` after `__INITIALIZE` had reallocated every field - which meant `parse(data, out)` reuse reallocated the whole graph in naive. Enabling it is purely additive (the slow path remains the fallback for whitespace / reordered / missing-key input): naive fresh parse ~2× (~314k → ~644k ops/s), naive reuse ~6.7× (~316k → ~2.1M) with nested structs/arrays/strings now reused in place. Main suite (10,590) and RFC suite unchanged across all three modes
- perf: escape-free string **fields** skip the scratch-buffer round-trip in NAIVE. `deserializeStringField_NAIVE` previously copied every char into `bs` then `bs`→field; it now scans for the closing quote without touching `bs` and copies source→field directly when no backslash is present (matching the SWAR/SIMD field paths), diverting to a `bs`-based decode tail only for escaped strings. ~+6% naive fresh parse; SWAR/SIMD already did this
- fix(build): drop `@inline` from `deserializeStringField_NAIVE`. Once the fast path was enabled for naive (above), this loop-bearing scanner got inlined into every string-field call site inside the `@inline __DESERIALIZE_FAST`, exploding binaryen's optimize phase - `bun run bench:as -- large --mode naive` went to ~118 s in `optimize` alone (the transform itself is ~23 ms). Kept as a single shared function - one call per field - matching the already-non-inline SWAR/SIMD field deserializers. naive `large` build **120.6 s → 8.6 s** asc (full repro 2:17 → ~13.5 s), and it's also ~12% *faster* at runtime (the bloated inline body optimized worse). `__DESERIALIZE_FAST` itself stays `@inline`
- test: `assembly/__tests__/parseinto.spec.ts` - reuse correctness across all three modes: `parse(data, out)` fully overwrites the target (with pointer-identity asserts that nested structs and arrays are reused, not reallocated), and `stringify(data, out)` reuses the output string in place (same length) and resizes correctly (different length)
- bench: `json-as-struct-{deserialize,stringify}-reuse.bench.ts` under `__benches__/multilib/` - reuse-path counterparts to the fresh benches, used with `--memory` to confirm the zero-allocation steady state

## 2026-06-01 - v1.3.9

- fix: remove readFileSync which failed under virtual file systems

## 2026-06-01 - v1.3.8

- feat(strict): the **naive value-path deserializers now reject malformed JSON** instead of silently accepting it (RFC 8259). Numbers (`deserializeFloat_NAIVE`) are validated against the JSON number grammar - no leading zeros, bare `-`, empty fraction/exponent, `+` sign, hex, or trailing garbage (the `NaN`/`Infinity` extension is preserved). Strings (`deserializeString_NAIVE`) reject unescaped control chars, illegal/incomplete escapes, non-hex `\u`, and missing surrounding quotes. The scalar/typed **array scanners** (`f64[]`/`i*[]`/`u*[]`/`bool[]`/`string[]`) were rewritten as strict state machines: `[`-framed, single-comma separated, no leading/trailing/doubled commas, no inter-value garbage. On the JSONTestSuite `n_` corpus (parsed against concrete types, one spec per case in `assembly/__tests__/rfc/`), naive now **rejects 179/188** reject-cases - up from 55 - the remaining 9 being the intentional `NaN`/`Infinity` extension (5) plus arbitrary-`JSON.Value`/formfeed/struct-trailing edges (4). Non-object rejects compile to uncatchable aborts until try-as traces the value path; object rejects (struct `__DESERIALIZE_SLOW`) are catchable today. Main suite (10,557) and curated rfc suite (801) stay green across all three modes
- feat(strict): under `JSON_STRICT=true` the generated `__DESERIALIZE_SLOW` object scanner now rejects malformed key positions - an unquoted / single-quoted / numeric key, or garbage after a value with no separating comma - by requiring the first non-space char at each key position to be a string-opening quote, `,`, or `}` (`transform/src/index.ts`). Combined with the existing strict unknown-key-by-value-type guards, this brings RFC 8259 `n_object` coverage to **28/28** (all three modes) in the conformance suite (`assembly/__tests__/rfc/struct-reject.spec.ts`, parsed against one rich all-value-type schema so every guard is generated). Gated on `JSON_STRICT`, so the default lenient build is unchanged
- test: RFC 8259 accept-side coverage is now complete - all **95** `y_` (must-accept) cases parse via the dynamic `JSON.Value` type (`assembly/__tests__/rfc/accept.spec.ts`) and **31/35** `i_` (impl-defined) cases (`impl.spec.ts`), all green across NAIVE/SWAR/SIMD. The 4 deferred `i_` cases are uncatchable traps (raw UTF-16/BOM byte input, depth-500 nesting). RFC suite now 804 tests across 3 modes
- fix: tier-1 (the exact byte-template fast path) over-matched whitespace after a colon. For input like `{"k": v}` (a space after the colon but otherwise compact - e.g. Python's `json.dumps` default), tier-1 matched the minified `{"k":` prefix then read the value at a fixed offset that the space shifted, feeding a misaligned pointer to the value deserializer - string fields `abort`ed ("Expected leading quote") and float fields hit `unreachable`. Tier-1 now checks for whitespace after the colon and bails to the (whitespace-tolerant) tier-2 instead of mis-reading. Surfaced via the RFC 8259 conformance work
- fix: add `bs.reset()` to `lib/as-bs.ts` - restores the shared serialization buffer to a clean state (offset + pause stacks) after a throw aborts a (de)serialize mid-flight, so the next op isn't corrupted by a dangling offset
- test: begin RFC 8259 conformance coverage from nst/JSONTestSuite as typed specs (`assembly/__tests__/rfc-object.spec.ts`, accept/round-trip cases; see `RFC-DEFERRED.md` for status and the reject-case blocker)

- perf: pretty-printed JSON now stays on the fast path instead of collapsing to the naive scalar deserializer (the "canada 10×"). The transform's `__DESERIALIZE_FAST` gained a whitespace-tolerant **tier 2**: when the exact packed-`u64` byte-template (tier 1) misses on inter-token whitespace, instead of dumping the whole object to `__DESERIALIZE_SLOW` (~5× slower) it re-matches per field using the same packed key constants but skips whitespace between every structural token (`{`, key, `:`, value, `,`, `}`). Minified input never reaches tier 2, so tier 1 keeps peak speed. canada *pretty* deserialize **~139 → ~1,180 MB/s (SWAR)** / **~1,150 MB/s (SIMD)** - on par with minified; on a value-heavy struct tier 2 costs ~1% over tier 1 (worst case ~2× on a 16-field all-primitive struct). The SWAR array bodies (`deserializeArrayArrayBody`, `deserializeFloatArrayBody`, the inline string/object array element loops) were made whitespace-tolerant to match
- fix: `JSON.parse` / `JSON.__deserialize` accepted a fast-path result only when it consumed *exactly* to `srcEnd`. Pretty files end in a newline, so tier 2 stopped just past the closing `}` and the **entire object silently fell back to the slow path despite a successful parse** - this was the real cause of the pretty penalty (tier 2 alone only moved canada 139 → 220 MB/s; this fix took 220 → ~1,180). The fast path is now accepted when only trailing whitespace remains (`skipWhitespace(fastEnd, srcEnd) == srcEnd`)
- perf: optional-field structs (`@omitnull` / `@omitif`) get a whitespace-tolerant tier 2 as well - a probe-and-commit variant that matches each field's key with a lookahead cursor and only commits past the separator + key + `:` when it matches, so omitted fields are skipped without consuming input. Previously these structs fell to slow on *any* whitespace. ~1.18× of tier-1 on a pretty 7-field optional struct, vs the ~5× slow path it used to hit
- fix: enforce a uniform whitespace contract across **every** deserialize handler in all three modes (field and non-field): the entry points (`JSON.parse` / `JSON.__deserialize`) skip leading whitespace once, and every handler now assumes `srcStart` points at the first non-whitespace char and never re-skips it. Removed ~17 now-redundant leading-whitespace trims from composite handlers (naive `object`/`map`/`set` + array/staticarray composites; SWAR array bodies); composites still skip whitespace *internally* since they are the caller for their child values/keys
- fix: Map and Set struct **fields** did not handle internal whitespace - `deserializeMapBody` had no inter-token skips at all, and `deserializeSetDirect`'s skips were gated behind an `allowWhitespace` flag the field path left `false`. Concrete structs with `Map`/`Set` fields parsed from pretty input silently misparsed (only the generic-box slow path that existing tests exercised handled it). Both now skip whitespace unconditionally
- fix: `scanValueEnd` (both `util/scanValueEnd.ts` and `swar/array/shared.ts`) now stops a scalar value at trailing whitespace, not just `,`/`]`/`}`. The returned range previously included trailing spaces (e.g. `"1 "`), which the SWAR/SIMD scalar number parsers - assuming `[srcStart,srcEnd)` is the exact value - misparsed (a whitespaced map value `{ "p" : 1 }` deserialized to `-6`). Now matches the already-correct `JSON.Util.scanValueEnd`
- bench: add `assembly/__benches__/custom/tier-h2h.bench.ts` - tier-1 (minified) vs tier-2 (one leading space, isolating pure path overhead) vs tier-2 (fully pretty), across a value-heavy `medium` struct, a 16-field all-primitive worst case, and an optional-field struct (with a non-optional twin to isolate the `seenAny` tier-1 overhead)
- test: add concrete-struct whitespace coverage to `whitespace.spec.ts` - tier-2 fast-path structs (nested objects, float/string/object arrays), the optional-field probe path, top-level leading whitespace for every scalar/array type, and one struct touching every field-handler family (scalar/string/nested-object/array/Map/Set) parsed from heavily-whitespaced (leading + internal + trailing) input
- perf: fully vectorize the SIMD string **field** deserializer. `deserializeStringField_SIMD` previously bailed to `deserializeStringField_SWAR` on the first backslash, so SIMD mode got zero vectorization on escaped struct fields. It now runs a HYBRID escaped scanner - v128 scan for `"`/`\`; escape-bearing blocks use a single whole-block v128 store to copy the plain prefix for free, then decode the escape; clean runs stream the first block then bulk-`memcpy` the remainder (bandwidth-optimal on long sparse runs, no large-input cliff). Validated against run-copy and pure-stream variants across escape densities; ~+10–20% on common small/moderate/sparse cases
- perf: replace the SWAR string **field** scanner (formerly the run-copy `deserializeEscapedStringScan_SWAR_SplitTuned`) with the same HYBRID strategy, renamed `deserializeEscapedStringField_SWAR`. On the `swar-string-deser-hybrid-h2h` bench: +50–70% dense, +17–22% moderate, +37–48% sparse - the prior run-copy scanner read each plain run twice (scan + `memcpy`)
- perf/fix: the standalone whole-value scanners (`deserializeString_SWAR` / `deserializeString_SIMD`) also move to the HYBRID strategy, replacing the older "overflow-pattern" SIMD code. Also fixes a latent out-of-bounds read on short escaped strings - the unguarded `srcEnd - 16` underflow is now guarded with `srcEnd >= 16`
- refactor: route string-field deserialization through the `deserialize/index/string.ts` dispatcher (`deserializeStringField`), matching the integer/unsigned/float field helpers, instead of the transform hard-coding `deserializeStringField_SWAR` / `_SIMD` by `codegenMode`. Adds a real `deserializeStringField_NAIVE` (NAIVE builds previously deserialized struct string fields with the SWAR field scanner) and unifies all three mode variants on the 3-param `(srcStart, srcEnd, dstFieldPtr)` signature
- refactor: rename the `simple/` (de)serialize implementation directories to `naive/` and carry the mode suffix on the source functions (`*_NAIVE` / `*_SWAR` / `*_SIMD`), eliminating the `as X_NAIVE` import aliases at call sites
- fix(build): drop `@inline` from `deserializeStringField_SIMD`. As an `@inline` entry it let binaryen inline the loop-bearing escaped scanner into every struct string-field call site, exploding `large` SIMD compile ~24× under `--converge` (4 s → 99 s, 221 KB → 555 KB wasm). Kept as a single shared function (matching the already-non-inline `deserializeStringField_SWAR`); `large` SIMD build is back to ~4 s / 138 KB with unchanged runtime
- bench: add string-perf benches under `assembly/__benches__/custom/` - `simd-string-deser-scratch-h2h`, `simd-string-deser-variants-h2h`, `simd-string-deser-standalone-h2h`, and `swar-string-deser-hybrid-h2h` (escape-density head-to-heads for the HYBRID scanners); `serialize-string-modes-h2h` (NAIVE/SWAR/SIMD landscape, confirms streaming serialize already beats run-copy 2–6× so no HYBRID change is warranted); and `serialize-string-safety-h2h`, which checks SWAR/SIMD serialize byte-for-byte against NAIVE across 430 adversarial escape/surrogate/boundary-length inputs - confirming the SIMD `store<v128>` overflow stores stay within buffer slack

## 2026-05-20

- perf: unify the SWAR 4-digit kernel across array entry points. `swar/array/integer.ts` and `swar/array/float.ts` now import `parse4Digits_PairMul` from `util/swar-int.ts` (Lemire-style PairMul) instead of defining a local Baseline variant. `JSON.parse<u32[]>` ~27.4 ms/op @ 64 MiB (up ~17% from ~33 ms) and `JSON.parse<Int32Array>` ~29.5 ms/op @ 64 MiB (up ~17% from ~35.6 ms). Float wins are smaller (~2-4%) since dragonbox dominates
- perf: `deserializeIntegerArrayInto` (the `Array<int>` struct-field path) inlines `parseSignedIntegerSWAR` / `parseUnsignedIntegerSWAR` directly instead of routing through the per-element `deserializeIntegerField` / `deserializeUnsignedField` dispatchers. The element parser is now identical across all three call sites (top-level `JSON.parse<T[]>`, `swar/typedarray.ts`, struct field). Tuning note: array path uses parse4 + scalar even for unsigned - parse8 wins for the single-token struct field where the digit run is aligned, but in arrays the `,` separator lands mid-load and forces a wasted validate, costing ~23% on `u32-64mib`
- refactor: fold byte-identical `deserializeObjectArrayInto` and `deserializeStructArrayInto` into one shared helper in `swar/array/shared.ts`. The two outer wrappers retain their type-specific names and now delegate; net ~130 lines removed
- bench: add `assembly/__benches__/custom/u32-array-field.bench.ts` covering the unsigned struct-field path (no existing bench targeted `deserializeIntegerArrayInto` for `Array<u32>`); add `uint8array-512mib.bench.ts` for round-trip throughput at the largest payload AS's GC allows (BLOCK_MAXSIZE = (1<<30)-16, so a managed UTF-16 string maxes out near 1 GiB = 512 MiB of UTF-8). Built via a single `__new` + `memory.copy` to avoid concat/slice peaking past the wasm cap; the deserialize bench drops the source string and runs `__collect()` before the serialize bench so the per-op ~1 GiB output fits. SWAR ~1,350 MB/s deserialize, ~1,130 MB/s serialize at 512 MiB

## 2026-05-19 - 1.3.7

- fix: anchor the json-as transform's import-path rewrite on the *trailing* `json-as` directory via `lastIndexOf`. Under pnpm/yarn-pnp the install path is `.pnpm/json-as@<ver>_<hash>/node_modules/json-as`; the previous `indexOf` matched the version-qualified store directory and leaked it into every emitted runtime import, crashing AS during `program.initialize` (AssertionError at `program.ts:1183`). Flat-npm consumers were unaffected. Test coverage added in `transform/__tests__/normalize-base-rel.test.mjs` (8 layout cases, including pnpm with version+hash). Runnable via `npm run test:transform`
- perf: `JSON.parse<u8[]>` SWAR / SIMD throughput at ~64 MiB up to ~2.8 GB/s (SWAR) and ~4.6 GB/s (SIMD), up from ~750 MB/s in both modes. SWAR cascades three u64 fast paths (3-/2-/1-digit single-element); SIMD batch-decodes 2 elements per v128 load via `i32x4.dot_i16x8_s` across six (a, b)-width patterns (0x88 / 0x48 / 0x44 / 0x24 / 0x28 / 0x22), falling back to the SWAR cascade for the remainder
- perf: `JSON.parse<u32[]>` (and other wider integer arrays) now use worst-case `srcLen >> 2` pre-allocation + unchecked direct stores via a `writePtr`, eliminating `Array.push`'s per-element capacity check. ~2.2 GB/s SWAR, ~2.7 GB/s SIMD on the u32-64mib bench (up from ~1.2 GB/s); the same pattern applies to all integer widths. Parse helpers (`parseSignedIntegerSWAR`, `parseUnsignedIntegerSWAR`, signed/unsigned scalar and SIMD variants) now take a `slot: usize` instead of `out: T` and store via `storeSignedInteger` / `storeUnsignedInteger`
- perf: `JSON.parse<bool[]>` ~10 GB/s across all modes (up from ~1.5 GB/s). Same pre-allocation + unchecked-store pattern; the per-element u64 magic-constant token match stays
- perf: `JSON.parse<f64[]>` / `JSON.parse<f32[]>` ~870 MB/s, up from ~735 MB/s, via pre-allocation + unchecked stores. The remaining cost is in `f64.parse` itself (Grisu)
- perf: `JSON.stringify<u8[]>` ~5.1 GB/s, up from ~680 MB/s (7.4×), via a 256-entry UTF-16 LUT that packs the `"DDD,"` representation of each `u8` value into a single u64 plus a parallel byte-count LUT. Trailing comma is overwritten by `]` after the loop. `JSON.stringify<i8[]>` follows the same path with a peeled `-`
- perf: `JSON.stringify<bool[]>` ~4.6 GB/s, up from ~1.1 GB/s (4.2×), by folding the per-element comma into the element write (`store<u64>(TRUE_COMMA_LO) + store<u16>(0x002c, 8)` for `"true,"`; `store<u64>(FALSE_COMMA_LO) + store<u32>(0x002c_0065, 8)` for `"false,"`)
- perf: replace AS std's `itoa_buffered` in the integer serialize path with a jeaiii-style forward-writing itoa (`assembly/util/itoa-fast.ts`). The new path uses a 100-entry UTF-16 digit-pair LUT, computes digit count from a width-ladder so `decimalCount32` is no longer a separate call, and `@inline`s into the array loop. `JSON.stringify<i32[]>` ~1.8 GB/s, up from ~1.35 GB/s. Per-width gains range from 1.0× (1-digit) to 3.4× (2-digit) in the head-to-head bench
- bench: new throughput benches at `assembly/__benches__/custom/{u8,u32,f64,bool}-64mib.bench.ts` for deserialize and `serialize-primitive-arrays.bench.ts` for stringify; head-to-head benches `itoa-h2h.bench.ts` (`itoa_buffered` vs jeaiii) and `parsefloat-h2h.bench.ts` (existing parser vs Lemire-lite at `util/parsefloat-fast.ts` - research, not wired in due to test expectations encoding the existing parser's rounding behaviour)
- deps: pin `as-test` to `^1.1.10` and `try-as` to `^1.0.1`

## 2026-05-14 - 1.3.6

- fix: prevent cross-lane borrow propagation in `detect_escapable_u64_swar_safe` and `detect_escapable_u64_swar_unsafe` by ORing `0x0100_0100_0100_0100` into each 16-bit lane before the SWAR subtraction steps, eliminating corrupted output (`\u00\0\0`) when a NUL or other control character precedes a printable character in SWAR string serialization
- tooling: fix `bun run bench -- <suite>` argument forwarding so the suite name reaches `run-bench.as.sh` (and `run-bench.js.sh` for non-custom suites) instead of only being passed to `charts:build`

## 2026-05-08 - 1.3.5

- compat: make the transform load `NodeKind` from the installed AssemblyScript runtime at execution time instead of baking stale const-enum ordinals into published JS, fixing cross-version breakage around `TupleType` and related enum shifts [#188](https://github.com/JairusSW/json-as/issues/188) [#189](https://github.com/JairusSW/json-as/pull/189)
- deps: bump `assemblyscript` to `0.28.17` and rebuild the published transform output
- tests: refresh the suite and align local `as-test` config defaults so direct `as-test` runs continue to include the transform in all modes

## 2026-04-28 - 1.3.4

- perf: improve deserialization throughput by roughly another 20%
- chore: update TypeScript configuration to support the deserialization changes and rebuild flow

## 2026-04-28 - 1.3.3

- perf: made deserialization 200% to 300% faster
- chore: enable JSON_USE_FAST_PATH by default

## 2026-04-13 - 1.3.2

- fix: remove the fast double parser dependency and return float deserialization to the local legacy parser path
- fix: restrict string field destination reuse/renewal to heap-backed strings only and avoid writing into static literal storage
- perf: reduce branching in string field write paths while preserving heap-backed reuse (`simple`, `swar`, `simd`, and shared `bs.toField`)
- tests: add string-field regression coverage for literal defaults and heap-backed output pointers
- tooling: fix d8 bench runner lint issues (`print` global and unused buffer id vars)
- tooling: align `bench` script to use `charts:build`
- docs: streamline README benchmark/docs sections and update benchmark chart command references

## 2026-03-19 - 1.3.0

- chore: exclude generated `.as-test` build artifacts from ESLint, tighten generic deserializer offset math, and remove the obsolete `run-tests.sh` helper
- fix: add built-in typed array and `ArrayBuffer` serialization and deserialization support, including transform-generated field handling inside `@json` classes
- fix: finish subtype-aware `StaticArray` deserialization for nested arrays, maps, JSON value types, transform-backed structs, and related regressions
- fix: tighten default-path runtime correctness for signed `JSON.Value`, `@omitif("...")`, escaped nested strings, raw-array string handling, and `JSON.Obj.from(...)`
- perf: add a SIMD string-field deserializer for fast-path object deserialization and align transform codegen with mode-specific field helpers
- perf: add direct SWAR and SIMD integer-array deserializers with reusable-storage fast paths and dedicated throughput benches
- refactor: add `assembly/serialize/index/*` and `assembly/deserialize/index/*` dispatchers and route the public API through them
- perf: speed up float deserialization with handwritten parser paths, bitwise power-of-ten handling, and batched fractional parsing
- fix: avoid pulling SIMD code into non-SIMD bench builds and make benchmark temp-file cleanup tolerant of missing `asc --converge` outputs
- compat: add compatability between json-as and try-as by ignoring methods prefixed by __try
- feat: gate generated fast struct deserialization behind `JSON_USE_FAST_PATH=1`
- refactor: make generated struct `__DESERIALIZE` methods return the advanced source pointer
- perf: tune SWAR and SIMD string deserialization to return plain strings directly and only allocate scratch space after the first escape
- perf: streamline split SWAR string field deserialization and string-buffer reuse on the fast path
- perf: simplify generated fast integer field parsing to reuse `srcStart` and offset-based stores
- perf: parse generated numeric fields in a single pass with typed integer, unsigned, and float field helpers
- perf: hand-tune `small.bench.ts` and refresh benchmark runner turbofan flag configuration
- bench: add a string deserialization head-to-head benchmark and simplify throughput/chart comparisons back to the final JS/NAIVE/SWAR/SIMD view
- fix: keep the fast generated path opt-in by default and restore the `large` benchmark slow-path behavior
- refactor: split numeric deserializers into dedicated `assembly/deserialize/{integer,unsigned,float}` modules
- tooling: expand benchmark chart metadata parsing for custom string benchmark series
- tests: add escaped-quote SWAR deserialization regressions around block boundaries

## 2026-02-18 - 1.2.6

- fix: support arbitrary nested arrays and objects [#176](https://github.com/JairusSW/json-as/pull/176)
- chore: add contributor from [#176](https://github.com/JairusSW/json-as/pull/176)
- tests: significantly expand coverage across every file in `assembly/__tests__`
- tests: add additional primitive, array, nested payload, and escaped string regression cases to all specs
- tests: add more file-specific deserialize/serialize scenarios for custom, struct, map, resolving, and related schema behaviors

## 2026-02-17 - 1.2.5

- fix: stabilize ESLint for this repo by excluding AssemblyScript sources from standard TypeScript lint parsing
- fix: allow underscore-prefixed intentionally-unused TypeScript variables in transformer sources
- fix: add d8 globals for benchmark runner linting and make `bench/lib/bench.js` parseable by ESLint

## 2026-01-23 - 1.2.4

- fix: `Set<T>` and `StaticArray<T>` members in classes were not deserializing correctly
- fix: Fully reset state of transformer between builds

## 2026-01-03 - 1.2.3

- feat: handle surrogates and code units during string serialization and deserialization
- perf: add SWAR and SIMD string deserialization implementations

## 2025-12-23 - 1.2.2

- chore: reduce package size to sub 70kb

## 2025-12-23 - 1.2.1

- chore: fix chart link in readme

## 2025-12-23 - 1.2.0

- feat: Implement SWAR based algorithms, SIMD improvements, and better documentation.

## 2025-12-21 - 1.1.26

- chore: remove log

## 2025-12-21 - 1.1.25

- feat: Implement SWAR-based string serialization

## 2025-11-28 - 1.1.24

- feat: Implement a moving average window to determine buffer size (essentially, allow the buffer size to shrink) [#163](https://github.com/JairusSW/json-as/pull/163)

## 2025-11-06 - 1.1.23

- fix: Map keys should follow proper typing and quote rules [#161](https://github.com/JairusSW/json-as/issues/161)

## 2025-09-01 - 1.1.22

- fix: Type aliases should work across files [#154](https://github.com/JairusSW/json-as/issues/154)

## 2025-08-14 - 1.1.21

- fix: JSON.parse on classes with enums [#155](https://github.com/JairusSW/json-as/issues/155)
- fix: Resolve memory OOB issue within `serializeFloat` function [#153](https://github.com/JairusSW/json-as/issues/153)

## 2025-07-14 - 1.1.20

- feat: enable SIMD string serialization

## 2025-06-30 - 1.1.19

- fix: wrong path used in `readFileSync` when importing from a library

## 2025-06-30 - 1.1.18

- fix: [#150](https://github.com/JairusSW/json-as/issues/150)

## 2025-06-17 - 1.1.17

- fix: add support for classes within namespaces [#147](https://github.com/JairusSW/json-as/pull/147)

## 2025-06-12 - 1.1.16

- tests: properly support nulls (in testing lib)
- fix: initialize generic properties correctly
- fix: make generated imports compatible with windows
- feat: add support for fields marked with `readonly`

## 2025-06-09 - 1.1.15

- feat: add `.as<T>()` method to `JSON.Value`
- chore: remove all references to `__SERIALIZE_CUSTOM`
- feat: add support for `StaticArray` serialization
- feat: support `JSON.Raw` in array types
- tests: add tests for `JSON.Raw[]`

## 2025-05-29 - 1.1.14

- fix: hotfix schema resolver

## 2025-05-29 - 1.1.13

- fix: small issues with schema linking
- tests: add tests for schema linking and discovery

## 2025-05-29 - 1.1.12

- fix: add helpful warning on unknown or unaccessible types in fields
- feat: support deserialization of class generics
- fix: add support for numerical generics
- tests: add proper testing for generics
- feat: support type aliases with a custom type resolver/linker
- chore: add other linkers to tsconfig and clean up
- feat: add type alias resolving

## 2025-05-28 - 1.1.11

- fix: class resolving should only search top level statements for class declarations
- fix: add helpful error if class is missing an @json decorator
- fix: properly calculate relative path when json-as is a library
- fix: add proper null check when resolving imported classes

## 2025-05-28 - 1.1.10

- feat: add more debug levels (1 = print transform code, 2 = print keys/values at runtime)
- feat: add write out feature (`JSON_WRITE=path-to-file.ts`) which writes out generated code
- fix: complete full parity between port and original version for correct deserialization of all types
- feat: add proper schema resolution and dependency resolution
- feat: add proper type resolution to schema fields
- fix: properly calculate the relative path between imports to modules

## 2025-05-27 - 1.1.9

- change: strict mode is disabled by default. Enable it with JSON_STRICT=true
- fix: should ignore properties of same length and type if no matching key exists
- fix: should ignore properties of different type if no matching key exists
- fix: should ignore complex properties if no matching key exists

## 2025-05-27 - 1.1.8

- feat: add support for calling `JSON.stringify/JSON.parse` methods inside of custom serializers, but not yet deserializers

## 2025-05-27 - 1.1.7

- fix: bad boolean logic to decide whether to add 2nd break statement

## 2025-05-23 - 1.1.6

- fix: null and boolean fields would miscalculate offsets when deserializing

## 2025-05-23 - 1.1.5

- fix: index.js didn't point to correct file, thus creating a compiler crash

## 2025-05-23 - 1.1.4

- revert: grouping properties in favor of memory.compare

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
