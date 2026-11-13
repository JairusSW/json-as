# Strategic laziness: captured API reads

Measured production sources: main `70a04480`; strategic branch `381902ff`.

[Raw paired samples, allocation results, source seals, and host audits](data/access-specialization-api-381902ff.json.gz). The [earlier 32-field capture](data/access-specialization-api-7bff3859.json.gz) is retained for comparison.

The later generic-inheritance change at `8cdeb1b2` produced [byte-identical ordinary benchmark binaries](data/access-specialization-binary-verification-8cdeb1b2.json) for all six payload/backend combinations.

Apple M4 Max, arm64, Node v26.4.0, v8 14.6.202.34-node.21, AssemblyScript 0.28.20. Incremental runtime, -O3, compatibility mode (strict off), fast path on, diagnostics on.

8 paired fresh-process groups per row and backend. Each process warms for at least 100 ms, then measures three batches; its median feeds the paired geometric means below. All raw batches are retained. GB/s uses captured UTF-8 payload bytes; input is already a pinned UTF-16 string. Timing includes JSON.parse plus the listed field reads, allocation and normal automatic collection. It excludes network, UTF-8 decoding, module startup and serialization.

The host used AC power with background activity. These are shared-host measurements, not an isolated qualification. Full power/process audits are included in the capture.

## Inputs and reads

- **github**, 7,624 bytes. Summary: id, full_name, stargazers_count, open_issues_count, archived, default_branch. Conditional: the same summary plus description, homepage, license, topics on 1/8 of records. Full: every modeled field and array element.
  Source: https://api.github.com/repos/AssemblyScript/assemblyscript
- **twitter**, 2,548 bytes. Summary: id_str, text, retweet_count, favorite_count. Conditional: the same summary plus user.name, user.screen_name, user.followers_count, entities.user_mentions on 1/8 of records. Full: every modeled field and array element.
  Source: assembly/__benches__/payloads/twitter.min.json: statuses[0] (integer-preserving extraction)
- **weather**, 8,395 bytes. Summary: latitude, longitude, timezone, current.temperature_2m, current.wind_speed_10m. Conditional: the same summary plus daily.temperature_2m_max, daily.temperature_2m_min, daily.sunrise on 1/8 of records. Full: every modeled field and array element.
  Source: https://api.open-meteo.com/v1/forecast?latitude=35.68&longitude=139.69&current=temperature_2m,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum&timezone=UTC&forecast_days=7

Models cover every field in each fixed capture. Integer tokens use i64; decimal/exponent tokens and mixed numeric arrays use f64. Null-only fields are nullable strings and empty arrays use string elements for this capture. Neither JSON.Raw nor dynamic-object shortcuts are used. Exact full snapshots and independent integer-preserving Python checksums passed before timing.

## SWAR

| API / read | Branch eager GB/s | Ordinary default GB/s | Default vs eager | 95% speedup interval | Ordinary lazy GB/s | Explicit strategic GB/s | Allocated bytes/op, eager → default |
|---|---:|---:|---:|---:|---:|---:|---:|
| github / summary | 2.148 | 2.408 | 1.12× (12.1%) | 1.11×–1.14× | 2.759 | 2.788 | 12928 → 880 |
| github / conditional | 2.118 | 2.238 | 1.06× (5.7%) | 1.04×–1.08× | 2.706 | 2.753 | 12928 → 1456 |
| github / full | 1.804 | 1.842 | 1.02× (2.1%) | 0.99×–1.05× | 0.935 | 1.697 | 12928 → 12928 |
| twitter / summary | 1.240 | 1.479 | 1.19× (19.2%) | 1.17×–1.22× | 2.113 | 2.223 | 3649 → 3153 |
| twitter / conditional | 1.244 | 1.472 | 1.18× (18.3%) | 1.17×–1.21× | 1.923 | 2.005 | 3584 → 3088 |
| twitter / full | 1.124 | 1.121 | 1.00× (-0.2%) | 0.99×–1.01× | 0.635 | 1.058 | 3584 → 3584 |
| weather / summary | 0.334 | 0.836 | 2.50× (150.5%) | 2.45×–2.55× | 2.767 | 2.841 | 42208 → 288 |
| weather / conditional | 0.333 | 0.766 | 2.30× (129.6%) | 2.25×–2.34× | 2.516 | 2.630 | 42208 → 2576 |
| weather / full | 0.299 | 0.296 | 0.99× (-0.7%) | 0.97×–1.01× | 0.302 | 0.292 | 42208 → 42208 |

## SIMD

