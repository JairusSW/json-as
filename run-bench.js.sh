#!/bin/bash

ENGINES=${ENGINES:-"turbofan"}
npx tsc -p ./bench > /dev/null 2>&1
npx tsc -p ./bench/throughput > /dev/null 2>&1
cp ./bench/lib/bench.js ./build/lib/bench.js
mkdir -p ./build/logs/js

BENCH_NAME="${1:-}"
FILES=()

if [[ -n "$BENCH_NAME" ]]; then
  # Allow passing `abc` or `abc.bench.ts`
  [[ "$BENCH_NAME" != *.bench.ts ]] && BENCH_NAME="$BENCH_NAME.bench.ts"

  CANDIDATES=(
    "./bench/$BENCH_NAME"
    "./bench/throughput/$BENCH_NAME"
  )

  for f in "${CANDIDATES[@]}"; do
    [[ -f "$f" ]] && FILES+=("$f")
  done

  if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "❌ No benchmark found for '$1'"
    exit 1
  fi
else
  FILES=(
    ./bench/*.bench.ts
    ./bench/throughput/*.bench.ts
  )
fi

for file in "${FILES[@]}"; do
  filename=$(basename -- "$file")

  if [[ "$file" == *throughput/* ]]; then
      file_js="./build/throughput/${filename%.ts}.js"
  else
      file_js="./build/${filename%.ts}.js"
  fi

  for engine in $ENGINES; do
    echo -e "$filename (js/$engine)\n"

    arg="${filename%.ts}.${runtime}.ts"
    if [[ "$engine" == "ignition" ]]; then
      v8 --no-opt --allow-natives-syntax --module $file_js -- $arg
    fi

    if [[ "$engine" == "liftoff" ]]; then
      v8 --liftoff-only --no-opt --allow-natives-syntax --module $file_js -- $arg
    fi

    if [[ "$engine" == "sparkplug" ]]; then
      v8 --sparkplug --always-sparkplug --allow-natives-syntax --no-opt --module $file_js -- $arg
    fi

    if [[ "$engine" == "turbofan" ]]; then
      v8 --no-liftoff --no-wasm-tier-up --allow-natives-syntax --module $file_js -- $arg
    fi
  done
done

echo "Finished benchmarks"
