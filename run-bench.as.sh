#!/bin/bash
RUNTIMES=${RUNTIMES:-"minimal stub"}
ENGINES=${ENGINES:-"liftoff ignition sparkplug turbofan llvm"}
for file in ./assembly/__benches__/abc.bench.ts; do
    filename=$(basename -- "$file")
    output_wasi=
    for runtime in $RUNTIMES; do
        output="./build/${filename%.ts}.${runtime}.wasm"

        npx asc "$file" --transform ./transform -o "${output}.wasm" -O3 --converge --noAssert --uncheckedBehavior always --runtime $runtime --enable simd --enable bulk-memory --exportStart start || {
            echo "Build failed"
            exit 1
        }

        # wasm-opt -all -O4 "${output}.1" -o "$output"
        # rm "${output}.1"

        npx asc "$file" --transform ./transform -o "${output}.wasi.wasm" -O3 --converge --noAssert --uncheckedBehavior always --runtime $runtime --enable simd --enable bulk-memory --config ./node_modules/@assemblyscript/wasi-shim/asconfig.json || {
            echo "Build failed"
            exit 1
        }

        # wasm-opt -all -O4 "${output}.2" -o "${output%.wasm}.wasi.wasm"
        # rm "${output}.2"

        for engine in $ENGINES; do
            echo -e "$filename (asc/$runtime/$engine)\n"

            arg="${filename%.ts}.${runtime}.wasm"
            if [[ "$engine" == "ignition" ]]; then
                v8 --no-opt --module ./bench/runners/assemblyscript.js -- $arg
            fi

            if [[ "$engine" == "liftoff" ]]; then
                v8 --liftoff-only --no-opt --module ./bench/runners/assemblyscript.js -- $arg
            fi

            if [[ "$engine" == "sparkplug" ]]; then
                v8 --sparkplug --always-sparkplug --no-opt --module ./bench/runners/assemblyscript.js -- $arg
            fi

            if [[ "$engine" == "turbofan" ]]; then
                v8 --no-liftoff --no-wasm-tier-up --module ./bench/runners/assemblyscript.js -- $arg
            fi

            if [[ "$engine" == "llvm" ]]; then
                wasmer run "${output%.wasm}.wasi.wasm" --llvm --enable-simd --enable-bulk-memory
            fi
        done
    done
done

echo "Finished benchmarks"
