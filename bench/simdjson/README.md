# simdjson parity qualification

## Current classic deserialization target

Use JSON text → owning native structs for the classic simdjson baseline, and
`JSON.parse<T>()` with validation disabled for json-as. Progress is measured as
`native latency / json-as latency` on the same input. First bring every classic
to at least 50% of simdjson throughput, then 60%, 70%, and onward toward parity,
in order Twitter, Canada, CITM, then the remaining classics. Both minified and
pretty layouts count where present. Keep every declared field materialized.

`scripts/run-comparison-benches.mjs --prepare-only --suites=twitter-min,twitter-pretty`
builds owning native models from the actual AS schemas. The check overwrites and
destroys the temporary input and reuses the parser before serializing the object;
the complete output is checked with an integer-preserving JSON oracle. Run timing
with `--run-only` and the same selection under the shared host timing lock.
Classic and library objects use owning native structs; overview primitives
use their native owning types. All current comparison logs identify typed
values rather than a DOM. Raw fields own their lexemes without an extra DOM validation pass, matching
json-as compatibility parsing of declared `JSON.Raw` fields. The full input and
output are validated by the untimed oracle. Those fields remain raw in both
libraries; they are not a claim of typed decoding inside a raw field.

## Historical strict qualification harness

The older `run.mjs` qualification below uses a different strict/retained-output
policy. Its target is not the current staged deserialization goal.


The target is SIMD json-as latency at most 1.2 times native simdjson, with no
limit on being faster, for all nine classic corpora (16 layouts). Equivalent
validation and owned outputs remain required. Fresh owned parsing,
stringification and full validation give 48 required SIMD rows. Missing classic
coverage fails the whole-goal audit; one fast corpus is not completion.

This harness is under construction. The current executable comparison covers
fresh owned typed parsing, fresh owned stringification, and full validation.
SWAR performance and reused/dynamic/lazy/byte-input/diagnostic families are
optional exploration under the user's revised goal. Correctness remains required
across all supported modes. Report each backend separately; qualification needs
one backend's own complete classic matrix, not the best row from each runtime.
Current coverage and measured gaps are recorded in RESULTS.md.

Runtime optimizations must be general. Put changes in shared allocation,
construction, grammar, conversion and scanning machinery. Do not introduce
corpus-name checks, fixture signatures, library recognition of benchmark schema
key sets, or decimal widths chosen to match a fixture. Normal schema-generated
code and checks required by type, grammar or SIMD bounds remain appropriate.
Use varied array lengths, number formats, layouts and Unicode mixes as controls;
the corpus that exposed a cost does not define the optimization's scope.

## Local setup

GCC 16 with `-freflection`, V8/d8, wasm-opt and the project dependencies are
required. `PARITY_CXX` overrides the compiler path. simdjson is downloaded into
ignored build output and pinned to the exact revision in the manifest.

```sh
node bench/simdjson/run.mjs bootstrap
node bench/simdjson/run.mjs prepare --case canada-min --label baseline --ops 100
node bench/simdjson/run.mjs build --case canada-min --label baseline
node bench/simdjson/run.mjs run --case canada-min --label baseline --pairs 5 --gate-row
```

`--gate-row` evaluates SIMD latency against the 1.2× native budget; a gap returns 1.
`--gate` additionally refuses to pass while whole-matrix coverage is incomplete.
The parity verdict currently uses median latency. Five alternating process pairs
are required for reported comparisons; the one-pair smoke check is diagnostic.
Do not run tests or compilers while collecting timings.

The benchmark reserves memory through the runtime heap allocator, then frees
those temporary blocks before warmup and measurement. The default request is
1 GiB; actual linear memory may be larger. `BENCH_PREALLOC_BYTES=0` disables
reservation. A requested reservation must fit the runtime's available memory.
Direct `memory.grow` was previously used, leaving its new pages outside TLSF's
free pool. The allocator could grow again inside one variant's timed loop but
during another variant's warmup, distorting comparisons. Historical measurements
need requalification when this timing difference matters. The regression test
is `node --test bench/simdjson/preallocation.test.mjs` and covers incremental,
minimal and stub runtimes, disabled reservation, and repeated calls.

Cross-variant `compare.py` runs reverse the complete process order in adjacent
rounds, then rotate the base order between those pairs. Prefer six or twelve
rounds when comparing two variants on all three backends: this balances which
variant runs first and cycles all backend orders. The ordering regression tests
run with `python3 bench/simdjson/round-order.test.py`. An earlier implementation
rotated labels every round before reversal, causing the two-label baseline to
run first in every round. Historical comparisons retain their original samples;
new comparisons record the comparison and scheduling source hashes.

