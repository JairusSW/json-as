import { JSON } from "..";
import { describe, expect } from "./lib";
import { Vec3 } from "./types";

describe("Should serialize arbitrary types", () => {
  expect(JSON.stringify(JSON.Value.from("hello world"))).toBe('"hello world"');
  expect(JSON.stringify(JSON.Value.from(0))).toBe("0");
  expect(JSON.stringify(JSON.Value.from(true))).toBe("true");
  expect(JSON.stringify(JSON.Value.from(new Vec3()))).toBe(
    '{"x":1.0,"y":2.0,"z":3.0}',
  );
  expect(
    JSON.stringify([
      JSON.Value.from("string"),
      JSON.Value.from(true),
      JSON.Value.from(3.14),
      JSON.Value.from(new Vec3()),
    ]),
  ).toBe('["string",true,3.14,{"x":1.0,"y":2.0,"z":3.0}]');

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
    '{"schema":"http://json-schema.org/draft-07/schema#","additionalProperties":false,"properties":{"duration":{"default":10.0,"description":"Duration of the operation in seconds","type":"number"},"steps":{"default":5.0,"description":"Number of steps in the operation","type":"number"}},"type":"object"}',
  );

  expect(JSON.stringify(JSON.Value.from<JSON.Box<i32> | null>(null))).toBe(
    "null",
  );
  expect(
    JSON.stringify(JSON.Value.from<JSON.Box<i32> | null>(JSON.Box.from(123))),
  ).toBe("123");
});

describe("Should deserialize arbitrary types", () => {
  expect(JSON.parse<JSON.Value>('"hello world"').get<string>()).toBe(
    "hello world",
  );
  expect(JSON.parse<JSON.Value>("0.0").toString()).toBe("0.0");
  expect(JSON.parse<JSON.Value>("true").toString()).toBe("true");
  expect(
    JSON.stringify(JSON.parse<JSON.Value>('{"x":1.0,"y":2.0,"z":3.0}')),
  ).toBe('{"x":1.0,"y":2.0,"z":3.0}');
  expect(
    JSON.stringify(
      JSON.parse<JSON.Value[]>(
        '["string",true,3.14,{"x":1.0,"y":2.0,"z":3.0},[1.0,2.0,3,true]]',
      ),
    ),
  ).toBe('["string",true,3.14,{"x":1.0,"y":2.0,"z":3.0},[1.0,2.0,3.0,true]]');

  let x = JSON.Box.fromValue<i32>(JSON.parse<JSON.Value>("null"));
  expect(x ? x.toString() : "null").toBe("null");
  x = JSON.Box.fromValue<i32>(JSON.parse<JSON.Value>("123"));
  expect(x ? x.toString() : "null").toBe("123");
});

describe("Should deserialize nested arbitrary arrays with element access", () => {
  const parsed = JSON.parse<JSON.Value>("[[1,2],[3,4]]");
  const outer = parsed.get<JSON.Value[]>();
  
  expect(outer.length).toBe(2);
  
  const inner0 = outer[0].get<JSON.Value[]>();
  const inner1 = outer[1].get<JSON.Value[]>();

  expect(inner0.length).toBe(2);
  expect(inner1.length).toBe(2);
  
  expect(inner0[0].get<f64>()).toBe(1.0);
  expect(inner0[1].get<f64>()).toBe(2.0);
  
  expect(inner1[0].get<f64>()).toBe(3.0);
  expect(inner1[1].get<f64>()).toBe(4.0);
  
  expect(JSON.stringify(parsed)).toBe("[[1.0,2.0],[3.0,4.0]]");
});

