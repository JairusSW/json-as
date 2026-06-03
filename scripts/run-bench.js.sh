#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENGINES=${ENGINES:-"turbofan"}
resolve_d8_bin() {
  if [[ -n "${D8_BIN:-}" ]]; then
    printf '%s\n' "$D8_BIN"
    return 0
  fi

  if command -v v8 >/dev/null 2>&1; then
    printf '%s\n' "v8"
    return 0
  fi

  if command -v d8 >/dev/null 2>&1; then
    printf '%s\n' "d8"
    return 0
  fi

  return 1
}

if ! D8_BIN="$(resolve_d8_bin)"; then
  echo "❌ Neither v8 nor d8 was found in PATH"
  exit 1
fi

TSC_BENCH_LOG="$(mktemp)"
TSC_THROUGHPUT_LOG="$(mktemp)"
trap 'rm -f "$TSC_BENCH_LOG" "$TSC_THROUGHPUT_LOG"' EXIT

if ! npx tsc -p ./bench >"$TSC_BENCH_LOG" 2>&1; then
  cat "$TSC_BENCH_LOG"
  exit 1
fi

if ! npx tsc -p ./bench/throughput >"$TSC_THROUGHPUT_LOG" 2>&1; then
  cat "$TSC_THROUGHPUT_LOG"
  exit 1
fi
cp ./bench/lib/bench.js ./build/lib/bench.js
mkdir -p ./build/logs/js

BENCH_NAME="${1:-}"
FILES=()

if [[ -n "$BENCH_NAME" ]]; then
  # Allow passing `abc` or `abc.bench.ts`
  RAW_BENCH_NAME="$BENCH_NAME"

  if [[ "$RAW_BENCH_NAME" == */ ]]; then
    # Directory form (`multilib/`, `custom/`, `throughput/`): run every bench in
    # that subdir.
    DIR_REL="${RAW_BENCH_NAME%/}"
    for f in ./bench/$DIR_REL/*.bench.ts; do
      [[ -f "$f" ]] && FILES+=("$f")
    done

    if [[ ${#FILES[@]} -eq 0 ]]; then
      echo "❌ No benchmarks found in '$RAW_BENCH_NAME'"
      exit 1
    fi
  else
  [[ "$BENCH_NAME" != *.bench.ts ]] && BENCH_NAME="$BENCH_NAME.bench.ts"

  CANDIDATES=(
    "./bench/$BENCH_NAME"
    "./bench/multilib/$BENCH_NAME"
    "./bench/throughput/$BENCH_NAME"
  )

  if [[ "$RAW_BENCH_NAME" == custom/* ]]; then
    CUSTOM_REL="${BENCH_NAME#custom/}"
    CANDIDATES+=( "./bench/custom/$CUSTOM_REL" )
  fi

  for f in "${CANDIDATES[@]}"; do
    [[ -f "$f" ]] && FILES+=("$f")
  done

  if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "❌ No benchmark found for '$1'"
    exit 1
  fi
  fi
else
  # Default run: top-level benches only. Subfolders (multilib/, throughput/) are
  # opt-in — pass `multilib/` or `multilib/<name>` to run them.
  FILES=(
    ./bench/*.bench.ts
  )
fi

for file in "${FILES[@]}"; do
  filename="${file##*/}"

  # tsc compiles bench/ with rootDir "." -> ../build, preserving subfolders, so
  # the built JS mirrors the source path under ./build (prim/, multilib/,
  # throughput/, or top-level).
  rel="${file#./bench/}"
  file_js="./build/${rel%.ts}.js"

  for engine in $ENGINES; do
    printf '%s\n\n' "$filename (js/$engine)"

    if [[ "$file" == *multilib/* ]]; then
      if [[ "$engine" != "turbofan" ]]; then
        echo "Skipping $filename: multilib benches require the Node runner"
        continue
      fi
      node ./bench/multilib/node-runner.mjs "$file_js"
      continue
    fi

    if [[ "$engine" == "ignition" ]]; then
      "$D8_BIN" --no-opt --allow-natives-syntax --module "$file_js"
    fi

    if [[ "$engine" == "liftoff" ]]; then
      "$D8_BIN" --liftoff-only --no-opt --allow-natives-syntax --module "$file_js"
    fi

    if [[ "$engine" == "sparkplug" ]]; then
      "$D8_BIN" --sparkplug --always-sparkplug --allow-natives-syntax --no-opt --module "$file_js"
    fi

    if [[ "$engine" == "turbofan" ]]; then
      "$D8_BIN" --no-liftoff --no-wasm-tier-up --allow-natives-syntax --module "$file_js"
    fi
  done
done

echo "Finished benchmarks"
