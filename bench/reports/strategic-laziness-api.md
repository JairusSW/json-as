# Strategic laziness: captured API reads

Measured production sources: main `70a04480`; strategic branch `5ae2306b`.

Apple M4 MAX, arm64, Node v26.4.0, v8 14.6.202.34-node.21, AssemblyScript 0.28.20. Incremental runtime, -O3, compatibility mode (strict off), fast path on, diagnostics on.

Eight paired fresh-process groups per row and backend. Each process warms for at least 100 ms, then measures three batches; its median feeds the paired geometric means below. All raw batches are retained. GB/s uses captured UTF-8 payload bytes; input is already a pinned UTF-16 string. Timing includes JSON.parse plus the listed field reads, allocation and normal automatic collection. It excludes network, UTF-8 decoding, module startup and serialization.

The host was on battery with background activity. These are shared-host measurements, not an isolated or normal-power qualification. Full power/process audits are included in the capture.

## Inputs and reads

- **github**, 7,624 bytes. Summary: id, full_name, stargazers_count, open_issues_count, archived, default_branch. Conditional: the same summary plus description, homepage, license, topics on 1/8 of records. Full: every modeled field and array element.
  Source: https://api.github.com/repos/AssemblyScript/assemblyscript
- **twitter**, 2,548 bytes. Summary: id_str, text, retweet_count, favorite_count. Conditional: the same summary plus user.name, user.screen_name, user.followers_count, entities.user_mentions on 1/8 of records. Full: every modeled field and array element.
  Source: assembly/__benches__/payloads/twitter.min.json: statuses[0] (integer-preserving extraction)
- **weather**, 8,395 bytes. Summary: latitude, longitude, timezone, current.temperature_2m, current.wind_speed_10m. Conditional: the same summary plus daily.temperature_2m_max, daily.temperature_2m_min, daily.sunrise on 1/8 of records. Full: every modeled field and array element.
  Source: https://api.open-meteo.com/v1/forecast?latitude=35.68&longitude=139.69&current=temperature_2m,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum&timezone=UTC&forecast_days=7

Models cover every field in each fixed capture. Integer tokens use i64; decimal/exponent tokens and mixed numeric arrays use f64. Null-only fields are nullable strings and empty arrays use string elements for this capture. Neither JSON.Raw nor dynamic-object shortcuts are used. Exact full snapshots and independent integer-preserving Python checksums passed before timing.

## SWAR

| API / read | Main eager GB/s | Branch eager GB/s | Ordinary lazy GB/s | Strategic GB/s | Strategic vs main | 95% speedup interval | Allocated bytes/op, main → strategic |
|---|---:|---:|---:|---:|---:|---:|---:|
| github / summary | 2.214 | 2.178 | 0.987 | 0.996 | 0.45× (-55.0%) | 0.442×–0.458× | 12928 → 2304 |
| github / conditional | 2.201 | 2.183 | 0.983 | 0.972 | 0.44× (-55.8%) | 0.435×–0.449× | 12928 → 2426 |
| github / full | 1.867 | 1.853 | 0.501 | 0.547 | 0.29× (-70.7%) | 0.289×–0.298× | 12928 → 15168 |
| twitter / summary | 1.318 | 1.265 | 0.954 | 0.944 | 0.72× (-28.4%) | 0.695×–0.730× | 3649 → 2128 |
| twitter / conditional | 1.314 | 1.268 | 0.814 | 0.813 | 0.62× (-38.1%) | 0.613×–0.623× | 3584 → 2382 |
| twitter / full | 1.155 | 1.099 | 0.304 | 0.305 | 0.26× (-73.6%) | 0.260×–0.268× | 3584 → 6656 |
| weather / summary | 0.341 | 0.342 | 1.358 | 1.344 | 3.95× (294.6%) | 3.900×–3.992× | 42208 → 3216 |
| weather / conditional | 0.338 | 0.340 | 1.283 | 1.295 | 3.83× (283.1%) | 3.787×–3.877× | 42208 → 3466 |
| weather / full | 0.305 | 0.300 | 0.275 | 0.272 | 0.89× (-10.9%) | 0.880×–0.900× | 42208 → 40496 |

## SIMD

