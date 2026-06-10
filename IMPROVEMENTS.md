# Improvements backlog

Prioritized list of library improvements to tackle one at a time. Each item
notes **why**, **what**, rough **effort**, and **status**. Ordered roughly by
value/effort.

---

## 1. Pretty-JSON parse performance (the "canada 10×")  - ✅ DONE (2026-05-29)

**RESULT.** canada *pretty* deserialize: **~139 → 1,182 MB/s (SWAR)** / **1,130 MB/s
(SIMD)** - now on par with minified (1,197 / 1,153 MB/s). The 10× pretty
penalty is gone; whitespace skipping is effectively free. All 10512 tests pass
across naive/swar/simd (added concrete-struct tier-2 specs in
`whitespace.spec.ts`).

**What shipped (three parts):**

1. **Tier-2 codegen** (`transform/src/index.ts`). After the tier-1 exact
   packed-byte template `do/while`, the generator now emits a *second*
   whitespace-tolerant `do/while` for non-optional static structs: `skipWs →
   packed-u64 key match (quotes folded in) → skipWs → ':' → skipWs → field
   deser → skipWs → ','/'}'`. Minified input still takes tier 1 at full speed
   (verified: tier-2 carries only ~1.24× the per-call cost of tier-1, and never
   runs on minified). Optional-field structs are **not yet** tier-2'd (they
   still fall to slow on pretty - see follow-up below).

2. **Whitespace-tolerant array element loops.** The inline string-array and
   object-array fast loops in `getDeserializer`, plus `deserializeArrayArrayBody`
   and `deserializeFloatArrayBody` (already done) / `deserializeFloatArray_SWAR`,
   now skip whitespace between `[`, elements, `,`, and `]`. Added
   `JSON.Util.skipWhitespace`.

3. **Trailing-whitespace dispatch fix** (`assembly/index.ts`, both
   `__deserialize` sites) - *this was the real unlock.* The dispatch accepted
   the fast path only when its return `== srcEnd`. Pretty files end with a
   newline, so tier-2 returned the position just past `}` (≠ srcEnd) and the
   **entire object fell to slow despite a successful fast parse**. Now: accept
   when `skipWhitespace(fastEnd, srcEnd) == srcEnd`. (Without this, tier-2 alone
   only moved canada 139 → 220 MB/s; with it, 220 → 1,182.)

**Follow-ups.**

- ✅ **Optional/`@omitnull` structs (done 2026-05-29).** Added a probe-and-commit
  tier-2 variant for `supportsFastOptionalPath` structs: each field is probed
  with a `kp` cursor and only commits `srcStart` when its key matches, so
  omitted fields are skipped without consuming input (the next field re-probes
  and re-consumes the comma). `seenAny` tracks whether a leading comma is
  expected. Measured: optional struct pretty **197 ns/op @ 2,299 MB/s** vs
  tier-1 min **168 ns/op @ 2,362 MB/s** - ~1.18× wall-clock, identical per byte
  (i.e. tier-2, not the ~5× slow path it used to hit). Matches in canonical
  order (optionals first, then required - the same order the serializer emits),
  so json-as round-trips stay fast; arbitrary external key order still falls to
  slow (see below). 10536 tests green across all 3 modes.
- **Unknown/extra keys + arbitrary key order** - tier-2 matches in
  declaration/canonical order with only schema keys, so unknown keys or a
  reordered producer fall to slow. Rather than a separate tier-3, these are
  folded into **#1c (optimize the slow path)**: slow already handles any
  order/unknown/missing - making it dispatch to the fast field deserializers
  turns that ~5× fallback into ~1.5–2×. See #1c.
- **SIMD array element loops** - ws-skip parity is in the SWAR array loops; the
  SIMD-specific element loops should be audited for the same (canada SIMD already
  wins via the shared SWAR array field path, so low priority).

---

## 1b. (superseded - original notes below)

**Why.** The `canada.bench.ts` pretty-vs-min comparison shows deserializing the
*pretty* (whitespace-padded) payload is ~10× slower than the minified one
(~22 ms vs ~2 ms/op), despite being only ~27% larger. Real-world JSON is often
pretty-printed, so this hits common workloads.

**Investigation notes (2026-05-29).** Pulled @JairusSW's `playground`
`jairus/whitespace` branch (`assembly/whitespace/{ascii,json}.ts`): a clean
scalar/SWAR/SIMD whitespace skipper (general `0x01..0x20` set via Lemire's
single-compare; JSON RFC-8259 set via simdjson low-nibble shuffle LUT). Two
caveats before applying it here:

