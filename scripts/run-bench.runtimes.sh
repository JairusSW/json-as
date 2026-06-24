#!/bin/bash
# Cross-runtime deserialization/serialization benchmark for json-as on the
# "classic" payloads. Unlike run-bench.as.sh (which compares NAIVE/SWAR/SIMD
# inside v8/wavm), this compares how fast the SAME json-as workload runs across
# different WebAssembly runtimes:
#
#   WARP (wasm-ecosystem/wasm-compiler) · wasmtime · wavm · wazero · v8 · bun
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
#   * WARP build  -> warp_host                 (WARP has no WASI and can't
#                    re-enter the module from a host import, so its payload is
#                    embedded and its iteration count capped; see
#                    scripts/gen-warp-bench.mjs. Still measured by the real
#                    bench() via warp_host's performance.now.)
#
# WARP is a C++ library with no standalone runner, so it's compiled from source.
# Point WARP_SRC at a wasm-ecosystem/wasm-compiler checkout that has a build dir
# with the static libs (see docs/setup/Build.md). Configure that build with:
#   cmake -G Ninja -DCMAKE_BUILD_TYPE=Release -DVB_ENABLE_DEV_FEATURE=OFF \
#     -DENABLE_BENCH=1 -DCMAKE_CXX_FLAGS="-DINTERRUPTION_REQUEST=0 -DEAGER_ALLOCATION=1" ..
#   ninja vb_libWasmModule
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WASI_SHIM_CONFIG="./node_modules/@assemblyscript/wasi-shim/asconfig.json"
GEN_DIR="assembly/__benches__/runtimes"
WASM_DIR="build/runtimes"
LOG_DIR="build/logs/runtimes"
ENV_RUNNER="bench/runners/runtimes-env.mjs"
mkdir -p "$GEN_DIR" "$WASM_DIR" "$LOG_DIR"

# Common asc flags: NAIVE, WARP-compatible feature subset, so all runtimes
# execute equivalent code. BENCH_FRAMES splits each timed run into that many
# small frames with a full (untimed) GC between them - applied to EVERY runtime
# so the measurement is identical, and required for WARP, which destabilizes
# under one long single-shot allocation loop. With the classic benches' counts
# (<=4000 ops) this keeps every frame at <=100 iterations, well inside WARP's
# stable envelope.
BENCH_FRAMES="${BENCH_FRAMES:-40}"
COMMON_FLAGS=(-O3 --noAssert --uncheckedBehavior always --runtime incremental
  --disable nontrapping-f2i --disable bulk-memory --use "BENCH_FRAMES=$BENCH_FRAMES")

PAYLOADS=("twitter" "citm_catalog" "canada")

has() { command -v "$1" >/dev/null 2>&1; }

# --- locate / build the WARP host -----------------------------------------
WARP_SRC="${WARP_SRC:-}"
WARP_HOST="${WARP_HOST:-}"
if [[ -z "$WARP_SRC" ]]; then
  for cand in "$ROOT_DIR/build/warp/wasm-compiler" "$HOME/wasm-compiler" "/tmp/warp-wc"; do
    [[ -d "$cand" ]] && WARP_SRC="$cand" && break
  done
fi
build_warp_host() {
  [[ -n "$WARP_HOST" && -x "$WARP_HOST" ]] && return 0
  [[ -z "$WARP_SRC" || ! -d "$WARP_SRC" ]] && return 1
  local build_dir libs
  local lib_dir
  lib_dir="$(find "$WARP_SRC" -name 'libvb_libWasmModule.a' -printf '%h\n' 2>/dev/null | head -1)"
  [[ -z "$lib_dir" ]] && { echo "    (WARP libs not found under $WARP_SRC - build them, see header)"; return 1; }
  # lib_dir is <build>/src/WasmModule; the build root is two levels up.
  build_dir="$(cd "$lib_dir/../.." && pwd)"
  WARP_HOST="$WASM_DIR/warp_host"
  echo "==> building warp_host (WARP_SRC=$WARP_SRC)"
  g++ -std=gnu++14 -O2 -DJIT_TARGET_X86_64 -DINTERRUPTION_REQUEST=0 -DEAGER_ALLOCATION=1 -I"$WARP_SRC" \
    bench/runners/warp_host.cpp -Wl,--start-group \
    "$build_dir"/src/WasmModule/libvb_libWasmModule.a "$build_dir"/src/core/compiler/libvb_libcompiler.a \
    "$build_dir"/src/core/runtime/libvb_libruntime.a "$build_dir"/src/utils/libvb_libutils.a \
    "$build_dir"/src/core/common/libvb_lib_core_common.a -Wl,--end-group -lpthread -o "$WARP_HOST"
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

build_warp_host || echo "    (WARP skipped - set WARP_SRC to a wasm-compiler checkout with built libs)"

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

  # --- WARP build: warp_host (embedded payload, capped iterations) --------
  if [[ -n "$WARP_HOST" && -x "$WARP_HOST" ]]; then
    warp_src="$GEN_DIR/$name.warp.ts"
    warp_wasm="$WASM_DIR/$name.warp.wasm"
    node scripts/gen-warp-bench.mjs "$name" "$warp_src" >/dev/null
    JSON_MODE=NAIVE npx asc "$warp_src" --transform ./transform -o "$warp_wasm" "${COMMON_FLAGS[@]}"
    "$WARP_HOST" "$warp_wasm" 2>/dev/null | capture warp
  fi
done

echo "Finished cross-runtime benchmarks -> $LOG_DIR/<runtime>/<suite>.<type>.json"
