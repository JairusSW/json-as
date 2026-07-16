import { JSON } from "..";
import { describe, expect } from "as-test";
import { Vec3 } from "./types";

class PlainBytes extends Uint8Array {
  constructor(length: i32 = 0) {
    super(length);
  }
}

function hexDigit(value: u8): string {
  return String.fromCharCode(value < 10 ? 48 + value : 87 + value);
}

function parseHexNibble(code: u16): u8 {
  if (code >= 48 && code <= 57) return <u8>(code - 48);
  if (code >= 97 && code <= 102) return <u8>(code - 87);
  return <u8>(code - 55);
}


@json
class HexBytes extends Uint8Array {
  constructor(length: i32 = 0) {
    super(length);
  }


  @serializer("string")
  serializer(self: HexBytes): string {
    let out = "";
    for (let i = 0; i < self.length; i++) {
      const value = unchecked(self[i]);
      out += hexDigit(value >> 4);
      out += hexDigit(value & 0x0f);
    }
    return JSON.stringify(out);
  }


  @deserializer("string")
  deserializer(data: string): HexBytes {
    const raw = JSON.parse<string>(data);
    const out = new HexBytes(raw.length >> 1);
    for (let i = 0, j = 0; i < raw.length; i += 2, j++) {
      const hi = parseHexNibble(<u16>raw.charCodeAt(i));
      const lo = parseHexNibble(<u16>raw.charCodeAt(i + 1));
      unchecked((out[j] = <u8>((hi << 4) | lo)));
    }
    return out;
  }
}

describe("Should serialize arbitrary types", () => {
  const typed = new Uint8Array(3);
  typed[0] = 1;
  typed[1] = 2;
  typed[2] = 3;

  expect(JSON.stringify(JSON.Value.from("hello world"))).toBe('"hello world"');
  expect(JSON.stringify(JSON.Value.from(0))).toBe("0");
  expect(JSON.stringify(JSON.Value.from(true))).toBe("true");
  expect(JSON.stringify(JSON.Value.from(typed))).toBe("[1,2,3]");
  expect(JSON.stringify(JSON.Value.from(typed.buffer))).toBe("[1,2,3]");
  expect(JSON.stringify(JSON.Value.from(new Vec3()))).toBe(
    '{"x":1,"y":2,"z":3}',
  );
  expect(
    JSON.stringify([
      JSON.Value.from("string"),
      JSON.Value.from(true),
      JSON.Value.from(3.14),
      JSON.Value.from(new Vec3()),
    ]),
  ).toBe('["string",true,3.14,{"x":1,"y":2,"z":3}]');

  const o = new JSON.Obj();
  o.set("schema", "http://json-schema.org/draft-07/schema#");
  o.set("additionalProperties", false);
  o.set("properties", new JSON.Obj());
  o.get("properties")!.as<JSON.Obj>().set("duration", new JSON.Obj());
  o.get("properties")!
    .as<JSON.Obj>()
    .get("duration")!
    .as<JSON.Obj>()
    .set("default", 10.0);
  o.get("properties")!
    .as<JSON.Obj>()
    .get("duration")!
    .as<JSON.Obj>()
    .set("description", "Duration of the operation in seconds");
  o.get("properties")!
    .as<JSON.Obj>()
    .get("duration")!
    .as<JSON.Obj>()
    .set("type", "number");
  o.get("properties")!.as<JSON.Obj>().set("steps", new JSON.Obj());
  o.get("properties")!
    .as<JSON.Obj>()
    .get("steps")!
    .as<JSON.Obj>()
    .set("default", 5.0);
  o.get("properties")!
    .as<JSON.Obj>()
    .get("steps")!
    .as<JSON.Obj>()
    .set("description", "Number of steps in the operation");
  o.get("properties")!
    .as<JSON.Obj>()
    .get("steps")!
    .as<JSON.Obj>()
    .set("type", "number");
  o.set("type", "object");

  expect(o.toString()).toBe(
    '{"schema":"http://json-schema.org/draft-07/schema#","additionalProperties":false,"properties":{"duration":{"default":10,"description":"Duration of the operation in seconds","type":"number"},"steps":{"default":5,"description":"Number of steps in the operation","type":"number"}},"type":"object"}',
  );

  expect(JSON.stringify(JSON.Value.from<JSON.Box<i32> | null>(null))).toBe(
    "null",
  );
  expect(
    JSON.stringify(JSON.Value.from<JSON.Box<i32> | null>(JSON.Box.from(123))),
  ).toBe("123");
});