- **It's byte-oriented (UTF-8, `load<u8>`, 8–16 bytes/window).** json-as parses
  **UTF-16** (`load<u16>`, space = `0x0020`). The *technique* ports, but the
  code must be rewritten for u16 lanes - json-as already has the building blocks
  (`i16x8.eq` classification in the string scanners; u16 SWAR masks).
- **The author's own finding:** the JSON skipper *defaults to scalar* because
  real inter-token gaps are short and SWAR/SIMD setup doesn't amortize; the
  wide variants only win on long synthetic runs. json-as already skips with a
  scalar `isSpace`, and the hot float-array path already calls
  `skipFloatArrayWhitespace` (scalar) per element - so this likely is **not** a
  "missing fast skip" problem.

**ROOT CAUSE (confirmed 2026-05-29).** It is **not** the skip primitive. The
transform-generated `__DESERIALIZE_FAST` is an **exact byte-template match**: it
packs each key + separator into `u64` literals and compares raw bytes, e.g.
`if (load<u64>(srcStart,0) != 34058970400424059 /* "type": */ ...) break;` and
`,"coordinates":` as packed `u64`s. It assumes the *canonical/minified* layout
with no (or fixed) inter-token whitespace. canada.pretty has `\n        ` before
each key and `,\n` between fields, so the packed compares **fail → `return 0` →
`JSON.__deserialize` falls the WHOLE object back to `__DESERIALIZE_SLOW` (naive
scalar)**. So pretty JSON silently runs the slow path end-to-end - that's the
10×, not per-element work. (Verified by reading the generated
`canada.bench.tmp.ts`.)

**Real fix (transform codegen) - the substantive task.** Make
`__DESERIALIZE_FAST` whitespace-tolerant between *structural* tokens
(`{`, key, `:`, value, `,`, `}`) without losing the packed-`u64` speed on
canonical input. Suggested **hybrid**: keep the packed exact-match as the first
attempt (max speed for minified), but on mismatch fall to a *per-field*
whitespace-tolerant matcher (skip ws → match key → skip ws → `:` → skip ws →
value → skip ws → `,`/`}`) **instead of bailing the entire object to naive**.
That keeps minified at today's speed and lifts pretty from naive-speed to
near-fast-path. This is a focused, higher-risk change to the most intricate part
of the transform - worth its own pass.

**Done so far.** `deserializeFloatArray_SWAR` (the *top-level* `JSON.parse<f64[]>`
fast path) was made whitespace-tolerant (skips inline instead of bailing to
naive). This does **not** help canada (which bails earlier at the struct level)
but fixes pretty top-level/bare float arrays. Tests green (10488/0).

**Also relevant:** `deserializeArrayArrayBody` (`swar/array/array.ts`) has no
whitespace handling and `throw`s on inter-element whitespace - currently masked
only because canada's `__DESERIALIZE_FAST` bails to naive before reaching it.
Once the fast path tolerates whitespace, the array bodies must too.

**Effort:** large (transform codegen). The standout perf item; do it as a
dedicated pass.

---

## 1c. Optimize the slow path (dispatch to fast field deserializers) - PLANNED

**Why.** `__DESERIALIZE_SLOW` (`transform/src/index.ts:2062–2520`) is the
universal fallback - it's the only path that handles arbitrary key order,
unknown/extra keys, and missing keys, so anything the ordered fast tiers reject
lands here. It's correct but ~5× slower than the fast path (canada 139 vs
~1,180 MB/s; medium ~280 vs ~1,400). Real workloads that consume *foreign* JSON
(different producers order keys differently - Go structs in decl order, Go maps
alpha-sorted, hand-written JSON) hit this cliff.

**Convergence note.** An optimized slow path *is* the "tier-3 / arbitrary key
order" idea from the tier work - slow already supports any order/unknown/missing;
it just needs to be fast. So **we do NOT build a separate tier-3**; we make slow
fast and keep the architecture `tier-1 → tier-2 → optimized-slow`.

**Three inefficiencies in today's slow path.**
1. **Double-scan every value** - it scans `valueStart..valueEnd`, then
   `JSON.__deserialize<T>(valueStart, valueEnd)` scans those bytes *again* to
   parse. Two passes per value.
2. **Generic re-dispatch + fresh allocation** - `JSON.__deserialize` re-resolves
   the type and allocates new strings/arrays/objects per call; no buffer reuse.
3. **Char-by-char scanning** of keys, value boundaries, and whitespace (no SWAR).

