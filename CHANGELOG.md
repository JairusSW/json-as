# Changelog

## Unreleased

- bench: object throughput gains **eager-vs-lazy** coverage. `assembly/__benches__/throughput/obj-{serialize,deserialize}.lazy.bench.ts` mirror the eager sweeps with `@json({ lazy: "auto" })` classes (dumped as `obj-lazy-*`): lazy deserialize measures the scan-and-record-ranges fast path (deferred fields never read), lazy serialize measures the raw-passthrough path (parse once, then re-serialize untouched). Wired into `scripts/build-chart{09,10}.ts` as a dashed AS-only series (JS has no lazy mode), and into the per-payload bars of `scripts/build-chart{01,02}.ts` as a distinct faded-copper bar at 0.8 fill opacity to flag that lazy defers work (not strictly apples-to-apples; only the 5 payloads with a `*.lazy.bench.ts` get a bar)
- bench: sub-1MB throughput sweeps step every **100 kB** instead of 50 kB (1 kB baseline + 100–900 kB + 1–10 MB) — half the sub-1MB points, same coverage shape. Applied across the AS benches (`assembly/__benches__/throughput/{str,obj}-{serialize,deserialize}.bench.ts`), their JS counterparts (`bench/throughput/`), and the chart payload lists (`scripts/build-chart{07,08,09,10}.ts`)
- fix(bench): restore the lazy **access-pattern** benchmark dropped when `lazy.bench.ts` was split into per-concern files. `assembly/__benches__/lazy/access-pattern.bench.ts` re-emits the `lz-access` suite (eager read-all baseline + lazy read-none / read-one / read-all / passthrough on a medium struct) that `scripts/build-chart15.ts` reads for `lazy-access-pattern.svg` — the chart had been aborting with ENOENT on `lz-access.eager`
- tooling: `bun run playground:tmp` builds and runs the transform-generated `assembly/playground.tmp.ts` directly (no transform) under the v8 bench runner, for hand-tuning the generated codec. `assembly/playground.ts` is now a fast-path (non-lazy, eager) deserialize micro-bench — a direct `__DESERIALIZE_FAST` into a reused object with a min-over-rounds timer

## 2026-06-05 - v1.4.0

- feat(lazy-fields): **on-demand (lazy) field parsing.** Mark a field `@lazy`, wrap its type as `JSON.Lazy<T>`, or set a class-wide default with `@json({ lazy: "auto" | "all" })` (and opt individual fields back out with `@eager`). A lazy field stores its raw JSON slice at parse time and parses it into the field's type only on first access (then caches); a field you never read is never parsed, and an untouched field round-trips by copying its original source bytes — never re-parsed or re-serialized. `auto` defers the expensive-to-parse fields (strings, arrays, maps/sets, `JSON.Value`/`Obj`/`Raw`, non-trivial nested structs) and keeps cheap ones eager (primitives, enums, `Date`, tiny all-scalar structs); `all` defers every field (best for proxy / filter / forward over large payloads). Skipping or forwarding fields is several× faster than eager and the win grows with payload size. The slot is a single `u64` — `0` = absent, `u64.MAX_VALUE` = materialized, otherwise a packed `(start<<32)|end` source range; a ≤32-bit scalar packs its value into the slot directly (no traced memo field). `@omitnull` / `@omitif` work on lazy fields (null-ness is read from the slot without materializing). A class with a custom `@serializer`/`@deserializer` can't have lazy fields (the transform reports an error). See the Lazy Fields guide for the full API and trade-offs
- perf(transform): the generated fast-path deserializer (`__DESERIALIZE_FAST`) is split into ~32-field chunk helper methods instead of one unrolled function — for both the straight-line tiers and the `seenAny`-stateful `@omitnull`/`@omitif` tiers (the latter threads `seenAny` across chunk boundaries through the call ABI, packed into the `u64` return alongside `srcStart`). A wide struct previously emitted a single function large enough to crash the Binaryen optimizer ("crashed during optimize") a few hundred fields in; chunked, the fast path stays compilable at any width (verified to 1000 fields) and optimizes faster, since Binaryen's per-function passes are superlinear
- perf(codegen): dropped `@inline` from the (de)serialize worker functions and removed every `inline.always()` call-site directive. They forced each worker to be copied into every dispatch / call site; as plain shared calls the generated module shrinks (~18% on the all-lazy `large` struct) and the Binaryen `optimize` phase eases. Dispatchers and genuinely small helpers keep `@inline`
- fix(lazy-fields): the lazy serialize path now `ensureSize`s before the structural key literals, not just the value passthrough. A wide struct (~150 fields, long keys) could overrun the output buffer once a passthrough left it nearly full — `JSON.stringify(JSON.parse<T>(...))` trapped with `unreachable`. The passthrough reserves exactly the slice bytes (unlike eager string serialize, which over-reserves for quotes/escaping), so the key writes that follow needed their own bounds check
- fix(lazy-fields): a *constructed* (not parsed) instance keeps its declared field defaults. Lazy lowering replaced each field with a slot and dropped its initializer, so `new T()` serialized the type default (`null` / `0`) instead of e.g. `"x"` from `name: string = "x"`; the slot is now seeded in the materialized-default state. `JSON.parse` (which builds via `__new`, skipping field initializers) is unaffected
- fix(serialize): `@omitnull` / `@omitif` fields emit a **leading** comma gated on a runtime "wrote" flag, not a trailing one. Optional fields sort to the front, so a present field followed by omitted ones — or an all-optional struct — left a dangling trailing comma, i.e. invalid JSON like `{"a":"1",}`. Added a regression test (first / last / gap / all-absent / all-present, plus the mixed-with-regular case)
- feat: `JSON.Value` moved to a NaN-boxed representation, and its value scanning now runs through the SWAR / SIMD scanners (~60% faster on value-heavy input)
- bench: committed eager-vs-lazy benchmarks under `assembly/__benches__/lazy/` (deserialize / round-trip / serialize) + `lazy:"auto"` variants of small/medium/large/token/vec3, and a `lazy` json-as struct in the multi-library comparison (`__benches__/multilib/`); charting in `scripts/build-chart15.ts` and the multilib charts
- docs: Lazy Fields guide + performance charts (eager-vs-lazy by payload size and a multi-library throughput comparison), full JSDoc for the decorators in `assembly/index.d.ts`, and a single shared chart colour palette (`scripts/lib/palette.ts`)

