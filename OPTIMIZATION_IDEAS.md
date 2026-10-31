# Ordinary-API optimization ideas

User-provided proposal, saved 2026-10-30. These are engineering hypotheses;
performance claims require measurements against the current implementation.
The source links refer to the inspected historical revision, not necessarily
the current tree.

**For ordinary `JSON.parse<T>(text)` and `JSON.stringify(value)`, I would change the priorities substantially.** The biggest opportunities are in **how objects get constructed, how the final string gets built, and how the generated code combines its existing fast kernels**.

I went deeper into those paths. There are some concrete sources of wasted work, plus a few more ambitious algorithms worth prototyping. Everything below can sit behind the existing APIs and return normal, fully materialized objects and strings.

My strongest bets:

| Idea | Main benefit | Where it applies |
|---|---|---|
| **Serialize directly into the returned string** | Eliminate the final whole-document copy | Ordinary stringification |
| **Generate dedicated fresh-object parsers** | Remove reuse machinery and unnecessary default construction | Ordinary parsing |
| **Make parsing resumable and adapt to producer order** | Eliminate reparsing and repeated field lookup | Nested, reordered, optional-field payloads |
| **Compile larger writing regions** | Reduce cursor dependencies, helper overhead, and capacity checks | Concrete typed serialization |
| **Progressive SIMD string escaping** | Eliminate prefix replay and process several escapes together | Text-bearing payloads |
| **Process several numbers independently** | Break long dependency chains | Numeric fields and ordinary arrays |

These are engineering hypotheses grounded in the current code. I’m confident about where work is duplicated; the size of the resulting speedups needs measurement.

## 1. Make the serialization buffer become the returned string

**This is the largest broad serialization experiment I would run.**

Currently, ordinary objects are serialized into the unmanaged `bs` staging buffer. At the end, `bs.out<string>()` allocates a managed string and copies the entire result into it. That final copy is explicit in the code. Sources: [buffer finalization](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/lib/as-bs.ts), [public stringify](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/assembly/index.ts).

For an output containing \(B\) physical UTF-16 bytes, the output-buffer work includes:

| Operation | Logical traffic |
|---|---:|
| Emit into staging | \(B\) bytes written |
| Read staging for finalization | \(B\) bytes read |
| Write returned string | \(B\) bytes written |

That is approximately **\(3B\) of output-buffer traffic**, excluding source reads, formatting, and any growth copies.

A direct writer could reduce that component to **\(B\)** when its initial allocation is sufficient.

That does **not** imply a 3× end-to-end speedup. It identifies a substantial category of work that can disappear.

### The design

Create a fresh, managed string under construction at the start of `JSON.stringify`:

1. Allocate an initial capacity.
2. Keep its managed reference rooted.
3. Emit directly into its payload.
4. Grow through the supported runtime mechanism if necessary.
5. Finalize its actual length.
6. Return that allocation.

Every call still returns an independently owned result. Previously returned strings remain valid.

There is already a small precedent in json-as: top-level float serialization allocates a managed string with spare capacity, writes into it, and then renews it to the actual length. Extending that construction model to concrete objects is the larger opportunity. Source: [top-level primitive serialization](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/assembly/index.ts).

### Exploit the schema for cheap capacity planning

For a concrete object, much of the output requirement is cheaply available:

- Keys and punctuation have a compile-time size.
- Integer and float writers have bounded output requirements.
- String lengths are available from their headers.
- Array lengths are already known.
- Small nested plain objects can contribute their own bounds.

I would start with a **cheap capacity estimate plus guarded growth**, using the current object’s contents.

I would avoid a mandatory exact-size traversal of the whole graph. Scanning every string twice or formatting every float twice can erase the benefit.

An interesting second variant would compute exact sizes only for small, flat schemas, keeping any expensive conversion result for the emission step.

### The real implementation challenges

The result must be a legitimate managed string throughout construction. The existing unmanaged buffer cannot simply be cast to one.

The writer must also preserve offsets across relocation, keep the string rooted during allocations, and handle reentrant custom serialization. Final shrinking should be verified for the supported runtimes; it should not be assumed universally copy-free.

**My initial prototype would target plain concrete schemas and leave custom-hook boundaries on the established path.** That preserves the public API while making the first experiment tractable.

