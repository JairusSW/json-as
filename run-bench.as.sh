#!/bin/bash
set -euo pipefail

RUNTIMES=${RUNTIMES:-"incremental"}
ENGINES=${ENGINES:-"turbofan"}
MODE_FILTER=${JSON_MODE:-""}
BENCH_NAME=""
ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      [[ $# -lt 2 ]] && { echo "Missing value for --mode"; exit 1; }
      MODE_FILTER="${2^^}"
      shift 2
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done

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
    write_target="${file#./}"
    tmp_ts="${write_target%.ts}.tmp.ts"
    for runtime in $RUNTIMES; do
        output="./build/${filename%.ts}.${runtime}"

        if [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "NAIVE" ]]; then
            JSON_WRITE="$write_target" JSON_MODE=NAIVE npx asc "$file" --transform ./transform -o "${output}.tmp" -O3 --converge --noAssert --uncheckedBehavior always --runtime $runtime --enable bulk-memory --exportStart start || {
                echo "Build failed"
                exit 1
            }

            wasm-opt --enable-bulk-memory --enable-nontrapping-float-to-int --enable-tail-call -tnh -iit -ifwl -s 0 -O4 "${output}.tmp" -o "${output}.naive.wasm"
            rm "${output}.tmp"
        fi

        if [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "SWAR" ]]; then
            JSON_WRITE="$write_target" JSON_MODE=SWAR npx asc "$file" --transform ./transform -o "${output}.tmp" -O3 --converge --noAssert --uncheckedBehavior always --runtime $runtime --enable bulk-memory --exportStart start || {
                echo "Build failed"
                exit 1
            }

            wasm-opt --enable-bulk-memory --enable-nontrapping-float-to-int --enable-tail-call -tnh -iit -ifwl -s 0 -O4 "${output}.tmp" -o "${output}.swar.wasm"
            rm "${output}.tmp"
        fi

        if [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "SIMD" ]]; then
            JSON_WRITE="$write_target" JSON_MODE=SIMD npx asc "$file" --transform ./transform -o "${output}.tmp" -O3 --converge --noAssert --uncheckedBehavior always --runtime $runtime --enable bulk-memory --enable simd --exportStart start || {
                echo "Build failed"
                exit 1
            }

            wasm-opt --enable-bulk-memory --enable-simd --enable-nontrapping-float-to-int --enable-tail-call -tnh -iit -ifwl -s 0 -O4 "${output}.tmp" -o "${output}.simd.wasm"
            rm "${output}.tmp"
        fi

        for engine in $ENGINES; do
            argNaive="${filename%.ts}.${runtime}.naive.wasm"
            argSwar="${filename%.ts}.${runtime}.swar.wasm"
            argSimd="${filename%.ts}.${runtime}.simd.wasm"
            if [[ "$engine" == "ignition" ]]; then
                if [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "NAIVE" ]]; then
                    echo -e "$filename (asc/$runtime/$engine/naive)\n"
                    v8 --no-opt --module ./bench/runners/assemblyscript.js -- $argNaive
                fi
                if [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "SWAR" ]]; then
                    echo -e "$filename (asc/$runtime/$engine/swar)\n"
                    v8 --no-opt --module ./bench/runners/assemblyscript.js -- $argSwar
                fi
                if [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "SIMD" ]]; then
                    echo -e "$filename (asc/$runtime/$engine/simd)\n"
                    v8 --no-opt --module ./bench/runners/assemblyscript.js -- $argSimd
                fi
            fi

            if [[ "$engine" == "liftoff" ]]; then
                if [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "NAIVE" ]]; then
                    echo -e "$filename (asc/$runtime/$engine/naive)\n"
                    v8 --liftoff-only --no-opt --module ./bench/runners/assemblyscript.js -- $argNaive
                fi
                if [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "SWAR" ]]; then
                    echo -e "$filename (asc/$runtime/$engine/swar)\n"
                    v8 --liftoff-only --no-opt --module ./bench/runners/assemblyscript.js -- $argSwar
                fi
                if [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "SIMD" ]]; then
                    echo -e "$filename (asc/$runtime/$engine/simd)\n"
                    v8 --liftoff-only --no-opt --module ./bench/runners/assemblyscript.js -- $argSimd
                fi
            fi

            if [[ "$engine" == "sparkplug" ]]; then
                if [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "NAIVE" ]]; then
                    echo -e "$filename (asc/$runtime/$engine/naive)\n"
                    v8 --sparkplug --always-sparkplug --no-opt --module ./bench/runners/assemblyscript.js -- $argNaive
                fi
                if [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "SWAR" ]]; then
                    echo -e "$filename (asc/$runtime/$engine/swar)\n"
                    v8 --sparkplug --always-sparkplug --no-opt --module ./bench/runners/assemblyscript.js -- $argSwar
                fi
                if [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "SIMD" ]]; then
                    echo -e "$filename (asc/$runtime/$engine/simd)\n"
                    v8 --sparkplug --always-sparkplug --no-opt --module ./bench/runners/assemblyscript.js -- $argSimd
                fi
            fi

            if [[ "$engine" == "turbofan" ]]; then
                if [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "NAIVE" ]]; then
                    echo -e "$filename (asc/$runtime/$engine/naive)\n"
                    v8 --no-liftoff --no-wasm-stack-checks --no-wasm-bounds-checks --no-wasm-tier-up --experimental-wasm-revectorize --wasm-simd-ssse3-codegen --module ./bench/runners/assemblyscript.js -- $argNaive
                fi
                if [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "SWAR" ]]; then
                    echo -e "$filename (asc/$runtime/$engine/swar)\n"
                    v8 --no-liftoff --no-wasm-stack-checks --no-wasm-bounds-checks --no-wasm-tier-up --experimental-wasm-revectorize --wasm-simd-ssse3-codegen --module ./bench/runners/assemblyscript.js -- $argSwar
                fi
                if [[ -z "$MODE_FILTER" || "$MODE_FILTER" == "SIMD" ]]; then
                    echo -e "$filename (asc/$runtime/$engine/simd)\n"
                    v8 --no-liftoff --no-wasm-stack-checks --no-wasm-bounds-checks --no-wasm-tier-up --experimental-wasm-revectorize --wasm-simd-ssse3-codegen --module ./bench/runners/assemblyscript.js -- $argSimd
                fi
            fi
        done
    done
done

echo "Finished benchmarks"