describe("Should keep built-in behavior for undecorated typed-array subclasses in JSON.Value", () => {
  const bytes = new PlainBytes(4);
  bytes[0] = 10;
  bytes[1] = 20;
  bytes[2] = 30;
  bytes[3] = 40;
  expect(JSON.stringify(JSON.Value.from(bytes))).toBe("[10,20,30,40]");
});

describe("Should keep built-in behavior for ArrayBuffer in JSON.Value and JSON.Obj", () => {
  const buffer = new ArrayBuffer(4);
  const view = Uint8Array.wrap(buffer);
  view[0] = 10;
  view[1] = 20;
  view[2] = 30;
  view[3] = 40;

  expect(JSON.stringify(JSON.Value.from(buffer))).toBe("[10,20,30,40]");

  const obj = new JSON.Obj();
  obj.set("raw", buffer);
  expect(JSON.stringify(obj)).toBe('{"raw":[10,20,30,40]}');
});

describe("Should use custom behavior for decorated typed-array subclasses in JSON.Value", () => {
  const bytes = new HexBytes(4);
  bytes[0] = 10;
  bytes[1] = 20;
  bytes[2] = 30;
  bytes[3] = 40;
  expect(JSON.stringify(JSON.Value.from(bytes))).toBe('"0a141e28"');
});

describe("Should deserialize arbitrary types", () => {
  expect(JSON.parse<JSON.Value>('"hello world"').get<string>()).toBe(
    "hello world",
  );
  expect(JSON.parse<JSON.Value>("0.0").toString()).toBe("0.0");
  expect(JSON.parse<JSON.Value>("true").toString()).toBe("true");
  expect(JSON.stringify(JSON.parse<JSON.Value>('{"x":1,"y":2,"z":3}'))).toBe(
    '{"x":1,"y":2,"z":3}',
  );
  // JSON.Obj/JSON.Value are lazy by default: a nested composite that is never
  // accessed is re-emitted from its original source bytes verbatim (no
  // re-encoding), so `[1.0,2.0,...]` passes through unchanged rather than being
  // canonicalized to `[1,2,...]`.
  expect(
    JSON.stringify(
      JSON.parse<JSON.Value[]>(
        '["string",true,3.14,{"x":1,"y":2,"z":3},[1.0,2.0,3,true]]',
      ),
    ),
  ).toBe('["string",true,3.14,{"x":1,"y":2,"z":3},[1.0,2.0,3,true]]');

  let x = JSON.Box.fromValue<i32>(JSON.parse<JSON.Value>("null"));
  expect(x ? x.toString() : "null").toBe("null");
  x = JSON.Box.fromValue<i32>(JSON.parse<JSON.Value>("123"));
  expect(x ? x.toString() : "null").toBe("123");
});

describe("Should deserialize nested arbitrary arrays with element access", () => {
  const parsed = JSON.parse<JSON.Value>("[[1,2],[3,4]]");
  const outer = parsed.get<JSON.Arr>();

  expect(outer.length).toBe(2);

  const inner0 = outer.at(0).get<JSON.Arr>();
  const inner1 = outer.at(1).get<JSON.Arr>();

  expect(inner0.length).toBe(2);
  expect(inner1.length).toBe(2);

  expect(inner0.at(0).get<f64>()).toBe(1.0);
  expect(inner0.at(1).get<f64>()).toBe(2.0);

  expect(inner1.at(0).get<f64>()).toBe(3.0);
  expect(inner1.at(1).get<f64>()).toBe(4.0);

  expect(JSON.stringify(parsed)).toBe("[[1,2],[3,4]]");
});

