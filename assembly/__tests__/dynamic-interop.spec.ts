import { JSON } from "..";
import { describe, expect } from "as-test";

// Interop of the dynamic types (JSON.Obj / JSON.Value / JSON.Arr) with the
// other library types: JSON.Raw, JSON.Box, Map, Date, and @json structs.

function singletonMap(k: string, v: string): Map<string, string> {
  const m = new Map<string, string>();
  m.set(k, v);
  return m;
}


@json
class Point {
  x: i32 = 0;
  y: i32 = 0;
}


@json
class Profile {
  id: i32 = 0;
  name: string = "";
  tags: string[] = [];
}

// A struct that carries dynamic fields alongside concrete ones.
@json
class Envelope {
  kind: string = "";
  payload: JSON.Value = JSON.Value.empty();
  items: JSON.Value[] = [];
}

// A struct mixing Date / JSON.Raw / JSON.Box with a dynamic field.
@json
class Mixed {
  when: Date = new Date(0);
  raw: JSON.Raw = new JSON.Raw("null");
  score: JSON.Box<i32> | null = null;
  extra: JSON.Value[] = [];
}

// A struct with single JSON.Obj and JSON.Arr fields.
@json
class Container {
  meta: JSON.Obj = new JSON.Obj();
  list: JSON.Arr = new JSON.Arr();
}

describe("JSON.Value <-> JSON.Raw", () => {
  const raw = JSON.Raw.from('{"x":1,"y":[2,3]}');
  const v = JSON.Value.from(raw);
  expect(v.type).toBe(JSON.Types.Raw);
  expect(v.get<JSON.Raw>().data).toBe('{"x":1,"y":[2,3]}');
  // Materialized Raw serializes as-is (regression guard for serializeArbitrary).
  expect(JSON.stringify(v)).toBe('{"x":1,"y":[2,3]}');

  // Raw set into a JSON.Obj / JSON.Arr round-trips through serializeArbitrary.
  const o = new JSON.Obj();
  o.set("pre", JSON.Raw.from('{"a":1}'));
  o.set("n", 5);
  expect(JSON.stringify(o)).toBe('{"pre":{"a":1},"n":5}');

  const a = new JSON.Arr();
  a.push(JSON.Raw.from("true"));
  a.push(JSON.Raw.from('"hi"'));
  expect(JSON.stringify(a)).toBe('[true,"hi"]');
});

describe("JSON.Value <-> JSON.Box", () => {
  // from() unwraps a Box to its inner value.
  const v = JSON.Value.from(JSON.Box.from<i32>(42));
  expect(v.get<i32>()).toBe(42);
  expect(JSON.stringify(v)).toBe("42");

  // asBox round-trips a primitive; null value -> null box.
  expect(JSON.Value.from<i32>(7).asBox<i32>()!.value).toBe(7);
  expect(JSON.parse<JSON.Value>("null").asBox<i32>() == null).toBe(true);

  // Box stored into a JSON.Obj is unwrapped to the primitive.
  const o = new JSON.Obj();
  o.set("b", JSON.Box.from<i32>(9));
  expect(o.getAs<i32>("b")).toBe(9);
  expect(JSON.stringify(o)).toBe('{"b":9}');

  // fromValue off a parsed value.
  const box = JSON.Box.fromValue<i32>(JSON.parse<JSON.Value>("123"));
  expect(box ? box.value : -1).toBe(123);
});

describe("JSON.Value / JSON.Obj <-> Map", () => {
  const m = new Map<string, JSON.Value>();
  m.set("k", JSON.Value.from("v"));
  // JSON.Value can box a Map<string, JSON.Value>.
  const v = JSON.Value.from<Map<string, JSON.Value>>(m);
  expect(v.type).toBe(JSON.Types.Map);
  expect(JSON.stringify(v)).toBe('{"k":"v"}');

  // JSON.Obj.from(Map) copies entries.
  const m2 = new Map<string, string>();
  m2.set("only", "x");
  const o = JSON.Obj.from(m2);
  expect(o.getAs<string>("only")).toBe("x");
  expect(JSON.stringify(o)).toBe('{"only":"x"}');

  // Map<string, JSON.Raw> and Map<string, JSON.Obj> parse targets.
  const rawMap = JSON.parse<Map<string, JSON.Raw>>('{"a":{"x":1}}');
  expect(rawMap.get("a").toString()).toBe('{"x":1}');
  const objMap = JSON.parse<Map<string, JSON.Obj>>('{"a":{"x":1}}');
  expect(objMap.get("a").getAs<f64>("x")).toBe(1.0);
});

