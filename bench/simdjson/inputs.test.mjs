import test from "node:test";
import assert from "node:assert/strict";
import { rotateText } from "./inputs.mjs";

test("rotation preserves keys, escaped text, and exact numeric tokens", () => {
  const input = '{"1234":"value\\ntext","n":9007199254740993,"e":1.2300e-12}';
  assert.equal(
    rotateText(input, 1),
    '{"1234":"vblue\\ntext","n":9007199254740993,"e":1.2300e-12}',
  );
  assert.equal(
    rotateText(input, 1, true),
    '{"1234":"vbblue\\ntext","n":9007199254740993,"e":1.2300e-12}',
  );
});
test("validation rotations change values and lengths without changing keys", () => {
  const input = '{"key":"abcdef","n":-1234}';
  const variants = Array.from({ length: 4 }, (_, i) =>
    rotateText(input, i, true),
  );
  assert.equal(new Set(variants.map((s) => s.length)).size, 4);
  assert.equal(new Set(variants.map((s) => JSON.parse(s).key)).size, 4);
  for (const s of variants) {
    const value = JSON.parse(s);
    assert.equal(value.n, -1234);
    assert.deepEqual(Object.keys(value), ["key", "n"]);
  }
});
test("escaped-only and numeric-only documents retain safe changing layouts", () => {
  for (const text of ["[1234,5678]", '{"x":"\\u0031\\n"}']) {
    const variants = Array.from({ length: 4 }, (_, i) =>
      rotateText(text, i, true),
    );
    assert.equal(new Set(variants).size, 4);
    for (const s of variants) assert.deepEqual(JSON.parse(s), JSON.parse(text));
  }
});
