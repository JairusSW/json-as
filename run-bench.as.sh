#!/bin/bash
RUNTIMES=${RUNTIMES:-"minimal stub"}
ENGINES=${ENGINES:-"liftoff ignition sparkplug turbofan llvm"}
for file in ./assembly/__benches__/vec3.bench.ts; do
    filename=$(basename -- "$file")
    for runtime in $RUNTIMES; do
        output="./build/${filename%.ts}.${runtime}"

        npx asc "$file" --transform ./transform -o "${output}.1" -O3 --converge --noAssert --uncheckedBehavior always --runtime $runtime --enable simd --enable bulk-memory --exportStart start || {
            echo "Build failed"
            exit 1
        }

        wasm-opt --enable-bulk-memory --enable-simd --enable-nontrapping-float-to-int --enable-tail-call -tnh -iit -ifwl -s 0 -O4 "${output}.1" -o "${output}.wasm"
        rm "${output}.1"

        npx asc "$file" --transform ./transform -o "${output}.2" -O3 --converge --noAssert --uncheckedBehavior always --runtime $runtime --enable simd --enable bulk-memory --config ./node_modules/@assemblyscript/wasi-shim/asconfig.json || {
            echo "Build failed"
            exit 1
        }

        wasm-opt --enable-bulk-memory --enable-simd --enable-nontrapping-float-to-int --enable-tail-call -tnh -iit -ifwl -s 0 -O4 "${output}.2" -o "${output%.wasm}.wasi.wasm"
        rm "${output}.2"

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
                wasmer run --cranelift --enable-simd --enable-bulk-memory "${output}.wasi.wasm"
            fi
        done
    done
done

echo "Finished benchmarks"
