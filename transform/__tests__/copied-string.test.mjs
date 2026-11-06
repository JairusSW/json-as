import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-copy-fusion-"));
const events = new Map();
const control = path.join(dir, "control.mjs");
const url = (p) => new URL(p, `file://${process.cwd()}/`).href;
fs.writeFileSync(
  control,
  `import Transformer from ${JSON.stringify(url("transform/lib/index.js"))};import {SimpleParser}from ${JSON.stringify(url("transform/lib/util.js"))};export default class extends Transformer{afterParse(parser){super.afterParse(parser);const source=parser.sources.find(s=>s.internalPath.endsWith('assembly/util/runtime'));const capability=source.statements.find(n=>n.name?.text==='canAllocateCopiedString');capability.body=SimpleParser.parseTopLevelStatement('function x():bool{return false;}').body;}}`,
);
const rows = [];
for (let n = 0; n < 128; n++) {
  let a = "";
  for (let i = 0; i < n; i++)
    a += String.fromCharCode((n * 277 + i * 1193) & 65535);
  rows.push({ a, b: n % 3 ? a.repeat(2) : null });
}
rows.push({ a: "plain ASCII ".repeat(73), b: '日本語 😀 " \\ \n \u0000' });
const text = JSON.stringify(rows);
const hashes = new Map();
try {
  for (const runtime of ["incremental", "minimal", "stub"])
    for (const trace of runtime === "incremental" ? [false, true] : [false])
      for (const strict of ["false", "true"])
        for (const transform of [control, "./transform"]) {
          const output = path.join(dir, "copy.wasm");
          execFileSync(
            process.execPath,
            [
              "node_modules/assemblyscript/bin/asc.js",
              "assembly/__tests__/copied-string.fixture.ts",
              "--transform",
              transform,
              "-O3",
              "--runtime",
              runtime,
              "--enable",
              "simd",
              "--exportStart",
              "start",
              "--exportRuntime",
              ...(trace ? ["--use", "ASC_RTRACE=1"] : []),
              "-o",
              output,
            ],
            {
              env: {
                ...process.env,
                JSON_MODE: "SIMD",
                JSON_STRICT: strict,
                JSON_USE_FAST_PATH: "1",
                JSON_CACHE: "0",
              },
              stdio: "pipe",
            },
          );
          // Non-incremental binaries must stay byte-identical. The retained-graph
          // stress fixture has an existing Minimal-runtime control failure; its
          // execution is intentionally qualified only under incremental here.
          const bytes = fs.readFileSync(output);
          if (runtime !== "incremental") {
            const hash = createHash("sha256").update(bytes).digest("hex");
            const key = runtime + strict + trace;
            if (transform === control) hashes.set(key, hash);
            else assert.equal(hash, hashes.get(key));
            console.log(runtime, strict, transform, "unchanged binary", hash);
            continue;
          }
          const counts = {};
          const hooks = {};
          for (const name of [
            "oninit",
            "onalloc",
            "onresize",
            "onmove",
            "onfree",
            "onvisit",
            "oncollect",
            "oninterrupt",
            "onyield",
            "onload",
            "onstore",
          ])
            hooks[name] = (...args) => {
              counts[name] = (counts[name] ?? 0) + 1;
              return name === "onvisit" ? 1 : args[0];
            };
          const { instance } = await WebAssembly.instantiate(
            fs.readFileSync(output),
            {
              rtrace: hooks,
              env: {
                abort(m, f, l, c) {
                  throw Error(`${runtime}/${strict}/${transform}: ${l}:${c}`);
                },
              },
            },
          );
          const e = instance.exports;
          e.start();
          assert.equal(e.copyEnabled(), transform === control ? 0 : 1);
          const ptr = e.__pin(e.__new(text.length * 2, e.stringId()));
          const words = new Uint16Array(e.memory.buffer, ptr, text.length);
          for (let i = 0; i < text.length; i++) words[i] = text.charCodeAt(i);
          const out = e.__pin(e.verify(ptr, runtime === "incremental" ? 1 : 0));
          const length = new DataView(e.memory.buffer).getUint32(out - 4, true);
          const data = Buffer.from(e.memory.buffer, out, length).toString(
            "utf16le",
          );
          assert.deepEqual(JSON.parse(data), rows);
          e.__unpin(out);
          e.__unpin(ptr);
          if (transform === control) events.set(strict + trace, counts);
          else assert.deepEqual(counts, events.get(strict + trace));
          console.log(
            runtime,
            strict,
            trace,
            transform,
            "UTF16/retained strings and matching trace events passed",
            JSON.stringify(counts),
          );
        }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