| API / read | Main eager GB/s | Branch eager GB/s | Ordinary lazy GB/s | Strategic GB/s | Strategic vs main | 95% speedup interval | Allocated bytes/op, main → strategic |
|---|---:|---:|---:|---:|---:|---:|---:|
| github / summary | 2.598 | 2.583 | 1.006 | 1.016 | 0.39× (-60.9%) | 0.388×–0.395× | 12928 → 2304 |
| github / conditional | 2.632 | 2.607 | 0.989 | 1.000 | 0.38× (-62.0%) | 0.373×–0.386× | 12928 → 2426 |
| github / full | 2.172 | 2.128 | 0.523 | 0.552 | 0.25× (-74.6%) | 0.248×–0.259× | 12928 → 15168 |
| twitter / summary | 1.441 | 1.427 | 0.965 | 0.961 | 0.67× (-33.3%) | 0.656×–0.677× | 3649 → 2128 |
| twitter / conditional | 1.436 | 1.392 | 0.810 | 0.816 | 0.57× (-43.2%) | 0.561×–0.576× | 3584 → 2382 |
| twitter / full | 1.232 | 1.224 | 0.314 | 0.313 | 0.25× (-74.6%) | 0.252×–0.256× | 3584 → 6656 |
| weather / summary | 0.340 | 0.339 | 1.349 | 1.347 | 3.97× (296.8%) | 3.940×–3.995× | 42208 → 3216 |
| weather / conditional | 0.340 | 0.339 | 1.298 | 1.291 | 3.80× (280.1%) | 3.759×–3.844× | 42208 → 3466 |
| weather / full | 0.305 | 0.304 | 0.261 | 0.263 | 0.86× (-13.7%) | 0.856×–0.870× | 42208 → 40496 |

Allocations are a separate ASC_RTRACE=1 run, averaged over 32 operations; values include managed allocator block overhead/rounding. They are not RSS or throughput from the instrumented build. The ordinary-lazy control uses lazy: all on the same branch. The branch-eager control checks the default path against main.

Conditional weights are syntactic estimates, not profiles. The full-read control intentionally includes the cost of materializing everything. Nested child classes are still independently lazy; this implementation does not propagate parse-site plans through the whole object graph, and effectful reference selections use the non-speculative reader.

95% intervals are paired bootstrap intervals (10,000 deterministic resamples), conditional on this host/run. They do not remove systematic effects from battery policy or concurrent load.

## Interpretation

- On SIMD, forecast summary/conditional reads improve by 3.97×/3.80× over main eager parsing, with roughly 92% fewer allocated bytes for summaries.
- GitHub and tweet summaries are slower than main eager parsing (0.39× and 0.67× throughput). Reading every field reduces throughput to about 0.25× on those two responses. These losses are retained in the tables.
- Strategic specialization is approximately level with ordinary lazy parsing in these API cases; the measured benefit is mainly deferring unused data, not a large incremental gain from the access planner.
- The generated root models report fast-reader capability disabled for both lazy variants in all three captures. The transform's initializer-effect check sees the generated implicit lazy-default factory calls and blocks fast-reader generation. Thus these results exercise specialized slow readers, despite `JSON_USE_FAST_PATH=1`. This is a concrete follow-up before promoting the feature as a general parsing-speed improvement.
- The branch-eager default-path control also measures 3–5% lower throughput on the SWAR tweet cases, and about 3% lower on the SIMD tweet conditional case. The captured controls and intervals are retained; this run does not establish the cause of these smaller differences.

## Evidence and reproduction

The [compressed capture](data/strategic-laziness-api.json.gz) contains the exact payload text, all 576 fresh-process samples (1,728 timed batches), checksums, compiler flags, source/binary SHA-256 seals, allocation measurements, selected-field decision logs, and power/process audits. The measurement source revision is `5ae2306b`; the follow-up commit adds only the harness and this report.

```sh
git worktree add --detach build/strategic-api-main 70a04480
ln -s "$PWD/node_modules" build/strategic-api-main/node_modules
node scripts/bench-strategic-laziness.mjs --prepare \
  --dir=build/strategic-api-replay --main=build/strategic-api-main \
  --capture=bench/reports/data/strategic-laziness-api.json.gz
python3 ~/benchmark-lock.py --wait --owner "json-as: strategic API replay" \
  --planned-minutes 10 -- node scripts/bench-strategic-laziness.mjs \
  --measure --dir=build/strategic-api-replay --pairs=8
node scripts/bench-strategic-laziness.mjs --report --dir=build/strategic-api-replay
```

Preparation and allocation checks are untimed. The shared lock is required for measurements on this host. `--fetch` can obtain new responses instead; new live captures will differ from these pinned inputs.

The Twitter payload is an integer-preserving extraction from the existing nativejson-benchmark corpus; its [upstream MIT notice](data/nativejson-LICENSE.txt) is retained alongside the capture. Weather data attribution: [Open-Meteo](https://open-meteo.com/). GitHub data is public REST metadata from the AssemblyScript repository. Captured data retains its upstream terms.
