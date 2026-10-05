import assert from "node:assert/strict";
import { keyDispatch } from "../lib/key-dispatch.js";

const candidates = (tree, key) => {
  let depth = 0;
  while (!("members" in tree)) {
    depth++;
    tree = key.charCodeAt(tree.offset) < tree.pivot ? tree.left : tree.right;
  }
  return { members: tree.members, depth };
};

for (const size of [0, 1, 8, 9, 16, 64, 256, 1024, 4096]) {
  const members = Array.from({ length: size }, (_, i) => ({
    key: `field${i.toString().padStart(5, "0")}`,
    i,
  })).reverse();
  const tree = keyDispatch(members, (m) => m.key);
  if (size <= 8) assert.equal(tree.members, members);
  for (const member of members) {
    const result = candidates(tree, member.key);
    assert.ok(result.members.includes(member));
    assert.ok(result.members.length <= 8);
    assert.deepEqual(
      result.members.map((m) => m.i),
      [...result.members.map((m) => m.i)].sort((a, b) => b - a),
    );
    assert.ok(result.depth <= 16 * member.key.length);
  }
  assert.deepEqual(
    members.map((m) => m.i),
    Array.from({ length: size }, (_, i) => size - i - 1),
  );
}

// Preserve stable declaration order when aliases coincide, including groups
// which cannot be narrowed to eight candidates without changing semantics.
const duplicate = Array.from({ length: 20 }, (_, i) => ({ key: "same", i }));
const mixed = [
  ...duplicate,
  ...Array.from({ length: 20 }, (_, i) => ({
    key: `k${i.toString().padStart(3, "0")}`,
    i,
  })),
];
assert.deepEqual(
  candidates(
    keyDispatch(mixed, (m) => m.key),
    "same",
  ).members,
  duplicate,
);

// UTF-16 ordering is unsigned and deterministic, including lone surrogates.
const unicode = [
  0, 1, 34, 92, 255, 256, 0x7fff, 0x8000, 0xd800, 0xdc00, 0xffff,
].map((n) => `a${String.fromCharCode(n)}z`);
const unicodeTree = keyDispatch(unicode, (key) => key);
for (let code = 0; code <= 0xffff; code++) {
  const key = `a${String.fromCharCode(code)}z`;
  const match = candidates(unicodeTree, key).members.find(
    (member) => member === key,
  );
  assert.equal(
    match,
    unicode.find((member) => member === key),
  );
}

// Highly skewed prefixes must advance either the code-unit range or offset.
const skewed = Array.from(
  { length: 128 },
  (_, i) => "a".repeat(i) + "z" + "a".repeat(127 - i),
);
const skewedTree = keyDispatch(skewed, (key) => key);
for (const key of skewed)
  assert.ok(candidates(skewedTree, key).members.includes(key));
console.log("Key dispatch tests passed");
