// Runs the lazy ≡ eager equivalence spec. Build first:
//   npx asc assembly/playground/lazy.spec.ts --transform ./transform \
//     -o build/pgspec.wasm --enable simd --runtime incremental -O3
import { readFileSync } from "node:fs";

const bytes = readFileSync(new URL("../../build/pgspec.wasm", import.meta.url));
const { instance } = await WebAssembly.instantiate(bytes, {
  env: {
    abort(msg, file, line, col) {
      throw new Error(`abort @ ${line}:${col}`);
    },
    trace(msg, n, ...a) {},
  },
});
const x = instance.exports;

const fails = x.run();
const total = x.total();
if (fails === 0) {
  console.log(`lazy ≡ eager: ${total}/${total} checks passed ✅`);
  process.exit(0);
} else {
  console.log(
    `lazy ≡ eager: ${total - fails}/${total} passed, ${fails} FAILED ❌ (first failing check id: ${x.firstFail()})`,
  );
  process.exit(1);
}
