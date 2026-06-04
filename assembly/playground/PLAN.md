# On-demand (lazy) JSON parsing — plan from start to finish

Status: prototype validated, design locked on the central finding below. This
doc is the full path from the current `playground/` scaffold to a shippable
`JSON` on-demand API.

---

## 0. The finding that drives everything

Benchmarked the prototype on the `small.bench.ts`-style payload
`{"uid":7,"token":"abcdef"}` (5M iters × 3 rounds, best-of, `-O3 --enable simd`,
incremental GC, memory pre-grown so `memory.grow` never fires in the loop):

```
  eager  parse + read both     70.7 ns/op    1.00x
  eager  parse + read one      71.1 ns/op    1.01x
  lazy   class  read both     189.8 ns/op    2.68x   ← LOSES badly
  lazy   class  read one       98.7 ns/op    1.40x   ← LOSES
  loc    0-alloc read both      65.4 ns/op   0.93x   ← beats eager
  loc    0-alloc read one       13.8 ns/op   0.20x   ← 5x faster than eager
```

Two conclusions, both load-bearing:

1. **The `Value`/`Document` class API is a trap.** It allocates a heap object
   per navigation hop (`Document.from`, `.root`, every `.get`/`.at`). On a small
   document there is nothing to skip, so those allocations are pure overhead and
   lazy loses by 1.4–2.7×. The convenient OO surface is exactly what kills it.

2. **A zero-allocation value-cursor wins even on the smallest input.** Operating
   on the packed `Loc` (`(start<<32)|end` in a `u64`, passed by register) does
   the identical scanning with zero heap until the final string copy. Reading
   one field is **5× faster than eager** (skips the struct alloc *and* the
   `token` string copy that eager always pays); reading both is a hair faster.

**Design principle #1 (non-negotiable): navigation allocates nothing.** The
cursor is a value (`u64`), not an object. Every accessor that doesn't materialize
a string/array/object must be heap-free. This is the difference between the
feature being a win and being a regression.

Everything below is built around that constraint.

---

## 1. Where on-demand wins and loses (cost model)

On-demand trades *eager whole-document cost* for *per-probe cost*. Let a
document have `F` fields and you read `R` of them.

| regime | eager | on-demand (0-alloc) |
| --- | --- | --- |
| read 1 of many (`R≪F`) | parse all `F`, alloc all | scan to 1 key, decode 1 — **big win** |
| read all (`R=F`), sparse cursor | one pass | `F` keyed scans = O(F²)-ish — **loses** |
| read all (`R=F`), dense cursor | one pass | one deferred pass — **~par** |
| huge value you skip (big string/array field) | copied/built always | never touched — **big win** |
| tiny object, read all | one SIMD pass | comparable, slight edge either way |

So the headline use cases are: **large documents where you read a few fields**
(API responses where you want 2 of 30 fields; `github-events`, `large`,
`canada` probing one coordinate), and **documents with large fields you skip**.
The losing case (sparse cursor, read everything) is handled by the *dense*
codegen variant (§4). The benchmark target is therefore NOT only `small` — we
add a large-doc-sparse-read bench (§9) where the win is order-of-magnitude.

**Two reference points** — `JSON.parse<>()` comes in two forms, and on-demand
competes with both:

- **Typed** `JSON.parse<T>()` — needs a compile-time `@json` struct. Fast: SIMD
  key-match, stores straight into struct fields. This is the hard baseline.
- **Dynamic** `JSON.parse<JSON.Obj>()` — untyped keyed access to JSON of unknown
  shape (the same job on-demand does). Eagerly materializes the *whole* object
  graph: a `JSON.Obj` key buffer + a `JSON.Value[]` of every member, each
  NaN-boxed. Pays for all `F` fields whether or not you read them.

**Empirical (small 2-field object, and 12-field object reading 1 field):**

```
  small:                       ns/op    vs typed
    parse<Token>  (typed)       69.6     1.00x
    parse<JSON.Obj> (dynamic)  532.0     7.64x   ← materializes everything
    loc  read both              59.7     0.86x
    loc  read one               12.6     0.18x

  wide (12 fields), read 1 field:
    parse<Wide>   (typed)       85.0     1.00x   (parses all 12 regardless)
    parse<JSON.Obj> (dynamic) 1610.8    18.9x    (builds Obj + 12 Values)
    loc  read first             12.2     0.14x   ← 7x vs typed, 132x vs dynamic
    loc  read last              94.4     1.11x   ← worst case, ~parity w/ typed
```

