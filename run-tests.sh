#!/bin/bash

mkdir -p ./build

for file in ./assembly/__tests__/*.spec.ts; do
  filename=$(basename -- "$file")
  if [ -z "$1" ] || [ "$1" = "$filename" ]; then
    output="./build/${filename%.ts}.wasm"

    start_time=$(date +%s%3N)
    npx asc "$file" --transform ./transform -o "$output" --runtime incremental --enable simd --config ./node_modules/@assemblyscript/wasi-shim/asconfig.json --debug --disableWarning 226 || { echo "Tests failed"; exit 1; }
    end_time=$(date +%s%3N)

    build_time=$((end_time - start_time))

    if [ "$build_time" -ge 60000 ]; then
      formatted_time="$(bc <<< "scale=2; $build_time/60000")m"
    elif [ "$build_time" -ge 1000 ]; then
      formatted_time="$(bc <<< "scale=2; $build_time/1000")s"
    else
      formatted_time="${build_time}ms"
    fi

    echo " -> $filename (built in $formatted_time)"
    wasmtime "$output" || { echo "Tests failed"; exit 1; }
  else
    echo " -> $filename (skipped)"
  fi
done

echo "All tests passed"
