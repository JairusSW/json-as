#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CHART_RUNTIME="v8"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --v8)
      CHART_RUNTIME="v8"
      shift
      ;;
    --wavm|--llvm)
      CHART_RUNTIME="wavm"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./scripts/build-charts.sh [--v8|--wavm]"
      exit 1
      ;;
  esac
done

mkdir -p ./build/charts
# json-as vs JavaScript, small synthetic payloads (overview).
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-overview-serialize.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-overview-deserialize.ts
# Typed-struct fixtures with every non-null scalar/string value changed from defaults.
# Render each chart in its own process: chart.js plugins retain module state
# between canvases and can otherwise drop the second chart's legend text.
JSON_CHART_RUNTIME="$CHART_RUNTIME" JSON_BENCH_KIND=serialize bun ./scripts/build-default-values.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" JSON_BENCH_KIND=deserialize bun ./scripts/build-default-values.ts
# String / object throughput vs payload size (full range + <=1MB zoom).
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-string-serialize.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-string-deserialize.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-object-serialize.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-object-deserialize.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-string-serialize-1mb.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-string-deserialize-1mb.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-object-serialize-1mb.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-object-deserialize-1mb.ts
# Primitive (de)serialize.
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-primitive-serialize.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-primitive-deserialize.ts
# Library comparison (json-as vs other JSON libraries).
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-library-serialize.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-library-deserialize.ts
# Lazy-fields charts (eager vs @json({ lazy: "auto" }))
bun ./scripts/build-lazy.ts
# Classic-dataset mode comparison (NAIVE/SWAR/SIMD + lazy, no JS baseline)
bun ./scripts/build-chart-classic.ts
# Cross-runtime comparison (WARP/wasmtime/wasmer/wavm/v8/bun). Opt-in: only built
# when scripts/run-bench.runtimes.sh has produced logs (it needs external
# runtimes + a WARP vb_bench build), so the default chart build never fails on it.
if compgen -G "./build/logs/runtimes/*/*.deserialize.json" >/dev/null 2>&1; then
  bun ./scripts/build-chart-runtimes.ts
fi
# asc-vs-warpo compiler comparison (opt-in: needs scripts/run-bench.warpo.sh logs).
if compgen -G "./build/logs/warpo/*/*.json" >/dev/null 2>&1; then
  bun ./scripts/build-chart-warpo.ts
fi
