import { readFileSync } from "node:fs";

const [baselinePath, candidatePath] = process.argv.slice(2);
if (!baselinePath || !candidatePath) {
  throw new Error(
    "Usage: node scripts/bench-primitive-slots.mjs baseline.wasm candidate.wasm",
  );
}

async function measure(path, length, kind, object, reuse) {
  let memory;
  let counting = false;
  let allocations = 0;
  let bytes = 0;
  let resizes = 0;
  const blockSize = (block) =>
    (new DataView(memory.buffer).getUint32(block, true) & ~3) + 4;
  const { instance } = await WebAssembly.instantiate(readFileSync(path), {
    env: {
      abort(_message, _file, line, column) {
        throw new Error(`Abort at ${line}:${column}`);
      },
    },
    rtrace: {
      oninit() {},
      onload(pointer) {
        return pointer;
      },
      onstore(pointer) {
        return pointer;
      },
      onalloc(block) {
        if (counting) {
          allocations++;
          bytes += blockSize(block);
        }
      },
      onresize(block, oldSize) {
        if (counting) {
          resizes++;
          bytes += Math.max(0, blockSize(block) - oldSize);
        }
      },
      onmove() {},
      onfree() {},
      onvisit() {
        return 1;
      },
      oncollect() {},
      oninterrupt() {},
      onyield() {},
    },
  });
  memory = instance.exports.memory;
  const string = () => {
    const pointer = instance.exports.output();
    const size = new DataView(memory.buffer).getUint32(pointer - 4, true);
    return Buffer.from(memory.buffer, pointer, size).toString("utf16le");
  };
  instance.exports.setup(length, kind, object);
  const expected = string();
  counting = true;
  instance.exports.run(reuse);
  counting = false;
  const output = string();
  if (output !== expected) throw new Error("Warm output changed");
  return { allocations, bytes, resizes, output };
}

const names = ["null", "bool", "f64", "spilled-i64", "string-control"];
for (const length of [0, 1, 8, 256, 4096]) {
  for (let kind = 0; kind < names.length; kind++) {
    for (const object of [false, true]) {
      for (const reuse of [false, true]) {
        const baseline = await measure(
          baselinePath,
          length,
          kind,
          object,
          reuse,
        );
        const candidate = await measure(
          candidatePath,
          length,
          kind,
          object,
          reuse,
        );
        if (baseline.output !== candidate.output)
          throw new Error("Baseline/candidate output mismatch");
        delete baseline.output;
        delete candidate.output;
        console.log(
          JSON.stringify({
            length,
            kind: names[kind],
            shape: object ? "object" : "array",
            reuse,
            baseline,
            candidate,
          }),
        );
      }
    }
  }
}
