import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-alloc-"));
try {
  const output = path.join(dir, "allocation.wasm");
  execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules/assemblyscript/bin/asc.js"),
      "assembly/__tests__/allocation-policy.fixture.ts",
      "--transform",
      "./transform",
      "-O3",
      "--use",
      "ASC_RTRACE=1",
      "--exportStart",
      "start",
      "-o",
      output,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        JSON_MODE: "SWAR",
        JSON_AS_LIBRARY_SOURCE: "assembly/index",
      },
      stdio: "pipe",
    },
  );
  let memory,
    count = 0,
    bytes = 0,
    largest = 0;
  const add = (block) => {
    const size = (new DataView(memory.buffer).getUint32(block, true) & ~3) + 4;
    count++;
    bytes += size;
    largest = Math.max(largest, size);
  };
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(output), {
    env: {
      abort(_m, _f, line, column) {
        throw new Error(`abort ${line}:${column}`);
      },
    },
    rtrace: {
      oninit() {},
      onalloc: add,
      onresize(block, old) {
        const size =
          (new DataView(memory.buffer).getUint32(block, true) & ~3) + 4;
        bytes += Math.max(0, size - old);
        largest = Math.max(largest, size);
      },
      onload: (p) => p,
      onstore: (p) => p,
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
  instance.exports.start();
  assert.ok(
    largest < 1 << 20,
    "disabled cache allocated a 1 MiB arena at startup",
  );
  const startupLargest = largest;
  instance.exports.setup();
  count = bytes = largest = 0;
  instance.exports.update();
  assert.equal(instance.exports.check(), 1);
  assert.equal(count, 0, "primitive slot updates allocated temporary wrappers");
  const primitiveAllocations = count;
  bytes = largest = 0;
  instance.exports.serializeFloats();
  assert.ok(
    bytes < instance.exports.outputBytes() * 4,
    `float array allocated ${bytes} bytes for ${instance.exports.outputBytes()} output bytes`,
  );
  console.log(
    "Allocation policy:",
    JSON.stringify({
      startupLargest,
      primitiveAllocations,
      floatAllocatedBytes: bytes,
      floatOutputBytes: instance.exports.outputBytes(),
    }),
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
