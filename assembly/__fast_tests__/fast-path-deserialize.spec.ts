import { JSON } from "..";
import { describe, expect } from "as-test";

@json
class FastChild {
  id: i32 = 0;
  label: string = "";
}

@json
class FastDirectFields {
  id: i32 = 0;
  total: u64 = 0;
  ratio: f64 = 0.0;
  ok: bool = false;
  name: string = "";
  note: string | null = null;
  child: FastChild = new FastChild();
  maybeChild: FastChild | null = null;
  tags: string[] = [];
  children: FastChild[] = [];
  scores: i32[] = [];
}

@json
class FastValueField {
  value: JSON.Value = JSON.Value.empty();
}

@json
class FastObjField {
  obj: JSON.Obj = new JSON.Obj();
}

@json
class FastBoxField {
  boxed: JSON.Box<i32> | null = null;
}

@json
class FastRawField {
  raw: JSON.Raw = JSON.Raw.from("{}");
}

@json
class FastSetField {
  labels: Set<string> = new Set<string>();
}

@json
class FastMapField {
  meta: Map<string, i32> = new Map<string, i32>();
}

@json
class FastStaticArrayField {
  coords: StaticArray<i32> = [0, 0, 0];
}

@json
class FastOmitNullFields {
  @omitnull()
  note: string | null = null;

  @omitnull()
  raw: JSON.Raw | null = null;

  id: i32 = 0;
  name: string = "";
}

describe("Fast-path deserialization should handle direct field types", () => {
  const payload =
    '{"id":7,"total":42,"ratio":3.5,"ok":true,"name":"alpha","note":"line\\nbreak","child":{"id":1,"label":"nested"},"maybeChild":{"id":2,"label":"optional"},"tags":["a","b","c"],"children":[{"id":3,"label":"x"},{"id":4,"label":"y"}],"scores":[5,6,7]}';

  const parsed = JSON.parse<FastDirectFields>(payload);

  expect(parsed.id).toBe(7);
  expect(parsed.total.toString()).toBe("42");
  expect(parsed.ratio.toString()).toBe("3.5");
  expect(parsed.ok.toString()).toBe("true");
  expect(parsed.name).toBe("alpha");
  expect(parsed.note!).toBe("line\nbreak");
  expect(parsed.child.id).toBe(1);
  expect(parsed.child.label).toBe("nested");
  expect(parsed.maybeChild!.id).toBe(2);
  expect(parsed.maybeChild!.label).toBe("optional");
  expect(parsed.tags.length).toBe(3);
  expect(parsed.tags[0]).toBe("a");
  expect(parsed.tags[2]).toBe("c");
  expect(parsed.children.length).toBe(2);
  expect(parsed.children[0].label).toBe("x");
  expect(parsed.children[1].id).toBe(4);
  expect(parsed.scores.length).toBe(3);
  expect(parsed.scores[1]).toBe(6);
  expect(JSON.stringify(parsed)).toBe(payload);
});

describe("Fast-path deserialization should handle nullable direct fields", () => {
  const payload = '{"id":1,"total":0,"ratio":0.0,"ok":false,"name":"beta","note":null,"child":{"id":9,"label":"base"},"maybeChild":null,"tags":[],"children":[],"scores":[]}';

  const parsed = JSON.parse<FastDirectFields>(payload);

  expect(parsed.id).toBe(1);
  expect((parsed.note == null).toString()).toBe("true");
  expect((parsed.maybeChild == null).toString()).toBe("true");
  expect(parsed.tags.length).toBe(0);
  expect(parsed.children.length).toBe(0);
  expect(parsed.scores.length).toBe(0);
  expect(JSON.stringify(parsed)).toBe(payload);
});

describe("Fast-path deserialization should handle JSON.Value fields", () => {
  const parsed = JSON.parse<FastValueField>('{"value":{"ok":true,"nums":[1,2,3]}}');
  expect(parsed.value.get<JSON.Obj>().get("ok")!.get<bool>().toString()).toBe("true");
  expect(JSON.stringify(parsed.value.get<JSON.Obj>().get("nums")!.get<JSON.Value[]>())).toBe("[1.0,2.0,3.0]");
  expect(JSON.stringify(parsed)).toBe('{"value":{"ok":true,"nums":[1.0,2.0,3.0]}}');
});

describe("Fast-path deserialization should handle JSON.Obj fields", () => {
  const parsed = JSON.parse<FastObjField>('{"obj":{"kind":"demo","count":2}}');
  expect(parsed.obj.get("kind")!.get<string>()).toBe("demo");
  expect(parsed.obj.get("count")!.get<f64>().toString()).toBe("2.0");
  expect(JSON.stringify(parsed)).toBe('{"obj":{"kind":"demo","count":2.0}}');
});

describe("Fast-path deserialization should handle JSON.Box fields", () => {
  const parsed = JSON.parse<FastBoxField>('{"boxed":15}');
  expect(parsed.boxed!.value).toBe(15);
  expect(JSON.stringify(parsed)).toBe('{"boxed":15}');
});

describe("Fast-path deserialization should handle JSON.Raw fields", () => {
  const parsed = JSON.parse<FastRawField>('{"raw":{"hello":[1,true,"x"]}}');
  expect(parsed.raw.toString()).toBe('{"hello":[1,true,"x"]}');
  expect(JSON.stringify(parsed)).toBe('{"raw":{"hello":[1,true,"x"]}}');
});

describe("Fast-path deserialization should handle Set fields", () => {
  const parsed = JSON.parse<FastSetField>('{"labels":["left","right"]}');
  expect(parsed.labels.has("left").toString()).toBe("true");
  expect(parsed.labels.has("right").toString()).toBe("true");
  expect(JSON.stringify(parsed)).toBe('{"labels":["left","right"]}');
});

describe("Fast-path deserialization should handle Map fields", () => {
  const parsed = JSON.parse<FastMapField>('{"meta":{"x":1,"y":2}}');
  expect(parsed.meta.get("x")).toBe(1);
  expect(parsed.meta.get("y")).toBe(2);
  expect(JSON.stringify(parsed)).toBe('{"meta":{"x":1,"y":2}}');
});

describe("Fast-path deserialization should handle StaticArray fields", () => {
  const parsed = JSON.parse<FastStaticArrayField>('{"coords":[9,8,7]}');
  expect(parsed.coords.length).toBe(3);
  expect(parsed.coords[0]).toBe(9);
  expect(parsed.coords[2]).toBe(7);
  expect(JSON.stringify(parsed)).toBe('{"coords":[9,8,7]}');
});

describe("Fast-path deserialization should handle omitnull schemas when omitted fields are absent", () => {
  const parsed = JSON.parse<FastOmitNullFields>('{"id":1,"name":"alpha"}');
  expect(parsed.id).toBe(1);
  expect(parsed.name).toBe("alpha");
  expect((parsed.note == null).toString()).toBe("true");
  expect((parsed.raw == null).toString()).toBe("true");
  expect(JSON.stringify(parsed)).toBe('{"id":1,"name":"alpha"}');
});

describe("Fast-path deserialization should handle omitnull schemas when optional fields are present", () => {
  const parsed = JSON.parse<FastOmitNullFields>('{"note":"hello","raw":{"x":1},"id":2,"name":"beta"}');
  expect(parsed.note!).toBe("hello");
  expect(parsed.raw!.toString()).toBe('{"x":1}');
  expect(parsed.id).toBe(2);
  expect(parsed.name).toBe("beta");
  expect(JSON.stringify(parsed)).toBe('{"note":"hello","raw":{"x":1},"id":2,"name":"beta"}');
});
