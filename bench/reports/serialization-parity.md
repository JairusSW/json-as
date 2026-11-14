# Native-struct serialization parity

Work in progress on `jairus/serialize-parity`. The target is near parity with
simdjson's fresh owning-struct serialization across the classic corpus. The
initial three-corpus screen is not whole-corpus qualification.

## Initial baseline

Measured on local ARM64, on AC power, with the shared host timing lock.
Runtime/host versions, binary and source hashes, power state, process audits,
and every sample are in the [raw capture](data/serialize-parity-baseline-6a37efd7.json.gz).
The json-as implementation is main at `6a37efd7`; the only code change for this
capture is the serialization phase added to the paired comparison runner.

| Corpus | json-as µs | simdjson µs | json-as GB/s | simdjson GB/s | Throughput ratio |
|---|---:|---:|---:|---:|---:|
| Twitter | 134.67 | 45.59 | 3.55 | 10.47 | 0.34× |
| Canada | 2541.57 | 1706.70 | 0.82 | 1.22 | 0.67× |
| CITM | 264.75 | 49.34 | 1.89 | 10.14 | 0.19× |

Numbers are medians of five alternating fresh-process pairs, SIMD json-as with
the incremental runtime, compatibility mode, validation disabled, and fast
readers enabled. Both writers serialize complete owned models to fresh strings
on every operation; the simdjson adapter does not cache serialized output.
The original classic AS harness, including its warmup and allocation behavior,
is retained. This is warmed-code serialization of an existing object, not
latency of the first call in a fresh module. GB/s uses each writer's actual
UTF-8 output length; json-as internally produces UTF-16 strings.

Before timing, complete model outputs were checked against integer-preserving
oracles, including retained models serialized after input disposal and GC.
Native output is also checked after every process invocation. Preparation seals
sources, runtime files and binaries; measurement rejects changed seals.

The 90% gate failed on all three initial corpora. CITM is the first profiling
target. Runtime optimization, paired before/after qualification, remaining
classic coverage, and a final performance verdict are outstanding.

## Reservation policy experiment

An allocation trace of warmed CITM serialization found four large allocations
per call: approximately 1.02 MB, 1.27 MB, 1.59 MB, then a 1.00 MB final output.
Generated field reservations exceed actual output size, so learning capacity
from the final length repeatedly underestimates the managed writer's demand.

The candidate retains reusable staging when reservation demand exceeds output
length by more than 25%. The same probe then records one large allocation.
The permanent synthetic integer-record regression fails on the baseline with
nine large allocations per warmed output and passes with one on the candidate.
Output retention and size transitions pass on all three backends and runtimes;
allocation counts are asserted only on incremental/minimal because stub does
not provide allocator trace callbacks. Static-output regressions pass 117 checks.

An isolated serialization-only CITM screen then measured six alternating
fresh-process pairs under the shared timing lock: median baseline 245.275 µs,
candidate 144.55 µs, a 41.1% latency reduction (1.70× throughput).
Both binaries used the same named-function profiling build and model source.
This establishes a local before/after effect, not a revised native parity ratio.
The regular harness and remaining classic corpora still need qualification.
The [screen capture](data/serialization-reservation-screen.json.gz) retains
all samples, logs, binary hashes, candidate patch, model source and CPU capture.
The profile processor warned of a V8 version mismatch, so native-symbol labels
should not be interpreted; named Wasm allocation/GC frames corroborate churn.
