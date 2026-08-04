# What `json-as` / `as-simd` can learn from simdjson

Upstream examined: simdjson commit
[`8e6bac94877f2d3d026000d36ce81e0aaf38d26f`](https://github.com/simdjson/simdjson/tree/8e6bac94877f2d3d026000d36ce81e0aaf38d26f).
This note focuses on the Haswell (AVX2) and Ice Lake (AVX-512) kernels and on
ideas applicable to UTF-16 AssemblyScript strings. It does not imply that
simdjson's UTF-8 parser can be copied directly.

## Executive summary

The most useful lesson is not “make every loop as wide as possible.”
simdjson keeps a **fixed 64-byte logical block** across architectures:

- AVX2 represents it as two 32-byte vectors.
- AVX-512 represents it as one 64-byte vector.
- Both return the same scalar `uint64_t` position mask to the higher-level
  algorithm.

See `simd8x64` in
[`include/simdjson/haswell/simd.h:298-365`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/include/simdjson/haswell/simd.h#L298-L365)
and
[`include/simdjson/icelake/simd.h:320-368`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/include/simdjson/icelake/simd.h#L320-L368).

For `json-as`, a 64-byte block is 32 UTF-16 code units. That gives a convenient
architecture-neutral `u32` lane mask. v256 can produce it from two 16-lane
pieces; v512 can produce it from one 32-lane operation. The parsing algorithm
should consume this common abstraction rather than changing its semantics and
loop shape with `JSON_SIMD_WIDTH`.

The highest-value concrete change is a fused `as-simd` operation that:

1. loads a 64-byte logical block directly from Wasm memory;
2. optionally stores that same block directly to the destination;
3. compares UTF-16 lanes against all relevant characters in the same lowering;
4. returns compact scalar masks without writing a wide temporary back to Wasm
   memory.

For deserialization it should return **separate quote and backslash masks**.
For serialization it should return one 32-bit “needs escaping or surrogate
handling” lane mask. This copies simdjson's actual seam: vector work stays in
the architecture kernel; control flow operates on cheap scalar bitsets.

## 1. Keep the logical block fixed at 64 bytes

The AVX2 `simd8x64` loads two vectors and joins their 32-bit movemasks into one
64-bit result
([`include/simdjson/haswell/simd.h:309-329`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/include/simdjson/haswell/simd.h#L309-L329)).
Its `eq` and `lteq` helpers hide those two comparisons behind one 64-byte API
([`include/simdjson/haswell/simd.h:343-364`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/include/simdjson/haswell/simd.h#L343-L364)).
The AVX-512 version performs the same operations with one vector and directly
returns a 64-bit mask
([`include/simdjson/icelake/simd.h:355-367`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/include/simdjson/icelake/simd.h#L355-L367)).

### Transferable

- Add a `block64` layer to `as-simd` or `json-as`, with operations expressed in
  terms of 32 UTF-16 lanes rather than native vector width.
- Make v256 lower a block to two wide operations and concatenate their masks.
- Make v512 lower it to one wide operation when the host really supports that
  efficiently.
- Keep v128 as four chunks under the same interface, which makes correctness
  tests and benchmarks directly comparable.
- Use a `u32` mask for UTF-16 lanes. Only use a `u64` when returning two packed
  `u32` masks.

This avoids width-specific duplicated loops and makes v512's win come from
fewer loads/comparisons, rather than from extra cross-boundary plumbing.

## 2. Fuse copy, classification, and mask extraction

simdjson's string parser loads a block once, stores it to the output
unconditionally, and derives quote/backslash masks from the loaded value:

- AVX2 processes 32 bytes and calls movemask on each comparison
  ([`include/simdjson/haswell/stringparsing_defs.h:31-41`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/include/simdjson/haswell/stringparsing_defs.h#L31-L41)).
- AVX-512 processes 64 bytes and gets the two masks directly from compare-mask
  instructions
  ([`include/simdjson/icelake/stringparsing_defs.h:31-41`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/include/simdjson/icelake/stringparsing_defs.h#L31-L41)).

The generic parser then asks which exceptional character comes first. If there
is none, it advances by the complete block. If one exists, the already-written
plain prefix is retained and only the exceptional character is fixed up
([`src/generic/stage2/stringparsing.h:151-192`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/src/generic/stage2/stringparsing.h#L151-L192)).

### Transferable

Add operations shaped approximately like:

```text
copy_find_quote_backslash_utf16_64(src, dst) -> u64
  low 32 bits: backslash lanes
  high 32 bits: quote lanes

copy_find_json_escape_utf16_64(src, dst) -> u32
  one bit per lane for quote, backslash, control, or surrogate

find_backslash_utf16_64(src) -> u32
```

These should be single `as-simd`/Wide boundary crossings. The lowering should
load once and return scalar masks directly. It should not:

- copy through a wide register file in linear memory;
- materialize vector comparison results back into linear memory;
- invoke separate wide operations for load, compare, bitmask, and store;
- use a byte mask when the caller ultimately reasons about UTF-16 lanes.

For `serializeString_SIMD`, fusing the current `wideStringEscapeMask` and
`copyWide` calls is the first priority. For escaped deserialization, use the
copy-and-find form so the clean prefix is already in the destination. For the
whole-value “no escapes” probe, use find-only because `json-as` can allocate and
copy the complete string once after proving it clean.

### Why separate quote and backslash masks matter

simdjson decides which appears first without two branches or two `ctz`
operations:

```text
quote is first:     ((backslashes - 1) & quotes) != 0
backslash is first: ((quotes - 1) & backslashes) != 0
```

See
[`include/simdjson/icelake/stringparsing_defs.h:22-25`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/include/simdjson/icelake/stringparsing_defs.h#L22-L25).
The same scalar trick works on packed UTF-16 lane masks after unpacking the two
`u32`s.

An “equals either” mask remains useful when only the first exceptional lane is
needed, but it loses information needed to distinguish a terminating quote from
an escape. Do not make it the only API.

## 3. Return masks, not wide booleans

On AVX2, equality produces byte vectors and `_mm256_movemask_epi8` reduces each
to a scalar mask
([`include/simdjson/haswell/simd.h:53-74`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/include/simdjson/haswell/simd.h#L53-L74)).
On AVX-512, equality itself returns the scalar mask-register value
([`include/simdjson/icelake/simd.h:69-79`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/include/simdjson/icelake/simd.h#L69-L79)).

The higher layers almost exclusively use scalar mask algebra:

- `ctz(mask)` finds the next interesting lane;
- `mask &= mask - 1` clears it;
- subtraction computes backslash-run parity;
- prefix XOR computes quote state.

This is especially relevant to Wago/Wide: an imported operation returning a
scalar mask is a better ABI for scanning than an operation returning a wide
boolean carrier that must later be stored and reduced by Wasm code.

### Recommended `as-simd` primitive set

Prioritize use-case primitives over a large set of tiny register-file
operations:

1. `eq_u16x32_mask(ptr, splat) -> u32`
2. `eq2_u16x32_masks(ptr, a, b) -> u64`
3. `json_escape_u16x32_mask(ptr) -> u32`
4. copy variants of 2 and 3
5. only then general wide comparison/carrier APIs

The fused operations are deliberately “deep” APIs: their contracts are stable
across AVX2 and AVX-512 even though their lowering is not.

## 4. Use one lane bit for serializer exceptions

simdjson's native serializer-style scan combines quote, backslash, and control
tests before extracting one mask:

- AVX2 ORs three boolean vectors then performs one movemask
  ([`include/simdjson/haswell/stringparsing_defs.h:57-66`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/include/simdjson/haswell/stringparsing_defs.h#L57-L66)).
- AVX-512 ORs three mask-register results
  ([`include/simdjson/icelake/stringparsing_defs.h:58-67`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/include/simdjson/icelake/stringparsing_defs.h#L58-L67)).

`json-as` additionally needs to detect UTF-16 surrogate code units. Its wide
primitive should directly compute:

```text
lane == '"'
OR lane == '\\'
OR lane < 0x20
OR (lane >= 0xD800 AND lane <= 0xDFFF)
```

and return one bit per UTF-16 lane. A one-bit-per-byte mask makes the caller
reconstruct lane identity and embeds an x86/Wasm byte-movemask artifact into
the public API. The lane-mask form also makes `ctz(mask) * 2` the only position
conversion.

The surrogate test is specific to `json-as`; simdjson validates UTF-8 and
therefore has no corresponding UTF-16 check.

## 5. Do mask-level backslash and quote processing across blocks

simdjson finds backslashes and quotes for a whole 64-byte block, computes which
characters are escaped, removes escaped quotes, and derives the in-string mask:

[`src/generic/stage1/json_string_scanner.h:62-84`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/src/generic/stage1/json_string_scanner.h#L62-L84).

Runs of backslashes are resolved with scalar subtraction and an alternating-bit
constant, including a one-bit carry from the previous block:

[`src/generic/stage1/json_escape_scanner.h:50-70`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/src/generic/stage1/json_escape_scanner.h#L50-L70)
and
[`src/generic/stage1/json_escape_scanner.h:96-142`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/src/generic/stage1/json_escape_scanner.h#L96-L142).

### Transferable, but only where `json-as` scans quoted source

For object-field parsing or any path that must locate an unescaped closing
quote, scan quote and backslash masks together and carry trailing-backslash
state between blocks. This avoids dropping to scalar code merely because a
block contains a backslash after an earlier clean prefix.

For the standalone path where quotes are already stripped and only escape
decoding remains, the full quote-prefix-XOR machinery is unnecessary. Retain
the simpler backslash-only mask.

The exact simdjson `u64` constants assume one bit per byte. For UTF-16 lane
masks, use a 32-bit alternating pattern (`0xAAAAAAAA`) and verify cross-block
backslash runs with exhaustive tests.

## 6. Batch two logical blocks to hide latency

simdjson's stage 1 works on two independent 64-byte inputs per 128-byte step.
The comments explain that loads and vector classification can overlap, while
the string-state portion remains serial
([`src/generic/stage1/json_structural_indexer.h:176-191`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/src/generic/stage1/json_structural_indexer.h#L176-L191)).
The implementation loads both blocks and scans both before emitting their
results
([`src/generic/stage1/json_structural_indexer.h:220-237`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/src/generic/stage1/json_structural_indexer.h#L220-L237)).

### Transferable after the fused primitive exists

Benchmark an unrolled 128-byte loop:

1. call the 64-byte classifier for block A;
2. call it for block B;
3. consume A's mask;
4. consume B's mask.

For clean serialization, both blocks can be classified/copied independently.
For quoted-source parsing, mask generation can overlap but escape/quote carry
must be applied in order. Do not unroll the current multi-import/register-file
path first; that is likely to multiply overhead rather than hide it.

## 7. Preserve an ASCII/clean fast path

simdjson's UTF-8 checker first asks whether the entire 64-byte block is ASCII.
If so, it skips the expensive lookup-based validation, while still carrying an
incomplete-sequence error from the prior block
([`src/generic/stage1/utf8_lookup4_algorithm.h:173-195`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/src/generic/stage1/utf8_lookup4_algorithm.h#L173-L195)).

### Transferable analogue

AssemblyScript strings are UTF-16, so simdjson's UTF-8 validator is not directly
applicable. The analogous fast path is:

- no quote/backslash/control/surrogate bits: copy or advance an entire block;
- any exception bit: locate only the first exception and enter the existing
  scalar repair path.

Do not port simdjson's three lookup tables, byte-history alignment, or
continuation checks into `json-as`; those validate UTF-8 byte streams
([`src/generic/stage1/utf8_lookup4_algorithm.h:16-113`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/src/generic/stage1/utf8_lookup4_algorithm.h#L16-L113)).
They are relevant only if `json-as` later parses UTF-8 memory directly instead
of an AssemblyScript UTF-16 string.

## 8. Tail safety and padding are part of the design

simdjson normally requires 64 bytes of readable padding so its kernels can
perform full-width loads near the end
([`doc/performance.md:196-211`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/doc/performance.md#L196-L211)).
Its bounds-safe string parser instead switches to a space-padded scratch buffer
near the end
([`src/generic/stage2/stringparsing.h:196-264`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/src/generic/stage2/stringparsing.h#L196-L264)).
The generic block reader also pads the final block with spaces
([`src/generic/stage1/buf_block_reader.h:82-109`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/src/generic/stage1/buf_block_reader.h#L82-L109)).

### Transferable

- Process a wide block when `src + 64 <= end`; equality is safe and should not
  unnecessarily require one extra UTF-16 code unit.
- Use v128/scalar code for the tail unless a measured scratch-buffer approach
  wins.
- Do not assume an AssemblyScript string allocation has 63 readable bytes after
  its logical end.
- Keep explicit output slack if using unconditional full-block stores, and
  document exactly how much can be overwritten.

Padding-based overreads are a native C++ technique, not automatically safe in
Wasm linear memory or across managed-object boundaries.

## 9. Width selection must be capability- and cost-based

simdjson compiles distinct kernels and selects the first implementation whose
complete instruction requirements are supported
([`src/implementation.cpp:286-293`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/src/implementation.cpp#L286-L293)).
The AVX2 kernel declares AVX2, PCLMUL, BMI1, and BMI2; the AVX-512 kernel
declares a much larger set including BW, VL, and VBMI2
([`include/simdjson/haswell/implementation.h:17-23`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/include/simdjson/haswell/implementation.h#L17-L23),
[`include/simdjson/icelake/implementation.h:17-23`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/include/simdjson/icelake/implementation.h#L17-L23)).

It also treats instruction cost as architecture-specific. For example, its
AVX-512 compression deliberately avoids `mask_compressstoreu` because that
instruction performs badly on AMD Zen 4
([`include/simdjson/icelake/simd.h:148-162`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/include/simdjson/icelake/simd.h#L148-L162)).
The documentation notes that older CPUs can downclock for wide instructions
and allows AVX-512 to be disabled
([`doc/performance.md:177-193`](https://github.com/simdjson/simdjson/blob/8e6bac94877f2d3d026000d36ce81e0aaf38d26f/doc/performance.md#L177-L193)).

### Transferable

- Treat `JSON_SIMD_WIDTH` as an override/testing knob, not proof that a width is
  faster.
- Let Wago/Wide select a lowering based on the actual operation and host.
- Permit a 512-bit logical operation to lower to two AVX2 halves when that is
  cheaper or AVX-512 is unavailable.
- Benchmark by CPU family, string length, escape density, ASCII/non-ASCII mix,
  and allocation mode before changing the default.
- Keep v128 available as a cheap short-input path. The dispatch threshold should
  account for import/call overhead as well as bytes per instruction.

### Native-only details

The following do not transfer directly through portable Wasm SIMD:

- AVX-512 `k` mask registers and `_mm512_*_mask` intrinsics;
- CPUID-based native dispatch inside the Wasm module;
- AVX-512 byte compression instructions;
- safe native overreads based on page allocation;
- assumptions about x86 instruction latency, ports, or frequency behavior.

They can only be exploited inside Wago/Wide's native lowering. The Wasm-facing
API should expose semantic operations and scalar results, not these mechanisms.

## Prioritized implementation plan

### P0 — reduce the wide boundary to one operation per block

1. Define a 64-byte/32-lane UTF-16 block contract.
2. Add `eq2_u16x32_masks`, `json_escape_u16x32_mask`, and fused copy variants
   to `as-simd`.
3. Lower them directly in Wide with scalar mask results.
4. Replace `wideStringEscapeMask` + `copyWide` in serialization with one call.
5. Return one bit per UTF-16 lane.

Expected benefit: eliminates the remaining duplicated loads, boundary
crossings, and byte-mask repair work. This is the clearest lesson from both
simdjson x86 kernels.

### P1 — use both masks and stay vectorized longer

1. Return quote and backslash masks together for field/string parsing.
2. Use scalar first-character tests and `ctz` on the masks.
3. Add cross-block backslash parity so escaped quotes do not force premature
   scalar scanning.
4. In escaped output paths, use unconditional wide copy then repair at the first
   exceptional lane.

Expected benefit: helps medium/long strings containing sparse escapes, where a
“break on any exception and restart scalar” strategy leaves most available
parallelism unused.

### P2 — overlap two 64-byte blocks

Unroll clean scanning/copying to 128 bytes and consume two masks per iteration.
Keep stateful mask processing ordered. Only do this after P0, and retain it only
if benchmarks show a win.

### P3 — dispatch and thresholds

Build a benchmark matrix for:

- 0–64, 65–256, 257–4096, and large strings;
- no escapes, sparse escapes, dense escapes;
- ASCII, BMP non-ASCII, valid surrogate pairs, and unpaired surrogates;
- serialize, standalone deserialize, and field deserialize;
- v128, logical-v256, and logical-v512 on at least AVX2-only and AVX-512 hosts.

Use the results to set a minimum length for wide entry and to choose the default
per host/lowering. A width should not be selected from vector width alone.

## Bottom line

simdjson's architecture is successful because it narrows wide native work into
a small, stable scalar-mask interface. For `json-as`, the next optimization
should therefore be **fewer, deeper `as-simd` operations over a fixed 64-byte
logical block**, not more general-purpose wide register operations in the hot
loop. AVX2 and AVX-512 should differ in lowering, while the AssemblyScript
algorithm, mask layout, tail handling, and correctness tests remain the same.