describe("Should deserialize nested arrays in mixed arbitrary arrays", () => {
  const parsed = JSON.parse<JSON.Value[]>('["string",true,[1,2,3,4]]');

  expect(parsed.length).toBe(3);
  expect(parsed[0].get<string>()).toBe("string");
  expect(parsed[1].toString()).toBe("true");

  const nestedArr = parsed[2].get<JSON.Arr>();
  expect(nestedArr.length).toBe(4);
  expect(nestedArr.at(0).get<f64>()).toBe(1.0);
  expect(nestedArr.at(1).get<f64>()).toBe(2.0);
  expect(nestedArr.at(2).get<f64>()).toBe(3.0);
  expect(nestedArr.at(3).get<f64>()).toBe(4.0);

  expect(JSON.stringify(parsed)).toBe('["string",true,[1,2,3,4]]');
});

describe("Should deserialize deeply nested arbitrary arrays", () => {
  const parsed = JSON.parse<JSON.Value>("[[[1,2]],[[3,4]]]");
  const outerArray = parsed.get<JSON.Arr>();

  expect(outerArray.length).toBe(2);

  const firstMiddleArray = outerArray.at(0).get<JSON.Arr>();
  expect(firstMiddleArray.length).toBe(1);

  const firstInnerArray = firstMiddleArray.at(0).get<JSON.Arr>();
  expect(firstInnerArray.length).toBe(2);
  expect(firstInnerArray.at(0).get<f64>()).toBe(1.0);
  expect(firstInnerArray.at(1).get<f64>()).toBe(2.0);

  const secondMiddleArray = outerArray.at(1).get<JSON.Arr>();
  expect(secondMiddleArray.length).toBe(1);
  const secondInnerArray = secondMiddleArray.at(0).get<JSON.Arr>();
  expect(secondInnerArray.length).toBe(2);
  expect(secondInnerArray.at(0).get<f64>()).toBe(3.0);
  expect(secondInnerArray.at(1).get<f64>()).toBe(4.0);

  expect(JSON.stringify(parsed)).toBe("[[[1,2]],[[3,4]]]");
});

describe("Should deserialize nested arrays in JSON obj", () => {
  const parsed = JSON.parse<JSON.Value>('{"data":[[1,2],[3,4]]}');
  const obj = parsed.get<JSON.Obj>();
  const data = obj.get("data")!.get<JSON.Arr>();

  expect(data.length).toBe(2);
  const inner0 = data.at(0).get<JSON.Arr>();
  const inner1 = data.at(1).get<JSON.Arr>();

  expect(inner0.length).toBe(2);
  expect(inner1.length).toBe(2);

  expect(inner0.at(0).get<f64>()).toBe(1.0);
  expect(inner0.at(1).get<f64>()).toBe(2.0);

  expect(inner1.at(0).get<f64>()).toBe(3.0);
  expect(inner1.at(1).get<f64>()).toBe(4.0);

  expect(JSON.stringify(parsed)).toBe('{"data":[[1,2],[3,4]]}');
});

describe("Should deserialize nested objects in arbitrary arrays", () => {
  const parsed = JSON.parse<JSON.Value>('[{"a":1,"b":2},{"c":3,"d":4}]');
  const arr = parsed.get<JSON.Arr>();

  expect(arr.length).toBe(2);

  const obj0 = arr.at(0).get<JSON.Obj>();
  expect(obj0.keys().length).toBe(2);
  expect(obj0.get("a")!.get<f64>()).toBe(1.0);
  expect(obj0.get("b")!.get<f64>()).toBe(2.0);

  const obj1 = arr.at(1).get<JSON.Obj>();
  expect(obj1.keys().length).toBe(2);
  expect(obj1.get("c")!.get<f64>()).toBe(3.0);
  expect(obj1.get("d")!.get<f64>()).toBe(4.0);

  expect(JSON.stringify(parsed)).toBe('[{"a":1,"b":2},{"c":3,"d":4}]');
});

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe(
    '"regression"',
  );
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe(
    '["a","b","c"]',
  );
});

describe("Should support additional arbitrary object operations", () => {
  const obj = new JSON.Obj();
  obj.set("a", 1);
  obj.set("b", true);
  obj.set("c", "str");
  expect(obj.has("a").toString()).toBe("true");
  expect(obj.get("a")!.toString()).toBe("1");
  obj.delete("a");
  expect(obj.has("a").toString()).toBe("false");
  expect(JSON.stringify(obj)).toBe('{"b":true,"c":"str"}');
});