describe("JSON.Value / JSON.Obj / JSON.Arr <-> @json struct", () => {
  // from(struct) boxes a struct; serializes via its generated serializer.
  const v = JSON.Value.from(new Point());
  expect(JSON.stringify(v)).toBe('{"x":0,"y":0}');
  expect(v.get<Point>().x).toBe(0);

  // Struct set into a JSON.Obj / pushed into a JSON.Arr.
  const o = new JSON.Obj();
  o.set("p", new Point());
  o.set("name", "n");
  expect(JSON.stringify(o)).toBe('{"p":{"x":0,"y":0},"name":"n"}');

  const a = new JSON.Arr();
  a.push(new Point());
  a.push(42);
  expect(JSON.stringify(a)).toBe('[{"x":0,"y":0},42]');

  // Retrieve a struct back out of a dynamic value.
  const got = o.get("p")!.get<Point>();
  expect(got.x).toBe(0);
});

describe("@json struct with dynamic fields (JSON.Value, JSON.Value[])", () => {
  const src =
    '{"kind":"event","payload":{"nested":[1,2]},"items":["a",true,{"z":9}]}';
  const env = JSON.parse<Envelope>(src);
  expect(env.kind).toBe("event");
  // Dynamic payload field stays lazy until accessed.
  expect(
    env.payload.get<JSON.Obj>().get("nested")!.get<JSON.Arr>().length,
  ).toBe(2);
  expect(env.items.length).toBe(3);
  expect(env.items[0].get<string>()).toBe("a");
  expect(env.items[1].get<bool>()).toBe(true);
  expect(env.items[2].get<JSON.Obj>().getAs<f64>("z")).toBe(9.0);
  // Untouched round-trip is byte-stable.
  expect(JSON.stringify(JSON.parse<Envelope>(src))).toBe(src);
});

describe("@json struct mixing Date / Raw / Box with a dynamic field", () => {
  const src =
    '{"when":"1970-01-01T00:00:00.000Z","raw":{"keep":[1,2]},"score":5,"extra":[{"a":1},"x"]}';
  const m = JSON.parse<Mixed>(src);
  expect(m.when.getTime()).toBe(0);
  expect(m.raw.data).toBe('{"keep":[1,2]}'); // JSON.Raw preserves verbatim
  expect(m.score ? m.score!.value : -1).toBe(5);
  expect(m.extra.length).toBe(2);
  expect(m.extra[0].get<JSON.Obj>().getAs<f64>("a")).toBe(1.0);
  expect(JSON.stringify(JSON.parse<Mixed>(src))).toBe(src);
});

describe("Date represented dynamically via JSON.Raw", () => {
  // Dates aren't a JSON.Value variant, but an ISO string can ride along as Raw.
  const o = new JSON.Obj();
  o.set("at", JSON.Raw.from('"1970-01-01T00:00:00.000Z"'));
  o.set("id", 1);
  expect(JSON.stringify(o)).toBe('{"at":"1970-01-01T00:00:00.000Z","id":1}');
});

describe("JSON.Arr with mixed element types round-trips", () => {
  const inner = new JSON.Obj();
  inner.set("k", "v");
  const a = new JSON.Arr();
  a.push(1);
  a.push("two");
  a.push(true);
  a.push<usize>(0); // null sentinel
  a.push(inner);
  a.push(JSON.Raw.from("[9,8]"));
  expect(a.length).toBe(6);
  expect(a.getAs<i32>(0)).toBe(1);
  expect(a.getAs<string>(1)).toBe("two");
  expect(a.getAs<bool>(2)).toBe(true);
  expect(a.at(3).type).toBe(JSON.Types.Null);
  expect(a.getAs<JSON.Obj>(4).getAs<string>("k")).toBe("v");
  expect(JSON.stringify(a)).toBe('[1,"two",true,null,{"k":"v"},[9,8]]');
});

