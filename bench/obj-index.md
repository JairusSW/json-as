# JSON.Obj collision index benchmark

Build the transform and run the deterministic correctness checks:

```sh
npm run build:transform
node transform/__tests__/obj-collision.test.mjs
```

This compiles and executes actual WebAssembly in Node for NAIVE, SWAR and SIMD,
with both strict settings and both fast-parser settings. It checks ordinary and
colliding keys through 4096 initial entries, duplicate ordering and last-value
lookup, append after index construction, update, deletion, reinsertion, clear,
parser destination reuse, escaped equivalent keys, different key lengths, nested
mutation and collection. A separate fixture inspects AVL ordering, heights,
balance and unique reachable nodes after construction, growth, duplicate append
and deletion, including reverse/shuffled insertion order. Wrapped collision
chains exercise both sides of the 64/65-entry fallback boundary. These are deterministic assertions, not timing thresholds.
The harness is included in `npm run test:transform`.

Run a before/after comparison against the parent revision:

```sh
node --no-liftoff transform/__tests__/obj-collision.test.mjs --bench \
  --baseline=83a88d03562af7778d5c612faa812ca5131ef89c
```

Set `OBJ_MODES=NAIVE,SWAR,SIMD` for benchmarks across all modes (benchmark default:
SWAR). The baseline's `assembly/index.ts` is copied from Git into an isolated
source tree with the same fixtures, dependencies and built transform. The live
source is never replaced. The baseline option is intended for revisions where
only `assembly/index.ts` differs in the runtime under comparison.

CSV output reports median nanoseconds per original key and the relative change
from baseline for 64, 256, 1024 and 4096 entries:

- **build:** first lookup, including lazy index construction;
- **lookup:** all present keys plus one colliding miss per round, with at least
  16384 present-key lookups;
- **mutation:** update each existing key and insert one new key per original key,
  including any index growth or rebuild.

Each phase/sample gets a fresh Wasm instance and fresh object. Setup, key
construction and checksums are outside the timed region; build and lookup retain
an internal correctness assertion. Seven measured samples follow two warmups, alternating current/baseline order.
The mutation result is checked with an additional untimed lookup checksum.
The fixture algebraically generates unique fixed-length UTF-16 keys whose FNV-1a
hashes have identical low 16 bits, including the hash's length mix. They collide
at every index capacity in this benchmark, including after growth. Key generation
is not a JavaScript algorithm mirror: every measured operation calls JSON.Obj in
compiled Wasm. Ordinary keys use sequential `ordinary-key-<n>` strings.

The benchmark command disables V8 Liftoff so background tier-up does not distort
comparisons. Use the same Node/runtime and machine for before/after measurements and avoid
concurrent builds or benchmarks. Small samples are sensitive to scheduling and
clock resolution. Treat performance numbers as observations, not CI assertions.

## Index guarantees

Objects with at most six entries use a backward linear scan. Larger objects use
at most 64 hash probes per index lookup or insertion. When a chain exceeds that
budget, the index switches to an AVL tree with O(n log n) key comparisons to
build and O(log n) comparisons per lookup. Incremental tree insertion has
logarithmic comparison cost; geometric buffer growth amortizes its copying
cost over insertions. Comparison cost also depends on key length, so these are
comparison-count bounds, not constant-time string comparisons.

Deletion still performs O(n) compaction and invalidates the index. These bounds
do not claim logarithmic work for arbitrary repeated delete/rebuild sequences.
The internal comparator and tree never reorder the original key/value slots:
iteration and serialization retain insertion order, including duplicate slots,
while lookup and updates resolve the last duplicate.

## Memory tradeoff

The tree stores four i32 fields per capacity slot (16 bytes), rounding capacity
up to a power of two. Hash metadata uses one i32 per bucket, with power-of-two
capacity strictly above twice the entry count. Thus tree metadata is about
16–32 bytes per entry versus 8–16 for hashing; at exactly 4096 entries both use
64 KiB, while between powers of two the tree can use twice the index memory.
Switching indexes can temporarily retain the discarded hash allocation until
collection. There are no per-node managed objects, and encoding the tree root in
the existing mask field avoids increasing the size of ordinary JSON.Obj objects.

## Recorded comparison

Measured on 2026-11-10 with AssemblyScript 0.28.20 (the installed lockfile
version), Node v24.22.1, Linux x64 on an AMD EPYC 9V74 80-Core Processor,
`--no-liftoff`, all three modes and baseline `83a88d03562af7778d5c612faa812ca5131ef89c`.
Other coordinated build/benchmark jobs were paused. The complete 64–4096-key
results are in [obj-index.results.csv](obj-index.results.csv), including ordinary
workloads and small-input costs. These are observations on a shared host, not
portable performance guarantees.

At 4096 initial keys, time changes versus the baseline were:

| Mode | Keys | Index build | Lookup | Update + insert |
| --- | --- | ---: | ---: | ---: |
| NAIVE | ordinary | +63.1% | +14.2% | +0.4% |
| NAIVE | colliding | -97.0% | -98.5% | -98.5% |
| SWAR | ordinary | +7.7% | -3.6% | +5.1% |
| SWAR | colliding | -97.0% | -98.5% | -98.3% |
| SIMD | ordinary | +5.1% | +0.4% | -17.1% |
| SIMD | colliding | -96.5% | -98.5% | -98.3% |

The collision protection substantially reduces adversarial growth. Remaining
ordinary-workload costs are shown rather than excluded: at 4096 keys, NAIVE
lookup was 14.2% slower and its index build was 63.1% slower in this run, while
SWAR/SIMD lookup changed by -3.6%/+0.4%. Build/mutation timings were more variable
across sizes, and small build samples are only a few microseconds. The full CSV
also preserves smaller-input regressions and variation.

Inspection of emitted Wasm identified avoidable helper/shadow-stack work from
compiler inlining on the repeated-lookup path. Explicitly checking the cached
index before lazy construction and inlining key equality removed the earlier
systematic ordinary-lookup regression in SWAR/SIMD. The 64-probe budget also
avoids the premature tree conversion observed with a 16-probe budget on the
ordinary 4096-to-8192-key insertion case. No timing threshold is enforced in CI.
