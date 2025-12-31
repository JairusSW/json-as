#!/bin/bash

mkdir -p ./build

TEST_NAME="$1"

for file in ./assembly/__tests__/*.spec.ts; do
  filename=$(basename -- "$file")
  basename_no_ext="${filename%.spec.ts}"

  if [ -z "$TEST_NAME" ] || \
     [ "$TEST_NAME" = "$basename_no_ext" ] || \
     [ "$TEST_NAME" = "$filename" ]; then

    for mode in naive swar simd; do
      output="./build/${basename_no_ext}.${mode}.wasm"

      start_time=$(date +%s%3N)

      if [ "$mode" = "simd" ]; then
        JSON_MODE=SIMD npx asc "$file" \
          --transform ./transform \
          -o "$output" \
          --runtime incremental \
          --enable simd \
          --config ./node_modules/@assemblyscript/wasi-shim/asconfig.json \
          --debug \
          --disableWarning 226 || { echo "Tests failed ($mode)"; exit 1; }
      elif [ "$mode" = "naive" ]; then
        JSON_MODE=NAIVE npx asc "$file" \
          --transform ./transform \
          -o "$output" \
          --runtime incremental \
          --config ./node_modules/@assemblyscript/wasi-shim/asconfig.json \
          --debug \
          --disableWarning 226 || { echo "Tests failed ($mode)"; exit 1; }
      else
        JSON_MODE=SWAR npx asc "$file" \
          --transform ./transform \
          -o "$output" \
          --runtime incremental \
          --config ./node_modules/@assemblyscript/wasi-shim/asconfig.json \
          --debug \
          --disableWarning 226 || { echo "Tests failed ($mode)"; exit 1; }
      fi

      end_time=$(date +%s%3N)
      build_time=$((end_time - start_time))

      if [ "$build_time" -ge 60000 ]; then
        formatted_time="$(bc <<< "scale=2; $build_time/60000")m"
      elif [ "$build_time" -ge 1000 ]; then
        formatted_time="$(bc <<< "scale=2; $build_time/1000")s"
      else
        formatted_time="${build_time}ms"
      fi

      echo " -> $filename ($mode build in $formatted_time)"
      wasmtime "$output" || { echo "Tests failed ($mode)"; exit 1; }
    done
  fi
done

echo "All tests passed"
