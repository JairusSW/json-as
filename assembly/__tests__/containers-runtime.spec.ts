import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class ContainerVec3 {
  x: f64 = 0.0;
  y: f64 = 0.0;
  z: f64 = 0.0;
}


@json
class ContainerEnvelope {
  map: Map<string, i32[]> = new Map<string, i32[]>();
  set: Set<string> = new Set<string>();
  staticItems: StaticArray<ContainerVec3> = [];
}

describe("Should round-trip mixed container envelopes", () => {
  const parsed = JSON.parse<ContainerEnvelope>('{"map":{"a":[1,2],"b":[3,4,5]},"set":["x","y","x"],"staticItems":[{"x":1.0,"y":2.0,"z":3.0},{"x":4.0,"y":5.0,"z":6.0}]}');
  expect(parsed.map.get("a").length.toString()).toBe("2");
  expect(parsed.map.get("a")[0].toString()).toBe("1");
  expect(parsed.map.get("b")[2].toString()).toBe("5");
  expect(parsed.set.size.toString()).toBe("2");
  expect(parsed.set.has("x").toString()).toBe("true");
  expect(parsed.set.has("y").toString()).toBe("true");
  expect(parsed.staticItems.length.toString()).toBe("2");
  expect(parsed.staticItems[0].x.toString()).toBe("1.0");
  expect(parsed.staticItems[1].z.toString()).toBe("6.0");
  expect(JSON.stringify(parsed)).toBe('{"map":{"a":[1,2],"b":[3,4,5]},"set":["x","y"],"staticItems":[{"x":1.0,"y":2.0,"z":3.0},{"x":4.0,"y":5.0,"z":6.0}]}');
});

describe("Should round-trip JSON.Value arrays containing objects, raw, and arrays", () => {
  const values = JSON.parse<JSON.Value[]>('[{"a":1},[2,3],true,"x",null]');
  expect(values.length.toString()).toBe("5");
  expect(values[0].get<JSON.Obj>().get("a")!.toString()).toBe("1.0");
  expect(values[1].get<JSON.Value[]>()[0].toString()).toBe("2.0");
  expect(values[1].get<JSON.Value[]>()[1].toString()).toBe("3.0");
  expect(values[2].get<bool>().toString()).toBe("true");
  expect(values[3].get<string>()).toBe("x");
  expect(values[4].type.toString()).toBe(JSON.Types.Null.toString());
  expect(JSON.stringify(values)).toBe('[{"a":1.0},[2.0,3.0],true,"x",null]');
});

describe("Should mutate JSON.Obj with replacement values", () => {
  const obj = new JSON.Obj();
  obj.set("status", "draft");
  obj.set("status", "published");
  obj.set("count", 1);
  obj.set("count", 2);
  obj.set("list", [JSON.Value.from(1), JSON.Value.from(2), JSON.Value.from(3)]);
  expect(obj.get("status")!.get<string>()).toBe("published");
  expect(obj.get("count")!.toString()).toBe("2");
  expect(JSON.stringify(obj.get("list")!.get<JSON.Value[]>())).toBe("[1,2,3]");
  expect(JSON.stringify(obj)).toBe('{"status":"published","count":2,"list":[1,2,3]}');
});
