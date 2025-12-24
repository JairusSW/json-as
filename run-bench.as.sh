#!/bin/bash
RUNTIMES=${RUNTIMES:-"incremental"} # incremental minimal stub
ENGINES=${ENGINES:-"turbofan"} # liftoff ignition sparkplug turbofan
mkdir -p ./build/logs/as/simd
mkdir -p ./build/logs/as/swar
for file in ./assembly/__benches__/*.bench.ts; do
    filename=$(basename -- "$file")
    for runtime in $RUNTIMES; do
        output="./build/${filename%.ts}.${runtime}"

        npx asc "$file" --transform ./transform -o "${output}.1" -O3 --converge --noAssert --uncheckedBehavior always --runtime $runtime --enable bulk-memory --exportStart start || {
            echo "Build failed"
            exit 1
        }

        wasm-opt --enable-bulk-memory --enable-nontrapping-float-to-int --enable-tail-call -tnh -iit -ifwl -s 0 -O4 "${output}.1" -o "${output}.wasm"
        rm "${output}.1"

        npx asc "$file" --transform ./transform -o "${output}.1" -O3 --converge --noAssert --uncheckedBehavior always --runtime $runtime --enable bulk-memory --enable simd --exportStart start || {
            echo "Build failed"
            exit 1
        }

        wasm-opt --enable-bulk-memory --enable-simd --enable-nontrapping-float-to-int --enable-tail-call -tnh -iit -ifwl -s 0 -O4 "${output}.1" -o "${output}.simd.wasm"
        rm "${output}.1"

        for engine in $ENGINES; do
            echo -e "$filename (asc/$runtime/$engine/swar)\n"

            arg="${filename%.ts}.${runtime}.wasm"

            argSimd="${filename%.ts}.${runtime}.simd.wasm"
            if [[ "$engine" == "ignition" ]]; then
                v8 --no-opt --module ./bench/runners/assemblyscript.js -- $arg
                echo -e "$filename (asc/$runtime/$engine/simd)\n"
                v8 --no-opt --module ./bench/runners/assemblyscript.js -- $argSimd
            fi

            if [[ "$engine" == "liftoff" ]]; then
                v8 --liftoff-only --no-opt --module ./bench/runners/assemblyscript.js -- $arg
                echo -e "$filename (asc/$runtime/$engine/simd)\n"
                v8 --liftoff-only --no-opt --module ./bench/runners/assemblyscript.js -- $argSimd
            fi

            if [[ "$engine" == "sparkplug" ]]; then
                v8 --sparkplug --always-sparkplug --no-opt --module ./bench/runners/assemblyscript.js -- $arg
                echo -e "$filename (asc/$runtime/$engine/simd)\n"
                v8 --sparkplug --always-sparkplug --no-opt --module ./bench/runners/assemblyscript.js -- $argSimd
            fi

            if [[ "$engine" == "turbofan" ]]; then
                v8 --no-liftoff --no-wasm-tier-up --module ./bench/runners/assemblyscript.js -- $arg
                echo -e "$filename (asc/$runtime/$engine/simd)\n"
                v8 --no-liftoff --no-wasm-tier-up --module ./bench/runners/assemblyscript.js -- $argSimd
            fi
        done
    done
done

echo "Finished benchmarks"