The optional `--native-from baseline` build argument reuses a byte-identical
native binary only after checking the generated model, driver and recorded binary
hash. Older artifacts without that provenance must be rebuilt. It
is useful for isolated formatter experiments that change only xjb-as.

Preparation records the linked AssemblyScript checkout's real path, git
revision, compiler files and a deterministic hash of the complete
`std/assembly` source tree. Build fails if any of them changes. The tree hash is
required because a dirty standard-library or runtime edit does not change the
checkout's git revision or compiled JavaScript compiler files.
Runtime experiments may pass `compare.py --allow-assemblyscript-source-change`;
this relaxes only the AssemblyScript provenance equality check. Inputs, native
binary, V8, wasm-opt, C++ toolchain, models, operation counts and output
oracles must still match.

## Comparable work

- Primary json-as measurements compile `JSON_STRICT=true`, no string cache,
  the incremental runtime, and the regular speed flags. SWAR and SIMD are shown
  separately. Native simdjson uses its current reflection API, GCC `-O3`, native
  CPU tuning and release checks.
- Models are extracted with the AssemblyScript parser from the same `@json`
  schemas. Nullable types and aliases are retained. Native owned strings are
  `std::string`; generated native classes reject unknown fields and permit
  defaults/missing fields, matching the current checked AS parser. Unsupported
  types and explicit initializers fail generation instead of being dropped.
- Four prebuilt, independently allocated input strings rotate each operation.
  Values change and no source offsets/results are cached. Eight prior parsed
  objects and eight prior output strings remain alive. Collection during the
  AS loop is timed; setup and the pre-phase full collection are excluded.
- AS strings are decoded from UTF-8 before the string-API timing. Native input
  is pre-padded UTF-8. These are natural API representations, not an end-to-end
  byte-ingestion claim. Byte-input timing remains a separate required family.
- Validation uses `JSON.validate` and simdjson DOM parsing, which validates the
  full document. It is not an On-Demand `iterate()`-only comparison. The DOM tape
  is an internal implementation cost of this available full-validation path.
- Complete serialized owned output is compared before the performance verdict,
  including earlier results retained through subsequent calls and forced GC.
  The Python oracle preserves integers above 2^53 and compares decoded strings,
  arrays and object fields. It rejects non-JSON numeric constants. This oracle
  compares JSON values; dedicated numeric tests cover target bits/rounding.
- Raw fields use owned `std::string` lexemes. Their native parse includes a full
  DOM validation pass before On-Demand boundary discovery and copying. The DOM
  parser retains its storage across calls. This is a conservative adapter
  baseline, not a claim about the fastest possible native raw parser.
  Nullable raw fields and raw arrays/maps use public serialization adapters.
  Lottie minified/pretty output and retention checks pass; the large OTFCC/FGO
  owned comparisons remain outstanding.

The raw benchmark adapter inherits DOM's number representability and Unicode
restrictions: oversized integers, overflowing exponents and isolated escaped
surrogates are rejected. AS `JSON.Raw` can retain a broader set of syntactically
valid lexemes. These corpus comparisons establish equivalent owned output for
the tested inputs; they do not establish identical acceptance on arbitrary JSON.
Run `node --test bench/simdjson/native-raw.test.mjs` after bootstrap for native
ownership, exact-text, malformed-subtree and adapter-limit checks.

Nullable native class pointers get explicit JSON-null handling through the
public tag_invoke deserialization hook. Self-recursive nullable fields use a
public with<Adapter> annotation and an outlined writer to avoid simdjson 5.0.4's
constexpr bound/forced-inline recursion under GCC 16. Twitter retains its
complete owned model. This adapter baseline and the original failed build are
documented in RESULTS.md; no private size-bound specialization or selective
output replaces the recursive field. @optional permits missing input keys but
still emits the field, matching the AS decorator's behavior.

String diagnostics include short/large ASCII, late quotes, dense escapes,
mixed Unicode, fullwidth text, short fullwidth tails and a forced Unicode
transition through an escaped prefix. They keep the ordinary owned-string API
and changing values/lengths; they do not qualify the entire strings family or
replace remaining corpus and family coverage.

## Artifacts

Each `build/simdjson-parity/runs/<label>/` contains the generated models, source
and input hashes, compiler/runtime versions, binary hashes and sizes, raw process
logs, full output oracles, and JSON results. Labels isolate dependency/algorithm
variants. Bootstrap records the native library object and source provenance.
Keep incomplete, failed and discarded runs separate from qualified results.

