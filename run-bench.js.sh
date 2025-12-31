#!/bin/bash
set -euo pipefail

RUNTIMES=${RUNTIMES:-"turbofan"}

npx tsc -p ./bench > /dev/null 2>&1
cp ./bench/lib/bench.js ./build/lib/bench.js

mkdir -p ./build/logs/js
mkdir -p ./build/logs/charts

BENCH_NAME="${1:-}"
FILES=()

if [[ -n "$BENCH_NAME" ]]; then
  # Allow `abc` or `abc.bench.ts`
  [[ "$BENCH_NAME" != *.bench.ts ]] && BENCH_NAME="$BENCH_NAME.bench.ts"

  CANDIDATE="./bench/$BENCH_NAME"
  if [[ -f "$CANDIDATE" ]]; then
    FILES+=("$CANDIDATE")
  else
    echo "❌ No JS benchmark found for '$1'"
    exit 1
  fi
else
  FILES=(./bench/*.bench.ts)
fi

for file in "${FILES[@]}"; do
  filename=$(basename -- "$file")
  file_js="${filename%.ts}.js"

  for rt in $RUNTIMES; do
    runtime="${rt%%-*}"
    engine="${rt#*-}"

    echo -e "$filename (js/$runtime/$engine)\n"

    arg="${filename%.ts}.${runtime}.ts"

    if [[ "$engine" == "ignition" ]]; then
      v8 --no-opt --allow-natives-syntax --module "./build/$file_js" -- "$arg"
    fi

    if [[ "$engine" == "liftoff" ]]; then
      v8 --liftoff-only --no-opt --allow-natives-syntax --module "./build/$file_js" -- "$arg"
    fi

    if [[ "$engine" == "sparkplug" ]]; then
      v8 --sparkplug --always-sparkplug --allow-natives-syntax --no-opt --module "./build/$file_js" -- "$arg"
    fi

    if [[ "$engine" == "turbofan" ]]; then
      v8 --no-liftoff --no-wasm-tier-up --allow-natives-syntax --module "./build/$file_js" -- "$arg"
    fi
  done
done

echo "Finished benchmarks"
