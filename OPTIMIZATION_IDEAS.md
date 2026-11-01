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

### Profile follow-up, 2026-10-31

The owned-corpus qualification and adaptive UTF-16 experiment are recorded in
[RESULTS.md](bench/simdjson/RESULTS.md#adaptive-utf-16-serialization-scanning).
The adaptive candidate improves Poet about 1.60× but regresses GSOC minified
stringify about 4.85%. The packed-loop follow-up below measures recovery of
that regression; full qualification still has failures.

The packed clean-run experiment classifies two UTF-16 vectors together:
signed-saturating narrowing packs their code units into sixteen bytes for
shared ASCII quote/backslash/control detection. ASCII stays unchanged; every
other UTF-16 unit maps to a byte at least 127. Unsigned narrowing also reads
signed source lanes and would map negative i16 values to zero. Surrogate checks
still use the original full-width units. An event leaves the established
bounded reader at the current block. Measured results and remaining failures
are recorded in [the packed-loop qualification](bench/simdjson/RESULTS.md#packed-clean-run-scanning).

Separately, compare i16x8.bitmask against the current byte-bitmask-plus-0x5555
representation for surrogate pair bookkeeping. One bit per UTF-16 lane could
remove scalar masking and simplify pair shifts. Check all lane/tail boundaries
and inspect actual lowering before claiming a gain. Phase isolation remains
necessary for the residual parsing/validation controls and backend-only
stringify failures.

The pinned native string writer also uses bounded overlapping loads for short
tails. Poet has 8,692 names of two or three UTF-16 units, so short-tail work
deserves its own profile and experiment. Keep reads and writes inside their
logical bounds and preserve isolated-surrogate escaping. These tail changes
are not implemented here. The length census is saved as
`build/simdjson-parity/pack32-poet-length-census.json`.

### Checked whitespace follow-up, 2026-10-31

An isolated Lottie-pretty validation profile and input census identify long
indentation as removable work. A guarded block scanner improves pretty
validation roughly 1.4–2.2× and owned Lottie parsing 1.7–1.9× across V8 and
w2c2, but fails the full regression screen on compact inputs. The production
scanner is restored. The measured patch, complete results and remaining
failures are described in [RESULTS.md](bench/simdjson/RESULTS.md#rejected-long-indentation-scanner).

The next experiment should preserve the compact grammar loop and select an
indentation specialization once at a value boundary. For example, initial
container whitespace containing a newline or a proven space run could predict
indentation; misses must still parse correctly through the compact reader.
Keep lexical rules shared through static specialization rather than introducing
a per-character runtime flag. Measure small values, compact corpora and mixed
layouts as controls, not only the pretty cases that motivate the experiment.
This adaptive specialization is a proposal, not an implemented improvement.

The qualification loop also had a real ordering bug: label rotation followed by
round reversal always put the two-label baseline first. `29e59b9` fixes it with
opposing adjacent rounds and rotation between pairs. The original results are
preserved; balanced reruns still reject the whitespace candidate.

### Current target and scratch-state result, 2026-10-31

The user's revised performance target is classic workloads, SIMD only, with up
to 20% higher latency than native and no upper limit on being faster. SWAR
backports are optional; additional families and the earlier 3% per-change screens
are diagnostic. Historical gate failures do not replace this revised criterion.

A smaller change replaces the discard traversal's managed byte-state array with
256 bytes of static module storage. It preserves the scalar grammar loop and
depth checks while removing managed scratch-reference access and first-use heap
allocation. Balanced classic validation and owned Lottie measurements are in
[RESULTS.md](bench/simdjson/RESULTS.md#static-discard-state-storage).

Root-only layout specialization and compact-subtree delegation were also tested.
The latter retains a separate compact Wasm function, verified against named
binaries with identical code sections, but checked-w2c2 Canada remained slower.
Their patches and code inspection are preserved in the ignored parity build
directory as `ws-selector-root-only.patch`, `ws-selector-nested.patch`,
`ws-selector-codegen/` and `ws-nested-codegen/`. Neither is part of production.
Re-evaluate whitespace scanning together with static scratch and the revised
absolute SIMD budget before pursuing more elaborate layout specialization.

Another concrete source finding: checked f64 readers already accumulate a
mantissa and decimal scale, but their non-small-power path reparses the token
through `parseDecimalF64(start, end)`. That helper eventually calls `scientific`
with the same coefficient for inputs with at most 19 digits. Investigate passing
the existing state directly, preserving signed zero and the exact long-number
interval/midpoint fallback. This conversion reuse is not implemented yet.

### Fresh-array allocation profile, 2026-10-31

A parse-only Canada profile changes the numeric priority: its f64 arrays already
use the specialized array reader, including paired conversion. Improving the
generic scalar-number fallback will not remove Canada's main cost. Of 5,020
Wasm self samples, 3,311 are in runtime allocation/GC routines. Self samples
do not establish end-to-end cost fractions for every backend.

Canada has 55,563 numeric arrays, all pairs. The standard Array constructor
reserves eight elements; a normal two-element array literal reserves two.
For f64 this removes 2,667,024 bytes of backing capacity per parsed graph.
Keep standard arrays and runtime growth, and test empty/single/long arrays,
signed zero, retained results, and GC. This is a capacity change, not pooling
or output reuse.

A separate candidate removes the generic array reader's managed CursorSlot:
publish a zero element before child allocation, then decode directly into its
backing-buffer slot with the Array as write-barrier owner. GC during child
initializers and growth needs explicit coverage. Measure this independently
from pair capacity before attributing either improvement.

The first short-run w2c2 pair diagnostic appeared 2.25× slower. Isolated capacity
and initializer variants reproduce it, but extended profiles do not. Sampling
the actual frozen short-run program, then tracing growth against timer calls,
finds a harness defect: raw pre-growth to 1 GiB leaves those pages outside TLSF.
The allocator grows to 2 GiB during baseline warmup but inside the candidate's
timed loop. `6b2a98d` reserves and frees unmanaged blocks through the allocator
instead. Red-to-green tests cover incremental/minimal/stub, and corrected native
traces show no timed growth. Requalify both variants under this fixed setup;
changing the operation count to move growth outside timing is not a fix.

An explicit `__newArray` initializer omitting the static zero-literal copy did
not remove the apparent regression and is not retained. Keep the ordinary
two-element literal in the capacity experiment.

Another discard-traversal experiment worth trying is to hold the current
container's grammar state in a local, saving/restoring only parent states at
container push/pop. The current loop loads a stack byte after every value.
This is a hypothesis; preserve all empty-container, separator and depth rules
and measure the full validation matrix before retaining it.

### Shared serialization call layers, 2026-10-31

A refreshed full-harness profile extends stringification to 10,000 operations
while retaining the other phases and live graphs. Object-element writers and
integer-array dispatch dominate named samples ahead of map snapshot allocation.
Named inspection binaries have code sections identical to frozen measurements:
an object element has four managed frames through element/namespace/struct/
generated-method calls; its integer-array field has four through namespace/
reference/array/primitive-array calls.

Direct generated-method calls after the existing null/custom checks remove two
object-element wrappers. Keeping reference dispatch inside JSON.__serialize
removes another container wrapper and keeps one dispatch chain for public and
internal calls. GC rooting and virtual method dispatch stay with the compiler.
The seven-case broad screen and three-backend CITM comparison are in RESULTS.md.
This is shared type dispatch, with no corpus or field-signature recognition.

The next writing-region experiment should keep fixed syntax and already-bounded
integer/boolean writes on a local output cursor. Flush before a call that can
grow the buffer or invoke user code, then reload afterwards. Existing primitive
reservation rules provide a starting invariant; nullable/lazy/conditional and
custom boundaries need explicit treatment. Do not mark allocating writers
unsafe or drop their GC roots to remove frames.

### Validation experiments after shared dispatch, 2026-10-31

Reusing scanDigits for discarded integer runs is rejected. Six balanced rounds
over all sixteen classic validation layouts compare frozen `ival-base-000001`
and `ival-word-000001`, including V8 and both w2c2 check policies. All 64-input
oracles pass. Canada minified throughput is 0.886× baseline on V8, 0.882× on
checked w2c2 and 0.766× on default w2c2; Lottie minified is 0.830× on default
w2c2. Some integer-heavy layouts improve, but the shared implementation is not
a broad win. Keep scalar integer recognition, with the existing bulk fractional
and exponent scans unchanged. Do not enable the rejected variant by corpus,
schema or number-width signatures. Results remain in
`build/simdjson-parity/comparisons/integer-word-full-validation/`.

Keeping the active discard-container state local is also not retained. This
variant saves only suspended parents to the bounded static stack, eliminating
ordinary field/element transition loads and stores for every object and array.
It passes the expanded independent-validator mutation controls, 123,057 normal
checks and 77,676 strict/RFC checks across all three modes. Six balanced rounds
over all sixteen layouts yield geometric mean SIMD throughput ratios of
1.006× on V8, 0.990× on checked w2c2 and 1.013× on default w2c2. Checked-w2c2
Lottie pretty is 0.932× baseline. No additional validation layout enters the
native budget on any backend. The small mixed result does not justify keeping
this change or enabling it only for favorable layouts. Artifacts remain in
`build/simdjson-parity/comparisons/local-state-full-validation/`.

### Shared array serializer experiments, 2026-10-31

Three shared dispatch variants are rejected after correctness and balanced
owned-output comparisons. The first moves the empty-array return before type
dispatch, reads length in the entry and passes it to seven private kernels.
The second also inlines that entry while outlining its generic loop. The third
keeps the generic loop inside the inlined entry. All apply to Array<T> generally;
there are no corpus, field-signature or numeric-width selectors.

The outlined version removes one primitive-array GC frame, proven with named
Wasm whose code section matches frozen timing binaries. Nested generic arrays
gain one four-byte root slot, however. V8 Canada stringification regresses to
0.902× baseline throughput, with a six-round confirmation at 0.923×. Its
default-w2c2 CITM gain varies from 1.209× to 1.086× in separate six-round runs.
Keeping the generic loop in the entry still gives only 0.921× V8 Canada
throughput, so outlining does not sufficiently explain the regression.
Original length-load placement and helper argument order remain unisolated.

Keep the original runtime. The next minimal experiment should change only
inlining, preserving original helper signatures, empty handling and length
loads. Also consider compiler inlining of generated serializers after inspecting
virtual dispatch and GC frames; preserve polymorphism and callback behavior.
Detailed tables, all negative results and artifact paths are in RESULTS.md.

Comparison preparation must match the baseline's --vary-length setting. A
preflight catches mismatched input hashes before control timing; those controls
are rebuilt with changing values and lengths before accepted comparisons.
Use a fresh exact-current baseline when an older frozen candidate has additional
reference-dispatch differences. Do not relax the comparison checks.

### Retained array-entry inlining, 2026-10-31

Inlining alone succeeds without the earlier length-load/empty-check changes.
Keep original helper signatures and control flow; add only @inline to the shared
serializeArray entry. Its representative integer-array namespace writer uses
two GC frame setups instead of three. Named and frozen Wasm code sections match.
Six balanced rounds on eight classic layouts give default-w2c2 SIMD stringify
throughput ratios from 1.006× to 1.091× baseline. V8 is mixed; an initial GSOC
ratio of 0.959× repeats at 0.996×. All original and confirmation rows remain in
RESULTS.md. This is a shared compiler hint, with no corpus or schema selector.

The full 48-row goal remains open. Prioritize owned FGO/OTFCC qualification with
the same fields, four input variants and eight retained outputs. Oracle copies
now use independent APFS copy-on-write clones where available, with ordinary
copy fallback and atomic replacement; large full-output evidence need not be
discarded to fit the disk. A failed copy never becomes a passing comparison.

A further SIMD experiment can target the common checked string scanner: keep
its first-block bitmask path cheap, then test any_true on subsequent clean
blocks and compute a lane mask only at an event. Preserve full UTF-16 event
classification, exact cursor positions and bounded tails. Measure the complete
validation matrix and owned parsing after profiling the larger cases first.

Generated serializer inlining is another unimplemented hypothesis. Apply any
method annotation after reservation injection: that generation currently uses
SERIALIZE.slice(0, 32), so prepending a decorator to its initial header would
break the splice. Preserve virtual dispatch, reentrancy and GC roots.

### Retained large-output ownership, 2026-10-31

Keep size-adaptive direct owned output. After one established-builder sample,
top-level results at least 8 MiB use a rooted managed string as the writer and
avoid the final whole-result copy. The threshold is a general output-size rule,
not a classic-corpus or schema selector. Smaller outputs retain the established
path because unconditional ownership caused deterministic parse/layout
regressions even when serialization improved slightly.

OTFCC now completes all owned-output oracles instead of corrupting low static
memory near the Wasm32 limit. Default-w2c2 SIMD parse is 1.024× native latency
and serialization is 0.902×; validation remains 1.665× and is the next measured
gap. Full results, rejected variants, and artifact paths are in RESULTS.md.

The next optimization should be the common checked validator scanner, not a Raw
or OTFCC branch. Profile the final frozen OTFCC validation function, then test
the existing first-block-bitmask/subsequent-block-any_true hypothesis across the
complete validation matrix. Preserve exact UTF-16 quote, backslash, control,
separator, depth, and bounded-tail behavior. Requalify FGO on this retained
output path before attributing its older serialization number to current source.

### Retained generated primitive-dispatch inlining, 2026-10-31

Keep `@inline` only on `JSON.__serializePrimitiveUnsafe`. Generated serializers
already reserve worst-case capacity for their integer and boolean fields; the
hint folds the compile-time type branch and removes the remaining tiny wrapper
without changing formatting or reservation algorithms. Seven minified V8
families range from 0.995× to 1.060× baseline stringification throughput. Five
default-w2c2 families range from 0.991× to 1.083×, with a repeated Twitter run
at 1.043× after an initial 1.069×. Exact owned-output and retention oracles pass.
Detailed controls and artifact paths are in RESULTS.md.

Do not generalize this to forced inlining of `itoaU64` or complete generated
serializers. Whole `itoaU64` inlining regressed CITM stringification to 0.961×
on V8 and 0.967× on default w2c2. Splitting a forced-inline small-value entry
from the large formatter was neutral on V8 and 0.933× on default w2c2. Complete
generated serializer inlining reached only 1.017× V8 and 1.038× default-w2c2
CITM stringification while moving unrelated phases by up to about 3.5%; all
three broader hints are rejected.

### Retained reservation-free generated floats, 2026-10-31

Generated serializers reserve their complete estimated output capacity once,
so route non-nullable `f32` and `f64` fields through the same unsafe primitive
dispatcher already used by integers and booleans. This removes redundant
per-field capacity and stack-size accounting without changing xjb-as conversion
or special-value semantics. Lottie minified stringification improves 1.023× in
V8 and 1.026× in default w2c2; Twitter is 1.001×/1.009× and three broad controls
are neutral within 0.7%. All exact owned-output comparisons pass. Keep this as
a general fixed-region improvement, but expect larger gains to require keeping
the output cursor local across multiple adjacent generated writes.

### Retained generated local output cursor, 2026-11-01

Keep the generated serializer cursor local across fixed keys and primitive
values. Cursor-returning boolean, integer and float writers avoid repeated
loads/stores of `bs.offset`; generated code flushes before every string, array,
nested object, lazy value or custom serializer and reloads afterward. The rule
is shared by every generated object and preserves relocation and reentrancy.

Against the preceding committed source, six balanced SIMD rounds give default-
w2c2 stringify gains of 1.014× CITM, 1.202× Lottie, 1.011× Canada and 1.159×
Twitter. V8 is 1.027×, 1.004×, 1.003× and 0.995× respectively. Exact retained-
output oracles and both complete three-mode suites pass. Continue this direction
by finding other allocation-free regions, but keep every flush boundary
explicit; do not make strings, collections or callbacks rely on a stale local
after buffer relocation.

### Retained specialized object-element inlining, 2026-11-01

Inline the shared array-element writer into each concrete array loop. The
generated serializer had already folded into that writer, but the loop still
paid a separate managed frame. All null, custom, polymorphic and fallback checks
remain and fold by concrete element type. A fresh CITM profile identifies 742
of 2,131 Wasm self samples in four object-element writers.

Seven-family balanced screens are broadly neutral or positive: CITM improves
1.039× in V8 and 1.089× in default w2c2; GitHub events improves 1.013×/1.042×;
the other five layouts range from 0.991× to 1.014×. SIMD binary size is flat to
0.07% smaller. Keep the general inline hint and its existing mutation/
reentrancy tests. Do not add a corpus or schema heuristic based on the initial
Canada outlier; its eight-pair confirmation is 1.011×/1.014×.

### Retained direct generated array dispatch, 2026-11-01

Generated serializers know the exact type of every field. Route non-nullable
`Array<T>` fields directly to the shared array writer through a tiny inline
entry instead of re-entering the generic reference dispatcher. Keep nullable
arrays on the generic path: the focused nullable-collection suite caught an
initial over-broad rule before performance qualification. This optimization is
transform-wide; it does not select a corpus, schema signature or value shape.

Across CITM and six classic minified families, six-pair SIMD stringify ratios
range from 0.978× to 1.039× on V8 and 0.988× to 1.048× on default w2c2.
All exact owned-output comparisons pass and no phase crosses the 5% regression
guard. The next generated-dispatch experiment should use the same rule: bypass
only a statically redundant generic layer, while leaving allocation, custom
hooks, nullable semantics and shared formatting kernels intact.

### Retained direct generated string dispatch, 2026-11-01

Apply that same static-dispatch rule to generated string fields. A small inline
entry handles the established nullable `null` word and sends non-null values to
the existing string kernel, bypassing only the generic type cascade. The rule
is shared by all concrete `string`, `String` and nullable string fields and has
no corpus, schema or value selector.

Independent eight-pair confirmations show Twitter SIMD stringification at
1.053× V8 and 1.415× default w2c2, and GitHub events at 1.086×/1.443×.
CITM is 1.011×/1.048×. Four other classic families are neutral to mildly
positive overall, with individual ratios from 0.990× to 1.027×. Exact owned
outputs pass and no measured phase crosses the 5% regression guard.

Do not replace the integer-array indexed load with an explicit pointer/end
loop. wasm-opt already emits a compact shifted index, and the candidate moves
CITM stringification to 0.994× V8 and 0.981× default w2c2 despite removing a
source-level multiply. Keep generated code inspection subordinate to paired
public-API measurements.

### Retained direct generated object dispatch, 2026-11-01

Route non-nullable, transform-known concrete object fields through a small
inline object entry instead of the complete generic reference dispatcher. The
entry still checks for a runtime custom serializer on subclass instances, then
uses the existing generated virtual serializer. Nullable, generic and
transform-known custom fields remain on the established generic path.

Seven minified classic layouts pass complete owned-output and retention
oracles. Six balanced SIMD pairs put V8 stringify throughput between 0.994×
and 1.015× baseline and default w2c2 between 0.977× and 1.066×. GitHub events
is the clearest gain at 1.066× on default w2c2; the largest measured slowdown
is GSOC at 0.977× on that backend. No measured phase crosses the 5% regression
guard. This is a transform-wide static dispatch rule, not a schema or corpus
selector.

### Retained two-vector clean SIMD string loop, 2026-11-01

Process two adjacent 16-byte blocks per branch in the optimistic SIMD string
serializer. Both blocks receive the same quote, backslash, control and Unicode
candidate checks as before; the first candidate pair falls through to the
existing one-vector and exceptional paths. This is a general clean-string loop
change with no corpus, schema, field, length or content signature selector.

An isolated GitHub-events serialization profile attributes 158 of 239 Wasm
self samples to the shared string serializer. The payload has 752 strings
averaging 50 UTF-16 units, with only five requiring JSON escapes. Six balanced
SIMD pairs put V8 stringification at 1.030x GitHub and 1.081x GSOC, with the
other five classic controls between 0.977x and 1.002x. Default w2c2 measures
1.024x GitHub, 1.025x GSOC, 1.016x Lottie and 0.997x multilingual Poet. Every
variant passes complete owned-output and retention oracles, and no measured
phase crosses the 5% regression guard. The retained source passes all 123,360
normal and 77,676 strict/RFC checks across NAIVE, SWAR and SIMD, plus transform
regressions, typecheck and lint.

### Retained two-vector checked SIMD input scan, 2026-11-01

Process two adjacent 16-byte blocks per branch in the shared checked UTF-16
string scanner. Each block uses the same full-lane quote, backslash and control
checks as the existing loop, and the first event still enters the established
scalar escape/tail path. The scanner is shared by standalone validation,
generated typed parsing, dynamic parsing, object keys and checked raw/lazy
traversal; it has no corpus, schema or value-shape selector.

Balanced five-pair SIMD screens show the largest gains on GSOC: owned parse is
1.073× baseline in V8 and 1.050× in default w2c2, while validation is 1.097×
and 1.110×. GitHub validation is 1.050×/1.020× and Lottie is 1.015×/0.974×.
The numeric-heavy Canada control validates at 1.044×/0.974× and parses at
0.992×/0.999×. No measured phase crosses the 5% regression guard, and every
variant passes complete owned-output and retention comparisons. The retained
source passes all 123,360 normal and 77,676 strict/RFC checks across NAIVE,
SWAR and SIMD, plus transform regressions, typecheck, lint and diff checks.

### Retained combined clean-input SIMD event branch, 2026-11-01

Combine the two checked input blocks' event vectors before testing the clean
32-byte iteration. Eventful pairs fall through to the established one-vector
mask path, which identifies the exact first code unit. Clean pairs avoid two
bitmask reductions and a branch between blocks. This is a control-flow change
inside the same shared scanner, with no new schema or input selector.

Relative to the preceding two-vector scan, V8 validation improves 1.148× on
GitHub events and 1.426× on GSOC; owned parse improves 1.065× and 1.140×.
Default w2c2 ranges from 0.989× to 1.016× on those parse/validation rows. The
Lottie and Canada controls remain within 1.8% on V8 and 3.2% on default w2c2,
and no phase crosses the 5% regression guard. Exact owned-output and retention
comparisons pass. The complete retained source passes all 123,360 normal and
77,676 strict/RFC checks across all three modes, plus transform regressions,
typecheck, lint and diff checks.

### Retained inline buffer-reservation fast check, 2026-11-01

Inline the shared output buffer's `requiredSize <= bufferSize` check into its
callers while keeping actual growth and relocation outlined. The change applies
to every serialization mode, output representation and value type; it does not
inspect the corpus, schema or value. This removes a managed Wasm call from the
ordinary no-growth path without duplicating the cold allocator.

Five-pair SIMD screens put GitHub-events stringification at 1.059× baseline in
V8 and 1.010× in default w2c2. GSOC is 1.017×/1.011×, Lottie 1.000×/1.006×,
and numeric-heavy Canada 1.004×/0.996×. All complete owned-output and retention
comparisons pass; no parse, stringify or validation row crosses the 5%
regression guard. The exact source passes 123,360 normal and 77,676 strict/RFC
checks across all three modes, plus transform regressions, typecheck, lint and
diff checks.

### Retained inline output-size proposal path, 2026-11-01

Inline `bs.proposeSize` so ordinary writers update the proposed stack size and
perform the already-inlined capacity check without another managed Wasm call.
Actual growth and relocation remain outlined. The change applies to every
serialization mode and value type; it has no corpus, schema or value selector.

An exact-code GitHub serialization-only profile attributes 23 of 911 Wasm self
samples to the outlined proposal helper before this change. Five-pair SIMD
screens put GitHub-events stringification at 1.015× baseline in V8 and 1.045×
in default w2c2. GSOC is 1.009×/1.072×, Lottie 1.009×/1.000× and Canada
1.009×/1.016×. All complete output/retention oracles pass and no measured phase
crosses the 5% regression guard. The exact source passes 123,360 normal and
77,676 strict/RFC checks across all three modes, plus transform regressions,
typecheck, lint and diff checks.

### Retained scalar entry for checked SIMD keys, 2026-11-01

Check the first two UTF-16 code units of an object key directly before entering
the wider clean-key event mask. Longer keys continue through the existing
full-lane quote, backslash and control checks, and escaped or invalid keys keep
the established checked path. This is a shared key-scanner rule with no corpus,
schema or field selector; NAIVE and SWAR are unchanged.

The motivating OTFCC input contains 5.86 million keys, while a complete
16-layout validation screen supplies the generality control. Five balanced
pairs show no SIMD row beyond the 5% regression guard in V8, checked w2c2 or
default w2c2. Default w2c2 validation throughput improves 1.117× on OTFCC,
1.023× on FGO, 1.042–1.047× on GSOC, 1.083–1.097× on Poet and 1.020× on
GitHub events. OTFCC moves from 1.167× native latency to 1.045×, inside the
1.2× target. V8 OTFCC improves 1.021× and checked w2c2 improves 1.040×; those
two executions remain outside the native target. Canada and CITM trade back by
at most 3.9% on default w2c2, without crossing the regression guard.

All 64 changing validation inputs and RFC preflight checks pass on every
measured backend. The exact source passes 123,360 normal and 77,676 strict/RFC
checks across all three modes, plus transform regressions, typecheck, lint and
diff checks.

### Retained four-unit checked SIMD key entry, 2026-11-01

Extend the checked SIMD key entry from two direct UTF-16 event checks to four
before entering the wider mask. This keeps the same quote, backslash, control,
bounds and fallback rules while covering ordinary two- and three-unit keys
without a reduction mask. It is still one shared scanner rule; there is no
corpus, schema or field selector.

Five balanced pairs across all 16 classic layouts show default-w2c2 SIMD
validation gains on every row: 1.110×/1.088× CITM, 1.081×/1.077× GitHub
events, 1.082× FGO, 1.078×/1.041× Lottie, about 1.06× Poet and 1.037× OTFCC.
OTFCC reaches 0.999× native latency. V8 improves as much as 1.070× on CITM and
1.041× on Lottie; its largest tradeoff is 1.8% on Twitter. Checked w2c2 ranges
from 0.974× to 1.050×. No row on any backend crosses the 5% regression guard.

All RFC preflight and 64 changing-input validation oracles pass. The exact
source passes 123,360 normal and 77,676 strict/RFC checks across all three
modes, plus transform regressions, typecheck, lint and diff checks.