The initial xjb experiments compare installed 0.1.0, the existing unpublished
0.2.0 revision, a PR #3025-inspired cache variant and an exact-zero-low-limb
formatter variant. They are local experiments; no package was published or
merged. Both correctness and full public-API throughput must pass before an
optimization is recommended for integration.

For comparisons that vary only the formatter, build two labels with identical
operations, input contents, toolchains and native executable, then use:

```sh
python3 bench/simdjson/compare.py --labels baseline,candidate --output formatter-check
node --test bench/simdjson/generate.test.mjs
```

The comparison checks frozen input/binary hashes, balances variant order and
runs all full-output oracles after timing. It preserves raw samples and refuses
to overwrite an existing comparison. It is diagnostic; it does not pass the
whole-matrix gate. `build --profile` preserves Wasm function names for V8 profiling;
keep those binaries separate from speed-qualification labels.

## Numeric-array diagnostics

`numeric_flat-min` and `numeric_pairs-min` use the same first 4,096 coordinate
pairs from Canada, preserving every decimal token. Only their array shape
changes. The four input rotations reorder the pairs, so values also change.
These diagnostic rows supplement the classic corpus matrix; they do not replace
it or satisfy the entire numeric-array family.

```sh
node bench/simdjson/run.mjs prepare --case numeric_pairs-min --label pairs --ops 500
node bench/simdjson/run.mjs build --case numeric_pairs-min --label pairs
node bench/simdjson/run.mjs run --case numeric_pairs-min --label pairs --pairs 5 --gate-row
```

Preparation saves tracked source patches and copies additional untracked TS
sources. Build refuses source drift. Frozen binaries and inputs can subsequently
be run independently of the current working tree.

## w2c2 backend

The local checkout uses upstream main `c6f15cb77afaf00799160455a4e7165e749f10dd`,
also fast-forwarded to the user's fork with authorization. The original local
w2c2 checkout and its uncommitted work were preserved. The translator passes its
22 CMake tests. SIMD uses external SIMDe, pinned here to
`65c15e6b545361f6dd89b1e3bcc76273e1344653`.

To reproduce, clone those revisions into `build/simdjson-parity/w2c2` and
`build/simdjson-parity/simde`, then build the translator:

```sh
cmake -S build/simdjson-parity/w2c2/w2c2 -B build/simdjson-parity/w2c2-host -DCMAKE_BUILD_TYPE=Release
cmake --build build/simdjson-parity/w2c2-host --parallel 6
ctest --test-dir build/simdjson-parity/w2c2-host --output-on-failure
python3 bench/simdjson/w2c2-host.test.py
python3 bench/simdjson/w2c2-build.py --label baseline --case canada-min
python3 bench/simdjson/w2c2-build.py --label candidate --case canada-min
python3 bench/simdjson/compare.py --labels baseline,candidate --backends v8,w2c2-checked,w2c2-default --output runtime-comparison
```

`W2C2_CC` selects the C compiler (default Homebrew GCC 16). The exact existing
Wasm is translated, preserving the AS incremental runtime, strict parsing and
ownership/retention behavior. No conversion to native C++ structs occurs.
Floating contraction is disabled to preserve separate Wasm operations. The host
only provides file I/O, UTF-16-to-UTF-8 output, a monotonic clock and logs; it
preserves V8 oracles in separate runtime folders. Timed validation/parsing runs
inside the translated module.

`w2c2-checked` sets `W2C2_RUNTIME_CHECKS=1`. `w2c2-default` uses the project's
default 0, which disables Wasm memory/table bounds checks. Keep its results
separate from checked execution. JSON syntax validation is still enabled in
both. Backend metadata captures the translator, source/dependency revisions,
compiler commands, host and translated sources, and final binary hashes.
The full RFC suite currently runs under Wasmtime; w2c2 runtime comparisons cover
the named valid fixtures and complete retained-output oracles.

## Full classic validation matrix

The validation-only driver covers all 16 layouts, including Raw-heavy models
and Twitter's recursive schema. It uses no typed reflection adapter. Each case
loads four independent strings with changing values and lengths, verifies all
four inputs, then times complete validation. Input preparation preserves exact
numeric tokens. Valid/invalid preflight cases and an input-count oracle must
also pass in every execution backend.

```sh
node bench/simdjson/validation.mjs prepare --label validation-before --source-root /path/to/pre-change-checkout
node bench/simdjson/validation.mjs build --label validation-before
node bench/simdjson/validation.mjs prepare --label validation-current
node bench/simdjson/validation.mjs build --label validation-current
python3 bench/simdjson/w2c2-build.py --case validation-matrix --label validation-before
python3 bench/simdjson/w2c2-build.py --case validation-matrix --label validation-current
python3 bench/simdjson/compare.py --case validation-matrix --labels validation-before,validation-current --backends v8,w2c2-checked,w2c2-default --output validation-check --gate-validation w2c2-checked
```

