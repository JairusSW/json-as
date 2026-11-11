# Strategic laziness: captured API reads

Measured production sources: main `70a04480`; strategic branch `7bff3859`.

[Raw paired samples, allocation results, source seals, and host audits](data/access-specialization-api-7bff3859.json.gz).

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
| github / summary | 2.168 | 2.389 | 1.10× (10.2%) | 1.08×–1.12× | 2.765 | 2.793 | 12928 → 880 |
| github / conditional | 2.140 | 2.183 | 1.02× (2.0%) | 1.01×–1.03× | 2.730 | 2.767 | 12928 → 1456 |
| github / full | 1.792 | 1.796 | 1.00× (0.2%) | 0.98×–1.02× | 0.937 | 1.722 | 12928 → 12928 |
| twitter / summary | 1.270 | 1.471 | 1.16× (15.8%) | 1.14×–1.18× | 2.162 | 2.258 | 3649 → 3153 |
| twitter / conditional | 1.245 | 1.493 | 1.20× (20.0%) | 1.18×–1.22× | 1.863 | 2.026 | 3584 → 3088 |
| twitter / full | 1.095 | 1.082 | 0.99× (-1.2%) | 0.97×–1.00× | 0.626 | 1.018 | 3584 → 3584 |
| weather / summary | 0.336 | 0.841 | 2.50× (150.4%) | 2.43×–2.57× | 2.740 | 2.814 | 42208 → 288 |
| weather / conditional | 0.333 | 0.765 | 2.30× (129.6%) | 2.28×–2.32× | 2.514 | 2.646 | 42208 → 2576 |
| weather / full | 0.297 | 0.294 | 0.99× (-0.8%) | 0.97×–1.01× | 0.300 | 0.290 | 42208 → 42208 |

## SIMD

| API / read | Branch eager GB/s | Ordinary default GB/s | Default vs eager | 95% speedup interval | Ordinary lazy GB/s | Explicit strategic GB/s | Allocated bytes/op, eager → default |
|---|---:|---:|---:|---:|---:|---:|---:|
| github / summary | 2.529 | 3.836 | 1.52× (51.7%) | 1.47×–1.56× | 4.362 | 4.565 | 12928 → 880 |
| github / conditional | 2.506 | 3.279 | 1.31× (30.8%) | 1.27×–1.35× | 4.287 | 4.312 | 12928 → 1456 |
| github / full | 2.121 | 2.132 | 1.01× (0.5%) | 0.97×–1.04× | 1.171 | 1.978 | 12928 → 12928 |
| twitter / summary | 1.405 | 1.588 | 1.13× (13.0%) | 1.11×–1.15× | 3.424 | 3.919 | 3649 → 3153 |
| twitter / conditional | 1.360 | 1.546 | 1.14× (13.6%) | 1.12×–1.16× | 2.852 | 3.158 | 3584 → 3088 |
| twitter / full | 1.178 | 1.190 | 1.01× (1.0%) | 1.00×–1.03× | 0.719 | 1.107 | 3584 → 3584 |
| weather / summary | 0.328 | 0.943 | 2.87× (187.2%) | 2.81×–2.94× | 7.151 | 7.919 | 42208 → 288 |
| weather / conditional | 0.325 | 0.848 | 2.61× (160.7%) | 2.57×–2.65× | 5.798 | 6.261 | 42208 → 2576 |
| weather / full | 0.300 | 0.297 | 0.99× (-1.0%) | 0.97×–1.01× | 0.322 | 0.292 | 42208 → 42208 |

Allocations are a separate ASC_RTRACE=1 run, averaged over 32 operations; values include managed allocator block overhead/rounding. They are not RSS or throughput from the instrumented build. Branch eager disables access specialization; ordinary default enables it. The ordinary-lazy control uses lazy: all on the same branch.

Conditional weights are syntactic estimates, not profiles. The full-read control intentionally includes the cost of materializing everything. Effectful reference selections use the non-speculative reader.

95% intervals are paired bootstrap intervals (10,000 deterministic resamples), conditional on this host/run. They do not remove systematic effects from power policy or concurrent load.

## Compiler cost and chunk-size experiment

On the same shared ARM64 host, four alternating whole-compiler `-O3` pairs for
the GitHub/SWAR model took approximately 7.2 seconds with ordinary
specialization disabled and 19.0 seconds enabled. This includes compilation
and optimization, not just the transform. Two `-O0` pairs took approximately
0.7 and 0.9 seconds respectively. These small samples identify a substantial
build-time cost; they are not isolated compiler benchmarks.

An experimental 8-field chunk size reduced the specialized `-O3` compilation
to approximately 13.8 seconds in two pairs. However, a separate eight-pair
head-to-head SIMD run found that the smaller chunks reduced GitHub summary
throughput by 9.5% and conditional throughput by 10.9%, with full-read
throughput essentially unchanged. The experiment was therefore reverted. The
retained 32-field layout matches all six SWAR/SIMD benchmark binaries in this
report byte for byte. [Raw compile samples and paired chunk comparison](data/access-specialization-compile-tradeoffs.json.gz).