**Best experiment:** change only output ownership, keep the formatting kernels identical, and measure changing objects with several previous results still alive. Count final-copy bytes, growth-copy bytes, allocated capacity, and total time.

## 2. Give ordinary fresh parsing its own generated implementation

This is my strongest broad parsing bet.

A plain call:

```typescript
const user = JSON.parse<User>(text);
```

has a fact available at the public boundary:

> There is no existing destination graph to reuse.

The current implementation still sends fresh objects through many readers that support reuse. String readers inspect the old field reference and choose between allocation, renewal, and same-size overwrite. Nested readers load the old object reference before deciding whether to allocate. Sources: [public parser](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/assembly/index.ts), [string field writer](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/assembly/deserialize/simd/string.ts), [nested-object generation](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/transform/src/index.ts).

Those features are useful for reuse calls. A fresh parser can compile away the decision entirely.

### Generate fresh construction separately

At the public boundary, select a generated fresh or reuse entry point once.

The fresh variant would:

- Allocate strings directly without reading an old string reference.
- Allocate nested objects when their fields occur.
- Construct arrays directly without checking for reusable elements.
- Avoid reuse tracing.
- Avoid alias-management work associated with replacing existing values.
- Store into known field offsets.

This should be a generation decision, so the hot path does not repeatedly test a `fresh` flag.

### Extend the existing default-initialization optimization

The repository already has `__DESERIALIZE_FULL_WRITE`, allowing some fresh roots to be zeroed instead of constructing their defaults. That is a useful start. It is narrower than a complete fresh-construction strategy: optional paths are excluded, nested objects still initialize eagerly, and fallback can initialize again. Source: [full-write capability and initializer generation](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/transform/src/index.ts).

I would extend it to:

1. Make reference slots GC-safe.
2. Parse the fields that actually appear.
3. Initialize only missing fields at successful object completion.

For example, if a non-null nested field is present in the JSON, constructing its default graph first is unnecessary if parsing will replace that graph immediately.

Likewise, an empty default array does not need to exist temporarily before the real array is constructed.

### Treat initialization as a compiler problem

The transform can classify defaults:

| Default | Treatment |
|---|---|
| Literal scalar or string | Cheap to defer until absence is known |
| Compiler-generated empty container | Usually eligible for deferred construction |
| Nested generated default graph | Potentially eligible transitively |
| Initializer calling user code | Preserve its observable behavior |
| Initializer depending on other fields | Requires dependency analysis |

The important constraint is GC correctness: reference slots must be valid before any later allocation can expose the object to collection. Scalar fields that are guaranteed to be written do not necessarily need the same preliminary initialization.

### Add bounded capacity prediction for fresh arrays

A useful extension is a small capacity hint per concrete array field.

If a field repeatedly contains roughly a few dozen elements, the next **fresh** array can begin with an appropriate capacity. It remains a new array; the hint only changes its initial allocation.

Bound the prediction using current input size and a maximum, sample updates, and grow normally on misses.

This can reduce several growth allocations while still handling varying array lengths.

**Why I like this direction:** it applies even when every source string, object, field value, and output identity is new. It reduces construction work that the ordinary API currently pays repeatedly.

## 3. Compile one resumable parser, then teach it producer order

There are two related changes here.

### First: preserve progress on a fast-path miss

The current generated parser has ordered compact and whitespace-tolerant paths, followed by other fallbacks. Some transitions restart from the object’s beginning. Nested fallback can scan the whole value’s extent, initialize again, and then parse again. Source: [generated parser tiers and nested fallback](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/transform/src/index.ts).

I would compile one parser with:

- A current cursor.
- A grammar phase.
- A seen-field bitmap.
- One decoding body per field.
- Fast expected-key edges.
- General dispatch at the current key.

If the first several fields matched and the next key is different, those completed fields stay completed.

This is especially useful for ordinary API responses with optional fields, producer-specific ordering, or nested records whose layouts vary slightly.

It also complements fresh construction: there is no need to rebuild defaults or allocate parsed strings again after a layout miss.

### Second: remember field order across changing values

Consider a schema declared in this order:

```typescript
@json
class User {
  id: i32;
  name: string;
  active: bool;
}
```

But a producer consistently sends:

```json
{"name":"Ava","id":7,"active":true}
```

