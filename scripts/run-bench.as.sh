#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

uppercase() {
  printf '%s' "$1" | tr '[:lower:]' '[:upper:]'
}

lowercase() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

RUNTIMES=${RUNTIMES:-"incremental"}
ENGINES=${ENGINES:-"turbofan"}
MODE_FILTER=${JSON_MODE:-""}
TURBOFAN_FLAGS=${TURBOFAN_FLAGS:-"--no-liftoff"}
D8_BIN=${D8_BIN:-""}
WAVM_BIN=${WAVM_BIN:-"wavm"}
WAVM_RUN_FLAGS=${WAVM_RUN_FLAGS:-"--abi=wasi --enable simd --enable bulk-memory --enable sign-extension"}
# Deserialize-biased alternative to try manually:
# TURBOFAN_FLAGS="--no-liftoff --no-wasm-stack-checks --no-wasm-bounds-checks --no-wasm-tier-up --minor-ms --minor-ms-concurrent-marking-trigger=30 --turboshaft-wasm-load-elimination"
BENCH_NAME=""
ARGS=()
RUN_V8=0
RUN_WAVM=0
BENCH_MEMORY=0

read -r -a WAVM_RUN_FLAGS_ARR <<< "$WAVM_RUN_FLAGS"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      [[ $# -lt 2 ]] && { echo "Missing value for --mode"; exit 1; }
      MODE_FILTER="$(uppercase "$2")"
      shift 2
      ;;
    --v8)
      RUN_V8=1
      shift
      ;;
    --wavm|--llvm)
      RUN_WAVM=1
      shift
      ;;
    --memory)
      BENCH_MEMORY=1
      shift
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done

# Preserve the historical default: V8 only. Pass --wavm or --v8 --wavm explicitly for WAVM runs.
if [[ $RUN_V8 -eq 0 && $RUN_WAVM -eq 0 ]]; then
  RUN_V8=1
fi

if [[ $RUN_V8 -eq 1 ]]; then
  if [[ -z "$D8_BIN" ]]; then
    if command -v v8 >/dev/null 2>&1; then
      D8_BIN="v8"
    elif command -v d8 >/dev/null 2>&1; then
      D8_BIN="d8"
    else
      echo "❌ Neither v8 nor d8 was found in PATH"
      exit 1
    fi
  fi
fi

if [[ $RUN_WAVM -eq 1 ]]; then
  if ! command -v "$WAVM_BIN" >/dev/null 2>&1; then
    echo "❌ wavm not found in PATH (or WAVM_BIN is invalid)"
    exit 1
  fi
fi

