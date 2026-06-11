import { JSON } from "..";
import { describe, expect } from "as-test";

// Round-trip strings through the dynamic JSON.Value path (which now caches an
// escape class + uses a memcpy fast path for clean strings). Each must be
// byte-exact, and serializing twice must be stable (exercises the cached class).
function rt(json: string): string {
  const v = JSON.parse<JSON.Value>(json);
  JSON.stringify(v); // first serialize: classifies + caches
  return JSON.stringify(v); // second: uses cached class (clean -> memcpy)
}

describe("JSON.Value string serialize: clean memcpy + escape classes", () => {
  expect(rt('"hello world"')).toBe('"hello world"'); // clean
  expect(rt('""')).toBe('""'); // empty clean
  expect(rt('"café 中文"')).toBe('"café 中文"'); // clean non-ASCII BMP
  expect(rt('"a\\"b"')).toBe('"a\\"b"'); // embedded quote -> escape
  expect(rt('"a\\\\b"')).toBe('"a\\\\b"'); // backslash -> escape
  expect(rt('"line\\nbreak"')).toBe('"line\\nbreak"'); // control (\n) -> escape
  expect(rt('"tab\\there"')).toBe('"tab\\there"'); // control (\t) -> escape
  expect(rt('"\\u0001ctrl"')).toBe('"\\u0001ctrl"'); //  control -> escape
  expect(rt('"emoji 😀 x"')).toBe('"emoji 😀 x"'); // surrogate pair
  // A clean value re-serialized many times stays correct.
  const v = JSON.parse<JSON.Value>('"repeat me"');
  for (let i = 0; i < 5; i++) expect(JSON.stringify(v)).toBe('"repeat me"');
});

describe("JSON.Obj/Arr string slot escape-class caches across re-serialize", () => {
  // Object with clean + escape-needing string values; materialize every value,
  // then re-serialize several times - output must stay byte-exact every time.
  const src =
    '{"a":"clean value","b":"with \\"quote\\"","c":"tab\\there","d":"emoji 😀"}';
  const o = JSON.parse<JSON.Obj>(src);
  o.getAs<string>("a");
  o.getAs<string>("b");
  o.getAs<string>("c");
  o.getAs<string>("d");
  for (let i = 0; i < 4; i++) expect(JSON.stringify(o)).toBe(src);

  // Array of strings, same idea.
  const asrc = '["alpha","be\\nta","gamma 中文","de\\\\lta"]';
  const arr = JSON.parse<JSON.Arr>(asrc);
  for (let i = 0; i < 4; i++) arr.getAs<string>(i);
  for (let i = 0; i < 3; i++) expect(JSON.stringify(arr)).toBe(asrc);

  // Untouched (still-lazy) slots keep passing through verbatim.
  expect(JSON.stringify(JSON.parse<JSON.Obj>(src))).toBe(src);
});