followed by:

```json
{"name":"Elias","id":90415,"active":false}
```

The values, lengths, and source identities change. The producer’s field order remains useful.

A small prediction record could remember:

```text
name, id, active
```

For each new document, the parser would:

1. Compare the expected key at the actual current cursor.
2. Parse the new value.
3. Obtain its actual end.
4. Predict the next field.
5. Continue through general dispatch immediately if the prediction misses.

It must compare every new key and parse every new value. It does not retain previous offsets or results.

### Start inside arrays of objects

The first object in an array can establish a likely order for subsequent objects in that same array. That keeps prediction local and avoids long-lived state.

For repeated standalone calls, a bounded two-to-four-entry prediction table per concrete type could cover a few common producers.

V8 already uses object-shape information to accelerate key comparisons while parsing arrays, so this general mechanism has precedent. json-as can combine it with stronger compile-time knowledge of field types. [V8](https://v8.dev/blog/json-stringify?utm_source=chatgpt.com)

### Keep the execution model realistic

AssemblyScript cannot spontaneously generate a new native straight-line parser at runtime.

The implementation would use precompiled field handlers and a compact order description, or guarded next-field prediction in a generated dispatcher. A switch can be preferable to an indirect call for tiny fields.

Keep declaration-order input on its existing directly generated path. Prediction should improve foreign producer orders without imposing an interpreter on the best case.

Also, do not generate a state for every possible field permutation. One grammar state plus seen-field bookkeeping and dispatch is sufficient.

**My confidence:** high that resumability removes wasted work; moderate that adaptive order prediction beats a good static dispatcher for enough schemas to justify enabling it.

## 4. Make the transform compile whole writing regions

json-as already generates keys and punctuation as packed stores. It already has good primitive writers. The next step is increasing the amount of work optimized together.

Currently, generated serialization is composed around shared `bs.offset` state and helpers with their own accounting and capacity behavior. Integers and booleans already get some reservation-free treatment, while float fields still use more general paths. Sources: [serialization generation](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/transform/src/index.ts), [float writers](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/assembly/serialize/naive/float.ts).

I would have the transform identify a region such as:

```text
opening syntax
integer field
boolean field
float field
small nested plain object
next fixed key
```

Then generate one kernel that:

1. Reserves enough space for the region.
2. Keeps the output cursor in a local.
3. Calls concrete pointer-based numeric writers.
4. Emits all fixed syntax directly.
5. Commits shared state at the end.

### Why this can matter

It gives the compiler a stronger invariant:

> Nothing in this region can grow the buffer or invoke user code.

That allows direct addressing and instruction scheduling without having to rediscover the invariant through mutable globals and helper calls.

It can eliminate:

- Repeated capacity tests.
- Repeated updates to size-accounting state.
- Cursor reloads across helpers.
- Generic reference dispatch.
- Some function boundaries.

Sonic’s design discussion identifies the cost of assembling many field-level codecs and motivates generating integrated codecs. AssemblyScript can pursue that integration ahead of time. [GitHub](https://github.com/bytedance/sonic/blob/main/docs/INTRODUCTION.md?utm_source=chatgpt.com)

### Use variable fields as explicit boundaries

A string or array does not mean abandoning the strategy. It means:

- Reserve a useful bounded amount.
- Emit its common path.
- Take a cold growth path when necessary.
- Rebase the cursor.
- Continue into the next bounded region.

Small, statically known nested structures can be integrated. Recursive or custom-hook boundaries can remain outlined.

### Verify the machine code before claiming the win

Some repeated state operations may already disappear after inlining and optimization.

The useful experiment is to inspect optimized Wasm and native code for:

- Global cursor loads/stores.
- Remaining reserve calls.
- Register spills.
- Helper calls.
- Code-size growth.

A schema compiler that generates enormous functions can lose through optimizer behavior and instruction-cache pressure. Put a size budget on regions.

**This is likely the best enabling change for direct-to-result serialization**, because it makes the ownership and growth boundaries explicit.

## 5. Make string handling progressive—and expand escapes in groups

I found an immediate improvement and a more ambitious SIMD direction.

### A. Stop replaying the clean prefix

Both string serializers optimistically copy clean input. When a special character appears, they reset `srcStart` to the original beginning and enter the escaped path.

That means a string containing a quote near its end can have almost its entire prefix scanned and copied twice. Sources: [SIMD serializer](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/assembly/serialize/simd/string.ts), [SWAR serializer](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/assembly/serialize/swar/string.ts).

Keep the prefix. Enter escape handling at the first exceptional block.

This is a small change with a clear cost model, and it helps changing descriptions, messages, paths, and other ordinary text.

### B. Use exact UTF-16 event masks

The SIMD serializer currently uses a conservative byte-level surrogate candidate mask. It verifies candidates afterward, but ordinary non-surrogate Unicode can trigger extra handling.

Experiment with one bit per UTF-16 code unit and an exact condition for:

- Quote.
- Backslash.
- Code unit below `0x20`.
- Code unit in the surrogate range.

An exact surrogate-range test can be expressed through unsigned subtraction and comparison. It costs instructions, so the comparison should include both ASCII-heavy and multilingual strings.

The purpose is to keep ordinary Unicode on the clean copying path and simplify exceptional-lane processing.

### C. Expand several short escapes using a tiny shuffle table

This is the more interesting algorithm.

For **four UTF-16 code units**, each unit either:

- Stays one code unit.
- Becomes a two-code-unit escape, such as `\"`, `\\`, or `\n`.

There are only \(2^4 = 16\) short-escape masks.

For each input unit, form a candidate pair:

```text
backslash, mapped character
```

Then use the four-bit mask to select a shuffle that retains both units for an escape and only the original character for a clean unit.

Four inputs expand to at most eight UTF-16 units, fitting in one `v128`. Sixteen 16-byte shuffle controls would occupy **256 bytes**.

The output length is:

\[
2 \times \left(4 + \operatorname{popcount}(\text{escapeMask})\right)
\]

bytes.

Other controls requiring `\u00XX`, and unpaired surrogates, can use the existing cold path.

### Why this is different from the existing SIMD loop

The current exceptional loop can copy shifted suffixes after individual escapes. With several escapes in a block, that creates overlapping writes and a chain of output-position updates.

Grouped expansion could replace that with a shuffle, one store, and one length update.

Standard Wasm SIMD supplies the shuffle/swizzle operations needed for this experiment. [GitHub](https://github.com/WebAssembly/simd/blob/main/proposals/simd/SIMD.md?utm_source=chatgpt.com)

Keep the clean-block shortcut. Most strings should continue to pay only for scan-and-copy.

**Best experiment:** separate the effects of prefix continuation, exact masks, and grouped escape expansion. Otherwise a simple replay removal could conceal whether the more complicated SIMD algorithm helps.

## 6. Process multiple values independently

This is the highest-risk algorithmic direction I would pursue.

Many existing numeric optimizations accelerate several digits **within one number**. Regular data often contains short numbers:

```json
[123,7,91,255]
```

There is little intra-number parallelism. There may be substantial parallelism **between** the numbers.

The current code already has specialized numeric kernels, including selected paired paths, so this proposal is about generalizing scheduling across ordinary lengths and concrete fields. Sources: [numeric SIMD helpers](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/assembly/util/simd-int.ts), [integer arrays](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/assembly/deserialize/simd/array/integer.ts), [float arrays](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/assembly/deserialize/swar/array/float.ts).

### Parsing: separate finding the next cursor from finishing conversion

A conventional loop has a dependency chain:

```text
finish value → obtain next cursor → find next value → finish that value
```

Try a small local window that discovers a handful of spans and captures useful numeric state. Then schedule independent conversions before storing into their known destinations.

For example:

1. Find four complete numeric tokens.
2. Record boundaries and accumulated mantissa/exponent information.
3. Convert those values through independent chains.
4. Store them into their concrete fields or array slots.
5. Discard the temporary window.

This does not require a full-document token tape.

For short integer arrays, a more ambitious version can classify separators and shuffle digits from multiple numbers into independent SIMD lanes.

### Serialization: determine several output positions together

Instead of completing one number before beginning the next:

1. Load several values.
2. Determine their formatting classes and lengths.
3. Compute prefix offsets.
4. Emit them into independent destinations.
5. Advance the shared cursor once.

For integers, the width decision must be reused by the writer. Computing decimal width and then calling an old writer that repeats that work would be counterproductive.

For floats, the larger research project would expose the decimal significand, exponent, and formatting class from the existing conversion algorithm before emission. Several conversions could then be scheduled independently.

### Why this might beat local instruction tweaks

It attacks latency dependencies. A faster multiply or a slightly cheaper digit check cannot help much if every operation waits on the preceding value.

However, span metadata, extra reads, register pressure, and code size can erase the benefit. Start with two or four values and inspect spills.

Keep tiny records and long strings on their direct paths. This is most promising for arrays of ordinary numeric values and records containing several numeric fields.

**I would treat this as a research branch with a clear abandonment criterion:** it must improve full public-API throughput over the existing kernels, with mixed widths and varying values.

## 7. A useful bonus: carry string knowledge from parsing into serialization

For ordinary round trips:

```typescript
const value = JSON.parse<Response>(input);
value.count++;
const output = JSON.stringify(value);
```

the parser has already inspected the strings. Some of that information could survive with the concrete object.

In particular:

> Does this particular string require any escaping under the serializer’s rules?

The dynamic value representation already has escape-class metadata for materialized strings. Concrete generated types do not automatically gain the same mechanism. Source: [dynamic string-class representation](https://github.com/JairusSW/json-as/blob/5fd64fc2cf5d1facfae901dccd2da4ce881a9543/assembly/index.ts).

A concrete-type variant could retain an escape classification associated with the actual string value. On later stringification, a valid clean classification permits direct copying.

This works with newly changing documents: each string earns its own classification during its parse.

### Why I would rank it below the broad changes

There are costs:

- Extra metadata.
- Potential extra classification instructions during parsing.
- A check that the field still refers to the classified value.
- Reliable invalidation for every supported in-place string rewrite.

It is also specifically a round-trip optimization. Independent stringification of newly constructed values would still classify normally.

I would prototype it for longer string fields, where avoiding an entire scan can outweigh metadata access. Short strings may be cheaper to inspect again.

## What I would actually prototype first

I would run three focused experiments before attempting the larger redesign.

### Prototype A: direct owned output

Keep the existing formatting algorithms and change only the builder.

Test small records, mixed records, nested objects, and larger text-bearing objects through ordinary `JSON.stringify`.

The question is:

> Does eliminating the final copy outweigh fresh capacity management and growth?

### Prototype B: fresh construction plus continuation

Generate a dedicated fresh parser and carry its construction state through layout misses.

Test canonical order, stable foreign order, optional fields, and nested objects through ordinary `JSON.parse<T>`.

The question is:

> How much time and allocation disappear when each field is constructed once?

### Prototype C: progressive string serialization

Remove prefix restart first. Then independently test exact SIMD masks and four-lane short-escape expansion.

The question is:

> Can exceptional characters be handled without reprocessing successful work or repeatedly shifting suffixes?

For all three, use independently allocated inputs with changing values and lengths. Keep a rotating set of earlier results alive. Include GC in sustained measurements. Report throughput, allocations, copied bytes, and generated code size.

**My strongest overall direction is to make json-as’s transform a more complete compiler for object construction and output emission.** Its individual kernels are already sophisticated. The next major gains are most likely to come from making those kernels share stronger invariants, preserving progress, and producing the final owned result with fewer allocations and less copying.

---

## Implementation notes

The proposal above is preserved as supplied. Current implementation notes:

- Fresh strict parsing and resumable keyed continuation are implemented in
  `5ac1c98`, using the checked cursor modules documented in [ARCHITECTURE.md](ARCHITECTURE.md#checked-cursor-parsing).
  This does not yet defer default construction or predict producer order.
- SWAR string serialization already preserved copied prefixes at the time this
  proposal was saved. SIMD prefix continuation and guarded exact UTF-16
  verification are the first new experiments selected from this proposal.
- [string-progressive.bench.ts](assembly/__benches__/custom/string-progressive.bench.ts)
  measures the ordinary owned string and typed-object APIs with changing input
  values/lengths and eight earlier outputs kept alive. Prefix continuation and
  Unicode-mask verification are measured separately before the combined result.
- Direct owned output, deferred defaults, adaptive order/capacity prediction,
  larger writing regions, grouped escape expansion, independent numeric
  scheduling, and concrete-field escape metadata remain proposals.