- feat: `JSON.parse<T>(data, out)` — deserialize into an existing object graph instead of allocating a fresh one, symmetric with the existing `JSON.stringify<T>(data, out)`. On the fast path every field is reused in place (nested structs threaded as `dst`, strings `__renew`d only when the byte length changes, arrays keeping capacity), so a steady-state re-parse of the same shape allocates **nothing** after the first call — ~4× on SWAR (~720k → ~2.8M ops/s) and ~4.5× on SIMD on the multilib struct payload, heap `totalDelta` 1,034,240 B → 0. Backward compatible: `out` defaults to a type-correct zero via `__zero<T>()` (branches on `isReference`/`isManaged` at compile time, since a bare `changetype<T>(0)` is a size mismatch for value types like `bool`/`f64`)
- feat: `JSON.stringify<T>(data, out)` now reuses `out` for composite values (structs, arrays, strings), not just the scalar/`Date` fast paths. The reference serialize branches route their final write through a new `bs.outTo<T>(target)` that overwrites the existing string in place — or `__renew`s when the length differs — instead of `__new`-ing a fresh one via `bs.out`. Zero-alloc serialize on reuse: SWAR ~2.31M → ~2.61M ops/s (~+13%), heap `totalDelta` 882,000 B → 0
- perf: the fast path (`__DESERIALIZE_FAST`) is now generated for **NAIVE** mode. It was disabled for naive (`requestedFastPath = USE_FAST_PATH && codegenMode !== JSONMode.NAIVE`), so naive always ran `__DESERIALIZE_SLOW` after `__INITIALIZE` had reallocated every field — which meant `parse(data, out)` reuse reallocated the whole graph in naive. Enabling it is purely additive (the slow path remains the fallback for whitespace / reordered / missing-key input): naive fresh parse ~2× (~314k → ~644k ops/s), naive reuse ~6.7× (~316k → ~2.1M) with nested structs/arrays/strings now reused in place. Main suite (10,590) and RFC suite unchanged across all three modes
- perf: escape-free string **fields** skip the scratch-buffer round-trip in NAIVE. `deserializeStringField_NAIVE` previously copied every char into `bs` then `bs`→field; it now scans for the closing quote without touching `bs` and copies source→field directly when no backslash is present (matching the SWAR/SIMD field paths), diverting to a `bs`-based decode tail only for escaped strings. ~+6% naive fresh parse; SWAR/SIMD already did this
- fix(build): drop `@inline` from `deserializeStringField_NAIVE`. Once the fast path was enabled for naive (above), this loop-bearing scanner got inlined into every string-field call site inside the `@inline __DESERIALIZE_FAST`, exploding binaryen's optimize phase — `bun run bench:as -- large --mode naive` went to ~118 s in `optimize` alone (the transform itself is ~23 ms). Kept as a single shared function — one call per field — matching the already-non-inline SWAR/SIMD field deserializers. naive `large` build **120.6 s → 8.6 s** asc (full repro 2:17 → ~13.5 s), and it's also ~12% *faster* at runtime (the bloated inline body optimized worse). `__DESERIALIZE_FAST` itself stays `@inline`
- test: `assembly/__tests__/parseinto.spec.ts` — reuse correctness across all three modes: `parse(data, out)` fully overwrites the target (with pointer-identity asserts that nested structs and arrays are reused, not reallocated), and `stringify(data, out)` reuses the output string in place (same length) and resizes correctly (different length)
- bench: `json-as-struct-{deserialize,stringify}-reuse.bench.ts` under `__benches__/multilib/` — reuse-path counterparts to the fresh benches, used with `--memory` to confirm the zero-allocation steady state

