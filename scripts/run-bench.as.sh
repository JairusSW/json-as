#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RUNTIMES=${RUNTIMES:-"incremental"}
ENGINES=${ENGINES:-"turbofan"}
MODE_FILTER=${JSON_MODE:-""}
TURBOFAN_FLAGS=${TURBOFAN_FLAGS:-"--no-liftoff --experimental-wasm-revectorize"}
D8_BIN=${D8_BIN:-""}
WAVM_BIN=${WAVM_BIN:-"wavm"}
WAVM_RUN_FLAGS=${WAVM_RUN_FLAGS:-"--abi=wasi --enable simd --enable bulk-memory --enable sign-extension"}
# Deserialize-biased alternative to try manually:
# TURBOFAN_FLAGS="--no-liftoff --no-wasm-stack-checks --no-wasm-bounds-checks --no-wasm-tier-up --experimental-wasm-revectorize --minor-ms --minor-ms-concurrent-marking-trigger=30 --turboshaft-wasm-load-elimination"
BENCH_NAME=""
ARGS=()
RUN_V8=0
RUN_WAVM=0

read -r -a WAVM_RUN_FLAGS_ARR <<< "$WAVM_RUN_FLAGS"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      [[ $# -lt 2 ]] && { echo "Missing value for --mode"; exit 1; }
      MODE_FILTER="${2^^}"
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

mkdir -p ./build/logs/as/{swar,simd,naive}
mkdir -p ./build/logs/charts

FILES=()

if [[ -n "$BENCH_NAME" ]]; then
  RAW_BENCH_NAME="$BENCH_NAME"
  [[ "$BENCH_NAME" != *.bench.ts ]] && BENCH_NAME="$BENCH_NAME.bench.ts"

  CANDIDATES=(
    "./assembly/__benches__/$BENCH_NAME"
    "./assembly/__benches__/throughput/$BENCH_NAME"
  )

  if [[ "$RAW_BENCH_NAME" == custom/* ]]; then
    CUSTOM_REL="${BENCH_NAME#custom/}"
    CANDIDATES+=( "./assembly/__benches__/custom/$CUSTOM_REL" )
  fi

  for f in "${CANDIDATES[@]}"; do
    [[ -f "$f" ]] && FILES+=("$f")
  done

  if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "❌ No benchmark found for '$RAW_BENCH_NAME'"
    exit 1
  fi
else
  FILES=(
    ./assembly/__benches__/*.bench.ts
    ./assembly/__benches__/throughput/*.bench.ts
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

  if ! "$WAVM_BIN" run "${WAVM_RUN_FLAGS_ARR[@]}" "./build/$wasm_arg" >"$tmp" 2>&1; then
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

  case "$mode" in
    NAIVE)
      JSON_WRITE="$write_target" JSON_MODE=NAIVE npx asc "$file" --transform ./transform -o "${output}.tmp" -O3 --converge --noAssert --uncheckedBehavior always --runtime "$runtime" --enable bulk-memory --exportStart start --exportRuntime || return 1
      optimize_or_fallback "${output}.tmp" "$out_wasm" --enable-bulk-memory --enable-nontrapping-float-to-int --enable-tail-call -tnh -iit -ifwl -s 0 -O4
      ;;
    SWAR)
      JSON_WRITE="$write_target" JSON_MODE=SWAR npx asc "$file" --transform ./transform -o "${output}.tmp" -O3 --converge --noAssert --uncheckedBehavior always --runtime "$runtime" --enable bulk-memory --exportStart start --exportRuntime || return 1
      optimize_or_fallback "${output}.tmp" "$out_wasm" --enable-bulk-memory --enable-nontrapping-float-to-int --enable-tail-call -tnh -iit -ifwl -s 0 -O4
      ;;
    SIMD)
      JSON_WRITE="$write_target" JSON_MODE=SIMD npx asc "$file" --transform ./transform -o "${output}.tmp" -O3 --converge --noAssert --uncheckedBehavior always --runtime "$runtime" --enable bulk-memory --enable simd --exportStart start --exportRuntime || return 1
      optimize_or_fallback "${output}.tmp" "$out_wasm" --enable-bulk-memory --enable-simd --enable-nontrapping-float-to-int --enable-tail-call -tnh -iit -ifwl -s 0 -O4
      ;;
  esac
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

  JSON_WRITE="$write_target" JSON_MODE="$mode" npx asc "$file" --transform ./transform -o "${output}.wavm.tmp" -O3 --converge --noAssert --uncheckedBehavior always --runtime "$runtime" --use AS_BENCH_RUNTIME_WAVM=1 --config ./node_modules/@assemblyscript/wasi-shim/asconfig.json "${features[@]}" --exportRuntime || return 1
  mv "${output}.wavm.tmp" "$out_wasm"
}

should_run_mode() {
  local mode="$1"
  local file_mode="$2"
  [[ (-z "$MODE_FILTER" || "$MODE_FILTER" == "$mode") && (-z "$file_mode" || "$file_mode" == "$mode") ]]
}

for file in "${FILES[@]}"; do
  filename=$(basename -- "$file")
  filename_lower="${filename,,}"
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
      mode_lower="${mode,,}"
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