describe("Should parse additional arbitrary values", () => {
  expect(JSON.parse<JSON.Value>("null").type.toString()).toBe(
    JSON.Types.Null.toString(),
  );
  expect(JSON.parse<JSON.Value>("123").toString()).toBe("123.0");
  expect(JSON.stringify(JSON.parse<JSON.Value>("[1,2,3]"))).toBe("[1,2,3]");
});

describe("Should parse each arbitrary root token shape", () => {
  expect(JSON.parse<JSON.Value>('"hello"').get<string>()).toBe("hello");
  expect(JSON.stringify(JSON.parse<JSON.Value>('{"a":1}'))).toBe('{"a":1}');
  expect(JSON.parse<JSON.Value>("123").get<f64>()).toBe(123.0);
  expect(JSON.stringify(JSON.parse<JSON.Value>("[1,true,null]"))).toBe(
    "[1,true,null]",
  );
  expect(JSON.parse<JSON.Value>("true").toString()).toBe("true");
  expect(JSON.parse<JSON.Value>("false").toString()).toBe("false");
  expect(JSON.parse<JSON.Value>("null").toString()).toBe("null");
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe(
    "[[1],[2,3],[]]",
  );
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe(
    '"line\\nbreak"',
  );
});

describe("Lazy-by-default: untouched composites pass through verbatim", () => {
  // No `.get`/`.type`/iteration before stringify => raw source bytes are copied
  // out byte-for-byte, preserving original formatting the eager path would
  // canonicalize (whitespace inside the slice, `1.0` vs `1`).
  const src = '{"a":[1.0,2.0],"b":{ "c" : 3 },"d":"x"}';
  expect(JSON.stringify(JSON.parse<JSON.Obj>(src))).toBe(src);
  expect(JSON.stringify(JSON.parse<JSON.Value>(src))).toBe(src);

  // Empty composites round-trip verbatim too.
  expect(JSON.stringify(JSON.parse<JSON.Obj>("{}"))).toBe("{}");
  expect(JSON.stringify(JSON.parse<JSON.Value>("[]"))).toBe("[]");
});

describe("Lazy-by-default: access materializes one level, siblings stay raw", () => {
  const obj = JSON.parse<JSON.Obj>('{"keep":[1.0,2.0,3.0],"touch":{"n":5}}');
  // Touch one nested value (materializes just that subtree, canonicalizing it).
  expect(obj.get("touch")!.get<JSON.Obj>().get("n")!.get<f64>()).toBe(5.0);
  // The untouched sibling is still emitted verbatim; the touched one is
  // re-serialized from its materialized form.
  expect(JSON.stringify(obj)).toBe('{"keep":[1.0,2.0,3.0],"touch":{"n":5}}');

  // Mutating a sibling after a peel leaves other untouched siblings raw.
  obj.set("touch", 9);
  expect(JSON.stringify(obj)).toBe('{"keep":[1.0,2.0,3.0],"touch":9}');
});

describe("JSON.Obj whole-source passthrough invalidates for deep mutation", () => {
  const src = '{ "child" : {"x":1}, "keep" : [1.0,2.0] }';
  const obj = JSON.parse<JSON.Obj>(src);
  expect(JSON.stringify(obj)).toBe(src);

  // A nested/custom serialization owns only a slice of the shared staging
  // buffer, so it must copy the object there instead of claiming the next
  // top-level output cache.
  expect(JSON.internal.stringify(obj)).toBe(src);
  expect(JSON.stringify(obj)).toBe(src);

  const child = obj.getAs<JSON.Obj>("child");
  child.set("x", 2);
  expect(JSON.stringify(obj)).toBe('{"child":{"x":2},"keep":[1.0,2.0]}');
});