## 2026-06-01 - v1.3.9

- fix: remove readFileSync which failed under virtual file systems

## 2026-06-01 - v1.3.8

- feat(strict): the **naive value-path deserializers now reject malformed JSON** instead of silently accepting it (RFC 8259). Numbers (`deserializeFloat_NAIVE`) are validated against the JSON number grammar — no leading zeros, bare `-`, empty fraction/exponent, `+` sign, hex, or trailing garbage (the `NaN`/`Infinity` extension is preserved). Strings (`deserializeString_NAIVE`) reject unescaped control chars, illegal/incomplete escapes, non-hex `\u`, and missing surrounding quotes. The scalar/typed **array scanners** (`f64[]`/`i*[]`/`u*[]`/`bool[]`/`string[]`) were rewritten as strict state machines: `[`-framed, single-comma separated, no leading/trailing/doubled commas, no inter-value garbage. On the JSONTestSuite `n_` corpus (parsed against concrete types, one spec per case in `assembly/__tests__/rfc/`), naive now **rejects 179/188** reject-cases — up from 55 — the remaining 9 being the intentional `NaN`/`Infinity` extension (5) plus arbitrary-`JSON.Value`/formfeed/struct-trailing edges (4). Non-object rejects compile to uncatchable aborts until try-as traces the value path; object rejects (struct `__DESERIALIZE_SLOW`) are catchable today. Main suite (10,557) and curated rfc suite (801) stay green across all three modes
- feat(strict): under `JSON_STRICT=true` the generated `__DESERIALIZE_SLOW` object scanner now rejects malformed key positions — an unquoted / single-quoted / numeric key, or garbage after a value with no separating comma — by requiring the first non-space char at each key position to be a string-opening quote, `,`, or `}` (`transform/src/index.ts`). Combined with the existing strict unknown-key-by-value-type guards, this brings RFC 8259 `n_object` coverage to **28/28** (all three modes) in the conformance suite (`assembly/__tests__/rfc/struct-reject.spec.ts`, parsed against one rich all-value-type schema so every guard is generated). Gated on `JSON_STRICT`, so the default lenient build is unchanged
- test: RFC 8259 accept-side coverage is now complete — all **95** `y_` (must-accept) cases parse via the dynamic `JSON.Value` type (`assembly/__tests__/rfc/accept.spec.ts`) and **31/35** `i_` (impl-defined) cases (`impl.spec.ts`), all green across NAIVE/SWAR/SIMD. The 4 deferred `i_` cases are uncatchable traps (raw UTF-16/BOM byte input, depth-500 nesting). RFC suite now 804 tests across 3 modes
- fix: tier-1 (the exact byte-template fast path) over-matched whitespace after a colon. For input like `{"k": v}` (a space after the colon but otherwise compact — e.g. Python's `json.dumps` default), tier-1 matched the minified `{"k":` prefix then read the value at a fixed offset that the space shifted, feeding a misaligned pointer to the value deserializer — string fields `abort`ed ("Expected leading quote") and float fields hit `unreachable`. Tier-1 now checks for whitespace after the colon and bails to the (whitespace-tolerant) tier-2 instead of mis-reading. Surfaced via the RFC 8259 conformance work
- fix: add `bs.reset()` to `lib/as-bs.ts` — restores the shared serialization buffer to a clean state (offset + pause stacks) after a throw aborts a (de)serialize mid-flight, so the next op isn't corrupted by a dangling offset
- test: begin RFC 8259 conformance coverage from nst/JSONTestSuite as typed specs (`assembly/__tests__/rfc-object.spec.ts`, accept/round-trip cases; see `RFC-DEFERRED.md` for status and the reject-case blocker)

- perf: pretty-printed JSON now stays on the fast path instead of collapsing to the naive scalar deserializer (the "canada 10×"). The transform's `__DESERIALIZE_FAST` gained a whitespace-tolerant **tier 2**: when the exact packed-`u64` byte-template (tier 1) misses on inter-token whitespace, instead of dumping the whole object to `__DESERIALIZE_SLOW` (~5× slower) it re-matches per field using the same packed key constants but skips whitespace between every structural token (`{`, key, `:`, value, `,`, `}`). Minified input never reaches tier 2, so tier 1 keeps peak speed. canada *pretty* deserialize **~139 → ~1,180 MB/s (SWAR)** / **~1,150 MB/s (SIMD)** — on par with minified; on a value-heavy struct tier 2 costs ~1% over tier 1 (worst case ~2× on a 16-field all-primitive struct). The SWAR array bodies (`deserializeArrayArrayBody`, `deserializeFloatArrayBody`, the inline string/object array element loops) were made whitespace-tolerant to match
- fix: `JSON.parse` / `JSON.__deserialize` accepted a fast-path result only when it consumed *exactly* to `srcEnd`. Pretty files end in a newline, so tier 2 stopped just past the closing `}` and the **entire object silently fell back to the slow path despite a successful parse** — this was the real cause of the pretty penalty (tier 2 alone only moved canada 139 → 220 MB/s; this fix took 220 → ~1,180). The fast path is now accepted when only trailing whitespace remains (`skipWhitespace(fastEnd, srcEnd) == srcEnd`)
- perf: optional-field structs (`@omitnull` / `@omitif`) get a whitespace-tolerant tier 2 as well — a probe-and-commit variant that matches each field's key with a lookahead cursor and only commits past the separator + key + `:` when it matches, so omitted fields are skipped without consuming input. Previously these structs fell to slow on *any* whitespace. ~1.18× of tier-1 on a pretty 7-field optional struct, vs the ~5× slow path it used to hit
- fix: enforce a uniform whitespace contract across **every** deserialize handler in all three modes (field and non-field): the entry points (`JSON.parse` / `JSON.__deserialize`) skip leading whitespace once, and every handler now assumes `srcStart` points at the first non-whitespace char and never re-skips it. Removed ~17 now-redundant leading-whitespace trims from composite handlers (naive `object`/`map`/`set` + array/staticarray composites; SWAR array bodies); composites still skip whitespace *internally* since they are the caller for their child values/keys
- fix: Map and Set struct **fields** did not handle internal whitespace — `deserializeMapBody` had no inter-token skips at all, and `deserializeSetDirect`'s skips were gated behind an `allowWhitespace` flag the field path left `false`. Concrete structs with `Map`/`Set` fields parsed from pretty input silently misparsed (only the generic-box slow path that existing tests exercised handled it). Both now skip whitespace unconditionally
- fix: `scanValueEnd` (both `util/scanValueEnd.ts` and `swar/array/shared.ts`) now stops a scalar value at trailing whitespace, not just `,`/`]`/`}`. The returned range previously included trailing spaces (e.g. `"1 "`), which the SWAR/SIMD scalar number parsers — assuming `[srcStart,srcEnd)` is the exact value — misparsed (a whitespaced map value `{ "p" : 1 }` deserialized to `-6`). Now matches the already-correct `JSON.Util.scanValueEnd`
- bench: add `assembly/__benches__/custom/tier-h2h.bench.ts` — tier-1 (minified) vs tier-2 (one leading space, isolating pure path overhead) vs tier-2 (fully pretty), across a value-heavy `medium` struct, a 16-field all-primitive worst case, and an optional-field struct (with a non-optional twin to isolate the `seenAny` tier-1 overhead)
- test: add concrete-struct whitespace coverage to `whitespace.spec.ts` — tier-2 fast-path structs (nested objects, float/string/object arrays), the optional-field probe path, top-level leading whitespace for every scalar/array type, and one struct touching every field-handler family (scalar/string/nested-object/array/Map/Set) parsed from heavily-whitespaced (leading + internal + trailing) input
- perf: fully vectorize the SIMD string **field** deserializer. `deserializeStringField_SIMD` previously bailed to `deserializeStringField_SWAR` on the first backslash, so SIMD mode got zero vectorization on escaped struct fields. It now runs a HYBRID escaped scanner — v128 scan for `"`/`\`; escape-bearing blocks use a single whole-block v128 store to copy the plain prefix for free, then decode the escape; clean runs stream the first block then bulk-`memcpy` the remainder (bandwidth-optimal on long sparse runs, no large-input cliff). Validated against run-copy and pure-stream variants across escape densities; ~+10–20% on common small/moderate/sparse cases
- perf: replace the SWAR string **field** scanner (formerly the run-copy `deserializeEscapedStringScan_SWAR_SplitTuned`) with the same HYBRID strategy, renamed `deserializeEscapedStringField_SWAR`. On the `swar-string-deser-hybrid-h2h` bench: +50–70% dense, +17–22% moderate, +37–48% sparse — the prior run-copy scanner read each plain run twice (scan + `memcpy`)
- perf/fix: the standalone whole-value scanners (`deserializeString_SWAR` / `deserializeString_SIMD`) also move to the HYBRID strategy, replacing the older "overflow-pattern" SIMD code. Also fixes a latent out-of-bounds read on short escaped strings — the unguarded `srcEnd - 16` underflow is now guarded with `srcEnd >= 16`
- refactor: route string-field deserialization through the `deserialize/index/string.ts` dispatcher (`deserializeStringField`), matching the integer/unsigned/float field helpers, instead of the transform hard-coding `deserializeStringField_SWAR` / `_SIMD` by `codegenMode`. Adds a real `deserializeStringField_NAIVE` (NAIVE builds previously deserialized struct string fields with the SWAR field scanner) and unifies all three mode variants on the 3-param `(srcStart, srcEnd, dstFieldPtr)` signature
- refactor: rename the `simple/` (de)serialize implementation directories to `naive/` and carry the mode suffix on the source functions (`*_NAIVE` / `*_SWAR` / `*_SIMD`), eliminating the `as X_NAIVE` import aliases at call sites
- fix(build): drop `@inline` from `deserializeStringField_SIMD`. As an `@inline` entry it let binaryen inline the loop-bearing escaped scanner into every struct string-field call site, exploding `large` SIMD compile ~24× under `--converge` (4 s → 99 s, 221 KB → 555 KB wasm). Kept as a single shared function (matching the already-non-inline `deserializeStringField_SWAR`); `large` SIMD build is back to ~4 s / 138 KB with unchanged runtime
- bench: add string-perf benches under `assembly/__benches__/custom/` — `simd-string-deser-scratch-h2h`, `simd-string-deser-variants-h2h`, `simd-string-deser-standalone-h2h`, and `swar-string-deser-hybrid-h2h` (escape-density head-to-heads for the HYBRID scanners); `serialize-string-modes-h2h` (NAIVE/SWAR/SIMD landscape, confirms streaming serialize already beats run-copy 2–6× so no HYBRID change is warranted); and `serialize-string-safety-h2h`, which checks SWAR/SIMD serialize byte-for-byte against NAIVE across 430 adversarial escape/surrogate/boundary-length inputs — confirming the SIMD `store<v128>` overflow stores stay within buffer slack

## 2026-05-20

- perf: unify the SWAR 4-digit kernel across array entry points. `swar/array/integer.ts` and `swar/array/float.ts` now import `parse4Digits_PairMul` from `util/swar-int.ts` (Lemire-style PairMul) instead of defining a local Baseline variant. `JSON.parse<u32[]>` ~27.4 ms/op @ 64 MiB (up ~17% from ~33 ms) and `JSON.parse<Int32Array>` ~29.5 ms/op @ 64 MiB (up ~17% from ~35.6 ms). Float wins are smaller (~2-4%) since dragonbox dominates
- perf: `deserializeIntegerArrayInto` (the `Array<int>` struct-field path) inlines `parseSignedIntegerSWAR` / `parseUnsignedIntegerSWAR` directly instead of routing through the per-element `deserializeIntegerField` / `deserializeUnsignedField` dispatchers. The element parser is now identical across all three call sites (top-level `JSON.parse<T[]>`, `swar/typedarray.ts`, struct field). Tuning note: array path uses parse4 + scalar even for unsigned — parse8 wins for the single-token struct field where the digit run is aligned, but in arrays the `,` separator lands mid-load and forces a wasted validate, costing ~23% on `u32-64mib`
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
- bench: new throughput benches at `assembly/__benches__/custom/{u8,u32,f64,bool}-64mib.bench.ts` for deserialize and `serialize-primitive-arrays.bench.ts` for stringify; head-to-head benches `itoa-h2h.bench.ts` (`itoa_buffered` vs jeaiii) and `parsefloat-h2h.bench.ts` (existing parser vs Lemire-lite at `util/parsefloat-fast.ts` — research, not wired in due to test expectations encoding the existing parser's rounding behaviour)
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
>>>>>>> cf237fa (chore: release 1.3.0)
