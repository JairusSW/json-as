import { JSON } from "..";
import { describe, expect } from "./lib";
import { Vec3 } from "./types";

describe("Should serialize arbitrary types", () => {
  expect(JSON.stringify(JSON.Value.from("hello world"))).toBe("\"hello world\"");
  expect(JSON.stringify(JSON.Value.from(0))).toBe("0");
  expect(JSON.stringify(JSON.Value.from(true))).toBe("true");
  expect(JSON.stringify(JSON.Value.from(new Vec3()))).toBe('{"x":1.0,"y":2.0,"z":3.0}');
  expect(JSON.stringify([JSON.Value.from("string"), JSON.Value.from(true), JSON.Value.from(3.14), JSON.Value.from(new Vec3())])).toBe('["string",true,3.14,{"x":1.0,"y":2.0,"z":3.0}]');
});

describe("Should deserialize arbitrary types", () => {
  expect(JSON.parse<JSON.Value>("\"hello world\"").get<string>()).toBe("hello world");
  expect(JSON.parse<JSON.Value>("0.0").toString()).toBe("0.0");
  expect(JSON.parse<JSON.Value>("true").toString()).toBe("true");
  expect(JSON.stringify(JSON.parse<JSON.Value>('{"x":1.0,"y":2.0,"z":3.0}'))).toBe('{"x":1.0,"y":2.0,"z":3.0}');
  expect(JSON.stringify(JSON.parse<JSON.Value[]>('["string",true,3.14,{"x":1.0,"y":2.0,"z":3.0},[1.0,2.0,3,true]]'))).toBe('["string",true,3.14,{"x":1.0,"y":2.0,"z":3.0},[1.0,2.0,3.0,true]]');
});