describe("Deeply nested Obj/Arr/Value built then round-tripped", () => {
  const root = new JSON.Obj();
  const list = new JSON.Arr();
  const child = new JSON.Obj();
  child.set("deep", new JSON.Arr());
  child.get("deep")!.get<JSON.Arr>(); // (no-op access)
  child.set("p", new Point());
  list.push(child);
  list.push(JSON.Raw.from('{"raw":true}'));
  root.set("list", list);
  root.set("ok", true);
  const out = JSON.stringify(root);
  expect(out).toBe(
    '{"list":[{"deep":[],"p":{"x":0,"y":0}},{"raw":true}],"ok":true}',
  );
  // Re-parse dynamically and read back through the tree (numbers are f64).
  const re = JSON.parse<JSON.Obj>(out);
  const reList = re.getAs<JSON.Arr>("list");
  expect(
    reList.at(0).get<JSON.Obj>().getAs<JSON.Obj>("p").getAs<f64>("x"),
  ).toBe(0.0);
  expect(reList.at(1).get<JSON.Obj>().getAs<bool>("raw")).toBe(true);
});

describe("@json struct with single JSON.Obj and JSON.Arr fields", () => {
  const src = '{"meta":{"a":1,"b":"x"},"list":[1,2,3]}';
  const c = JSON.parse<Container>(src);
  expect(c.meta.getAs<f64>("a")).toBe(1.0);
  expect(c.meta.getAs<string>("b")).toBe("x");
  expect(c.list.length).toBe(3);
  expect(c.list.getAs<f64>(2)).toBe(3.0);
  expect(c.list.at(0).get<f64>()).toBe(1.0);
  expect(JSON.stringify(JSON.parse<Container>(src))).toBe(src);

  // Built in code, not parsed.
  const built = new Container();
  built.meta.set("k", true);
  built.list.push("z");
  built.list.push(7);
  expect(JSON.stringify(built)).toBe('{"meta":{"k":true},"list":["z",7]}');
});

describe("Map<string, JSON.Value> whose values are Obj / Arr / Raw / struct", () => {
  const m = new Map<string, JSON.Value>();
  m.set("o", JSON.Value.from(JSON.Obj.from(singletonMap("a", "1"))));
  const v = JSON.Value.from<Map<string, JSON.Value>>(m);
  expect(
    v
      .get<Map<string, JSON.Value>>()
      .get("o")
      .get<JSON.Obj>()
      .getAs<string>("a"),
  ).toBe("1");
  expect(JSON.stringify(v)).toBe('{"o":{"a":"1"}}');
});

describe("JSON.Obj mutation with mixed value types then delete", () => {
  const o = new JSON.Obj();
  o.set("a", 1);
  o.set("b", new Point());
  o.set("c", JSON.Raw.from("[true]"));
  expect(JSON.stringify(o)).toBe('{"a":1,"b":{"x":0,"y":0},"c":[true]}');
  expect(o.delete("b")).toBe(true);
  expect(o.size).toBe(2);
  expect(JSON.stringify(o)).toBe('{"a":1,"c":[true]}');
});

describe("JSON.Arr as an explicit parse target with nested dynamic values", () => {
  const a = JSON.parse<JSON.Arr>('[{"a":1},[2,3],"s",null,true]');
  expect(a.length).toBe(5);
  expect(a.at(0).get<JSON.Obj>().getAs<f64>("a")).toBe(1.0);
  expect(a.at(1).get<JSON.Arr>().getAs<f64>(0)).toBe(2.0);
  expect(a.at(2).get<string>()).toBe("s");
  expect(a.at(3).type).toBe(JSON.Types.Null);
  expect(a.at(4).get<bool>()).toBe(true);
  // Untouched passthrough.
  expect(JSON.stringify(JSON.parse<JSON.Arr>('[{"a":1},[2,3]]'))).toBe(
    '[{"a":1},[2,3]]',
  );
});
