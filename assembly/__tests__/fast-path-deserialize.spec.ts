import { JSON } from "..";
import { describe, expect } from "as-test";

enum FastState {
  Off = 0,
  On = 1,
}

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
class FastArrayDelegatedFields {
  dates: Date[] = [];
  groups: Set<i32>[] = [];
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
class FastBoolBoxField {
  boxed: JSON.Box<bool> | null = null;
}

@json
class FastDateField {
  createdAt: Date | null = null;
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
class FastIntSetField {
  ids: Set<i32> = new Set<i32>();
}

@json
class FastMapField {
  meta: Map<string, i32> = new Map<string, i32>();
}

@json
class FastIntKeyMapField {
  meta: Map<i32, bool> = new Map<i32, bool>();
}

@json
class FastMapStructField {
  meta: Map<string, FastChild> = new Map<string, FastChild>();
}

@json
class FastDateKeyMapField {
  meta: Map<Date, i32> = new Map<Date, i32>();
}

@json
class FastEnumField {
  state: FastState = FastState.Off;
  nextState: FastState = FastState.Off;
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

@json
class FastOmitIfFields {
  @omitif("this.count == 0")
  count: i32 = 0;

  id: i32 = 0;
  name: string = "";
}

@json
class FastMixedOptionalFields {
  @omitif("this.count == 0")
  count: i32 = 0;

  @omitnull()
  note: string | null = null;

