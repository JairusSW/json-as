#!/bin/bash
RUNTIMES=${RUNTIMES:-"liftoff ignition sparkplug turbofan"}
npx tsc -p ./bench > /dev/null 2>&1
for file in ./bench/abc.bench.ts; do
  filename=$(basename -- "$file")
  file_js="${filename%.ts}.js"

  output="./build/${filename%.ts}.wasm"

  for rt in $RUNTIMES; do
    runtime=$(echo $rt | cut -d'-' -f1)
    engine=$(echo $rt | cut -d'-' -f2-)
    echo -e "$filename (js/$runtime/$engine)\n"

    arg="${filename%.ts}.${runtime}.wasm"
    if [[ "$engine" == "ignition" ]]; then
      v8 --no-opt --module ./build/$file_js
    fi

    if [[ "$engine" == "liftoff" ]]; then
      v8 --liftoff-only --no-opt --module ./build/$file_js
    fi

    if [[ "$engine" == "sparkplug" ]]; then
      v8 --sparkplug --always-sparkplug --no-opt --module ./build/$file_js
    fi

    if [[ "$engine" == "turbofan" ]]; then
      v8 --no-liftoff --no-wasm-tier-up --module ./build/$file_js
    fi
  done
done

echo "Finished benchmarks"
