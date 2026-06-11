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
