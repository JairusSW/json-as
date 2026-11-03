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
      "assembly/__tests__/static-string-allocation.fixture.ts",
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
  for (const length of [100, 1000]) {
    instance.exports.setup(length);
    for (const kind of [0, 1]) {
      instance.exports.run(kind);
      instance.exports.run(kind);
      const first = instance.exports.first(kind);
      count = bytes = 0;
      assert.equal(instance.exports.run(kind), length);
      metrics.push({
        length,
        kind,
        count,
        bytes,
        retained: instance.exports.first(kind) === first,
      });
      assert.equal(count, 0);
      assert.equal(instance.exports.first(kind), first);
    }
  }
  console.log(JSON.stringify(metrics));
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
