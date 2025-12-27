#!/bin/bash
RUNTIMES=${RUNTIMES:-"incremental"} # incremental minimal stub
ENGINES=${ENGINES:-"turbofan"} # liftoff ignition sparkplug turbofan
mkdir -p ./build/logs/as/swar
mkdir -p ./build/logs/as/simd
mkdir -p ./build/logs/as/naive
mkdir -p ./build/logs/charts

for file in ./assembly/__benches__/*.bench.ts \
    ./assembly/__benches__/throughput/*.bench.ts; do
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
