# Playground — On-demand JSON (prototype)

Scaffolding for a lazy / on-demand JSON reader, in the spirit of simdjson's
"On Demand" API. **Nothing is parsed up front.** We pin the source string and
hand out cheap cursors that scan into it only when a value is touched.

## Mental model

```
Document  ── owns the source string (pins it for the GC)
   │
   └─ root : Value          ← lazy cursor, no scanning yet
        ├─ .get("k") : Value   ← linear scan of THIS object, skips nested values
        ├─ .at(i)    : Value   ← linear scan to the i-th element
        ├─ .kind               ← O(1), peeks one byte
        ├─ .length             ← one shallow pass over the immediate container
        └─ .asI64 / .asF64 / .asBool / .asString  ← decode + NaN-box, cached
```

You pay only for the path you walk. `root.get("meta").get("alive")` never
looks at `"tags"`. There is no index, so random access is `O(n)` in the
container — that's the on-demand tradeoff (cheap setup, pay per probe).

## Representation

A cursor is just the slice of source it covers, packed into one `u64`:

```
[ start : u32 ][ end : u32 ]      // two wasm32 pointers, (start<<32)|end
```

Zero heap, copyable by register. The *kind* is never stored — it's recovered
by peeking the first byte (`{` `[` `"` `t/f` `n` digit). `end` is exclusive,
matching the rest of the codebase's `(srcStart, srcEnd)` convention, so slices
feed straight into `atoi`, `scanStringEnd`, and the deserialize handlers.

## NaN-box reuse

A resolved scalar is cached in an 8-byte quiet-NaN word using the **same**
layout as `JSON.Value` (see `assembly/index.ts`). So a decoded lazy scalar is
bit-portable to the eager API, and a re-read is one masked load instead of a
re-scan.

## What's real vs. stubbed

Real (you can run `demo()`): cursor packing, `kind`, `length`, `get`, `at`,
structural scanning with escape/nesting awareness, integer + bool decode,
allocation-free key comparison.

Also real now (Phase 1): the zero-alloc `Loc` API (`docRootLoc`/`locGet`/
`locAsI64`/`locAsF64`/`locAsBool`/`locAsString`) — navigation by `u64` value
with no per-hop heap allocation. `asF64` uses the full IEEE grammar via
`parseFloatFast`; `asString` does real unescaping via the mode-dispatched
`deserializeString`. Verified by `lazy.spec.ts` (37 `lazy ≡ eager` checks, green
across NAIVE/SWAR/SIMD). See `PLAN.md` for the full roadmap and the benchmark
that established the zero-allocation design principle.

TODO (deferred — see `PLAN.md` for the phased plan):

- **`set` (mutation)** — the buffer is borrowed/read-only, so a real `set`
  records overrides in a **copy-on-write overlay** keyed by cursor `loc`, then
  re-serializes lazily. Only mutated paths cost anything.
- **Optional tape/index** — for hot documents probed many times, build a
  structural index on first access to turn `get`/`at` from `O(n)` into `O(1)`.
- **SIMD/SWAR structural scan** — reuse `deserialize/simd` to find the next
  structural char in bulk instead of the scalar 2-byte step.
