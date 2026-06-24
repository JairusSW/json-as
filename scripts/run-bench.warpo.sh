#!/bin/bash
# Compiler comparison: json-as deserialization throughput when the SAME source is
# compiled with asc (the stock AssemblyScript compiler) vs warpo
# (wasm-ecosystem/warpo, a "next-gen AssemblyScript compiler"), each before and
# after a wasm-opt -O4 pass, all run on one runtime (v8) so the only variable is
# the compiler/optimizer.
#
# warpo can't run asc transform plugins and its stdlib lacks asc's ambient
# console/performance, so scripts/gen-warpo-bench.mjs emits a self-contained
# harness (lifted @json schema + embedded payload + explicit env now/log imports
# + its own framed, timer-latency-corrected timing). asc compiles it through the
# json-as transform and (via JSON_WRITE) drops the post-transform .tmp.ts that
# warpo then compiles.
#
# Output: build/logs/warpo/<variant>/<payload>.<kind>.json for variant in
#   {asc, asc-opt, warpo, warpo-opt, warpo-radical, warpo-radical-opt}
#   and kind in {deserialize, serialize}. asc is incremental-GC only; the warpo
#   variants cover its incremental and radical (stop-the-world) GCs.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

JS_REPS="${JS_REPS:-3}"
GEN_DIR="assembly/__benches__/runtimes"
WASM_DIR="build/warpo"
LOG_DIR="build/logs/warpo"
RUNNER="bench/runners/warpo-run.mjs"
mkdir -p "$GEN_DIR" "$WASM_DIR" "$LOG_DIR"

# wasm-opt max-performance pass (mirrors run-bench.as.sh), applied equally to both
# compilers' output. NAIVE here is JSONMode 2 (SWAR=0, SIMD=1, NAIVE=2).
OPT_FLAGS=(-O4 -tnh -iit -ifwl -s 0 --enable-bulk-memory --enable-nontrapping-float-to-int
  --enable-sign-ext --enable-mutable-globals)

# payload | RootType | checksumExpr
PAYLOADS=(
  "twitter|Twitter|parsed.statuses.length"
  "citm_catalog|Citm|parsed.performances.length"
  "canada|Canada|parsed.features.length"
)

has() { command -v "$1" >/dev/null 2>&1; }
if ! has v8; then echo "v8 not found (jsvu) - required to run the benches"; exit 1; fi
if ! has wasm-opt; then echo "wasm-opt not found"; exit 1; fi

# Locate the native warpo_asc (the `npx warpo build` wrapper fails silently here;
# `warpo download` fetches the prebuilt archive that contains this binary).
if [[ -z "${WARPO_ASC:-}" ]]; then
  npx warpo download >/dev/null 2>&1 || true
  WARPO_ASC="$(find node_modules/warpo -name warpo_asc -type f 2>/dev/null | head -1)"
fi
if [[ -z "$WARPO_ASC" || ! -x "$WARPO_ASC" ]]; then
  echo "warpo_asc binary not found (run: npx warpo download)"; exit 1
fi

# Run a wasm on v8 JS_REPS times; for each kind (deserialize, serialize) keep the
# best (highest mbps) result line and write it to
# build/logs/warpo/<variant>/<payload>.<kind>.json.
run_variant() {
  local variant="$1" payload="$2" wasm="$3"
  mkdir -p "$LOG_DIR/$variant"
  local best_de=0 best_se=0 line_de="" line_se="" out l m
  for ((i = 0; i < JS_REPS; i++)); do
    out="$(v8 --module "$RUNNER" -- "$wasm" 2>/dev/null)"
    l="$(printf '%s' "$out" | grep '"kind":"deserialize"' | head -1)"
    m="$(printf '%s' "$l" | grep -oE '"mbps":[0-9.]+' | cut -d: -f2)"
    if [[ -n "$m" ]] && (( $(echo "${m:-0} > $best_de" | bc -l) )); then best_de="$m"; line_de="$l"; fi
    l="$(printf '%s' "$out" | grep '"kind":"serialize"' | head -1)"
    m="$(printf '%s' "$l" | grep -oE '"mbps":[0-9.]+' | cut -d: -f2)"
    if [[ -n "$m" ]] && (( $(echo "${m:-0} > $best_se" | bc -l) )); then best_se="$m"; line_se="$l"; fi
  done
  [[ -n "$line_de" ]] && printf '%s' "$line_de" >"$LOG_DIR/$variant/$payload.deserialize.json"
  [[ -n "$line_se" ]] && printf '%s' "$line_se" >"$LOG_DIR/$variant/$payload.serialize.json"
  printf "    %-10s de=%-7.0f se=%-7.0f MB/s\n" "$variant" "$best_de" "$best_se"
}

for entry in "${PAYLOADS[@]}"; do
  IFS='|' read -r name root chk <<<"$entry"
  src="$GEN_DIR/$name.warpo.src.ts"
  tmp="${src%.ts}.tmp.ts"
  echo "==> $name"

  node scripts/gen-warpo-bench.mjs "$name" "$root" "$chk" "$src" >/dev/null

  # asc: compile through the json-as transform; JSON_WRITE drops the post-transform
  # .tmp.ts that warpo consumes.
  JSON_WRITE="$src" JSON_MODE=NAIVE npx asc "$src" --transform ./transform -o "$WASM_DIR/$name.asc.wasm" \
    -O3 --runtime incremental --exportRuntime --enable bulk-memory

  # warpo: compile the post-transform .tmp.ts (no transform). bulk-memory must
  # stay enabled - warpo's optimizer asserts on memory.fill otherwise. asc only
  # has the incremental GC, so it's the asc baseline; warpo is built twice - with
  # its incremental GC (apples-to-apples with asc) and with its `radical` GC (a
  # stop-the-world collector with no per-allocation write-barrier overhead, which
  # tends to win on this allocation-heavy fresh-parse workload).
  "$WARPO_ASC" "$tmp" -o "$WASM_DIR/$name.warpo.wasm" \
    --optimizeLevel 3 --runtime incremental --exportRuntime --host none --use JSON_MODE=2
  "$WARPO_ASC" "$tmp" -o "$WASM_DIR/$name.warpo-radical.wasm" \
    --optimizeLevel 3 --runtime radical --exportRuntime --host none --use JSON_MODE=2

  # wasm-opt -O4 each.
  wasm-opt "${OPT_FLAGS[@]}" "$WASM_DIR/$name.asc.wasm" -o "$WASM_DIR/$name.asc-opt.wasm"
  wasm-opt "${OPT_FLAGS[@]}" "$WASM_DIR/$name.warpo.wasm" -o "$WASM_DIR/$name.warpo-opt.wasm"
  wasm-opt "${OPT_FLAGS[@]}" "$WASM_DIR/$name.warpo-radical.wasm" -o "$WASM_DIR/$name.warpo-radical-opt.wasm"

  run_variant asc               "$name" "$WASM_DIR/$name.asc.wasm"
  run_variant asc-opt           "$name" "$WASM_DIR/$name.asc-opt.wasm"
  run_variant warpo             "$name" "$WASM_DIR/$name.warpo.wasm"
  run_variant warpo-opt         "$name" "$WASM_DIR/$name.warpo-opt.wasm"
  run_variant warpo-radical     "$name" "$WASM_DIR/$name.warpo-radical.wasm"
  run_variant warpo-radical-opt "$name" "$WASM_DIR/$name.warpo-radical-opt.wasm"
done

echo "Finished compiler comparison -> $LOG_DIR/<variant>/<payload>.<kind>.json"