**Core idea.** Replace `scan + JSON.__deserialize` with a direct call to the fast
field deserializer - the exact code `getDeserializer()` already emits for
tier-1/2:
```ts
srcStart = __deserializeStringField<T>(valueStart, srcEnd, out, offsetof<this>("field"));
// or __deserializeFloatField / __deserializeIntegerField / __deserializeArrayField_SWAR
// or the child's __DESERIALIZE_FAST for nested objects
```
These parse in a single pass, reuse `out`'s buffers, and return the end cursor -
so no value pre-scan is needed (skip-ws → `:` → skip-ws → dispatch → continue).
Unknown keys are skipped with `JSON.Util.scanValueEnd`. This kills
inefficiencies #1 and #2 (the big ones).

**Two strategies.**
- **A - surgical swap (lower risk):** keep the existing slow state machine +
  key-dispatch chain; only swap the value handling (field deser at value start,
  use its return as the cursor; drop the pre-scan + `JSON.__deserialize`).
  Captures #1 and #2.
- **B - full rewrite (more upside):** clean key-dispatch loop - SWAR key scan →
  length-bucketed packed dispatch (reuse `groupMembers`/`getComparison`) →
  `getDeserializer` field desers → `scanValueEnd` for unknowns. Captures all
  three; becomes the canonical general fallback.

**Recommendation:** do A first, bench, then decide on B (A de-risks the riskiest
edit in the codebase and captures most of the win).

**Details to handle.**
- Reuse `getDeserializer` (`keyOffset:0`, fastPath). Its `break`-to-bail needs
  adapting for slow context: a bail here = genuinely malformed → throw/STRICT
  error (slow is the last resort, not "fall to next tier").
- Unknown keys → `JSON.Util.scanValueEnd` to skip.
- Buffers reused (slow runs after `__INITIALIZE`); no per-value alloc.
- Nested objects/arrays → child's `__DESERIALIZE_FAST` (own tier ladder).
- **Import injection** (`transform/src/index.ts:~3469`) currently keys off
  *fast-path* usage - must also cover slow-path usage so non-`useFastPath`
  structs that now reference field desers still resolve.
- **Generics scoping:** generic structs (`hasTypeParams`) have no fast path and
  field desers can't bind an unknown `T` - keep the current `JSON.__deserialize`
  slow path for those; optimize only concrete structs.
- Preserve STRICT throw-on-unexpected-key behavior.