describe("Lazy-by-default: deep nesting peels one level at a time", () => {
  const root = JSON.parse<JSON.Value>('{"a":{"b":{"c":[10,20]}}}');
  const c = root
    .get<JSON.Obj>()
    .get("a")!
    .get<JSON.Obj>()
    .get("b")!
    .get<JSON.Obj>()
    .get("c")!
    .get<JSON.Arr>();
  expect(c.length).toBe(2);
  expect(c.at(0).get<f64>()).toBe(10.0);
  expect(c.at(1).get<f64>()).toBe(20.0);
});

describe("Buffer-backed JSON.Obj: getAs<T> typed access", () => {
  const obj = JSON.parse<JSON.Obj>(
    '{"id":42,"name":"Alice","active":true,"score":3.5,"owner":{"login":"bob"},"tags":[1,2,3]}',
  );
  // Eager scalars read straight from the slot; strings/composites materialize.
  // (Arbitrary JSON numbers are f64, so read them as f64.)
  expect(obj.getAs<f64>("id")).toBe(42.0);
  expect(obj.getAs<string>("name")).toBe("Alice");
  expect(obj.getAs<bool>("active")).toBe(true);
  expect(obj.getAs<f64>("score")).toBe(3.5);
  expect(obj.getAs<JSON.Obj>("owner").getAs<string>("login")).toBe("bob");
  expect(obj.getAs<JSON.Arr>("tags").length).toBe(3);
  // Absent key returns the type default (0 for numbers, null for references).
  expect(obj.getAs<f64>("missing")).toBe(0.0);
  expect(changetype<usize>(obj.getAs<string>("missing"))).toBe(0);

  // getAs caches the materialized composite: a second read is the same instance.
  const a = obj.getAs<JSON.Obj>("owner");
  const b = obj.getAs<JSON.Obj>("owner");
  expect(a === b).toBe(true);

  // Mutate (stores an i32 slot) then read back.
  obj.set("id", 99);
  expect(obj.getAs<i32>("id")).toBe(99);
});

describe("Buffer-backed JSON.Obj: build, mutate, delete", () => {
  const o = new JSON.Obj();
  o.set("a", 1);
  o.set("b", "two");
  o.set("c", true);
  expect(o.size).toBe(3);
  expect(JSON.stringify(o)).toBe('{"a":1,"b":"two","c":true}');
  o.set("b", 22); // overwrite with a different type
  expect(o.getAs<i32>("b")).toBe(22);
  expect(o.delete("a")).toBe(true);
  expect(o.has("a")).toBe(false);
  expect(o.size).toBe(2);
  expect(JSON.stringify(o)).toBe('{"b":22,"c":true}');
});

describe("Lazy-by-default: slices with brackets/quotes in strings scan correctly", () => {
  // The scanner must not mistake `}`/`]`/escaped quotes inside strings for the
  // value end. keys() must work without materializing the (raw) value.
  const tricky = '{"s":"a}b]c\\"d","arr":["x]","y}"]}';
  const obj = JSON.parse<JSON.Obj>(tricky);
  expect(obj.size).toBe(2);
  expect(obj.keys()[0]).toBe("s");
  expect(obj.get("s")!.get<string>()).toBe('a}b]c"d');
  // The untouched array slice round-trips verbatim.
  expect(JSON.stringify(obj.get("arr")!)).toBe('["x]","y}"]');
});

describe("Buffer-backed: large (>16KB) values pack exactly and round-trip", () => {
  // ~20 KB value: past the old 13-bit length cap, well within the 22-bit
  // relative-offset/length packing, so it resolves without a scan fallback.
  const big = "x".repeat(20000);
  const objSrc = '{"big":"' + big + '","n":1}';
  const obj = JSON.parse<JSON.Obj>(objSrc);
  expect(JSON.stringify(obj)).toBe(objSrc); // untouched passthrough
  expect(obj.getAs<string>("big").length).toBe(20000); // materializes
  expect(obj.getAs<f64>("n")).toBe(1.0);

  const arrSrc = '["' + big + '",2]';
  const arr = JSON.parse<JSON.Arr>(arrSrc);
  expect(JSON.stringify(arr)).toBe(arrSrc);
  expect(arr.getAs<string>(0).length).toBe(20000);
  expect(arr.getAs<f64>(1)).toBe(2.0);
});