Both source checkouts need matching dependencies and a built transform. Their
exact revisions, tracked patches and extra untracked TypeScript sources are
saved, and build rejects source drift.
The comparison verifies input and binary hashes and uses one byte-identical
native baseline for all variants. Corpus-specific iteration counts target at
least 32 MiB per phase, with at least ten iterations. Warmup, input loading and
transcoding are excluded; collection within the loop is included. Native DOM
scratch capacity and AS parser scratch are reusable implementation state.

A validation gate checks SIMD against the 1.2× native latency budget on every
layout. It cannot pass on missing layouts or a one-round smoke run. It does not
certify owned parsing or serialization. `--smoke --pairs 1`
is available for correctness/setup diagnostics and carries no performance gate.

For a tighter development loop, `prepare --cases canada-min,citm_catalog-pretty,lottie-pretty`
builds an explicitly partial diagnostic. `compare.py --gate-regression 3` fails
if a candidate median is more than 3% slower than its baseline on any measured
row. The threshold is explicit; this screen is not a native parity verdict. A
partial matrix cannot pass `--gate-validation`. This optional per-change screen
is diagnostic, not an additional user-goal requirement. `--gate-classic v8`
checks all three phases of one classic case against the SIMD budget; other
layouts still need their own evidence. The explicit target is recorded in the
manifest and comparison artifacts. Run its policy tests with
`python3 bench/simdjson/goal-policy.test.py`.

For an explicitly isolated backend-source experiment,
`compare.py --allow-w2c2-source-change` permits different pinned w2c2 commits.
The matching translator binaries may differ with those revisions. Compiler,
SIMDe, host, Wasm and input checks still apply; all backend provenance is saved
in `backends.json`. Build requires clean, committed w2c2 sources. Keep
experiment labels separate to preserve baseline executables. This flag does not
relax coverage or performance gates.

Owned-driver preparation accepts `--vary-length` to rotate both string values
and their lengths while preserving numeric tokens and key names. The choice is
recorded in `inputVariation`, and each input has its own length/hash. Use the
same option for both sides of a comparison. Numeric-shape diagnostics keep
their existing changing-value generator. Existing frozen same-length results
remain separate artifacts.

For small A/B effects, use equal-length ASCII labels and pass
`compare.py --require-equal-label-length`. Generated Wasm embeds label-derived
input/output paths; unequal label lengths can change data-section placement.
The flag rejects unequal lengths, and each comparison saves `invocation.json`.
Matching labels control this particular confound without proving that unrelated
code-layout or timing variation is absent.

String diagnostics (`string_short`, `string_clean`, `string_late`, `string_dense`,
`string_unicode`, each with layout `min`) generate four JSON string roots with
changing values and lengths. They compare fresh owned parsing/stringification
and full validation with std::string on native. Use 100,000 operations for the
short case and 5,000 for larger cases. The Unicode input is well formed;
isolated UTF-16 units remain correctness tests because native UTF-8 input has
a different representation/policy. These diagnostics do not bypass the overall
coverage gate.

Oracle copies happen after timing. On APFS the comparison driver uses
copy-on-write clones to preserve complete output bytes without duplicating
their storage. Other filesystems use ordinary copies. Destinations are replaced
atomically with independent inodes, so later producer writes or replacement of
previously hardlinked evidence cannot modify another captured file. Storage
errors propagate without truncating an existing destination. The copier's hash
is recorded in `invocation.json`; its tests run with
`python3 bench/simdjson/oracle-storage.test.py`.

To qualify a single frozen revision against native, supply one label. Use
`--modes simd` to measure only the goal's required mode; the default still
measures both SWAR and SIMD. Each selected mode retains every output check:
four initial graphs, eight retained objects and eight retained strings. A
single-label run reports self-comparison as one, not as an A/B speedup, and
balances native-first/native-last order across adjacent rounds. Regression
gates require multiple labels, and native gates require the target SIMD mode.

```sh
python3 bench/simdjson/compare.py --labels current --case fgo-min \
  --modes simd --backends w2c2-default --pairs 6 \
  --gate-classic w2c2-default --output current-fgo-qualified
```

The builders still freeze both modes; selecting measurements does not claim
unmeasured SWAR evidence. Selection and complete-output tests run with
`python3 bench/simdjson/measurement-selection.test.py`; ordering tests run with
`python3 bench/simdjson/round-order.test.py`. These options change measurement
selection, not fields, input variants, retained-output counts or the native
latency target. A single classic-case gate is not the full 48-row gate.
