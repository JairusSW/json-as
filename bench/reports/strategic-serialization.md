# Strategic read-then-forward serialization

The serializer already copied unmaterialized lazy ranges. Access analysis still
treated whole-object `JSON.stringify` as an unknown escape, however, disabling
strategic eager-read plans in forwarding functions. The fix recognizes calls
bound to json-as (including aliases and namespace imports), without relaxing
ordinary unused-field elimination or application-owned calls.

The first serialization freezes the eligible read set. A later access must not
pull a custom decoder ahead of the first output. This boundary includes nested
sites and children discovered later. Assigned/materialized values use typed
serialization; deferred values copy their original field ranges. Omission,
inheritance, eager arrays, reuse and GC retain their existing behavior. There is
no whole-output cache. Ordinary `@json` whole-object serialization keeps all
observable fields; deferred source forwarding remains an explicit lazy feature.

## Validation

- Initial regression goes red with eager-state mask 0 rather than 1 despite a
  guaranteed pre-serialization read.
- A second regression catches premature decoding of a field first read after
  the first serialization (two encoder calls rather than one).
- 760 checks across 38 backend/runtime/strict/fast-path and disabled-strategy
  configurations pass, including aliases, inherited source ranges, replacement,
  child mutation, serialization ordering, omissions and GC.
- Actual npm tarball: 324 operations across 36 configurations pass through both
  entrypoints, including runtime aliases, namespace imports, raw forwarding,
  eager-state checks and distinct owning output strings.
- Existing strategic quick suite: 134 checks; ordinary quick suite: 72 checks.
  Strategic analysis, path budgets, decorator IntelliSense, typecheck, lint and
  license headers pass.
- All nine classic output/retained-model GC oracles pass. Their serialization
  binaries are byte-identical to `e9971446`; this change does not modify those
  native-struct benchmark images.

## Saved GitHub API workload

Saved 7,624-byte AssemblyScript repository API response, complete inferred model,
summary reads followed by fresh serialization on every operation. Output length
is consumed; both full-read and forwarding snapshots pass independent Python
full-document checks, as do integer-preserving read checksums. Preparation also
asserts eager decisions for the forwarding function's summary fields.

Apple M4 Max / arm64 / AC, Node 26.4.0 / v8 14.6.202.34-node.21, AssemblyScript
0.28.20, SWAR/incremental, -O3, compatibility mode, fast path on, JSON_CACHE=0.
Eight alternating fresh-process groups; each process warms at least 100 ms and
records three timed batches. These are audited shared-host measurements under
background activity. This is **end-to-end read-and-forward throughput using
input UTF-8 bytes**, not isolated serialization or the simdjson native gate.

| Current branch variant | µs/op | GB/s | Throughput / eager | Paired 95% interval | Trace block bytes/op |
|---|---:|---:|---:|---:|---:|
| Eager control | 4.749 | 1.605 | 1.000× | 1.000–1.000× | 27778 |
| Ordinary default | 4.998 | 1.525 | 0.950× | 0.932–0.966× | 27778 |
| Deferred all | 3.873 | 1.968 | 1.226× | 1.204–1.249× | 17040 |
| Strategic | 3.768 | 2.023 | 1.260× | 1.241–1.278× | 17040 |

The strategic row has 26.0% higher throughput than the same-branch eager
control in this capture. This comparison includes the existing benefit of
forwarding deferred ranges; it is not an isolated before/after measurement of
this analyzer fix. The ordinary variant still parses every field because the
writer observes the whole object. Its slower result is retained, not attributed
to the new fix. Allocation counts use separate RTRACE builds and are not RSS or
timed-instrumented measurements.

The [raw evidence](data/strategic-serialization-forwarding.json.gz) preserves all
samples/audits, payload, compiler flags, source/binary seals, measured harness,
read decisions, tracked patch, red/green checks and classic binary hashes. The
reporter received smoke-export and wording corrections after timing; the original
measured harness snapshot still matches the recorded SHA. Near parity for eager
native-struct serialization remains a separate, unfinished goal.
