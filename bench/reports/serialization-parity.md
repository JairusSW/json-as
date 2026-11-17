# Native-struct serialization parity

The accepted checkpoint meets the 90% simdjson throughput gate on **4 of 9**
classic corpora. Full corpus parity remains unfinished. Further performance
optimization stopped at the user's request.

## Latest measured checkpoint

Measured implementation: `213db5dd`. The correctness follow-ups through
`a9de415d` rebuild all nine optimized classic serialization binaries
byte-for-byte identically to that implementation. Those follow-ups were not
separately timed.

| Corpus | json-as GB/s | simdjson GB/s | Throughput ratio | 90% gate |
|---|---:|---:|---:|---|
| twitter | 8.230 | 10.568 | 0.779× | Below |
| canada | 1.153 | 1.260 | 0.915× | Pass |
| citm_catalog | 6.453 | 10.374 | 0.622× | Below |
| poet | 20.160 | 23.329 | 0.864× | Below |
| github_events | 8.331 | 16.316 | 0.511× | Below |
| gsoc-2018 | 11.638 | 16.760 | 0.694× | Below |
| lottie | 26.135 | 22.386 | 1.168× | Pass |
| otfcc | 34.608 | 23.615 | 1.466× | Pass |
| fgo | 38.872 | 21.470 | 1.810× | Pass |

Apple M4 Max / arm64 / AC power; v8 15.2.20, Node 26.4.0, AssemblyScript
0.28.20; SIMD/incremental/compatibility, validation disabled, JSON_CACHE=0.
The original classic harness serializes complete native models into fresh
owning output strings. Native uses simdjson 5.0.4 (`3b0b2b53`), GCC 16.2.0,
C++26/reflection and `-O3 -DNDEBUG -mcpu=native`. Input layouts are aligned,
and GB/s counts each writer's actual UTF-8 output bytes.

The capture used five alternating fresh-process pairs per corpus, 90 processes
in total, under the shared host timing lock. These are shared-host measurements,
not isolated-host or peak-RSS claims. Differences from earlier independent
captures are not causal implementation deltas.

Two paired Twitter comparisons measured 3.24% and 3.37% lower elapsed time for
bounded large-writer literal pools. GitHub's paired effect remained unresolved.

## Correctness follow-ups

- Numeric batches use comparisons without invoking application `min`/`max`.
- Redirected `__new` allocation hooks retain the original output allocation path.
- Deserialization GB/s uses input fixture bytes; serialization uses output bytes.
- Purity certificates require native operation and depth bookkeeping bindings.
- Wrapped or unverified float formatters retain snapshot Map traversal.
- Scoped SIMD literal helpers construct their vectors in native scope.

Targeted regressions, Map mutation/GC checks, literal-store checks and the packed
consumer matrix passed locally on `a9de415d`. Hosted CI status is reported on
the PR separately. Raw result archives and the chronological experiment dump
are excluded from the source tree; this document retains the accepted summary.
