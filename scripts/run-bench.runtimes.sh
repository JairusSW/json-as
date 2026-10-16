#!/bin/bash
# Cross-runtime deserialization/serialization benchmark for json-as on the
# "classic" payloads. Unlike run-bench.as.sh (which compares NAIVE/SWAR/SIMD
# inside v8/wavm), this compares how fast the SAME json-as workload runs across
# different WebAssembly runtimes:
#
#   Wago · wasmtime · wavm · wazero · v8 · bun
#
# Every runtime runs the REAL classic bench (assembly/__benches__/classic/<name>.
# bench.ts) through the actual bench() lib - it reads the payload, warms up,
# times the loop, and reports MB/s itself. We only collect those results; we do
# not time anything externally. Two builds cover the runtimes' differing host
# ABIs, all in NAIVE mode with the same feature set (no SIMD / bulk-memory /
# non-trapping float-to-int) so the executed code is equivalent:
#
#   * WASI build  -> wago / wasmtime / wavm / wazero  (payload read via WASI; results to
#                    stdout as __AS_BENCH_JSON__ lines)
#   * env  build  -> v8 / bun                  (env-ABI host bench/runners/
#                    runtimes-env.mjs supplies readFile/performance.now/...)
# Wago uses the same WASI build as wasmtime/wavm/wazero. Its small Go host
# links WASI Preview 1 with the project root preopened and emits bench results.
# Go builds the host from pinned dependencies in bench/runners/wago.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WASI_SHIM_CONFIG="./node_modules/@assemblyscript/wasi-shim/asconfig.json"
WASM_DIR="build/runtimes"
LOG_DIR="build/logs/runtimes"
ENV_RUNNER="bench/runners/runtimes-env.mjs"
mkdir -p "$WASM_DIR" "$LOG_DIR"

# Common NAIVE-mode feature set. Each timed run uses the same number of
# frames, with untimed full GC between frames on every runtime.
BENCH_FRAMES="${BENCH_FRAMES:-40}"
COMMON_FLAGS=(-O3 --noAssert --uncheckedBehavior always --runtime incremental
  --disable nontrapping-f2i --disable bulk-memory --use "BENCH_FRAMES=$BENCH_FRAMES")

PAYLOADS=("twitter" "citm_catalog" "canada")

has() { command -v "$1" >/dev/null 2>&1; }

# Build the Wago WASI host without changing local/global CLI plugins.
WAGO_HOST="$ROOT_DIR/$WASM_DIR/wago-run"
echo "==> building wago-run (pinned Wago + WASI dependencies)"
(cd bench/runners/wago && GOWORK=off go build -mod=readonly -o "$WAGO_HOST" .)

# Captures a runner's stdout: each __AS_BENCH_JSON__<path>\t<json> line is written
# to build/logs/runtimes/<runtime>/<suite>.<type>.json (suite/type come from the
# bench's own path; the .as.json/.wavm.json suffix is stripped).
capture() {
  local runtime="$1"
  mkdir -p "$LOG_DIR/$runtime"
  local count=0
  while IFS= read -r line; do
    [[ "$line" != __AS_BENCH_JSON__* ]] && continue
    local rest="${line#__AS_BENCH_JSON__}"
    local path="${rest%%$'\t'*}"
    local json="${rest#*$'\t'}"
    local base="${path##*/}"
    base="${base%.as.json}"
    base="${base%.wavm.json}"
    printf '%s' "$json" >"$LOG_DIR/$runtime/$base.json"
    count=$((count + 1))
  done
  if [[ "$count" != 3 ]]; then
    echo "Expected 3 results for $runtime, received $count" >&2
    return 1
  fi
  echo "    $runtime: $count result(s)"
}


for name in "${PAYLOADS[@]}"; do
  classic="assembly/__benches__/classic/$name.bench.ts"
  echo "==> $name"

  # --- WASI build: wago / wasmtime / wavm / wazero -------------------------------
  if [[ -x "$WAGO_HOST" ]] || has wasmtime || has wavm || has wazero; then
    wasi_wasm="$WASM_DIR/$name.wasi.wasm"
    JSON_AS_LIBRARY_SOURCE=assembly/index JSON_MODE=NAIVE npx asc "$classic" --transform ./transform -o "$wasi_wasm" \
      "${COMMON_FLAGS[@]}" --use AS_BENCH_RUNTIME_WAVM=1 --config "$WASI_SHIM_CONFIG" --enable sign-extension
    "$WAGO_HOST" "$wasi_wasm" | capture wago
    has wasmtime && wasmtime run --dir . "$wasi_wasm" 2>/dev/null | capture wasmtime
    has wavm && wavm run --mount-root "$ROOT_DIR" --abi=wasi --enable sign-extension "$wasi_wasm" 2>/dev/null | capture wavm
    has wazero && wazero run -mount ".:/" "$wasi_wasm" 2>/dev/null | capture wazero
  fi

  # --- env build: v8 / bun -----------------------------------------------
  if has v8 || has bun; then
    env_wasm="$WASM_DIR/$name.env.wasm"
    JSON_AS_LIBRARY_SOURCE=assembly/index JSON_MODE=NAIVE npx asc "$classic" --transform ./transform -o "$env_wasm" \
      "${COMMON_FLAGS[@]}" --exportStart start --exportRuntime
    has v8 && v8 --module "$ENV_RUNNER" -- "$env_wasm" 2>/dev/null | capture v8
    has bun && bun "$ENV_RUNNER" "$env_wasm" 2>/dev/null | capture bun
  fi

done

echo "Finished cross-runtime benchmarks -> $LOG_DIR/<runtime>/<suite>.<type>.json"
