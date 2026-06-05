// Doc-example tester: extracts ```ts code blocks from a markdown file,
// concatenates them into one module (so later blocks can use classes defined in
// earlier ones), compiles it against the local json-as transform, and runs it.
// A block tagged ```ts ignore is skipped (illustrative fragments).
//
// Usage: node scripts/test-doc-examples.mjs <file.md> [file.md ...]
import { readFileSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { execSync } from "child_process";

const OUT_DIR = "assembly/__doctest__";
mkdirSync(OUT_DIR, { recursive: true });

function extractBlocks(md) {
  const blocks = [];
  const re = /```ts([^\n]*)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(md))) {
    const flags = m[1].trim();
    if (flags.includes("ignore")) continue;
    blocks.push(m[2]);
  }
  return blocks;
}

let failed = 0;
for (const file of process.argv.slice(2)) {
  const md = readFileSync(file, "utf8");
  const blocks = extractBlocks(md);
  if (!blocks.length) {
    console.log(`SKIP  ${file} (no ts blocks)`);
    continue;
  }
  // Declaration blocks (classes / functions / enums / decorated types) stay at
  // top level so later blocks can use them; pure statement blocks are wrapped in
  // a scope so independent snippets can reuse local names (`parsed`, `out`, ...).
  const isDecl = (b) =>
    /(^|\n)\s*(@json|@serializable|export\s+)?\s*(class|function|enum|namespace|interface)\s/.test(
      b,
    ) || /(^|\n)\s*@(json|serializable)\b/.test(b);
  const clean = (b) =>
    b
      .split("\n")
      .filter(
        (l) =>
          !/^\s*import\s.*json-as/.test(l) && !/^\s*import\s*\{\s*JSON/.test(l),
      )
      .join("\n");
  const body = blocks
    .map((b) => (isDecl(b) ? clean(b) : `{\n${clean(b)}\n}`))
    .join("\n\n");
  const name = file.replace(/[^a-zA-Z0-9]/g, "_");
  const tmp = `${OUT_DIR}/${name}.ts`;
  writeFileSync(tmp, `import { JSON } from "..";\n\n${body}\n`);

  try {
    execSync(
      `JSON_MODE=SIMD npx asc ${tmp} --transform ./transform -o /tmp/doctest.wasm ` +
        `-O0 --runtime incremental --enable simd ` +
        `--config ./node_modules/@assemblyscript/wasi-shim/asconfig.json`,
      { stdio: "pipe" },
    );
    // run it (catches traps); top-level example code executes at start
    execSync(`wasmtime /tmp/doctest.wasm`, { stdio: "pipe" });
    console.log(`PASS  ${file}  (${blocks.length} blocks)`);
  } catch (e) {
    failed++;
    const out = (e.stdout?.toString() || "") + (e.stderr?.toString() || "");
    const errs = out
      .split("\n")
      .filter((l) => /error|ERROR|trap|unreachable|abort/i.test(l))
      .slice(0, 8)
      .join("\n");
    console.log(`FAIL  ${file}\n${errs}\n  (module: ${tmp})`);
  } finally {
    rmSync("/tmp/doctest.wasm", { force: true });
  }
}
rmSync(OUT_DIR, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
