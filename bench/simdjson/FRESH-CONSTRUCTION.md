# Generated fresh object construction

This changes construction as a coherent generated path: establish zeroed
reference slots, initialize observable defaults in their existing order,
decode present fields once, and complete implicit defaults only for missing
fields. The expected-order and cursor dispatch tiers retain their existing
grammar and continuation behavior.

Eligible schemas have no explicit field initializers, generic fields, lazy
fields or custom construction/completion hooks. Their generated fresh
initializer omits scalar/null zero stores and defers implicit empty strings
alongside existing pure collection/object defaults. Incremental allocation
already clears the complete object; minimal and stub receive one explicit
clear before any default can allocate or collect. Legacy initialization
remains available for other callers.

Generated nested default construction uses the same allocation and completion
policy recursively. Declared initializers still execute in their established
order and count; custom cursor hooks do not replace ordinary default
initialization. Fully ordered, complete objects skip the missing-default walk.
A layout miss continues at its current cursor and tracks whether the normal
tier still proves complete declaration order; partial/reordered objects retain
completion. Custom completion hooks are never elided by that proof.

The selection is based on construction semantics and schema capabilities,
without corpus, key-name, token-width, input-identity or value signatures.

## Correctness checkpoint

- 123,956 normal and 78,024 strict/RFC checks pass across all three modes,
  with every test binary rebuilt.
- The transform suite passes, including 1,416 parser checks over twelve
  configurations.
- The new runtime matrix passes 16,236 checks across incremental/minimal/stub
  and NAIVE/SWAR/SIMD. It covers missing fields, duplicate/reordered/full-order
  keys, retained graph independence, ordinary reuse, custom completion hooks,
  observable initializer counts, dirty minimal/stub payloads and collection.
- Forced collection inside initializers runs under incremental GC. Minimal GC
  is invoked from the host with the guest stack unwound, then the entire
  fixture runs again against recycled allocations.
- Typecheck and lint pass.

## Inheritance follow-up

An additional derived-class regression exposed two gaps before any performance
measurement. The checked cursor method's `out: this` parameter was not a valid
override signature for a derived class; it now uses the same generic-destination
pattern as the established slow parser. After that compile fix, the fixture
failed on the derived explicit-initializer count: it inherited the base's fresh
initializer and skipped its own declared default.

Every strict class now emits its own parsing/default-construction entries,
including classes that delegate to ordinary initialization. Inherited manual
cursor hooks are preserved during parsing, while ordinary default construction
does not run those hooks or custom completion hooks. Defer eligibility respects
custom lifecycle hooks throughout the base chain. The expanded fixture covers
each of these cases across all nine runtime/mode configurations. Both full
suites, the transform suite, typecheck and lint pass after the correction.

## Development performance screen

The frozen baseline is `freshpush000001` (production `c9e4c85`). Candidate
`freshctor000001` contains the corrected construction bundle. The earlier
`freshinit000001` checkpoint was never timed: its queued batch was stopped
before acquiring the host so inheritance could be corrected first.
Both use AssemblyScript `670f0653`, simdjson 5.0.4 and 500 operations per phase.
One nine-pair fresh-process V8 SIMD screen covers Canada, CITM and GitHub
Events, minified and pretty. Every label passes twenty complete owned-output
and retained-result comparisons on every layout. All observed phases remain
within the 3% regression guard. Ratios below are baseline latency / candidate
latency; values above one improve:

| Layout | Parse | Serialize | Validate |
| --- | ---: | ---: | ---: |
| Canada minified | 0.996x | 0.993x | 0.985x |
| Canada pretty | 1.000x | 0.997x | 0.981x |
| CITM minified | 1.002x | 1.002x | 1.000x |
| CITM pretty | 1.006x | 1.004x | 1.003x |
| GitHub Events minified | 0.990x | 0.995x | 0.988x |
| GitHub Events pretty | 0.996x | 1.003x | 1.012x |

These results supply no material throughput win. The retained construction
checkpoint includes the verified inheritance/runtime correctness fixes;
default-initialization tuning is not established as a useful performance
direction. Optimized driver sizes change by -0.07% Canada, approximately zero
CITM and -0.44% GitHub.

**This is not clean performance qualification.** Despite the kernel host lock,
the audit captures the uncoordinated periodic publisher and capture-transfer
`rsync` PID 42696 during part of the batch; desktop activity is also recorded.
The coordination request in `~/LOCK.md` has been updated with this evidence.
No speedup, regression-free qualification or native-parity claim follows from
this screen, and the same batch will not be repeated until heavy publisher
cycles coordinate through the host lock.

Heavy checks/builds use `~/benchmark-lock.py`; the separate measurement batch
used the same host lock after releasing the build hold. The completed hold
released normally. Artifacts are under `build/simdjson-parity/`: frozen runs
`freshpush000001/` and `freshctor000001/`, comparisons
`fresh-construction-<layout>-v8/`, and `fresh-construction-host-audit.log`.
Generated oracle JSON files were removed after complete comparisons passed;
metadata, inputs, binaries, raw timing logs and summary results remain.
