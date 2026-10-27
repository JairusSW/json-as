import { JSON } from "..";
import { describe, expect } from "as-test";

// Materialize strings so repeated serialization exercises escape classification,
// rather than passing an untouched lazy source slice through verbatim.
function rt(json: string): string {
  const v = JSON.parse<JSON.Value>(json);
  v.get<string>();
  JSON.stringify(v);
  return JSON.stringify(v);
}

describe("JSON.Value string serialize: clean memcpy + escaping", () => {
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

describe("JSON.Obj/Arr string slots across re-serialize", () => {
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

// All wrappers below retain the same managed string. The public output-reuse
// API overwrites it without replacing their handles or changing its length.
function checkAliasedOutput(source: string): void {
  const encoded = JSON.stringify<string>(source);
  const shared = JSON.parse<string>('"' + "a".repeat(encoded.length) + '"');
  const value = JSON.Value.from(shared);
  const otherValue = JSON.Value.from(shared);
  const obj = new JSON.Obj();
  obj.set<string>("value", shared);
  const arr = new JSON.Arr();
  arr.push<string>(shared);

  const clean = JSON.stringify<string>(shared);
  expect(JSON.stringify(value)).toBe(clean);
  expect(JSON.stringify(otherValue)).toBe(clean);
  expect(JSON.stringify(obj)).toBe('{"value":' + clean + "}");
  expect(JSON.stringify(arr)).toBe("[" + clean + "]");

  const out = JSON.stringify<string>(source, shared);
  expect(changetype<usize>(out)).toBe(changetype<usize>(shared));
  expect(shared).toBe(encoded);
  const escaped = JSON.stringify<string>(encoded);
  expect(JSON.stringify(JSON.Value.from(shared))).toBe(escaped);
  for (let i = 0; i < 3; i++) {
    expect(JSON.stringify(value)).toBe(escaped);
    expect(JSON.stringify(otherValue)).toBe(escaped);
    expect(JSON.stringify(obj)).toBe('{"value":' + escaped + "}");
    expect(JSON.stringify(arr)).toBe("[" + escaped + "]");
  }
}

describe("Dynamic strings reclassify after same-size output reuse through aliases", () => {
  checkAliasedOutput("bb");
  checkAliasedOutput("a\\b");
  checkAliasedOutput("line\nbreak");
  checkAliasedOutput("é 中文 😀");
});

describe("Materialized dynamic strings reclassify after output reuse", () => {
  const value = JSON.parse<JSON.Value>('"aaaa"');
  const valueString = value.get<string>();
  expect(JSON.stringify(value)).toBe('"aaaa"');
  expect(changetype<usize>(JSON.stringify<string>("bb", valueString))).toBe(
    changetype<usize>(valueString),
  );
  expect(JSON.stringify(value)).toBe('"\\"bb\\""');

  const obj = JSON.parse<JSON.Obj>('{"value":"aaaa"}');
  const objString = obj.getAs<string>("value");
  expect(JSON.stringify(obj)).toBe('{"value":"aaaa"}');
  expect(changetype<usize>(JSON.stringify<string>("bb", objString))).toBe(
    changetype<usize>(objString),
  );
  expect(JSON.stringify(obj)).toBe('{"value":"\\"bb\\""}');

  const arr = JSON.parse<JSON.Arr>('["aaaa"]');
  const arrString = arr.getAs<string>(0);
  expect(JSON.stringify(arr)).toBe('["aaaa"]');
  expect(changetype<usize>(JSON.stringify<string>("bb", arrString))).toBe(
    changetype<usize>(arrString),
  );
  expect(JSON.stringify(arr)).toBe('["\\"bb\\""]');
});