describe("Should deserialize nested arrays in mixed arbitrary arrays", () => {
  const parsed = JSON.parse<JSON.Value[]>('["string",true,[1,2,3,4]]');
  
  expect(parsed.length).toBe(3);
  expect(parsed[0].get<string>()).toBe("string");
  expect(parsed[1].toString()).toBe("true");
  
  const nestedArr = parsed[2].get<JSON.Value[]>();
  expect(nestedArr.length).toBe(4);
  expect(nestedArr[0].get<f64>()).toBe(1.0);
  expect(nestedArr[1].get<f64>()).toBe(2.0);
  expect(nestedArr[2].get<f64>()).toBe(3.0);
  expect(nestedArr[3].get<f64>()).toBe(4.0);

  expect(JSON.stringify(parsed)).toBe('["string",true,[1.0,2.0,3.0,4.0]]');
});

describe("Should deserialize deeply nested arbitrary arrays", () => {
  const parsed = JSON.parse<JSON.Value>("[[[1,2]],[[3,4]]]");
  const outerArray = parsed.get<JSON.Value[]>();
  
  expect(outerArray.length).toBe(2);
  
  const firstMiddleArray = outerArray[0].get<JSON.Value[]>();
  expect(firstMiddleArray.length).toBe(1);
  
  const firstInnerArray = firstMiddleArray[0].get<JSON.Value[]>();
  expect(firstInnerArray.length).toBe(2);
  expect(firstInnerArray[0].get<f64>()).toBe(1.0);
  expect(firstInnerArray[1].get<f64>()).toBe(2.0);

  const secondMiddleArray = outerArray[1].get<JSON.Value[]>();
  expect(secondMiddleArray.length).toBe(1);
  const secondInnerArray = secondMiddleArray[0].get<JSON.Value[]>();
  expect(secondInnerArray.length).toBe(2);
  expect(secondInnerArray[0].get<f64>()).toBe(3.0);
  expect(secondInnerArray[1].get<f64>()).toBe(4.0);  
  
  expect(JSON.stringify(parsed)).toBe("[[[1.0,2.0]],[[3.0,4.0]]]");
});

describe("Should deserialize nested arrays in JSON obj", () => {
  const parsed = JSON.parse<JSON.Value>('{"data":[[1,2],[3,4]]}');
  const obj = parsed.get<JSON.Obj>();
  const data = obj.get("data")!.get<JSON.Value[]>();
  
  expect(data.length).toBe(2);
  const inner0 = data[0].get<JSON.Value[]>();
  const inner1 = data[1].get<JSON.Value[]>();

  expect(inner0.length).toBe(2);
  expect(inner1.length).toBe(2);
  
  expect(inner0[0].get<f64>()).toBe(1.0);
  expect(inner0[1].get<f64>()).toBe(2.0);

  expect(inner1[0].get<f64>()).toBe(3.0);
  expect(inner1[1].get<f64>()).toBe(4.0);

  expect(JSON.stringify(parsed)).toBe('{"data":[[1.0,2.0],[3.0,4.0]]}');
});

describe("Should deserialize nested objects in arbitrary arrays", () => {
  const parsed = JSON.parse<JSON.Value>('[{"a":1,"b":2},{"c":3,"d":4}]');
  const arr = parsed.get<JSON.Value[]>();
  
  expect(arr.length).toBe(2);
  
  const obj0 = arr[0].get<JSON.Obj>();
  expect(obj0.keys().length).toBe(2);
  expect(obj0.get("a")!.get<f64>()).toBe(1.0);
  expect(obj0.get("b")!.get<f64>()).toBe(2.0);
  
  const obj1 = arr[1].get<JSON.Obj>();
  expect(obj1.keys().length).toBe(2);
  expect(obj1.get("c")!.get<f64>()).toBe(3.0);
  expect(obj1.get("d")!.get<f64>()).toBe(4.0);

  expect(JSON.stringify(parsed)).toBe('[{"a":1.0,"b":2.0},{"c":3.0,"d":4.0}]');
describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe('"regression"');
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
  expect(JSON.stringify(JSON.parse<JSON.Value>("[1,2,3]"))).toBe("[1.0,2.0,3.0]");
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
