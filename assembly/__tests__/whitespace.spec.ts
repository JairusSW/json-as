import { JSON } from "..";
import { describe, expect } from "as-test";
import { Vec3 } from "./types";


@json
class WhitespaceEnvelope {
  title: string = "";
  count: i32 = 0;
  enabled: bool = false;
  values: f64[] = [];
  pos: Vec3 | null = null;
}

describe("Should deserialize containers with internal whitespace", () => {
  expect(JSON.stringify(JSON.parse<i32[]>("[ 1 , 2 , 3 , 4 ]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<f64[][]>("[ [ 1.5 ] , [ -2.25 , 3.125 ] , [ ] ]"))).toBe("[[1.5],[-2.25,3.125],[]]");
  expect(JSON.stringify(JSON.parse<Map<string, i32>>('{ "a" : 1 , "b" : 2 }'))).toBe('{"a":1,"b":2}');
  expect(JSON.stringify(JSON.parse<Set<bool>>("[ true , false , true ]"))).toBe("[true,false]");
});

describe("Should deserialize structs with aggressive whitespace", () => {
  const parsed = JSON.parse<WhitespaceEnvelope>(' {\n  "title" : "demo" ,\n  "count" : 7 ,\n  "enabled" : true ,\n  "values" : [ 1.5 , 2.5 , 3.5 ] ,\n  "pos" : { "x" : 4.5 , "y" : 5.5 , "z" : 6.5 }\n} ');
  expect(parsed.title).toBe("demo");
  expect(parsed.count.toString()).toBe("7");
  expect(parsed.enabled.toString()).toBe("true");
  expect(parsed.values.length.toString()).toBe("3");
  expect(parsed.values[2].toString()).toBe("3.5");
  expect((parsed.pos as Vec3).x.toString()).toBe("4.5");
  expect((parsed.pos as Vec3).z.toString()).toBe("6.5");
  expect(JSON.stringify(parsed)).toBe('{"title":"demo","count":7,"enabled":true,"values":[1.5,2.5,3.5],"pos":{"x":4.5,"y":5.5,"z":6.5}}');
});

describe("Should preserve escaped backslashes and quotes inside nested values", () => {
  const parsedObject = JSON.parse<Map<string, string>>('{ "msg" : "path \\\\\\\\ and quote \\\\\\"" }');
  const parsedArray = JSON.parse<string[]>('[ "path \\\\\\\\ and quote \\\\\\"" ]');

  expect(parsedObject.get("msg")).toBe('path \\\\ and quote \\"');
  expect(parsedArray[0]).toBe('path \\\\ and quote \\"');
  expect(JSON.stringify(parsedObject)).toBe('{"msg":"path \\\\\\\\ and quote \\\\\\""}');
  expect(JSON.stringify(parsedArray)).toBe('["path \\\\\\\\ and quote \\\\\\""]');
});
