# Encoding normalization allocation comparison

Compared unchanged main `83a88d03562af7778d5c612faa812ca5131ef89c` with this change using the same `encoding-normalization.test.mjs` runner (set `JSON_ENCODING_BASELINE=1` only when running the old implementation to disable the one-allocation assertion).

Node v24.22.1, AssemblyScript 0.28.20, `-O3`, incremental runtime, `ASC_RTRACE=1`. The input is a valid quoted ASCII string represented by alternating NUL and non-NUL UTF-16 code units. Input creation and startup are excluded; counters surround a call to public `JSON.validate`. Allocation bytes are cumulative allocator block bytes, **not peak memory or retained heap**. There is no latency claim.

Both byte orders and all six NAIVE/SWAR/SIMD × fast on/off configurations yielded the same counts and bytes below. Input storage means UTF-16 payload bytes, excluding its object header.

| Input storage | Output code units | Allocations before → after | Cumulative bytes before → after | Bytes reduction |
| ---: | ---: | ---: | ---: | ---: |
| 4,096 | 1,024 | 2,048 → 1 | 1,110,016 → 2,080 | 99.8126% |
| 8,192 | 2,048 | 4,096 → 1 | 4,317,184 → 4,128 | 99.9044% |
| 16,384 | 4,096 | 8,192 → 1 | 17,022,976 → 8,224 | 99.9517% |
| 32,768 | 8,192 | 16,384 → 1 | 67,600,384 → 16,416 | 99.9757% |
| 65,536 | 16,384 | 32,768 → 1 | 269,418,496 → 32,800 | 99.9878% |
| 131,072 | 32,768 | 65,536 → 1 | 1,075,707,904 → 65,568 | 99.9939% |

The new implementation retains the existing recognition pass, then allocates one exact-size string and copies selected code units. Ordinary inputs still return the original string without an output allocation. Odd-length and malformed alternating-NUL inputs retain their old behavior; this is not a change to the accepted encoding policy.

Regression coverage compares short and malformed cases with an independent reference of the old behavior, preserves unchanged-input identity, checks surrogate/high code units, validates and strictly parses both byte orders, and asserts one allocation plus linear byte growth for 1K–32K output code units. CI runs the regression as part of `test:transform`.
