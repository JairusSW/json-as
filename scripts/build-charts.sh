#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p ./build/charts
bun ./scripts/build-chart01.ts
bun ./scripts/build-chart02.ts
bun ./scripts/build-chart03.ts
bun ./scripts/build-chart04.ts
bun ./scripts/build-chart05.ts
bun ./scripts/build-chart06.ts
