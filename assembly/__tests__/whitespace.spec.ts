import { JSON } from "..";
import { describe, expect } from "as-test";
import { Vec3 } from "./types";


@json
class WhitespaceBox<T> {
  value!: T;
}

function expectWhitespaceMatrix<T>(
  single: string,
  array: string,
  object: string,
  singleExpected: string,
  arrayExpected: string,
  objectExpected: string,
): void {
  expect(JSON.stringify(JSON.parse<T>(single))).toBe(singleExpected);
  expect(JSON.stringify(JSON.parse<T[]>(array))).toBe(arrayExpected);
  expect(JSON.stringify(JSON.parse<WhitespaceBox<T>>(object))).toBe(
    objectExpected,
  );
}

describe("Should deserialize primitive types with whitespace in arrays and object fields", () => {
  expectWhitespaceMatrix<string>(
    '"line\\nbreak"',
    '[ "line\\nbreak" , "tab\\tvalue" ]',
    '{ "value" : "line\\nbreak" }',
    '"line\\nbreak"',
    '["line\\nbreak","tab\\tvalue"]',
    '{"value":"line\\nbreak"}',
  );

  expectWhitespaceMatrix<i32>(
    "-42",
    "[ -42 , 0 , 7 ]",
    '{ "value" : -42 }',
    "-42",
    "[-42,0,7]",
    '{"value":-42}',
  );

  expectWhitespaceMatrix<bool>(
    "true",
    "[ true , false , true ]",
    '{ "value" : false }',
    "true",
    "[true,false,true]",
    '{"value":false}',
  );

  expectWhitespaceMatrix<f64>(
    "-3.125",
    "[ 1.5 , -2.25 , 3.125 ]",
    '{ "value" : -3.125 }',
    "-3.125",
    "[1.5,-2.25,3.125]",
    '{"value":-3.125}',
  );
});

describe("Should deserialize object-like types with aggressive whitespace", () => {
  expectWhitespaceMatrix<Vec3>(
    '{"x":1.25,"y":-2.5,"z":3.75}',
    '[ { "x" : 1.25 , "y" : -2.5 , "z" : 3.75 } , { "x" : 4.5 , "y" : 5.5 , "z" : 6.5 } ]',
    '{ "value" : { "x" : 1.25 , "y" : -2.5 , "z" : 3.75 } }',
    '{"x":1.25,"y":-2.5,"z":3.75}',
    '[{"x":1.25,"y":-2.5,"z":3.75},{"x":4.5,"y":5.5,"z":6.5}]',
    '{"value":{"x":1.25,"y":-2.5,"z":3.75}}',
  );

  expect(JSON.parse<JSON.Raw>('{"x":1,"y":[true,false]}').toString()).toBe(
    '{"x":1,"y":[true,false]}',
  );
  const rawArray = JSON.parse<JSON.Raw[]>(
    '[ {"x":1} , [ true , false ] , false ]',
  );
  expect(rawArray.length.toString()).toBe("3");
  expect(rawArray[0].toString().includes('"x":1').toString()).toBe("true");
  expect(rawArray[1].toString()).toBe("[ true , false ]");
  expect(rawArray[2].toString()).toBe("false");
  expect(
    JSON.parse<WhitespaceBox<JSON.Raw>>(
      '{ "value" : { "x" : 1 , "y" : [ true , false ] } }',
    ).value.toString(),
  ).toBe('{ "x" : 1 , "y" : [ true , false ] }');

  expect(JSON.stringify(JSON.parse<Date>('"2025-02-03T21:28:40.525Z"'))).toBe(
    '"2025-02-03T21:28:40.525Z"',
  );

  expect(
    JSON.stringify(JSON.parse<Map<string, i32>>('{ "a" : 1 , "b" : 2 }')),
  ).toBe('{"a":1,"b":2}');
  expect(
    JSON.stringify(
      JSON.parse<WhitespaceBox<Map<string, i32>>>(
        '{ "value" : { "a" : 1 , "b" : 2 } }',
      ),
    ),
  ).toBe('{"value":{"a":1,"b":2}}');

  expect(JSON.stringify(JSON.parse<Set<bool>>("[ true , false , true ]"))).toBe(
    "[true,false]",
  );
});

