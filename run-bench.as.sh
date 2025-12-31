#!/bin/bash
set -euo pipefail

RUNTIMES=${RUNTIMES:-"incremental"}
ENGINES=${ENGINES:-"turbofan"}

mkdir -p ./build/logs/as/{swar,simd,naive}
mkdir -p ./build/logs/charts

BENCH_NAME="${1:-}"
FILES=()

if [[ -n "$BENCH_NAME" ]]; then
  # Allow passing `abc` or `abc.bench.ts`
  [[ "$BENCH_NAME" != *.bench.ts ]] && BENCH_NAME="$BENCH_NAME.bench.ts"

  CANDIDATES=(
    "./assembly/__benches__/$BENCH_NAME"
    "./assembly/__benches__/throughput/$BENCH_NAME"
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
    ./assembly/__benches__/*.bench.ts
    ./assembly/__benches__/throughput/*.bench.ts
  )
fi

for file in "${FILES[@]}"; do
    filename=$(basename -- "$file")
    for runtime in $RUNTIMES; do
        output="./build/${filename%.ts}.${runtime}"

        JSON_MODE=NAIVE npx asc "$file" --transform ./transform -o "${output}.tmp" -O3 --converge --noAssert --uncheckedBehavior always --runtime $runtime --enable bulk-memory --exportStart start || {
            echo "Build failed"
            exit 1
        }

        wasm-opt --enable-bulk-memory --enable-nontrapping-float-to-int --enable-tail-call -tnh -iit -ifwl -s 0 -O4 "${output}.tmp" -o "${output}.naive.wasm"
        rm "${output}.tmp"

        JSON_MODE=SWAR npx asc "$file" --transform ./transform -o "${output}.tmp" -O3 --converge --noAssert --uncheckedBehavior always --runtime $runtime --enable bulk-memory --exportStart start || {
            echo "Build failed"
            exit 1
        }

        wasm-opt --enable-bulk-memory --enable-nontrapping-float-to-int --enable-tail-call -tnh -iit -ifwl -s 0 -O4 "${output}.tmp" -o "${output}.swar.wasm"
        rm "${output}.tmp"

        JSON_MODE=SIMD npx asc "$file" --transform ./transform -o "${output}.tmp" -O3 --converge --noAssert --uncheckedBehavior always --runtime $runtime --enable bulk-memory --enable simd --exportStart start || {
            echo "Build failed"
            exit 1
        }

        wasm-opt --enable-bulk-memory --enable-simd --enable-nontrapping-float-to-int --enable-tail-call -tnh -iit -ifwl -s 0 -O4 "${output}.tmp" -o "${output}.simd.wasm"
        rm "${output}.tmp"

        for engine in $ENGINES; do
            argNaive="${filename%.ts}.${runtime}.naive.wasm"
            argSwar="${filename%.ts}.${runtime}.swar.wasm"
            argSimd="${filename%.ts}.${runtime}.simd.wasm"
            if [[ "$engine" == "ignition" ]]; then
                echo -e "$filename (asc/$runtime/$engine/naive)\n"
                v8 --no-opt --module ./bench/runners/assemblyscript.js -- $argNaive
                echo -e "$filename (asc/$runtime/$engine/swar)\n"
                 v8 --no-opt --module ./bench/runners/assemblyscript.js -- $argSwar
                echo -e "$filename (asc/$runtime/$engine/simd)\n"
                 v8 --no-opt --module ./bench/runners/assemblyscript.js -- $argSimd
            fi

            if [[ "$engine" == "liftoff" ]]; then
                echo -e "$filename (asc/$runtime/$engine/naive)\n"
                v8 --liftoff-only --no-opt --module ./bench/runners/assemblyscript.js -- $argNaive
                echo -e "$filename (asc/$runtime/$engine/swar)\n"
                 v8 --liftoff-only --no-opt --module ./bench/runners/assemblyscript.js -- $argSwar
                echo -e "$filename (asc/$runtime/$engine/simd)\n"
                 v8 --liftoff-only --no-opt --module ./bench/runners/assemblyscript.js -- $argSimd
            fi

            if [[ "$engine" == "sparkplug" ]]; then
                echo -e "$filename (asc/$runtime/$engine/naive)\n"
                v8 --sparkplug --always-sparkplug --no-opt --module ./bench/runners/assemblyscript.js -- $argNaive
                echo -e "$filename (asc/$runtime/$engine/swar)\n"
                 v8 --sparkplug --always-sparkplug --no-opt --module ./bench/runners/assemblyscript.js -- $argSwar
                echo -e "$filename (asc/$runtime/$engine/simd)\n"
                 v8 --sparkplug --always-sparkplug --no-opt --module ./bench/runners/assemblyscript.js -- $argSimd
            fi

            if [[ "$engine" == "turbofan" ]]; then
                echo -e "$filename (asc/$runtime/$engine/naive)\n"
                 v8 --no-liftoff --no-wasm-stack-checks --no-wasm-bounds-checks --no-wasm-tier-up --experimental-wasm-revectorize --wasm-simd-ssse3-codegen --module ./bench/runners/assemblyscript.js -- $argNaive
                echo -e "$filename (asc/$runtime/$engine/swar)\n"
                 v8 --no-liftoff --no-wasm-stack-checks --no-wasm-bounds-checks --no-wasm-tier-up --experimental-wasm-revectorize --wasm-simd-ssse3-codegen --module ./bench/runners/assemblyscript.js -- $argSwar
                echo -e "$filename (asc/$runtime/$engine/simd)\n"
                 v8 --no-liftoff --no-wasm-stack-checks --no-wasm-bounds-checks --no-wasm-tier-up --experimental-wasm-revectorize --wasm-simd-ssse3-codegen --module ./bench/runners/assemblyscript.js -- $argSimd
            fi
        done
    done
done

echo "Finished benchmarks"
