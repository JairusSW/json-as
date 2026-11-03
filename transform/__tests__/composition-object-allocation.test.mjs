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
      "assembly/__tests__/composition-object-allocation.fixture.ts",
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
  const metrics = [];
  instance.exports.setup(1000);
  for (let kind = 0; kind < 3; kind++) {
    instance.exports.run(kind);
    instance.exports.run(kind);
    count = bytes = 0;
    const pointer = instance.exports.run(kind);
    const byteLength =
      new DataView(memory.buffer).getUint32(pointer - 4, true) & 0x7fffffff;
    const value = JSON.parse(
      Buffer.from(memory.buffer, pointer, byteLength).toString("utf16le"),
    );
    assert.equal(Object.keys(value).length, kind === 0 ? 1000 : 1001);
    assert.equal(value.k999, 999);
    if (kind) assert.deepEqual(value.child, kind === 1 ? {} : { value: 1 });
    assert.equal(
      count,
      kind === 0 ? 1 : 2,
      "snapshot allocations on callback-free values",
    );
    assert.ok(bytes <= byteLength + 256, "excess serialization storage");
    metrics.push({ kind, count, bytes });
  }
  console.log(JSON.stringify(metrics));
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