describe("Should deserialize array-like types with whitespace in values and object fields", () => {
  expect(JSON.stringify(JSON.parse<i32[]>("[ 1 , 2 , 3 , 4 ]"))).toBe(
    "[1,2,3,4]",
  );
  expect(
    JSON.stringify(
      JSON.parse<WhitespaceBox<i32[]>>('{ "value" : [ 1 , 2 , 3 , 4 ] }'),
    ),
  ).toBe('{"value":[1,2,3,4]}');

  expect(JSON.stringify(JSON.parse<string[]>('[ "a" , "b" , "c" ]'))).toBe(
    '["a","b","c"]',
  );
  expect(
    JSON.stringify(
      JSON.parse<WhitespaceBox<string[]>>('{ "value" : [ "a" , "b" , "c" ] }'),
    ),
  ).toBe('{"value":["a","b","c"]}');

  expect(
    JSON.stringify(
      JSON.parse<Vec3[]>(
        '[ { "x" : 1 , "y" : 2 , "z" : 3 } , { "x" : 4 , "y" : 5 , "z" : 6 } ]',
      ),
    ),
  ).toBe('[{"x":1.0,"y":2.0,"z":3.0},{"x":4.0,"y":5.0,"z":6.0}]');
  expect(
    JSON.stringify(
      JSON.parse<WhitespaceBox<Vec3[]>>(
        '{ "value" : [ { "x" : 1 , "y" : 2 , "z" : 3 } , { "x" : 4 , "y" : 5 , "z" : 6 } ] }',
      ),
    ),
  ).toBe('{"value":[{"x":1.0,"y":2.0,"z":3.0},{"x":4.0,"y":5.0,"z":6.0}]}');
});

describe("Should preserve escaped backslashes and quotes inside whitespace-heavy nested values", () => {
  const parsedObject = JSON.parse<Map<string, string>>(
    '{ "msg" : "path \\\\\\\\ and quote \\\\\\"" }',
  );
  const parsedArray = JSON.parse<string[]>(
    '[ "path \\\\\\\\ and quote \\\\\\"" ]',
  );
  const parsedBox = JSON.parse<WhitespaceBox<string>>(
    '{ "value" : "path \\\\\\\\ and quote \\\\\\"" }',
  );

  expect(parsedObject.get("msg")).toBe('path \\\\ and quote \\"');
  expect(parsedArray[0]).toBe('path \\\\ and quote \\"');
  expect(parsedBox.value).toBe('path \\\\ and quote \\"');
  expect(JSON.stringify(parsedObject)).toBe(
    '{"msg":"path \\\\\\\\ and quote \\\\\\""}',
  );
  expect(JSON.stringify(parsedArray)).toBe(
    '["path \\\\\\\\ and quote \\\\\\""]',
  );
  expect(JSON.stringify(parsedBox)).toBe(
    '{"value":"path \\\\\\\\ and quote \\\\\\""}',
  );
});

// Concrete (non-generic, static) classes get the transform's
// `__DESERIALIZE_FAST` path. Minified input takes tier 1 (exact byte
// template); pretty/whitespace-padded input takes tier 2 (whitespace-tolerant
// fast path). These specs exercise tier 2 directly — the generic
// `WhitespaceBox<T>` cases above can't, since type parameters disable the fast
// path and route everything through the naive scalar deserializer.
@json
class WsPoint {
  x: f64 = 0;
  y: f64 = 0;
}


@json
class WsGeo {
  type: string = "";
  coordinates: f64[][] = [];
}


@json
class WsFeature {
  id: i32 = 0;
  name: string = "";
  point: WsPoint = new WsPoint();
  geo: WsGeo = new WsGeo();
  tags: string[] = [];
}

