# Strategic laziness: captured API reads

Measured production sources: main `70a04480`; strategic branch `6f1d7d43`.

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
| github / summary | 2.207 | 2.179 | 3.008 | 3.033 | 1.37× (37.4%) | 1.36×–1.39× | 12928 → 1408 |
| github / conditional | 2.190 | 2.172 | 2.878 | 2.898 | 1.32× (32.3%) | 1.31×–1.34× | 12928 → 1530 |
| github / full | 1.863 | 1.849 | 0.934 | 0.632 | 0.34× (-66.1%) | 0.34×–0.34× | 12928 → 15168 |
| twitter / summary | 1.284 | 1.259 | 2.163 | 2.193 | 1.71× (70.8%) | 1.66×–1.77× | 3649 → 752 |
| twitter / conditional | 1.298 | 1.254 | 1.933 | 1.984 | 1.53× (52.8%) | 1.52×–1.54× | 3584 → 988 |
| twitter / full | 1.141 | 1.114 | 0.585 | 0.425 | 0.37× (-62.7%) | 0.37×–0.38× | 3584 → 6512 |
| weather / summary | 0.334 | 0.337 | 2.767 | 1.369 | 4.10× (310.1%) | 4.04×–4.19× | 42208 → 3216 |
| weather / conditional | 0.336 | 0.338 | 2.560 | 1.347 | 4.00× (300.4%) | 3.94×–4.08× | 42208 → 3466 |
| weather / full | 0.299 | 0.300 | 0.344 | 0.300 | 1.00× (0.3%) | 0.99×–1.02× | 42208 → 40496 |

## SIMD

| API / read | Main eager GB/s | Branch eager GB/s | Ordinary lazy GB/s | Strategic GB/s | Strategic vs main | 95% speedup interval | Allocated bytes/op, main → strategic |
|---|---:|---:|---:|---:|---:|---:|---:|
| github / summary | 2.605 | 2.597 | 5.009 | 5.104 | 1.96× (96.0%) | 1.93×–1.99× | 12928 → 1408 |
| github / conditional | 2.539 | 2.537 | 4.649 | 4.853 | 1.91× (91.1%) | 1.88×–1.94× | 12928 → 1530 |
| github / full | 2.102 | 2.067 | 1.156 | 0.643 | 0.31× (-69.4%) | 0.30×–0.31× | 12928 → 15168 |
| twitter / summary | 1.400 | 1.412 | 3.378 | 3.783 | 2.70× (170.2%) | 2.65×–2.76× | 3649 → 752 |
| twitter / conditional | 1.400 | 1.369 | 2.851 | 3.099 | 2.21× (121.4%) | 2.17×–2.26× | 3584 → 988 |
| twitter / full | 1.207 | 1.199 | 0.668 | 0.432 | 0.36× (-64.2%) | 0.35×–0.37× | 3584 → 6512 |
| weather / summary | 0.333 | 0.332 | 7.169 | 1.383 | 4.15× (315.2%) | 4.08×–4.23× | 42208 → 3216 |
| weather / conditional | 0.330 | 0.323 | 6.144 | 1.305 | 3.96× (295.8%) | 3.86×–4.06× | 42208 → 3466 |
| weather / full | 0.298 | 0.299 | 0.380 | 0.301 | 1.01× (1.1%) | 0.99×–1.03× | 42208 → 40496 |

Allocations are a separate ASC_RTRACE=1 run, averaged over 32 operations; values include managed allocator block overhead/rounding. They are not RSS or throughput from the instrumented build. The ordinary-lazy control uses lazy: all on the same branch. The branch-eager control checks the default path against main.

Conditional weights are syntactic estimates, not profiles. The full-read control intentionally includes the cost of materializing everything. Nested child classes are still independently lazy; this implementation does not propagate parse-site plans through the whole object graph, and effectful reference selections use the non-speculative reader.

95% intervals are paired bootstrap intervals (10,000 deterministic resamples), conditional on this host/run. They do not remove systematic effects from battery policy or concurrent load.

## Interpretation and fix

The first run incorrectly classified generated lazy backing-field defaults as application effects, disabling the root fast reader. The transform now checks each original field initializer and resolved implicit default. Pure native defaults retain fast-reader generation; application constructors, unknown generic bindings and custom initialization hooks remain conservative. This adds no runtime purity checks.

- SWAR summary speedups over main eager: github 1.37×, twitter 1.71×, weather 4.10×.
- SIMD summary speedups over main eager: github 1.96×, twitter 2.70×, weather 4.15×.

All six selective summary/conditional workloads beat eager parsing in both measured backends. Full-record consumption remains a separate tradeoff: GitHub/tweet full reads are still slower, while the forecast full-read case is around parity. The complete table retains those losses and the branch-eager/ordinary-lazy controls. This is an opt-in optimization for selective reads, not a universal replacement for eager parsing.

Restoring fast readers also accelerates ordinary lazy parsing. On SIMD, ordinary lazy versus strategic summary throughput is 5.009 versus 5.104 GB/s for GitHub, 3.378 versus 3.783 GB/s for tweets, and 7.169 versus 1.383 GB/s for forecasts. The forecast strategy still loses to ordinary lazy because eagerly selecting its nested `current` model forces the non-speculative reader. Proving pure nested materialization is a remaining optimization.

All root model schemas now report fast-reader capability enabled. Plans that select potentially effectful reference materialization still use a non-speculative reader, and child plans are not propagated through the entire object graph. Remaining full-read losses need further work.

The [initial report](strategic-laziness-api-initial.md) and its raw capture are retained. These are separate paired cohorts; the main-versus-strategic ratios within each run are the qualified comparisons.

## Evidence and reproduction

The [compressed capture](data/strategic-laziness-api-fast-readers.json.gz) retains exact payloads, 576 fresh-process samples (1,728 timed batches), independent checksums, source/binary SHA-256 seals, allocation profiles, field decisions and power/process audits. Measurement source is `6f1d7d43`, compared with main `70a04480` on the same installed toolchain. Source files were archived and hash-verified before the subsequent initialization-hook guard.

The follow-up guard in `a37c8d77` preserves custom initialization hooks. Recompiling all 18 branch API binaries produces exactly the same bytes as the measurement candidate; the [hash comparison](data/strategic-laziness-api-bytecode-equivalence.json) records each result. The final guard passes 1,092 strategic runtime checks across all three backends, runtimes, strictness and fast settings, plus opt-in controls. Typecheck, lint and license checks pass; the quick capability suite passes 80 checks.

```sh
git worktree add --detach build/strategic-api-main 70a04480
ln -s "$PWD/node_modules" build/strategic-api-main/node_modules
node scripts/bench-strategic-laziness.mjs --prepare \
  --dir=build/strategic-api-replay --main=build/strategic-api-main \
  --capture=bench/reports/data/strategic-laziness-api-fast-readers.json.gz
python3 ~/benchmark-lock.py --wait --owner "json-as: strategic API replay" \
  --planned-minutes 10 -- node scripts/bench-strategic-laziness.mjs \
  --measure --dir=build/strategic-api-replay --pairs=8
node scripts/bench-strategic-laziness.mjs --report --dir=build/strategic-api-replay
```

Preparation, allocation and bytecode-equivalence checks are untimed. This host requires the shared timing lock for measurements. New live responses from `--fetch` are different captures.

Twitter data is an integer-preserving extraction from the existing nativejson-benchmark corpus; its [MIT notice](data/nativejson-LICENSE.txt) is retained. Weather data attribution: [Open-Meteo](https://open-meteo.com/). GitHub data is public AssemblyScript repository metadata. Captured data retains its upstream terms.