So on-demand vs **typed** parse: 7× faster on an early field, ~parity worst
case (last of 12). On-demand vs **dynamic** `JSON.Obj` — its real competitor:
**9× faster** (small, both fields), **39× faster** (small, one field), **132×
faster** (wide, first field), **17× faster** even reading the last of 12. The
cursor pays only for the path it walks; the dynamic API pays the full
materialization up front every time.

**The scaling law on a REAL large document** (5.2 KB GitHub repo API object,
~80 fields, `repo.data.ts` + typed `repo.struct.ts` — lifted from
`large.bench.ts`). Baseline is the **fast typed** `JSON.parse<Repo>` (SIMD
key-match, direct field stores) — the hard bar, not the dynamic API (which is
itself 5.4× slower than typed and was flattering on-demand):

```
  eager  Repo struct read 3    2809.6 ns   1.00x   ← fast typed parse (the real bar)
  eager  Repo struct read 1    2791.6 ns   0.99x   ← same cost; eager parses all ~80
  dyn    Obj parse + read 3   15173.4 ns   5.40x   (untyped — softer baseline)
  loc    read first (id)         23.9 ns   0.01x   ← 117x faster than typed
  loc    read owner.login       652.7 ns   0.23x   ← 4.3x faster (nested, near start)
  loc    read last (branch)    2767.4 ns   0.98x   ← parity (full 5 KB scan)
  loc    cursor read 3         3005.9 ns   1.07x   ← slightly SLOWER than typed
```

The honest read against the fast typed path:

- **Sparse read of an early/nested field → huge win** (117× for `id`, 4.3× for
  `owner.login`). Eager pays ~2.8 µs to parse all ~80 fields no matter what; the
  cursor pays for the path walked.
- **Read a *late* field, or several fields incl. a late one → parity-to-slightly
  -slower** (0.98×–1.07×). When the cursor must scan most of the document anyway,
  eager's single SIMD pass with direct stores is hard to beat — and reading N
  fields via the cursor is roughly one pass + per-field overhead.

So on-demand's advantage is **sparsity + earliness of access**, not raw scan
speed. vs the **dynamic** `JSON.Obj` (its true peer — untyped, unknown shape) it
wins everywhere (5–650×); vs a **typed** struct it wins only when you skip real
work. The gap vs typed on the worst case (last field, ~2.8 µs over 5 KB) is what
the structural index (Phase 6) targets — simdjson skips a value to its end in
O(1) via the index; we scan to it (SIMD-accelerated, Phase 7, but still linear).

Gap-vs-dynamic still **widens with size** (the materialization the cursor avoids
grows): 141× on the 85 B wide object → 634× on the 5.2 KB repo, read-first.

---

## 2. Current prototype inventory (`playground/`)

| file | what it is | state |
| --- | --- | --- |
| `lazy.ts` | `Loc` packing, `classify`, `scanValueEnd`, `Value`/`Document`/`ObjectIter` classes, NaN-box cache, **new** zero-alloc `docRootLoc`/`locGet`/`locAsI32`/`locAsString` | structural scan real; `asF64`/`asString` stubbed (no full grammar, no unescape); `set` stubbed |
| `token.example.ts` | hand-written shape of the **sparse** transform codegen | illustrative |
| `token.dense.example.ts` | hand-written shape of the **dense** (fill-on-first-touch) codegen | illustrative |
| `bench.ts` + `bench.run.mjs` | eager vs class-lazy vs loc-lazy micro-bench | runs, see §0 |
| `README.md` | mental model + representation notes | current |

What's real: cursor packing, `kind` (O(1) first-byte), `length` (one shallow
pass), `get`/`at`/`ObjectIter` with escape- and nesting-aware scanning,
allocation-free key compare, integer + bool decode, the **0-alloc loc API**.

What's stubbed / missing: full float grammar, string unescaping, all
int/uint widths + overflow, mutation, structural index, SIMD scan, error model.

---

## 3. Target architecture

### 3.1 The cursor is a value, not an object

`Loc = u64 = (start<<32)|end`. wasm32 pointers, `end` exclusive — already
matches the codebase's `(srcStart,srcEnd)` convention so slices feed straight
into `atoi`, `scanStringEnd`, `parsefloat-fast`, etc.

