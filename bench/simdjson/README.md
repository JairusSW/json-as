# simdjson parity qualification

The target is json-as parity or better across the workload matrix, with equivalent
validation and output ownership. `workloads.json` records all nine classic corpora
(16 layouts) and the additional required families. Missing coverage fails the
whole-goal gate; an improvement on one corpus is not completion.

This harness is under construction. The current executable comparison covers
fresh owned typed parsing, fresh owned stringification, and full validation.
Reused output, fully materialized dynamic values, selective/lazy reads with full
validation, byte ingestion, scalar/numeric/string cases and layout variations
remain required. The initial completed corpus is Canada minified.

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

`--gate-row` evaluates the measured row against native simdjson; a gap returns 1.
`--gate` additionally refuses to pass while whole-matrix coverage is incomplete.
The parity verdict currently uses median latency. Five alternating process pairs
are required for reported comparisons; the one-pair smoke check is diagnostic.
Do not run tests or compilers while collecting timings.

The optional `--native-from baseline` build argument reuses a byte-identical
native binary only after checking the generated model, driver and recorded binary
hash. Older artifacts without that provenance must be rebuilt. It
is useful for isolated formatter experiments that change only xjb-as.

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
- Raw fields are not silently mapped to unvalidated On-Demand slices. Their
  equivalent-work native adapter and validation evidence are still outstanding.

The native Twitter reflection writer currently encounters a recursive-type
compile failure in simdjson 5.0.4 under GCC 16 (constexpr bound recursion and
forced-inline recursion). That row remains unmeasured; no reduced schema or
selective-output result has been substituted. Failed build logs are retained.

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
