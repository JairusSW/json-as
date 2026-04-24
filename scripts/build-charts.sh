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
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-chart01.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-chart02.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-chart03.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-chart04.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-chart05.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-chart06.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-chart07.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-chart08.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-chart09.ts
JSON_CHART_RUNTIME="$CHART_RUNTIME" bun ./scripts/build-chart10.ts
