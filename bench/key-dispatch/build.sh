#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
cd "$root"
baseline=${1:-ca2cb4747dd54923c23fe2b094c2f72523ca9eb2}
out=${2:-build/key-dispatch}
mkdir -p "$out"
# Keep the archived transform at the same depth as ./transform so its runtime
# imports resolve to this checkout's unchanged AssemblyScript implementation.
base_transform=$(mktemp -d "$root/.key-dispatch-baseline.XXXXXX")
trap 'rm -rf "$base_transform"' EXIT
git archive "$baseline:transform" | tar -x -C "$base_transform"
npm run build:transform
for width in ${JSON_KEY_WIDTHS:-1 4 8 16 32 64 128 256 512 1024 2048}; do
  node bench/key-dispatch/generate.mjs "$width"
  for variant in base candidate; do
    transform=./transform
    if [[ $variant == base ]]; then transform=$base_transform; fi
    JSON_AS_LIBRARY_SOURCE=assembly/index JSON_MODE=SWAR JSON_USE_FAST_PATH="${JSON_KEY_FAST:-0}" \
      node node_modules/assemblyscript/bin/asc.js bench/key-dispatch/fixture.tmp.ts \
      --transform "$transform" -O3 --runtime incremental --exportRuntime \
      -o "$out/$variant-$width.wasm"
  done
done
