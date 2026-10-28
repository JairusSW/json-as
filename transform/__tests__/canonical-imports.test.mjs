// Exercise the real compiler in a subprocess: asc calls process.exit on an
// unresolved import assertion, which must fail this test rather than kill it.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const self = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(self), "../..");
if (process.argv[2] === "--compile") {
  const { main } = await import("assemblyscript/asc");
  const layout = process.argv[3];
  const relative = layout.startsWith("relative");
  const split = layout === "split" || layout === "relative-split";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-canonical-"));
  try {
    fs.mkdirSync(path.join(dir, "node_modules"));
    fs.symlinkSync(root, path.join(dir, "node_modules/json-as"), "dir");
    fs.symlinkSync(
      path.join(root, "node_modules/xjb-as"),
      path.join(dir, "node_modules/xjb-as"),
      "dir",
    );
    const runtime = relative
      ? path.relative(dir, path.join(root, "assembly/index"))
      : "json-as/assembly";
    const bs = relative
      ? path.relative(dir, path.join(root, "lib/as-bs"))
      : "json-as/lib/as-bs";
    const src = `
import { JSON } from ${JSON.stringify(runtime.replaceAll(path.sep, "/"))};
${layout.endsWith("no-bs") ? "" : `import { bs } from ${JSON.stringify(bs.replaceAll(path.sep, "/"))};`}
${split ? `import { Item } from "./models/model";` : "@json\nclass Item { amount: f64 = 0; }"}
@json
class Body { items: Item[] = []; }
export function verify(): i32 {
  const body = JSON.parse<Body>('{"items":[{"amount":42}]}');
  assert(body.items.length == 1 && body.items[0].amount == 42);
  assert(JSON.stringify<Body>(body) == '{"items":[{"amount":42}]}');
  const items = JSON.parse<Item[]>('[{"amount":7}]');
  assert(items.length == 1 && items[0].amount == 7);
  return 1;
}
`;
    let binary;
    const result = await main(
      [
        "entry.ts",
        "--baseDir",
        dir,
        "--transform",
        path.join(root, "transform/lib/index.js"),
        ...(split ? ["--disable", "simd"] : ["--enable", "simd"]),
        "--outFile",
        "result.wasm",
      ],
      {
        readFile(name, baseDir) {
          if (name === "entry.ts") return src;
          if (name === "models/model.ts")
            return "@json\nexport class Item { amount: f64 = 0; }";
          try {
            return fs.readFileSync(path.resolve(baseDir, name), "utf8");
          } catch {
            return null;
          }
        },
        writeFile(name, contents) {
          if (name.endsWith("result.wasm")) binary = contents;
        },
      },
    );
    assert.equal(result.error, null, result.stderr.toString());
    assert.ok(binary, "expected WASM output");
    const { instance } = await WebAssembly.instantiate(binary, {
      env: {
        abort() {
          throw new Error("guest assertion failed");
        },
      },
    });
    assert.equal(instance.exports.verify(), 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
} else {
  for (const layout of [
    "package",
    "relative",
    "no-bs",
    "split",
    "relative-no-bs",
    "relative-split",
  ]) {
    const result = spawnSync(process.execPath, [self, "--compile", layout], {
      encoding: "utf8",
      timeout: 60000,
    });
    assert.ifError(result.error);
    assert.equal(
      result.status,
      0,
      `${layout}:\n${result.stdout}${result.stderr}`,
    );
    console.log(
      `  ✓ ${layout} runtime imports compile and execute nested/array JSON`,
    );
  }
}