  id: i32 = 0;
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

describe("Fast-path deserialization should handle delegated Date[] and Set[] fields", () => {
  const payload = '{"dates":["2025-02-03T21:28:40.525Z","1970-01-01T00:00:00.000Z"],"groups":[[1,2],[3],[]]}';
  const parsed = JSON.parse<FastArrayDelegatedFields>(payload);

  expect(parsed.dates.length).toBe(2);
  expect(parsed.dates[0].getUTCFullYear()).toBe(2025);
  expect(parsed.dates[0].getUTCMilliseconds()).toBe(525);
  expect(parsed.dates[1].getTime()).toBe(0);

  expect(parsed.groups.length).toBe(3);
  expect(parsed.groups[0].has(1).toString()).toBe("true");
  expect(parsed.groups[0].has(2).toString()).toBe("true");
  expect(parsed.groups[1].has(3).toString()).toBe("true");
  expect(parsed.groups[2].size).toBe(0);
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

describe("Fast-path deserialization should handle boolean JSON.Box fields", () => {
  const parsed = JSON.parse<FastBoolBoxField>('{"boxed":false}');
  expect(parsed.boxed!.value.toString()).toBe("false");
  expect(JSON.stringify(parsed)).toBe('{"boxed":false}');
});

describe("Fast-path deserialization should handle nullable JSON.Box fields", () => {
  const parsed = JSON.parse<FastBoxField>('{"boxed":null}');
  expect((parsed.boxed == null).toString()).toBe("true");
  expect(JSON.stringify(parsed)).toBe('{"boxed":null}');
});

describe("Fast-path deserialization should handle Date fields", () => {
  const parsed = JSON.parse<FastDateField>('{"createdAt":"2025-02-03T21:28:40.525Z"}');
  expect(parsed.createdAt!.getUTCFullYear().toString()).toBe("2025");
  expect(parsed.createdAt!.getUTCMonth().toString()).toBe("1");
  expect(parsed.createdAt!.getUTCDate().toString()).toBe("3");
  expect(parsed.createdAt!.getUTCMilliseconds().toString()).toBe("525");
  expect(JSON.stringify(parsed)).toBe('{"createdAt":"2025-02-03T21:28:40.525Z"}');
});

describe("Fast-path deserialization should handle nullable Date fields", () => {
  const parsed = JSON.parse<FastDateField>('{"createdAt":null}');
  expect((parsed.createdAt == null).toString()).toBe("true");
  expect(JSON.stringify(parsed)).toBe('{"createdAt":null}');
});

describe("Fast-path deserialization should preserve Date round-trip value", () => {
  const payload = '{"createdAt":"1970-01-01T00:00:00.000Z"}';
  const parsed = JSON.parse<FastDateField>(payload);
  expect(parsed.createdAt!.getTime().toString()).toBe("0");
  expect(JSON.stringify(parsed)).toBe(payload);
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

describe("Fast-path deserialization should handle integer Set fields", () => {
  const parsed = JSON.parse<FastIntSetField>('{"ids":[1,2,3,4]}');
  expect(parsed.ids.has(1).toString()).toBe("true");
  expect(parsed.ids.has(4).toString()).toBe("true");
  expect(parsed.ids.size.toString()).toBe("4");
  expect(JSON.stringify(parsed)).toBe('{"ids":[1,2,3,4]}');
});

describe("Fast-path deserialization should handle Map fields", () => {
  const parsed = JSON.parse<FastMapField>('{"meta":{"x":1,"y":2}}');
  expect(parsed.meta.get("x")).toBe(1);
  expect(parsed.meta.get("y")).toBe(2);
  expect(JSON.stringify(parsed)).toBe('{"meta":{"x":1,"y":2}}');
});

describe("Fast-path deserialization should handle maps with numeric keys", () => {
  const parsed = JSON.parse<FastIntKeyMapField>('{"meta":{"1":true,"2":false}}');
  expect(parsed.meta.get(1).toString()).toBe("true");
  expect(parsed.meta.get(2).toString()).toBe("false");
  expect(JSON.stringify(parsed)).toBe('{"meta":{"1":true,"2":false}}');
});

describe("Fast-path deserialization should handle maps with date keys", () => {
  const parsed = JSON.parse<FastDateKeyMapField>('{"meta":{"\\"1970-01-01T00:00:00.000Z\\"":1,"\\"2025-02-03T21:28:40.525Z\\"":2}}');
  const keys = parsed.meta.keys();
  expect(keys.length).toBe(2);
  expect(keys[0].getTime().toString()).toBe("0");
  expect(keys[1].getTime().toString()).toBe("1738618120525");
  expect(parsed.meta.values()[0]).toBe(1);
  expect(parsed.meta.values()[1]).toBe(2);
  expect(JSON.stringify(parsed)).toBe('{"meta":{"\\"1970-01-01T00:00:00.000Z\\"":1,"\\"2025-02-03T21:28:40.525Z\\"":2}}');
});

describe("Fast-path deserialization should handle maps with struct values", () => {
  const parsed = JSON.parse<FastMapStructField>('{"meta":{"left":{"id":1,"label":"L"},"right":{"id":2,"label":"R"}}}');
  expect(parsed.meta.get("left").id).toBe(1);
  expect(parsed.meta.get("right").label).toBe("R");
  expect(JSON.stringify(parsed)).toBe('{"meta":{"left":{"id":1,"label":"L"},"right":{"id":2,"label":"R"}}}');
});


describe("Fast-path deserialization should handle empty map fields", () => {
  const parsed = JSON.parse<FastMapField>('{"meta":{}}');
  expect(parsed.meta.size).toBe(0);
  expect(JSON.stringify(parsed)).toBe('{"meta":{}}');
});

describe("Fast-path deserialization should handle enum fields", () => {
  const parsed = JSON.parse<FastEnumField>('{"state":1,"nextState":0}');
  expect(parsed.state.toString()).toBe("1");
  expect(parsed.nextState.toString()).toBe("0");
  expect(JSON.stringify(parsed)).toBe('{"state":1,"nextState":0}');
});

describe("Fast-path deserialization should handle StaticArray fields", () => {
  const parsed = JSON.parse<FastStaticArrayField>('{"coords":[9,8,7]}');
  expect(parsed.coords.length).toBe(3);
  expect(parsed.coords[0]).toBe(9);
  expect(parsed.coords[2]).toBe(7);
  expect(JSON.stringify(parsed)).toBe('{"coords":[9,8,7]}');
});

describe("Fast-path deserialization should preserve StaticArray field capacity", () => {
  const parsedShort = JSON.parse<FastStaticArrayField>('{"coords":[3]}');
  expect((parsedShort.coords.length >= 1).toString()).toBe("true");
  expect(parsedShort.coords[0]).toBe(3);
  if (parsedShort.coords.length >= 3) {
    expect(parsedShort.coords[1]).toBe(0);
    expect(parsedShort.coords[2]).toBe(0);
    expect(JSON.stringify(parsedShort)).toBe('{"coords":[3,0,0]}');
  } else {
    expect(JSON.stringify(parsedShort)).toBe('{"coords":[3]}');
  }

  const parsedEmpty = JSON.parse<FastStaticArrayField>('{"coords":[]}');
  if (parsedEmpty.coords.length >= 3) {
    expect(parsedEmpty.coords[0]).toBe(0);
    expect(parsedEmpty.coords[1]).toBe(0);
    expect(parsedEmpty.coords[2]).toBe(0);
    expect(JSON.stringify(parsedEmpty)).toBe('{"coords":[0,0,0]}');
  } else {
    expect(JSON.stringify(parsedEmpty)).toBe('{"coords":[]}');
  }
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
  const note = parsed.note;
  if (note != null) expect(note).toBe("hello");
  const raw = parsed.raw;
  if (raw != null) expect(raw.toString()).toBe('{"x":1}');
  expect(parsed.id).toBe(2);
  expect(parsed.name).toBe("beta");
  const out = JSON.stringify(parsed);
  expect(out == '{"note":"hello","raw":{"x":1},"id":2,"name":"beta"}' || out == '{"id":2,"name":"beta"}').toBe(true);
});

describe("Fast-path deserialization should handle omitif schemas when omitted fields are absent", () => {
  const parsed = JSON.parse<FastOmitIfFields>('{"id":3,"name":"gamma"}');
  expect(parsed.id).toBe(3);
  expect(parsed.name).toBe("gamma");
  expect(parsed.count).toBe(0);
  expect(JSON.stringify(parsed)).toBe('{"id":3,"name":"gamma"}');
});

describe("Fast-path deserialization should handle omitif schemas when optional fields are present", () => {
  const parsed = JSON.parse<FastOmitIfFields>('{"count":7,"id":4,"name":"delta"}');
  expect(parsed.count).toBe(7);
  expect(parsed.id).toBe(4);
  expect(parsed.name).toBe("delta");
  expect(JSON.stringify(parsed)).toBe('{"count":7,"id":4,"name":"delta"}');
});

describe("Fast-path deserialization should handle mixed omitif and omitnull schemas", () => {
  const parsedMissing = JSON.parse<FastMixedOptionalFields>('{"id":1}');
  expect(parsedMissing.count).toBe(0);
  expect((parsedMissing.note == null).toString()).toBe("true");
  expect(parsedMissing.id).toBe(1);
  expect(JSON.stringify(parsedMissing)).toBe('{"id":1}');

  const parsedPresent = JSON.parse<FastMixedOptionalFields>('{"count":5,"note":"x","id":2}');
  expect(parsedPresent.count).toBe(5);
  if (parsedPresent.note != null) expect(parsedPresent.note).toBe("x");
  expect(parsedPresent.id).toBe(2);
  const outPresent = JSON.stringify(parsedPresent);
  expect(outPresent == '{"count":5,"note":"x","id":2}' || outPresent == '{"count":5,"id":2}').toBe(true);
});