The public surface is a **thin namespaced free-function API over `Loc`**, not a
class with methods. Sketch:

```ts
namespace JSON.OnDemand {           // working name; final naming in §4
  function root(src: string): Loc          // O(1), no scan
  function kind(loc: Loc): Kind            // O(1), peek first byte
  function get(loc: Loc, key: string): Loc // 0 if absent; linear scan of THIS obj
  function at(loc: Loc, i: i32): Loc       // 0 if OOR; linear scan to i-th
  function length(loc: Loc): i32           // one shallow pass
  function asI64/asU64/asF64/asBool(loc): … // decode, no alloc
  function asString(loc: Loc): string       // the one allocating accessor
  function raw(loc: Loc): string            // slice copy
}
```

A `Value` *struct-like wrapper* may still exist for ergonomics, but it must be
an AS value type or be aggressively inlined so it compiles to the same register
moves — never a heap allocation per hop. (Validate with the bench every time:
if the wrapper regresses `loc one` past ~20 ns it's allocating; kill it.)

### 3.2 Document lifetime / GC safety

A `Loc` holds **raw interior pointers** into a `string`'s backing store. AS's
incremental/compacting GC must not move or free that string while a `Loc` is
live. Options, in order of preference:

- **Caller-pins (prototype default).** The source `string` is held by the
  caller for the cursor's lifetime. Document this as a hard contract: *do not
  let the source string go out of scope while navigating.* Cheapest, zero
  overhead, matches how `JSON.parse(data)` already borrows `data`.
- **A `Document` holder** that stores the `string` and exposes the root `Loc`.
  One allocation per *document* (not per hop) — acceptable. Use when the
  ergonomic safety is worth it. AS's current GC (`incremental`) does not move
  objects, so interior pointers are stable as long as the holder is reachable;
  confirm this assumption against the GC in use and re-check if AS adopts a
  moving collector.

Decision: ship the free-function API with an explicit "source must stay alive"
contract, plus an optional `Document` holder for safety-first callers. Both are
zero-per-hop.

### 3.3 Scalar cache — drop it for the value API

The class `Value` memoized decoded scalars in a NaN-box (`cache`+`resolved`).
With a value cursor there's nowhere to memoize (no identity), and the benchmark
shows decode is so cheap that re-decode beats carrying state. **The cache is a
class-API artifact; the value API simply re-decodes.** Memoization moves up to
the *generated struct* (per-field memo, §4) where it belongs and where identity
exists. Keep the NaN-box layout knowledge only for the handoff-to-`JSON.Value`
path (§4.4).

---

## 4. Transform codegen — the real payoff

`JSON.parse<T>` today runs `__DESERIALIZE_FAST` (full eager pass). On-demand
adds an **opt-in lazy lowering** so reading 2 of 30 fields costs 2 field-scans,
not a 30-field parse. Two variants, same author-facing surface
(`t.uid`, `t.token` unchanged):

### 4.1 Sparse (per-field keyed scan) — `token.example.ts`

`parse<T>` → bind a `Loc` (O(1)). Each field becomes a getter: keyed scan →
field deserializer → memoize into a private slot (+`_loaded` flag for
primitives whose zero value is ambiguous; null pointer as sentinel for refs).
Best when `R≪F` or fields are large and usually skipped.

### 4.2 Dense (deferred one-pass fill) — `token.dense.example.ts`

`parse<T>` → bind a `Loc`. First read of *any* field triggers ONE forward sweep
(`ObjectIter`-style, but on `Loc`) that fills every field, guarded by one
`__filled` flag. This is the eager `__DESERIALIZE_FAST` body, deferred. Best
when most fields are read together. Avoids the sparse O(F²) cliff.

### 4.3 Picking sparse vs dense

- Heuristic at codegen: few fields, or presence of large `string`/array/object
  fields → sparse; many small scalar fields → dense.
- Explicit override: `@json({ lazy: "fields" | "struct" | false })` decorator
  hint. Default `false` (eager) until the feature is proven, then consider
  opt-in `lazy: true` choosing the heuristic.
- The key dispatch in both reuses the existing packed-`u64` SWAR/SIMD key
  matcher the eager path already emits (`getComparison`/`groupMembers` in
  `transform/src`), not the prototype's scalar `keyEquals`.

### 4.4 Interop with `JSON.Value` / `JSON.Obj`

The NaN-box layout in `lazy.ts` is bit-identical to `assembly/index.ts`'s
`JSON.Value`. A resolved lazy scalar can be handed to the eager dynamic API for
free. Wire `JSON.Value`/`JSON.Obj` fields and `JSON.parse<JSON.Value>` to be
able to consume a `Loc` so dynamic and on-demand share one scanner. (Ties into
the existing `scanValueEnd` + `JSON.__deserialize<JSON.Value>` TODO in `TODO.md`
— on-demand is the optimized form of that scan-and-delegate path.)

---

## 5. Phased delivery

Each phase is independently landable, benched, and reversible. Order is by
de-risking: lock the perf foundation first, then correctness, then codegen.

### Phase 0 — validate the perf thesis ✅ DONE
0-alloc loc API beats eager on `small` (§0). Thesis confirmed: navigation must
be allocation-free.

### Phase 1 — complete the value-cursor primitives (`lazy.ts`) ✅ DONE (decoders)
Make the loc API correct and complete; it's the foundation everything else
calls.
- ✅ `asF64` / `locAsF64`: full IEEE grammar via `util/parseFloatFast` (no
  string alloc — parses the byte range in place).
- ✅ `asString` / `locAsString`: real unescaping by routing the quote-inclusive
  token range through the library's mode-dispatched `deserializeString`
  (handles `\n \t \" \\ \/ \uXXXX` + surrogate pairs; no-escape case is a single
  bulk copy inside that handler).
- ✅ `locAsBool` / `locAsI64` / `locAsI32` extracted as free functions; the
  class `Value` methods now delegate (no duplicated scan logic, stubs removed).
- ✅ `lazy.spec.ts` + `lazy.spec.run.mjs`: 37 `lazy ≡ eager` checks (ints,
  floats incl. exp/frac, bools, every escape class + surrogate pair, object
  field reads vs the eager graph, nested skip). **Green across NAIVE/SWAR/SIMD.**
  Hot path unchanged: `loc one` 14.4 ns, `loc both` 67.6 ns.
- ✅ Free-function navigation completed: `locKind` (O(1)), `locLength` (one
  shallow pass), `locAt` (O(i) array index) — the entire surface is now
  zero-alloc, so no path needs the allocating class `Value`/`Document` (the
  2.5× loser). Spec now 49 checks (added nav + escaped-key/escaped-value cases),
  green NAIVE/SWAR/SIMD.
- ✅ Optimizations landed:
  - `locAsString` no-escape fast path — fuse the close-quote scan (shared
    `scanPlainString`) with a single bulk `memory.copy`, skipping the
    `bs`-buffer round-trip; fall to the full unescaper only on a backslash.
  - `locGet` scan loop — forward-only `scanKeyEnd` (no backward backslash walk),
    length-gate before byte compare, and a comma fast-check that avoids the
    redundant whitespace skip on minified input. Worst case (read last of 12)
    **104 → 92 ns (1.21× → 1.06× eager)**; best case **12.2 → 11.5 ns**.
- ✅ Memory-pressure reduction (the loc path's only heap cost is the result
  string — so the wins are about not allocating it when unneeded, and reusing it
  when looping):
  - `locStringLength` / `locStringEq` — length and equality with **zero
    allocation** on unescaped strings (pointer subtraction / `memEq` over source
    bytes; escaped strings fall back to a decode). Reading just the length of
    the wide object's last field: **93.6 → 60.9 ns (−35%)** — the string alloc
    was the whole difference.
  - `locReadStringInto(loc, out)` — `__renew`-in-place buffer reuse, mirroring
    the library's `JSON.stringify(data, out)` pattern. Batch loop reading the
    `token` string into a reused scratch: `loc read both` **61.8 → 34.2 ns
    (−45%)** by eliminating per-iteration string churn and the GC it feeds.
- **Remaining:** all integer widths + unsigned + overflow behavior (currently
  i64/i32 only), aligned with IMPROVEMENTS #8; logical-key matching with key
  unescaping in `locGet` (today matches raw source key bytes — fine for
  unescaped keys, the common case). Carry into Phase 2.
- **Exit:** ✅ decoders + nav correct cross-mode; loc API still ~12–14 ns for a
  one-field read; 7.5× faster than eager on the wide-object sweet spot.

### Phase 2 — settle the public surface
- Decide naming: `JSON.OnDemand.*` free functions vs a value-type `View`
  wrapper. Implement whichever keeps `loc one` ≤ ~20 ns (bench-gated).
- `Document` holder (optional, one-alloc-per-doc) for GC-safe callers.
- Document the "source string must outlive the cursor" contract prominently.
- **Exit:** API frozen; README + `index.d.ts` updated.

### Phase 3 — transform codegen: sparse
- Emit the `token.example.ts` shape for concrete (non-generic) `@json` structs
  behind `@json({ lazy: "fields" })`.
- Reuse the eager key matcher (packed-`u64` SWAR/SIMD), field deserializers,
  and import injection (mind the fast-path-vs-lazy-path import gating noted in
  IMPROVEMENTS #1c).
- Generics (`hasTypeParams`) stay eager — field desers can't bind unknown `T`.
- **Exit:** sparse round-trips a handful of structs; full suite green across
  naive/swar/simd; large-doc-sparse bench shows the win (§9).

### Phase 4 — transform codegen: dense + heuristic
- Emit the `token.dense.example.ts` shape behind `@json({ lazy: "struct" })`.
- Implement the sparse-vs-dense heuristic for plain `lazy: true`.
- **Exit:** dense ~par with eager on read-all; sparse wins on read-few; both
  identical observable behavior.

### Phase 5 — mutation overlay (the `set` side)
The source buffer is borrowed/read-only. A real `set` records overrides in a
**copy-on-write overlay** keyed by cursor `loc`, then re-serializes lazily so
only mutated paths cost anything.
- Overlay data structure (small map `loc → new value word/string`).
- Re-serialize: walk source, splice overrides, emit. Untouched subtrees copied
  as raw slices (fast).
- Setters in generated structs force a dense fill first (so untouched fields
  keep source values) then mark overlay dirty.
- **Exit:** mutate-then-stringify round-trips; untouched-field passthrough is a
  raw slice copy.

### Phase 6 — optional structural index / tape (hot docs) ◐ BUILDER DONE
For documents probed many times, `get`/`at` being O(n) per probe adds up. Build
a structural index (simdjson-style tape: offsets of every key/element) on first
access to turn repeat `get`/`at` into O(1)/O(log n).
- ✅ **Stage 1 ported** (`lazy.index.ts`) — direct port of simdjson Stage 1
  (Langdale & Lemire, arXiv:1902.08318). One branchless pass over 64-char
  windows builds three SIMD bitmasks (quotes/backslashes/structural) then applies
  the paper's bit-tricks: find_escaped (Fig 3, with cross-window backslash-run
  carry), quoted-range via prefix-XOR (Fig 4 — WASM has no carry-less multiply,
  so the log-shift equivalent; "inside string" carries across windows via the
  broadcast top bit), structural-minus-strings + opening quotes (Fig 5), and
  ctz/blsr index extraction (Fig 6). Output: code-unit offsets of every `{}[]:,`
  outside strings + each string's opening `"`.
- ✅ **Validated** against a scalar oracle (`buildIndexOracle`) on a battery
  (escapes, escaped quotes, escaped backslashes, `\u`, structural chars inside
  strings, **strings straddling the 64-char window**, long multi-window member
  runs, empty/bare values) — 96 spec checks, green NAIVE/SWAR/SIMD.
- **Remaining:** index-driven navigation reader (walk the index for `get`/`at`
  instead of byte-scanning — the consumer that turns the index into the
  repeated-probe / late-field win); lazy build-on-Nth-probe threshold; pseudo-
  structural atom starts (today atoms sit in the gap between two index entries,
  found by a short scan — fine).
- **Exit (builder):** ✅ SIMD index ≡ oracle cross-mode; build throughput benched.
  **Exit (full):** repeated-probe bench shows index amortizing; one-shot path
  unchanged.

### Phase 7 — SIMD structural scan ✅ DONE (core)
The scalar scanners stepped 2 bytes at a time through string/container content.
Replaced with SIMD (8 u16 lanes via `i16x8.eq`/`bitmask`/`ctz`, same technique
as `deserialize/simd/string.ts`):
- ✅ `scanPlainString` — string body → close quote, 8 lanes/step; first-of-{`"`,
  `\`} reports "escape before close?" in one shot.
- ✅ `nextStructural` — next `{`/`}`/`[`/`]`/`"`, used to skip filler inside a
  container while tracking depth.
- ✅ `scanValueEnd` rewired to both; scalar tail for the last < 8 lanes, and a
  `ptr + 16 <= end` guard keeps every wide load inside the source allocation.
- ✅ Correct cross-mode: spec 83 checks (added long-string, escape-past-the-
  8-lane-boundary, large-container-skip, and braces-in-strings cases), green
  NAIVE/SWAR/SIMD.

**Measured.** Isolated scan of a 4 KB string value to its close:

```
  scalar  scan 4 KB string   1267 ns    6.47 GB/s   1.00x
  SIMD    scan 4 KB string    299 ns   27.37 GB/s   4.23x   ← the scan primitive
```

The scan primitive is **4.23× faster (6.5 → 27.4 GB/s)**. End-to-end on the
realistic worst case (read last field of the 5.2 KB repo object), the gain is
~13% (3197 → 2769 ns) — because that workload is dominated by *per-member*
scalar traversal (80 keys / colons / commas, mostly short values), and SIMD only
accelerates the content-scan fraction. **Rule of thumb:** SIMD scan delivers
most of its 4.2× on documents with long string/blob values you skip past
(logs, base64, big text); many-short-fields docs see ~10–15% because per-member
work dominates — that residual is what the structural index (Phase 6) targets
(simdjson's O(1) skip-to-value-end), the complementary lever to on-the-fly SIMD.

- **Remaining:** SWAR variant for non-SIMD builds (currently SIMD-gated; real
  integration feature-gates on `JSON_MODE` like the rest of the library); SIMD
  the key scan (`scanKeyEnd`) — low value, keys are short.

### Phase 8 — error handling + depth guard
On-demand must be safe on untrusted input (ties to IMPROVEMENTS #3 + #4).
- No `abort()` (traps the module) — recoverable `throw` or a `tryGet`/result
  form. A malformed slice returns `Kind.Invalid` / `0` loc rather than trapping.
- Deep-nesting guard in `scanValueEnd`/`get`/`at` (configurable depth limit).
- **Exit:** fuzz with malformed + adversarially-nested input, no traps.

### Phase 9 — tests, fuzzing, benchmarks
- Spec suite mirroring `__tests__/`: every type, escapes, whitespace, nesting,
  empty containers, absent keys, OOR indices, numbers at the edges.
- **Cross-mode + cross-API equivalence:** on-demand read of field X ≡ eager
  `parse<T>().X` for the same input (this is the strongest correctness net).
- Structure fuzzer (IMPROVEMENTS #5): random JSON → assert lazy ≡ eager.
- Benches: add `large`/`github-events` **sparse-read** cases (read 1–2 fields of
  a big doc) where the win is large, plus the `small` micro-bench as the
  regression guard for the allocation principle.
- **Exit:** suite green all modes; benches checked in; charts updated.

### Phase 10 — docs + opt-in rollout
- README section, `index.d.ts`, examples. Document the cost model (§1) honestly
  so users reach for it in the right regime.
- Ship behind the decorator opt-in; eager stays the default.

---

## 6. Risks & open questions

- **GC / pointer stability.** Interior pointers into a `string` are only safe
  while the string is reachable and the GC is non-moving. AS `incremental` is
  non-moving today; re-verify if that changes. The `Document` holder + the
  documented contract are the mitigations. This is the single biggest
  correctness risk.
- **Value-type ergonomics in AS.** AS has no first-class value types/structs for
  a `Value` wrapper that's guaranteed not to allocate. We may be stuck with the
  free-function `Loc` API for the hot path and a class only for cold/ergonomic
  use. Bench-gate every wrapper.
- **Codegen surface area.** The transform is the riskiest part of the repo
  (per IMPROVEMENTS #1c). Land sparse on ONE struct, fuzz it, then roll out.
- **Sparse O(F²) trap.** Easy to ship sparse and have read-all workloads regress.
  The heuristic + dense variant must land together with sparse, not after.
- **String unescaping correctness.** The no-escape fast path is easy; full
  `\uXXXX` + surrogate pairs must reuse the battle-tested eager unescaper, not a
  fresh impl.

---

## 6b. simdjson On-Demand — what we borrowed, what we already had

Studied simdjson's On-Demand API (Keiser & Lemire, *SP&E* 2024; simdjson docs).
The model is the same one we converged on: *"a document is not a fully-parsed
JSON value; rather, it is an iterator over the JSON text."* Key alignments and
the one technique we adopted:

**Already matched (independent convergence — validation):**

- **Raw key matching, no unescape.** simdjson: *"simdjson does not unescape keys
  when matching."* Our `locGet`/`ObjReader` compare raw source bytes — the same
  deliberate tradeoff, not a prototype shortcut. Reclassified from "limitation"
  to "by design."
- **Lifetime contract.** simdjson: *"the JSON text and the parser must remain
  alive while you are using it."* = our "source string must outlive the cursor."
- **String view, allocate-on-unescape.** simdjson returns `std::string_view` and
  only touches the unescape buffer on demand; our `locStringEq`/`locStringLength`
  are the no-alloc view ops, and `locReadStringInto` is its parser-owned reuse
  buffer (*"reuse the same parser repeatedly… eliminate the need to allocate"*).
- **Lazy, parse-once, flexible-type values.** Same `loc` decodes as int/float/
  string; skipped values aren't validated — same lazy-validation tradeoff.
- **Structural index is OPTIONAL.** The paper is explicit: *"the construction of
  the index is fast, but an On-Demand front-end may not require an index."* Our
  scan-on-the-fly design is the no-index variant; the index is an amortization
  (§ Phase 6/7), not a prerequisite. simdjson keeps it mainly for up-front UTF-8
  validation and O(1) large-value skipping.

**Adopted — "scan from the current position" (the one real gap):** ✅ DONE.
simdjson: *"We always scan for keys from our current position, instead of
systematically starting from the beginning."* Our `locGet` rescanned from `{`
every call → O(N²) to read N fields. Added **`ObjReader`** — a stateful cursor
that advances past each found field (O(N) in source order) and resolves
out-of-order access via a single **wraparound** (= `find_field_unordered` /
`object["x"]`). One allocation per object (the handle), amortized over all field
reads; the lazy-struct codegen will hold `pos` inline (zero extra alloc).

```
  read ALL 12 fields:           ns/op   vs eager
    eager  parse<Wide>           86.7    1.00x
    loc    repeated locGet O(N²) 406.2   4.68x   ← the documented anti-pattern
    loc    ObjReader cursor O(N) 135.9   1.57x   ← 3x faster than repeated locGet
```

The residual 1.57× vs eager is eager's SIMD packed-u64 key match + direct
field stores; the dense codegen (inlined cursor + packed key match) closes most
of it. simdjson exposes three modes — strict-forward (`find_field`, fastest),
wraparound (`find_field_unordered`), always-from-start. We now have the latter
two (`ObjReader.find` and `locGet`); strict-forward is a trivial future variant.

**Still to borrow (folded into existing phases):**

- **O(1) large-value skip via the index** (Phase 6/7). simdjson jumps to a
  skipped value's end using the structural index; we scan byte-by-byte. The SIMD
  structural scan (Phase 7) gets most of this without a full index; the index
  (Phase 6) gets the rest for repeatedly-probed hot docs.
- **Up-front UTF-8 validation** as an opt-in (ties to the Phase 8 error path).

## 7. Relationship to the existing roadmap

- **IMPROVEMENTS #10 (streaming)** — on-demand is the read-path half of "don't
  materialize the whole doc." Streaming adds incremental *input*; on-demand adds
  lazy *access*. They compose later.
- **IMPROVEMENTS #1c (optimize slow path) / TODO scan-and-delegate** — both are
  "scan a value range, decode on demand." The loc scanner here is the shared
  primitive; unifying them avoids two scanners.
- **IMPROVEMENTS #3/#4 (error path, depth guard)** — Phase 8 depends on these;
  do them as one effort.
- **NaN-box layout** — already shared with `JSON.Value`; keep bit-compatible so
  lazy↔dynamic handoff stays free.

---

## 8. Immediate next step

Phase 1: replace the two stubbed decoders in `lazy.ts`
(`asF64` full grammar via `parsefloat-fast`, `asString` unescaping) with the
real, allocation-disciplined implementations, and stand up the Phase-9 spec
skeleton asserting lazy ≡ eager. Keep the `small` bench as the guard: if
`loc one` drifts above ~20 ns, something started allocating.