| API / read | Branch eager GB/s | Ordinary default GB/s | Default vs eager | 95% speedup interval | Ordinary lazy GB/s | Explicit strategic GB/s | Allocated bytes/op, eager → default |
|---|---:|---:|---:|---:|---:|---:|---:|
| github / summary | 2.581 | 3.697 | 1.43× (43.2%) | 1.39×–1.47× | 4.384 | 4.476 | 12928 → 880 |
| github / conditional | 2.565 | 3.193 | 1.24× (24.5%) | 1.18×–1.30× | 4.297 | 4.435 | 12928 → 1456 |
| github / full | 2.134 | 2.128 | 1.00× (-0.3%) | 0.98×–1.01× | 1.182 | 1.991 | 12928 → 12928 |
| twitter / summary | 1.388 | 1.570 | 1.13× (13.2%) | 1.11×–1.16× | 3.390 | 3.887 | 3649 → 3153 |
| twitter / conditional | 1.381 | 1.552 | 1.12× (12.4%) | 1.11×–1.14× | 2.842 | 3.257 | 3584 → 3088 |
| twitter / full | 1.190 | 1.181 | 0.99× (-0.8%) | 0.98×–1.00× | 0.723 | 1.137 | 3584 → 3584 |
| weather / summary | 0.333 | 0.935 | 2.81× (180.9%) | 2.76×–2.85× | 7.164 | 7.732 | 42208 → 288 |
| weather / conditional | 0.331 | 0.839 | 2.54× (153.6%) | 2.48×–2.58× | 5.901 | 6.262 | 42208 → 2576 |
| weather / full | 0.295 | 0.299 | 1.01× (1.5%) | 1.00×–1.03× | 0.319 | 0.290 | 42208 → 42208 |

Allocations are a separate ASC_RTRACE=1 run, averaged over 32 operations; values include managed allocator block overhead/rounding. They are not RSS or throughput from the instrumented build. Branch eager disables access specialization; ordinary default enables it. The ordinary-lazy control uses lazy: all on the same branch.

Conditional weights are syntactic estimates, not profiles. The full-read control intentionally includes the cost of materializing everything. Effectful reference selections use the non-speculative reader.

95% intervals are paired bootstrap intervals (10,000 deterministic resamples), conditional on this host/run. They do not remove systematic effects from power policy or concurrent load.

## Access-analysis review fixes

The correctness and startup-allocation fixes at `10e86535` were compared with
`381902ff` using the same GitHub input on the same ARM64 host. Each row uses 16
alternating fresh-process pairs; the intervals are paired bootstrap intervals.
As above, the machine had background activity and these are not isolated-host
measurements. [Raw samples, binary hashes, and host audits](data/access-review-fix-10e86535.json.gz).

| Backend / read | Before GB/s | After GB/s | Change | 95% interval |
|---|---:|---:|---:|---:|
| SWAR / summary | 2.423 | 2.365 | −2.4% | −5.4% to +0.4% |
| SWAR / conditional | 2.264 | 2.269 | +0.2% | −2.0% to +2.3% |
| SWAR / full | 1.864 | 1.898 | +1.8% | −0.2% to +3.9% |
| SIMD / summary | 3.684 | 3.732 | +1.3% | −3.3% to +5.7% |
| SIMD / conditional | 3.237 | 3.260 | +0.7% | −2.9% to +4.2% |
| SIMD / full | 2.182 | 2.181 | 0.0% | −1.7% to +1.6% |

## Compiler cost and chunk-size experiments

On the same shared ARM64 host, four alternating whole-compiler `-O3` pairs for
the GitHub/SWAR model took approximately 7.2 seconds with ordinary
specialization disabled and 19.0 seconds enabled with the original 32-field
chunk size. This includes compilation and optimization, not just the
transform. Two `-O0` pairs took approximately 0.7 and 0.9 seconds respectively.
These small samples identify a substantial build-time cost; they are not
isolated compiler benchmarks.

An experimental 8-field chunk reduced specialized `-O3` compilation to about
13.8 seconds in two pairs, but a separate eight-pair SIMD run found 9.5% lower
GitHub summary throughput and 10.9% lower conditional throughput than 32-field
chunks. The retained 16-field layout took about 15.6 seconds in two compiler
pairs. In a separate 16-pair comparison against the original layout, GitHub
summary and conditional throughput changed by +0.6% and +3.8% on SWAR, and
−0.2% and +0.5% on SIMD. These measurements are shared-host results and do not
establish an isolated-host guarantee. [Raw compile samples and paired chunk comparisons](data/access-specialization-compile-tradeoffs.json.gz).