**Risk & mitigation.** Slow is the universal correctness backstop - highest-risk
change in the repo. Must stay green on the full suite (10,536) across all 3
modes; lean on the structure fuzzer + cross-mode equivalence (#5) - ideally land
that fuzzer *before* strategy B.

**Expected gains.** ~5× → ~1.5–2× of tier-1, i.e. roughly **3× faster slow path**
for misordered / unknown-key / foreign-JSON workloads.

**Measurement.** Add misordered + unknown-key + foreign-order cases to
`assembly/__benches__/custom/tier-h2h.bench.ts`; bench before/after (also
retroactively quantifies the misordered-keys penalty).

**Increments (one-at-a-time):** (1) strategy A on one struct (e.g. canada),
verified + benched; (2) roll A across all concrete structs, full suite + fuzz;
(3) decide on B with the fuzzer as safety net.

**Effort:** large (transform codegen, riskiest path). High value.

---

## 2. Route `Array<T>` struct fields through a dispatcher

**Why.** `deserializeArrayField_SWAR` is the *only* field helper the transform
doesn't route through an `index/` dispatcher - array fields always use SWAR even
in NAIVE/SIMD builds. Inconsistent with every other field type, and leaves SIMD
array-field throughput unused.

**What.** Add a `deserialize/index/array` `deserializeArrayField` dispatcher
(NAIVE/SWAR/SIMD on `JSON_MODE`), give the modes matching signatures, and have
the transform inject `__deserializeArrayField` from the barrel like the others.

**Effort:** medium.

---

## 3. Don't trap the wasm instance on malformed input

**Why.** The hot scanners `abort("Failed to parse JSON!")` /
`"Expected leading quote"` / `"Unterminated string literal"`, while a few paths
`throw`. `abort()` **traps the whole module** - a server parsing untrusted JSON
crashes instead of getting a catchable error. Error handling is also
inconsistent (trap vs throw).

**What.** Unify on a recoverable error path (throw, or a `JSON.tryParse<T>()` /
validate API that returns a result/null). Audit all `abort`/`unreachable` in the
deserialize path.

**Effort:** medium. High correctness/safety value.

---

## 4. Deep-nesting stack guard

**Why.** Deserialization recurses; deeply nested input (`[[[[…]]]]`) can blow the
wasm stack - a classic JSON DoS vector.

**What.** Add a configurable depth limit (or convert the hottest recursion to an
explicit stack) and reject beyond it via the #3 error path.

**Effort:** small–medium.

---

## 5. Structure-level fuzzing + cross-mode equivalence tests

**Why.** `__fuzz__/` covers only atoi/float. Given the hand-tuned SWAR/SIMD
pointer math, a structure fuzzer would catch off-by-ones the manual h2h
`expect`s only spot-check.

**What.** Fuzz random JSON → round-trip (`parse` then `stringify` ≡ canonical),
plus assert NAIVE == SWAR == SIMD for the same input across types/escapes/
whitespace.

**Effort:** medium.

---

## 6. Dead-code cleanup  (quick win)

- `deserialize/swar/string.ts`: `deserializeEscapedStringContinuation_SWAR_MergedTuned` - defined, never called.
- `assembly/__benches__/custom/canada.data.ts` - orphaned after the canada bench switched to `readFile` of the payload variants (~2 MB).

**Effort:** trivial.

---

## 7. SIMD standalone string deser (moderate-density escapes)

**Why.** `deserializeString_SIMD`'s HYBRID escaped scanner trails the prior
overflow-pattern code ~20% on sustained moderate-density escaping (accepted
tradeoff; wins dense + sparse). Revisit if it matters - a combined
multi-escape-per-block + bulk-run scanner might recover it.

**Effort:** medium. Low priority.

---

## 8. Number edge-case audit

**Why.** Robustness: integer overflow on out-of-range values, `NaN`/`Infinity`
handling, float precision, very large `u64`/`i64`.

**What.** Define + test behavior for each (reject vs clamp vs wrap), aligned
with the #3 error path.

**Effort:** medium.

---

## 9. `package.json` `exports` map

**Why.** AS ignores `exports`, but consumer bundlers / Node ESM honor it; a
proper map (incl. the `lib/`, `assembly/` subpaths the transform emits) improves
DX and prevents subpath-resolution surprises in mixed toolchains.

**Effort:** small.

---

## 10. Streaming / incremental parse  (big bet)

**Why.** Large payloads (e.g. the 33 MB events fixture) load fully into memory.
A streaming/incremental API would cut peak memory for huge inputs.

**Effort:** large (real feature). Lowest priority.

---

## 11. Shorter compile times / less Binaryen pressure  - PLANNED

**Why.** `asc`'s Binaryen `optimize` pass dominates build time. Measured on the
multilib `Repo` bench (~80-field struct) at `-O3`: optimize **8332 ms** vs compile
237 ms, parse 79 ms, emit 64 ms, transform 51 ms. So every lever is "feed Binaryen
less, or run fewer passes." By impact:

**a) Opt level (free, no code change).** `-O3` buys ~0% size over `-O2` and only
+2% over `-O1`, for 4× the time:

| opt | optimize | module    |
|-----|----------|-----------|
| -O3 | 8332 ms  | 356,860 b |
| -O2 | 5013 ms  | 356,860 b (identical) |
| -O1 | 2019 ms  | 364,751 b (+2%) |

Keep `-O3` for published benchmarks (runtime matters); document `-O1`/`-O2` for dev
iteration, CI, and end users who don't need peak parse throughput. The test suite
already builds `--debug` (no `-O`), so it isn't the bottleneck.

**b) Chunk the SLOW deserializer** like the FAST tiers already are (`chunkFastBlocks`
/ `chunkFastBlocksOptional`). `__DESERIALIZE_SLOW` is the last big unrolled per-field
function; Binaryen's per-function passes are superlinear, so splitting it into
helpers cuts optimize time and dodges the crash ceiling FAST hit. Overlaps with #1c.

**c) `minified-only` flag to skip FAST tier-2.** Each struct emits two unrolled FAST
deserializers - tier-1 (minified) and tier-2 (whitespace-tolerant). json-as's own
output is minified and most wire JSON is too, so a `JSON_FAST_MINIFIED_ONLY` build
flag (falling to SLOW on whitespace) roughly halves the FAST code.

**d) Optional SLOW path.** SLOW is always emitted as the FAST fallback even though
FAST handles all valid input; a flag to drop it shrinks size-sensitive builds.

**Already banked:** `@inline` + `inline.always` removal, FAST chunking, and
width-tiering all cut exactly this optimize input.

**Effort:** (a) trivial/docs; (b) medium (mirror the FAST chunking); (c)/(d) small
(flag-gated codegen).
