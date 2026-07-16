#!/bin/bash
# Cross-runtime deserialization/serialization benchmark for json-as on the
# "classic" payloads. Unlike run-bench.as.sh (which compares NAIVE/SWAR/SIMD
# inside v8/wavm), this compares how fast the SAME json-as workload runs across
# different WebAssembly runtimes:
#
#   WAGO · wasmtime · wavm · wazero · v8 · bun
#
# Every runtime runs the REAL classic bench (assembly/__benches__/classic/<name>.
# bench.ts) through the actual bench() lib - it reads the payload, warms up,
# times the loop, and reports MB/s itself. We only collect those results; we do
# not time anything externally. Three builds cover the runtimes' differing host
# ABIs, all in NAIVE mode with the same feature set (no SIMD / bulk-memory /
# non-trapping float-to-int) so the executed code is equivalent:
#
#   * WASI build  -> wasmtime / wavm / wazero  (payload read via WASI; results to
#                    stdout as __AS_BENCH_JSON__ lines)
#   * env  build  -> v8 / bun                  (env-ABI host bench/runners/
#                    runtimes-env.mjs supplies readFile/performance.now/...)
#   * WAGO build -> wago_host                  (payload embedded; the small Go
#                   host supplies timing/logging/result imports; see
#                   scripts/gen-wago-bench.mjs)
#
# The WAGO host uses WAGO's public Go API and its guard-page bounds mode. Point
# WAGO_SRC at a wago-org/wago checkout; the script builds the host against that
# checkout automatically.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WASI_SHIM_CONFIG="./node_modules/@assemblyscript/wasi-shim/asconfig.json"
GEN_DIR="assembly/__benches__/runtimes"
WASM_DIR="build/runtimes"
LOG_DIR="build/logs/runtimes"
ENV_RUNNER="bench/runners/runtimes-env.mjs"
mkdir -p "$GEN_DIR" "$WASM_DIR" "$LOG_DIR"

# Common asc flags: NAIVE with a portable feature subset, so all runtimes
# execute equivalent code. Split allocation-heavy runs into equal, GC-separated
# frames to keep long classic loops within a stable memory envelope everywhere.
BENCH_FRAMES="${BENCH_FRAMES:-40}"
COMMON_FLAGS=(-O3 --noAssert --uncheckedBehavior always --runtime incremental
  --disable nontrapping-f2i --disable bulk-memory --use "BENCH_FRAMES=$BENCH_FRAMES")

PAYLOADS=("twitter" "citm_catalog" "canada")

has() { command -v "$1" >/dev/null 2>&1; }

# --- locate / build the WAGO host -----------------------------------------
WAGO_SRC="${WAGO_SRC:-}"
WAGO_HOST="${WAGO_HOST:-}"
if [[ -z "$WAGO_SRC" ]]; then
  for cand in "$HOME/Code/Wago/wago" "$HOME/wago" "/tmp/wago"; do
    [[ -f "$cand/go.mod" ]] && WAGO_SRC="$cand" && break
  done
fi
build_wago_host() {
  [[ -n "$WAGO_HOST" && -x "$WAGO_HOST" ]] && return 0
  [[ -z "$WAGO_SRC" || ! -f "$WAGO_SRC/go.mod" ]] && return 1
  has go || { echo "    (Go not found; cannot build the WAGO host)"; return 1; }
  WAGO_HOST="$WASM_DIR/wago_host"
  echo "==> building wago_host (WAGO_SRC=$WAGO_SRC)"
  (cd "$WAGO_SRC" && go build -mod=readonly -tags wago_guardpage \
    -o "$WAGO_HOST" "$ROOT_DIR/bench/runners/wago_host.go")
}

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
  echo "    $runtime: $count result(s)"
}

build_wago_host || echo "    (WAGO skipped - set WAGO_SRC to a wago-org/wago checkout)"

for name in "${PAYLOADS[@]}"; do
  classic="assembly/__benches__/classic/$name.bench.ts"
  echo "==> $name"

  # --- WASI build: wasmtime / wavm / wazero -------------------------------
  if has wasmtime || has wavm || has wazero; then
    wasi_wasm="$WASM_DIR/$name.wasi.wasm"
    JSON_MODE=NAIVE npx asc "$classic" --transform ./transform -o "$wasi_wasm" \
      "${COMMON_FLAGS[@]}" --use AS_BENCH_RUNTIME_WAVM=1 --config "$WASI_SHIM_CONFIG" --enable sign-extension
    has wasmtime && wasmtime run --dir . "$wasi_wasm" 2>/dev/null | capture wasmtime
    has wavm && wavm run --mount-root "$ROOT_DIR" --abi=wasi --enable sign-extension "$wasi_wasm" 2>/dev/null | capture wavm
    has wazero && wazero run -mount ".:/" "$wasi_wasm" 2>/dev/null | capture wazero
  fi

  # --- env build: v8 / bun -----------------------------------------------
  if has v8 || has bun; then
    env_wasm="$WASM_DIR/$name.env.wasm"
    JSON_MODE=NAIVE npx asc "$classic" --transform ./transform -o "$env_wasm" \
      "${COMMON_FLAGS[@]}" --exportStart start --exportRuntime
    has v8 && v8 --module "$ENV_RUNNER" -- "$env_wasm" 2>/dev/null | capture v8
    has bun && bun "$ENV_RUNNER" "$env_wasm" 2>/dev/null | capture bun
  fi

  # --- WAGO build: embedded payload + small Go host -----------------------
  if [[ -n "$WAGO_HOST" && -x "$WAGO_HOST" ]]; then
    wago_src="$GEN_DIR/$name.wago.ts"
    wago_wasm="$WASM_DIR/$name.wago.wasm"
    node scripts/gen-wago-bench.mjs "$name" "$wago_src" >/dev/null
    JSON_MODE=NAIVE npx asc "$wago_src" --transform ./transform -o "$wago_wasm" \
      "${COMMON_FLAGS[@]}" --exportStart start
    "$WAGO_HOST" "$wago_wasm" | capture wago
  fi
done

echo "Finished cross-runtime benchmarks -> $LOG_DIR/<runtime>/<suite>.<type>.json"
