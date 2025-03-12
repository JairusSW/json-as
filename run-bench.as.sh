#!/bin/bash

mkdir -p ./build

for file in ./assembly/__benches__/large.bench.ts; do
  filename=$(basename -- "$file")
  output="./build/${filename%.ts}.wasm"

  start_time=$(date +%s%3N)
  npx asc "$file" --transform ./transform -o "$output" --optimizeLevel 3 --shrinkLevel 0 --converge --noAssert --uncheckedBehavior always --runtime stub --enable simd --enable bulk-memory || { echo "Build failed"; exit 1; }
  end_time=$(date +%s%3N)

  build_time=$((end_time - start_time))

  if [ "$build_time" -ge 60000 ]; then
    formatted_time="$(bc <<< "scale=2; $build_time/60000")m"
  elif [ "$build_time" -ge 1000 ]; then
    formatted_time="$(bc <<< "scale=2; $build_time/1000")s"
  else
    formatted_time="${build_time}ms"
  fi

  echo -e "$filename (built in $formatted_time)\n"
  wasmer "$output" --llvm || { echo "Benchmarked failed."; exit 1; }
done

echo "Finished benchmarks."