describe("Should fast-path concrete structs with pretty/whitespace input (tier 2)", () => {
  // Deep float arrays via the field array path (canada's shape).
  const geoMin = '{"type":"Polygon","coordinates":[[1.5,2.5],[3.5,4.5]]}';
  const geoPretty =
    '{\n  "type": "Polygon",\n  "coordinates": [\n    [1.5, 2.5],\n    [3.5, 4.5]\n  ]\n}\n';
  expect(JSON.stringify(JSON.parse<WsGeo>(geoMin))).toBe(geoMin);
  expect(JSON.stringify(JSON.parse<WsGeo>(geoPretty))).toBe(geoMin);
  // Leading + trailing whitespace must not knock it off the fast path.
  expect(JSON.stringify(JSON.parse<WsGeo>("  \n\t" + geoPretty + "\n  "))).toBe(
    geoMin,
  );

  // Nested objects, an i32, a string, an array of strings, and an array of
  // floats — every tier-2 field shape in one struct.
  const featMin =
    '{"id":7,"name":"alpha","point":{"x":1.25,"y":-2.5},"geo":{"type":"Point","coordinates":[[0.5,1.5]]},"tags":["a","b","c"]}';
  const featPretty =
    '{\n  "id": 7,\n  "name": "alpha",\n  "point": { "x": 1.25, "y": -2.5 },\n  "geo": {\n    "type": "Point",\n    "coordinates": [ [ 0.5, 1.5 ] ]\n  },\n  "tags": [ "a", "b", "c" ]\n}\n';
  expect(JSON.stringify(JSON.parse<WsFeature>(featMin))).toBe(featMin);
  expect(JSON.stringify(JSON.parse<WsFeature>(featPretty))).toBe(featMin);

  // Array of concrete objects (the tier-2 inline object-array loop).
  const arrMin = '[{"x":1.25,"y":-2.5},{"x":4.5,"y":5.5}]';
  const arrPretty =
    '[\n  { "x": 1.25, "y": -2.5 },\n  { "x": 4.5, "y": 5.5 }\n]\n';
  expect(JSON.stringify(JSON.parse<WsPoint[]>(arrMin))).toBe(arrMin);
  expect(JSON.stringify(JSON.parse<WsPoint[]>(arrPretty))).toBe(arrMin);

  // Empty arrays under pretty whitespace.
  expect(
    JSON.stringify(JSON.parse<WsGeo>('{ "type": "x", "coordinates": [ ] }')),
  ).toBe('{"type":"x","coordinates":[]}');
});

// Optional-field structs (@omitnull) use tier-2's probe-and-commit variant:
// fields may be omitted, and present fields are still matched in canonical
// order. Declaring the optionals first makes canonical order == declaration
// order, so these pretty inputs are canonical (and thus reach tier 2, not slow).
@json
class WsOpt {

  @omitnull name: string | null = null;


  @omitnull nums: i32[] | null = null;
  id: i32 = 0;
  active: boolean = false;
}

