# Append-only fresh cursor arrays

The fresh checked array reader constructs a new Array and advances its index
once per parsed element. Its former reuse-capable slot helper tested whether
each slot already existed, although this loop always appends. The reader now
pushes its zero placeholder directly, then decodes into that final slot.

Normal Array growth and zero-slot publication are preserved before any child
allocation or explicit collection. References remain owned by the Array;
reuse readers and the specialized float-array reader are unchanged. This
uses a fresh-construction invariant, without a corpus, schema, field name,
input identity, token width or value signature selector.

## Verification

- 123,956 normal and 78,024 strict/RFC checks pass across NAIVE, SWAR and SIMD.
  No cached test binaries are used.
- 2,109 focused checks pass across all modes, including forced collection
  during child initialization, buffer growth, float lengths and empty arrays.
- Typecheck and lint pass.
- Frozen candidate production patch SHA-256:
  `3f811e6d7cf3fdfee38d76c0578e569b5c0e6489a7311c966ea74ddc08231a28`.

The baseline is `emptyemit000001` (production code at `90ac4e7`); candidate
`freshpush000001` adds only this fresh-array change. Both use AssemblyScript
`670f0653`, simdjson 5.0.4, equal-length labels and 500 operations per phase.
Alternating fresh V8 processes use `--no-liftoff`. Builds, tests and profiling
do not overlap timing. SIMD is the only native parity performance gate;
correctness covers all three modes.

All six priority layouts (Canada, CITM and GitHub Events, minified and pretty)
pass twenty complete owned-output and retained-result comparisons per label
in the initial five-pair screen. No phase crosses the 3% regression guard.
Fifteen-pair confirmations replace the initial CITM/Canada estimates; GitHub
uses five pairs. Initial five-pair CITM/Canada parse estimates of 5–8% were
larger and are not final speedup claims. Final throughput ratios are baseline
latency / candidate latency; values above one improve:

| Layout | Parse | Serialize | Validate |
| --- | ---: | ---: | ---: |
| Canada minified | 1.053x | 1.004x | 0.998x |
| Canada pretty | 1.043x | 1.000x | 0.993x |
| CITM minified | 1.036x | 0.996x | 0.998x |
| CITM pretty | 1.037x | 1.014x | 1.001x |
| GitHub Events minified | 1.016x | 1.005x | 1.007x |
| GitHub Events pretty | 0.990x | 0.984x | 0.992x |

No phase exceeds the 3% regression guard in these final screens. The fresh
Array invariant explains the removed check; the measured results, rather than
the source-level operation count, establish its performance benefit here.

The shared host-lock protocol was introduced while the confirmation batch was
running. A kernel-lock wrapper guarded completion of the live Canada-pretty
batch without restarting it, then released the host to a queued W compiler
test job. Earlier samples predate that host-lock adoption; they do not provide
formal host-isolation evidence. Future heavy work uses the shared wrapper in
`~/LOCK.md`. This coordination transition does not establish native parity.

## Artifacts

Under `build/simdjson-parity/`: runs `emptyemit000001/` and
`freshpush000001/`; comparisons `fresh-push-<layout>-v8/` and confirmations
`fresh-push-<layout>-v8-15/`. Regenerable oracle JSON files are removed only
after complete comparisons pass. Frozen inputs, metadata, binaries,
individual timing logs and summary results remain.

This is an incremental improvement against the prior json-as revision. The
full native parity goal remains incomplete, particularly serialization on
CITM/GitHub and parsing/serialization/validation on Canada. Qualification in
this change follows the user's current focus on these three corpora.
