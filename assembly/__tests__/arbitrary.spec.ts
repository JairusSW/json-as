import { JSON } from "..";
import { describe, expect } from "./lib";
import { Vec3 } from "./types";

describe("Should serialize arbitrary types", () => {
  expect(JSON.stringify(JSON.Value.from("hello world"))).toBe('"hello world"');
  expect(JSON.stringify(JSON.Value.from(0))).toBe("0");
  expect(JSON.stringify(JSON.Value.from(true))).toBe("true");
  expect(JSON.stringify(JSON.Value.from(new Vec3()))).toBe('{"x":1.0,"y":2.0,"z":3.0}');
  expect(JSON.stringify([JSON.Value.from("string"), JSON.Value.from(true), JSON.Value.from(3.14), JSON.Value.from(new Vec3())])).toBe('["string",true,3.14,{"x":1.0,"y":2.0,"z":3.0}]');

  const o = new JSON.Obj();
  o.set("schema", "http://json-schema.org/draft-07/schema#");
  o.set("additionalProperties", false);
  o.set("properties", new JSON.Obj());
  o.get("properties")!.as<JSON.Obj>().set("duration", new JSON.Obj());
  o.get("properties")!.as<JSON.Obj>().get("duration")!.as<JSON.Obj>().set("default", 10.0);
  o.get("properties")!.as<JSON.Obj>().get("duration")!.as<JSON.Obj>().set("description", "Duration of the operation in seconds");
  o.get("properties")!.as<JSON.Obj>().get("duration")!.as<JSON.Obj>().set("type", "number");
  o.get("properties")!.as<JSON.Obj>().set("steps", new JSON.Obj());
  o.get("properties")!.as<JSON.Obj>().get("steps")!.as<JSON.Obj>().set("default", 5.0);
  o.get("properties")!.as<JSON.Obj>().get("steps")!.as<JSON.Obj>().set("description", "Number of steps in the operation");
  o.get("properties")!.as<JSON.Obj>().get("steps")!.as<JSON.Obj>().set("type", "number");
  o.set("type", "object");

  expect(o.toString())
    .toBe('{"schema":"http://json-schema.org/draft-07/schema#","additionalProperties":false,"properties":{"duration":{"default":10.0,"description":"Duration of the operation in seconds","type":"number"},"steps":{"default":5.0,"description":"Number of steps in the operation","type":"number"}},"type":"object"}');
});

describe("Should deserialize arbitrary types", () => {
  expect(JSON.parse<JSON.Value>('"hello world"').get<string>()).toBe("hello world");
  expect(JSON.parse<JSON.Value>("0.0").toString()).toBe("0.0");
  expect(JSON.parse<JSON.Value>("true").toString()).toBe("true");
  expect(JSON.stringify(JSON.parse<JSON.Value>('{"x":1.0,"y":2.0,"z":3.0}'))).toBe('{"x":1.0,"y":2.0,"z":3.0}');
  expect(JSON.stringify(JSON.parse<JSON.Value[]>('["string",true,3.14,{"x":1.0,"y":2.0,"z":3.0},[1.0,2.0,3,true]]'))).toBe('["string",true,3.14,{"x":1.0,"y":2.0,"z":3.0},[1.0,2.0,3.0,true]]');
});