describe("Should fast-path optional-field structs with pretty/omitted input (tier 2 probe)", () => {
  // All fields present.
  const allMin = '{"name":"neo","nums":[1,2,3],"id":7,"active":true}';
  expect(JSON.stringify(JSON.parse<WsOpt>(allMin))).toBe(allMin);
  expect(
    JSON.stringify(
      JSON.parse<WsOpt>(
        '{\n  "name": "neo",\n  "nums": [ 1, 2, 3 ],\n  "id": 7,\n  "active": true\n}\n',
      ),
    ),
  ).toBe(allMin);

  // Both optionals omitted — only the required fields remain.
  const noneMin = '{"id":9,"active":false}';
  expect(JSON.stringify(JSON.parse<WsOpt>(noneMin))).toBe(noneMin);
  expect(
    JSON.stringify(JSON.parse<WsOpt>('{\n  "id": 9,\n  "active": false\n}\n')),
  ).toBe(noneMin);

  // First optional present, second omitted.
  const oneMin = '{"name":"ax","id":3,"active":true}';
  expect(JSON.stringify(JSON.parse<WsOpt>(oneMin))).toBe(oneMin);
  expect(
    JSON.stringify(
      JSON.parse<WsOpt>(
        '{\n  "name": "ax",\n  "id": 3,\n  "active": true\n}\n',
      ),
    ),
  ).toBe(oneMin);

  // Second optional present, first omitted.
  const otherMin = '{"nums":[4,5],"id":1,"active":false}';
  expect(JSON.stringify(JSON.parse<WsOpt>(otherMin))).toBe(otherMin);
  expect(
    JSON.stringify(
      JSON.parse<WsOpt>(
        '{\n  "nums": [ 4, 5 ],\n  "id": 1,\n  "active": false\n}\n',
      ),
    ),
  ).toBe(otherMin);
});

// The entry point (JSON.parse / JSON.__deserialize) skips LEADING whitespace, so
// every type works with leading whitespace at the top level — handlers assume a
// non-whitespace start and never re-skip it themselves.
describe("Should skip leading whitespace at the top level for every type", () => {
  expect(JSON.parse<i32>("   42")).toBe(42);
  expect(JSON.parse<u32>("\t\n 7")).toBe(7);
  expect(JSON.parse<f64>("  -3.5").toString()).toBe("-3.5");
  expect(JSON.parse<bool>("  true")).toBe(true);
  expect(JSON.stringify(JSON.parse<string>('   "hi"'))).toBe('"hi"');
  expect(JSON.stringify(JSON.parse<i32[]>("  [ 1 , 2 , 3 ]"))).toBe("[1,2,3]");
  expect(JSON.stringify(JSON.parse<string[]>('\n\t ["a","b"]'))).toBe(
    '["a","b"]',
  );
});

// A concrete (fast-path) struct touching EVERY field-handler family: scalar,
// string, nested object, primitive array, object array, string array, Map field,
// Set field. Parsed from heavily-whitespaced (leading + internal + trailing)
// input, it must round-trip identically to the canonical minified form — this is
// what exercises the field-path internal whitespace skips end to end.
@json
class WsKid {
  n: i32 = 0;
}


@json
class WsCombo {
  id: i32 = 0;
  name: string = "";
  kid: WsKid = new WsKid();
  nums: i32[] = [];
  kids: WsKid[] = [];
  tags: string[] = [];
  meta: Map<string, i32> = new Map<string, i32>();
  flags: Set<i32> = new Set<i32>();
}

describe("Should handle whitespace across every field handler in one concrete struct", () => {
  const o = new WsCombo();
  o.id = 7;
  o.name = "x";
  o.kid.n = 3;
  o.nums = [1, 2, 3];
  const k1 = new WsKid();
  k1.n = 10;
  const k2 = new WsKid();
  k2.n = 20;
  o.kids = [k1, k2];
  o.tags = ["a", "b"];
  o.meta.set("p", 1);
  o.meta.set("q", 2);
  o.flags.add(5);
  o.flags.add(6);
  const min = JSON.stringify(o);

  // Sanity: the minified canonical round-trips (tier 1 / exact).
  expect(JSON.stringify(JSON.parse<WsCombo>(min))).toBe(min);

  // Heavily whitespaced, canonical key order, leading + internal + trailing ws.
  const pretty = `   {
  "id" : 7 ,
  "name" : "x" ,
  "kid" : { "n" : 3 } ,
  "nums" : [ 1 , 2 , 3 ] ,
  "kids" : [ { "n" : 10 } , { "n" : 20 } ] ,
  "tags" : [ "a" , "b" ] ,
  "meta" : { "p" : 1 , "q" : 2 } ,
  "flags" : [ 5 , 6 ]
}  `;
  expect(JSON.stringify(JSON.parse<WsCombo>(pretty))).toBe(min);
});
