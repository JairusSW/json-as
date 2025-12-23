#!/bin/bash
RUNTIMES=${RUNTIMES:-"turbofan"}
npx tsc -p ./bench > /dev/null 2>&1
cp ./bench/lib/bench.js ./build/lib/bench.js
mkdir -p ./build/logs
for file in ./bench/*.bench.ts; do
  filename=$(basename -- "$file")
  file_js="${filename%.ts}.js"

  output="./build/${filename%.ts}.wasm"

  for rt in $RUNTIMES; do
    runtime=$(echo $rt | cut -d'-' -f1)
    engine=$(echo $rt | cut -d'-' -f2-)
    echo -e "$filename (js/$runtime/$engine)\n"

    arg="${filename%.ts}.${runtime}.ts"
    if [[ "$engine" == "ignition" ]]; then
      v8 --no-opt --allow-natives-syntax --module ./build/$file_js -- $arg
    fi

    if [[ "$engine" == "liftoff" ]]; then
      v8 --liftoff-only --no-opt --allow-natives-syntax --module ./build/$file_js -- $arg
    fi

    if [[ "$engine" == "sparkplug" ]]; then
      v8 --sparkplug --always-sparkplug --allow-natives-syntax --no-opt --module ./build/$file_js -- $arg
    fi

    if [[ "$engine" == "turbofan" ]]; then
      v8 --no-liftoff --no-wasm-tier-up --allow-natives-syntax --module ./build/$file_js -- $arg
    fi
  done
done

echo "Finished benchmarks"