if [[ ${#ARGS[@]} -gt 0 ]]; then
  BENCH_NAME="${ARGS[0]}"
fi

if [[ -n "$MODE_FILTER" ]]; then
  case "$MODE_FILTER" in
    NAIVE|SWAR|SIMD)
      ;;
    *)
      echo "Invalid mode '$MODE_FILTER'. Expected one of: naive, swar, simd"
      exit 1
      ;;
  esac
fi

EXTRA_ASC_FLAGS=()
if [[ $BENCH_MEMORY -eq 1 ]]; then
  EXTRA_ASC_FLAGS+=(
    --use BENCH_TRACK_MEMORY=1
    --use BENCH_PREALLOC_BYTES=0
    --transform as-heap-analyzer/transform/addHeapAnalyzerInfo.mjs
  )
  echo "note: --memory enabled - per-op timings include a memory.size() poll and prealloc is disabled. Rerun without --memory for canonical timings." >&2
  echo "note: --memory also emits a 'heap: {...}' delta JSON per bench. Run 'npx as-heap-analyzer frame <wasm-path>' and paste the JSON to resolve runtime IDs to class names." >&2
fi

mkdir -p ./build/logs/as/{swar,simd,naive}
mkdir -p ./build/logs/charts

FILES=()

if [[ -n "$BENCH_NAME" ]]; then
  RAW_BENCH_NAME="$BENCH_NAME"

  if [[ "$RAW_BENCH_NAME" == */ ]]; then
    # Directory form (`multilib/`, `custom/`, `throughput/`): run every bench in
    # that subdir.
    DIR_REL="${RAW_BENCH_NAME%/}"
    for f in ./assembly/__benches__/$DIR_REL/*.bench.ts; do
      [[ -f "$f" ]] && FILES+=("$f")
    done

    if [[ ${#FILES[@]} -eq 0 ]]; then
      echo "❌ No benchmarks found in '$RAW_BENCH_NAME'"
      exit 1
    fi
  else
  [[ "$BENCH_NAME" != *.bench.ts ]] && BENCH_NAME="$BENCH_NAME.bench.ts"

  CANDIDATES=(
    "./assembly/__benches__/$BENCH_NAME"
    "./assembly/__benches__/multilib/$BENCH_NAME"
    "./assembly/__benches__/throughput/$BENCH_NAME"
  )

  if [[ "$RAW_BENCH_NAME" == custom/* ]]; then
    CUSTOM_REL="${BENCH_NAME#custom/}"
    CANDIDATES+=( "./assembly/__benches__/custom/$CUSTOM_REL" )
  fi

  if [[ "$RAW_BENCH_NAME" == multilib/* ]]; then
    MULTILIB_REL="${BENCH_NAME#multilib/}"
    CANDIDATES+=( "./assembly/__benches__/multilib/$MULTILIB_REL" )
  fi

  # Dedup: `./assembly/__benches__/custom/foo.bench.ts` shows up in both the
  # base list (CANDIDATES[0] when arg is `custom/foo`) and the explicit
  # `custom/` branch above, so each mode would otherwise be built and timed
  # twice. macOS ships bash 3.2 (no associative arrays), so dedup linearly.
  for f in "${CANDIDATES[@]}"; do
    [[ -f "$f" ]] || continue
    already_added=0
    if [[ ${#FILES[@]} -gt 0 ]]; then
      for existing in "${FILES[@]}"; do
        if [[ "$existing" == "$f" ]]; then
          already_added=1
          break
        fi
      done
    fi
    [[ $already_added -eq 1 ]] && continue
    FILES+=("$f")
  done

  if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "❌ No benchmark found for '$RAW_BENCH_NAME'"
    exit 1
  fi
  fi
else
  # Default run: top-level benches only. Subfolders (custom/, multilib/,
  # throughput/) are opt-in - pass `multilib/` or `multilib/<name>` to run them.
  FILES=(
    ./assembly/__benches__/*.bench.ts
  )
fi

run_v8_module() {
  local engine="$1"
  local wasm_arg="$2"
  case "$engine" in
    ignition)
      "$D8_BIN" --no-opt --module ./bench/runners/assemblyscript.js -- "$wasm_arg"
      ;;
    liftoff)
      "$D8_BIN" --liftoff-only --no-opt --module ./bench/runners/assemblyscript.js -- "$wasm_arg"
      ;;
    sparkplug)
      "$D8_BIN" --sparkplug --always-sparkplug --no-opt --module ./bench/runners/assemblyscript.js -- "$wasm_arg"
      ;;
    turbofan)
      # shellcheck disable=SC2086
      "$D8_BIN" $TURBOFAN_FLAGS --module ./bench/runners/assemblyscript.js -- "$wasm_arg"
      ;;
    *)
      echo "❌ Unknown V8 engine '$engine'"
      return 1
      ;;
  esac
}

consume_bench_output() {
  local tmp="$1"

  while IFS= read -r line; do
    if [[ "$line" == __AS_BENCH_JSON__* ]]; then
      local payload file_name json
      payload="${line#__AS_BENCH_JSON__}"
      file_name="${payload%%$'\t'*}"
      json="${payload#*$'\t'}"
      mkdir -p "$(dirname "$file_name")"
      printf "%s" "$json" >"$file_name"
    else
      echo "$line"
    fi
  done <"$tmp"
}

run_wavm_module() {
  local wasm_arg="$1"
  local tmp
  tmp="$(mktemp)"

  # Mount the project root as the WASI root (fd 3) so file-reading benches
  # (canada/twitter/... via readFile) can open payloads by relative path.
  if ! "$WAVM_BIN" run --mount-root "$ROOT_DIR" "${WAVM_RUN_FLAGS_ARR[@]}" "./build/$wasm_arg" >"$tmp" 2>&1; then
    cat "$tmp"
    rm -f "$tmp"
    return 1
  fi

  consume_bench_output "$tmp"
  rm -f "$tmp"
}

optimize_or_fallback() {
  local in_wasm="$1"
  local out_wasm="$2"
  if command -v wasm-opt >/dev/null 2>&1; then
    shift 2
    wasm-opt "$@" "$in_wasm" -o "$out_wasm"
    rm -f "$in_wasm"
  else
    mv "$in_wasm" "$out_wasm"
  fi
}

build_v8_mode() {
  local file="$1"
  local output="$2"
  local write_target="$3"
  local runtime="$4"
  local mode="$5"
  local out_wasm="$6"

  # asc codegen flags. --converge re-runs asc's own optimizer until it reaches a
  # fixpoint (no further improvements), squeezing out the last bit of perf.
  local asc_flags=(-O3 --noAssert --uncheckedBehavior always --runtime "$runtime" --enable bulk-memory --exportStart start --exportRuntime)

  # wasm-opt max-performance set:
  #   -O4          flatten + the full -O3 pass pipeline
  #   --converge   keep re-running the pipeline until the module stops improving
  #                (the headline max-perf knob)
  #   -tnh / -iit  assume traps never happen / ignore implicit traps
  #   -ifwl        allow inlining functions that contain loops
  #   -s 0         shrink level 0 - optimize for speed, not size
  # Raising the inline-size caps (-fimfs/-aimfs/-ocimfs/-pii) was measured to
  # regress the ftoa micro-path (~10%) for no net win, so it is deliberately
  # left out - more inlining is not the same as faster.
  #
  # sign-ext + mutable-globals are on by default in asc's codegen (e.g.
  # i32.extend8_s, the exported mutable runtime globals), so wasm-opt must allow
  # them too or validation fails with "all used features should be allowed".
  local opt_flags=(-O4 -tnh -iit -ifwl -s 0 --enable-bulk-memory --enable-nontrapping-float-to-int --enable-tail-call --enable-sign-ext --enable-mutable-globals)

  if [[ "$mode" == "SIMD" ]]; then
    asc_flags+=(--enable simd)
    opt_flags+=(--enable-simd)
  fi

  JSON_CACHE=0 JSON_WRITE="$write_target" JSON_MODE="$mode" npx asc "$file" --transform ./transform -o "${output}.tmp" "${asc_flags[@]}" ${EXTRA_ASC_FLAGS[@]+"${EXTRA_ASC_FLAGS[@]}"} || return 1
  optimize_or_fallback "${output}.tmp" "$out_wasm" "${opt_flags[@]}"
}

build_wavm_mode() {
  local file="$1"
  local output="$2"
  local write_target="$3"
  local runtime="$4"
  local mode="$5"
  local out_wasm="$6"
  local features=(--enable bulk-memory --enable sign-extension)
  if [[ "$mode" == "SIMD" ]]; then
    features+=(--enable simd)
  fi

  JSON_CACHE=0 JSON_WRITE="$write_target" JSON_MODE="$mode" npx asc "$file" --transform ./transform -o "${output}.wavm.tmp" -O3 --converge --noAssert --uncheckedBehavior always --runtime "$runtime" --use AS_BENCH_RUNTIME_WAVM=1 --config ./node_modules/@assemblyscript/wasi-shim/asconfig.json "${features[@]}" --exportRuntime ${EXTRA_ASC_FLAGS[@]+"${EXTRA_ASC_FLAGS[@]}"} || return 1
  mv "${output}.wavm.tmp" "$out_wasm"
}

should_run_mode() {
  local mode="$1"
  local file_mode="$2"
  [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "$mode" ]] || return 1
  [[ -z "$file_mode" || "$file_mode" == "$mode" ]]
}

for file in "${FILES[@]}"; do
  filename="${file##*/}"
  filename_lower="$(lowercase "$filename")"
  file_mode=""
  if [[ "$filename_lower" == simd-* || "$filename_lower" == *-simd.bench.ts ]]; then
    file_mode="SIMD"
  elif [[ "$filename_lower" == swar-* || "$filename_lower" == *-swar.bench.ts ]]; then
    file_mode="SWAR"
  elif [[ "$filename_lower" == naive-* || "$filename_lower" == *-naive.bench.ts ]]; then
    file_mode="NAIVE"
  fi

  if [[ -n "$file_mode" && -n "$MODE_FILTER" && "$file_mode" != "$MODE_FILTER" ]]; then
    continue
  fi

  write_target="${file#./}"

  for runtime in $RUNTIMES; do
    output="./build/${filename%.ts}.${runtime}"

    for mode in NAIVE SWAR SIMD; do
      mode_lower="$(lowercase "$mode")"
      if ! should_run_mode "$mode" "$file_mode"; then
        continue
      fi

      if [[ $RUN_V8 -eq 1 ]]; then
        arg="${filename%.ts}.${runtime}.${mode_lower}.wasm"
        if ! build_v8_mode "$file" "$output" "$write_target" "$runtime" "$mode" "${output}.${mode_lower}.wasm"; then
          echo "V8 $mode build failed"
          exit 1
        fi
        for engine in $ENGINES; do
          echo -e "$filename (asc/$runtime/$engine/$mode_lower/v8)\n"
          run_v8_module "$engine" "$arg"
        done
      fi

      if [[ $RUN_WAVM -eq 1 ]]; then
        arg="${filename%.ts}.${runtime}.wavm.${mode_lower}.wasm"
        if ! build_wavm_mode "$file" "$output" "$write_target" "$runtime" "$mode" "${output}.wavm.${mode_lower}.wasm"; then
          echo "WAVM WASI $mode build failed"
          exit 1
        fi
        echo -e "$filename (asc/$runtime/wavm/$mode_lower/wavm)\n"
        run_wavm_module "$arg"
      fi
    done
  done
done

echo "Finished benchmarks"
