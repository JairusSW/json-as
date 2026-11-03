import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-f32-"));
// Exact integer arithmetic: no binary64 parsing or Math.fround oracle.
function binary(bits) {
  if (bits === 0x7f800000) return [1n, 128];
  const exponent = bits >>> 23;
  return [
    BigInt((bits & 0x7fffff) + (exponent ? 0x800000 : 0)),
    exponent ? exponent - 150 : -149,
  ];
}
function decimal(n, scale) {
  const digits = n.toString().padStart(scale + 1, "0");
  return scale ? digits.slice(0, -scale) + "." + digits.slice(-scale) : digits;
}
const intervals = [
  0, 1, 0x7ffffe, 0x7fffff, 0x800000, 0x3f7fffff, 0x3f800000, 0x3f800001,
  0x7f7ffffe, 0x7f7fffff,
];
let state = 0x12345678;
for (let i = 0; i < 16; i++) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  intervals.push(state % 0x7f7fffff);
}
const cases = [];
for (const bits of intervals) {
  const [a, ae] = binary(bits),
    [b, be] = binary(bits + 1),
    e = Math.min(ae, be) - 1;
  let n = (a << BigInt(ae - e - 1)) + (b << BigInt(be - e - 1)),
    scale = 0;
  if (e < 0) {
    n *= 5n ** BigInt(-e);
    scale = -e;
  } else n <<= BigInt(e);
  for (const delta of [-1n, 0n, 1n]) {
    const value = n * 10n ** 20n + delta,
      s = scale + 20;
    const expected =
      delta < 0n ? bits : delta > 0n ? bits + 1 : bits & 1 ? bits + 1 : bits;
    for (const negative of [false, true])
      for (const text of [decimal(value, s), value.toString() + "e-" + s])
        cases.push({
          text: (negative ? "-" : "") + text,
          bits: (expected | (negative ? 0x80000000 : 0)) >>> 0,
        });
  }
}
let checks = 0;
try {
  for (const strict of [false, true])
    for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
      const file = path.join(directory, `${mode}-${strict}.wasm`);
      execFileSync(
        process.execPath,
        [
          path.join(root, "node_modules/assemblyscript/bin/asc.js"),
          "assembly/__tests__/float32-midpoints.fixture.ts",
          "--transform",
          "./transform",
          "--exportRuntime",
          "-O3",
          "-o",
          file,
          ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            JSON_MODE: mode,
            JSON_STRICT: String(strict),
            JSON_AS_LIBRARY_SOURCE: "assembly/index",
          },
          stdio: "pipe",
        },
      );
      const { instance } = await WebAssembly.instantiate(
        fs.readFileSync(file),
        {
          env: {
            abort(_m, _f, l, c) {
              throw new Error(`${mode}/${strict} abort ${l}:${c}`);
            },
          },
        },
      );
      const exports = instance.exports;
      for (const entry of cases) {
        const ptr = exports.__new(
          entry.text.length * 2,
          exports.stringId.value,
        );
        new Uint16Array(exports.memory.buffer, ptr, entry.text.length).set(
          [...entry.text].map((c) => c.charCodeAt(0)),
        );
        for (const [name, args] of [
          ["root", [ptr]],
          ["field", [ptr, 0]],
          ["field", [ptr, 1]],
          ["array", [ptr]],
        ]) {
          assert.equal(
            exports[name](...args) >>> 0,
            entry.bits,
            `${mode}/${strict}/${name}: ${entry.text}`,
          );
          checks++;
        }
      }
    }
  console.log(
    `Exact f32 midpoint oracle: ${checks} root/field/reuse/array checks passed`,
  );
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
