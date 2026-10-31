import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class CursorChild {
  label: string = "default";
  values: f64[] = [];
}


@json
class CursorRecord {
  count: i32 = 17;
  enabled: bool = false;
  child: CursorChild | null = null;
  children: CursorChild[] = [];
  names: (string | null)[] = [];


  @alias("line-key") text: string = "unchanged";
}

let callbacks = 0;
let sourceRestored = false;


@json
class CursorCustom {
  value: i32 = 0;


  @deserializer("object")
  read(data: string): CursorCustom {
    callbacks++;
    const source = JSON.Util.getParseSource();
    const nested = JSON.parse<CursorRecord>('{"count":42}');
    sourceRestored = JSON.Util.getParseSource() === source;
    const out = new CursorCustom();
    out.value = nested.count;
    return out;
  }
}


@json
class CursorCustomContainer {
  custom: CursorCustom = new CursorCustom();
  tail: JSON.Value = JSON.Value.empty();
}

let rejected = "";
const reusedRecord = new CursorRecord();
function rejectRecord(source: string): void {
  rejected = source;
  expect((): void => {
    JSON.parse<CursorRecord>(rejected);
  }).toThrow();
}

describe("Generated cursor capabilities cover fresh typed objects and nested arrays", () => {
  expect(JSON.__cursorSupports<CursorRecord>()).toBe(true);
  expect(JSON.__cursorSupports<CursorChild[]>()).toBe(true);
  expect(JSON.__cursorSupports<CursorCustomContainer>()).toBe(false);
  expect(JSON.__cursorSupports<CursorCustom[]>()).toBe(false);
  const value = JSON.parse<CursorRecord>(
    '{"count":9,"enabled":true,"child":{"label":"first","values":[-0,1.25,5e-324]},"children":[{"label":"a"},{"values":[2,3]}],"names":["a",null,"b"],"line-key":"decoded"}',
  );
  expect(value.count).toBe(9);
  expect(value.enabled).toBe(true);
  expect(value.child!.label).toBe("first");
  expect(reinterpret<u64>(value.child!.values[0])).toBe(0x8000000000000000);
  expect(value.child!.values[1]).toBe(1.25);
  expect(value.child!.values[2]).toBe(5e-324);
  expect(value.children.length).toBe(2);
  expect(value.children[0].label).toBe("a");
  expect(value.children[1].label).toBe("default");
  expect(value.children[1].values[1]).toBe(3.0);
  expect(value.names[1] === null).toBe(true);
  expect(value.text).toBe("decoded");
});

describe("Cursor keyed continuation preserves previous fields, aliases, defaults and duplicate order", () => {
  const value = JSON.parse<CursorRecord>(
    ' { "count" : 1, "names" : ["kept"], "enabled":true, "count":2, "line\\u002dkey":"escaped", "child":null } \n',
  );
  expect(value.count).toBe(2);
  expect(value.names[0]).toBe("kept");
  expect(value.enabled).toBe(true);
  expect(value.text).toBe("escaped");
  expect(value.child === null).toBe(true);
  expect(value.children.length).toBe(0);
  const empty = JSON.parse<CursorRecord>("{}");
  expect(empty.count).toBe(17);
  expect(empty.text).toBe("unchanged");
});

describe("Checked object cursors reject malformed grammar without replay", () => {
  const inputs: string[] = [
    "",
    "{",
    '{"count":1,}',
    '{"count":01}',
    '{"count":1 "enabled":true}',
    '{"names":["a",]}',
    '{"names":["a\\q"]}',
    '{"child":{"values":[1.,2]}}',
    '{"child":{"values":[1e,2]}}',
    '{"child":{"values":[1e+,2]}}',
    '{"child":{"values":[01.25,2]}}',
    '{"child":{"values":[NaN]}}',
    '{"count":1,"unknown":{"x":2}}',
    '{"count":1}false',
    '{"line\\u00zzkey":"bad"}',
    '{"names":["raw\u0001"]}',
    '{"names":["ok"]\u0001}',
    '{"count":1}\u00a0',
  ];
  for (let i = 0; i < inputs.length; i++) rejectRecord(inputs[i]);
  expect(JSON.parse<CursorRecord>('{"count":3}').count).toBe(3);
});

describe("Strict reuse still rejects syntax before mutation", () => {
  reusedRecord.count = 100;
  rejected = '{"count":1,"names":["x",]}';
  expect((): void => {
    JSON.parse<CursorRecord>(rejected, reusedRecord);
  }).toThrow();
  expect(reusedRecord.count).toBe(100);
});

describe("Custom deserializers retain prevalidation and nested cursor source restoration", () => {
  callbacks = 0;
  rejected = '{"custom":{},"tail":[1,]}';
  expect((): void => {
    JSON.parse<CursorCustomContainer>(rejected);
  }).toThrow();
  expect(callbacks).toBe(0);
  rejected = "[{},]";
  expect((): void => {
    JSON.parse<CursorCustom[]>(rejected);
  }).toThrow();
  expect(callbacks).toBe(0);
  const out = JSON.parse<CursorCustomContainer>(
    '{"custom":{},"tail":{"text":"retained"}}',
  );
  // Legacy custom parsing may retry; preserve its prevalidation contract.
  expect(callbacks > 0).toBe(true);
  expect(sourceRestored).toBe(true);
  __collect();
  expect(out.custom.value).toBe(42);
  expect(out.tail.get<JSON.Obj>().getAs<string>("text")).toBe("retained");
});


@json
class CursorCollections {
  map: Map<string, CursorChild> = new Map<string, CursorChild>();
  set: Set<string> = new Set<string>();
  fixed: StaticArray<CursorChild> = [];
  raw: JSON.Raw = JSON.Raw.from("null");
  date: Date = new Date(0);
}

function makeCursorCollections(): CursorCollections {
  return JSON.parse<CursorCollections>(
    '{"raw":{"unmodeled":[1,true,"\\u4e2d"]},"map":{"a":{"label":"first"},"\\u0061":{"label":"last"}},"set":["x","x","y"],"fixed":[{"values":[1.25]}],"date":"2025-02-03\\u005421:28:40.525\\u005a"}',
  );
}

let collectionInput = "";
describe("Cursor collections validate while populating maps, sets, static arrays, raw values and dates", () => {
  expect(JSON.__cursorSupports<CursorCollections>()).toBe(true);
  expect((): void => {
    makeCursorCollections();
  }).not.toThrow();
  const value = makeCursorCollections();
  __collect();
  expect(value.map.size).toBe(1);
  expect(value.map.get("a").label).toBe("last");
  expect(value.set.size).toBe(2);
  expect(value.set.has("y")).toBe(true);
  expect(value.fixed.length).toBe(1);
  expect(value.fixed[0].values[0]).toBe(1.25);
  expect(value.raw.data).toBe('{"unmodeled":[1,true,"\\u4e2d"]}');
  expect(value.date.getTime()).toBe(
    Date.fromString("2025-02-03T21:28:40.525Z").getTime(),
  );
  expect(JSON.parse<JSON.Raw>(" \n[1,2] \t").data).toBe("[1,2] \t");
  const invalid: string[] = [
    '{"raw":{"x":[1,]}}',
    '{"map":{"a":{}} ,}',
    '{"map":{"a":{"label":"x"},}}',
    '{"set":["a",]}',
    '{"fixed":[{},]}',
  ];
  for (let i = 0; i < invalid.length; i++) {
    collectionInput = invalid[i];
    expect((): void => {
      JSON.parse<CursorCollections>(collectionInput);
    }).toThrow();
  }
});


@json({ lazy: "all" })
class CursorLazy {
  count: i32 = 7;
  payload: JSON.Raw = JSON.Raw.from("null");
  child: CursorChild | null = null;
}


@json({ lazy: "all" })
class CursorLazyCustom {
  custom: CursorCustom | null = null;
}

function makeCursorLazy(): CursorLazy {
  return JSON.parse<CursorLazy>(
    '{"payload":{"unmodeled":[1,2]},"child":{"values":[1.25,2]},"count":9}',
  );
}

let lazyInput = "";
describe("Cursor lazy fields validate full ranges before deferring conversion", () => {
  expect(JSON.__cursorSupports<CursorLazy>()).toBe(true);
  expect(JSON.__cursorSupports<CursorLazyCustom>()).toBe(false);
  const value = makeCursorLazy();
  __collect();
  expect(value.count).toBe(9);
  expect(value.payload.data).toBe('{"unmodeled":[1,2]}');
  expect(value.child!.values[0]).toBe(1.25);
  value.child!.values[0] = 8.0;
  __collect();
  expect(value.child!.values[0]).toBe(8.0);
  const invalid: string[] = [
    '{"payload":{"ignored":[1,]}}',
    '{"child":{"ignored":"bad\\q"}}',
    '{"count":1e}',
    '{"payload":[true false]}',
  ];
  for (let i = 0; i < invalid.length; i++) {
    lazyInput = invalid[i];
    expect((): void => {
      JSON.parse<CursorLazy>(lazyInput);
    }).toThrow();
  }
});


@json
class CursorNode {
  value: i32 = 0;
  left: CursorNode | null = null;
  right: CursorNode | null = null;
}

// Capability-only descriptors exercise an unsafe metadata cycle independently
// of the transform's existing mutually recursive schema limitation.
class CursorCycleA {
  __CURSOR_SUPPORTED(depth: i32): bool {
    return (
      JSON.__cursorSupports<CursorCycleB>(depth + 1) &&
      JSON.__cursorSupports<CursorChild>(depth + 1) &&
      JSON.__cursorSupports<CursorCustom>(depth + 1)
    );
  }
}

class CursorCycleB {
  __CURSOR_SUPPORTED(depth: i32): bool {
    return JSON.__cursorSupports<CursorCycleA>(depth + 1);
  }
}

describe("Capability traversal handles recursive types without trusting an unsafe cycle", () => {
  expect(JSON.__cursorSupports<CursorNode>()).toBe(true);
  expect(JSON.__cursorSupports<CursorCycleA>()).toBe(false);
  expect(JSON.__cursorSupports<CursorCycleB>()).toBe(false);
  expect(JSON.__cursorSupports<CursorChild>()).toBe(true);
  const root = JSON.parse<CursorNode>(
    '{"left":{"value":1,"right":{"value":2}},"value":3,"right":{"value":4}}',
  );
  __collect();
  expect(root.value).toBe(3);
  expect(root.left!.value).toBe(1);
  expect(root.left!.right!.value).toBe(2);
  expect(root.right!.value).toBe(4);
});

function makeCursorDynamic(): JSON.Obj {
  const payload = "x".repeat(131072);
  return JSON.parse<JSON.Obj>(
    '{"long":"' +
      payload +
      '","a":1,"\\u0061":2,"nested":[{"n":42}],"\\u0100":true}',
  );
}

describe("Dynamic cursor parsing retains lazy slots, decoded keys and source ownership", () => {
  expect(JSON.__cursorSupports<JSON.Value>()).toBe(true);
  expect(JSON.__cursorSupports<JSON.Obj>()).toBe(true);
  expect(JSON.__cursorSupports<JSON.Arr>()).toBe(true);
  const value = makeCursorDynamic();
  __collect();
  expect(value.size).toBe(5);
  expect(JSON.Value.slotIsLazy(unchecked(value._vals[0]))).toBe(true);
  expect(JSON.Value.slotIsLazy(unchecked(value._vals[3]))).toBe(true);
  expect(value.getAs<f64>("a")).toBe(2.0);
  expect(value.getAs<bool>("Ā")).toBe(true);
  expect(value.getAs<string>("long").length).toBe(131072);
  const nested = value.getAs<JSON.Arr>("nested");
  const child = nested.getAs<JSON.Obj>(0);
  child.set("n", 7);
  __collect();
  expect(child.getAs<i32>("n")).toBe(7);
  expect(value.delete("a")).toBe(true);
  expect(value.has("a")).toBe(false);
  expect(value.size).toBe(3);
  const scalar = JSON.parse<JSON.Value>('"line\\n中"');
  expect(scalar.get<string>()).toBe("line\n中");
  const arr = JSON.parse<JSON.Arr>('[null,true,-0,{"x":1},"\\uD800"]');
  __collect();
  expect(arr.length).toBe(5);
  expect(arr.at(0).type).toBe(JSON.Types.Null);
  expect(arr.getAs<bool>(1)).toBe(true);
  expect(reinterpret<u64>(arr.getAs<f64>(2))).toBe(0x8000000000000000);
  expect(arr.getAs<JSON.Obj>(3).getAs<f64>("x")).toBe(1.0);
  expect(arr.getAs<string>(4) == "\ud800").toBe(true);
});


@json
class CursorTyped {
  signed: Int16Array = new Int16Array(0);
  clamped: Uint8ClampedArray = new Uint8ClampedArray(0);
  floats: Float32Array = new Float32Array(0);
  bytes: ArrayBuffer = new ArrayBuffer(0);
}

let typedInput = "";
describe("Typed cursor readers preserve wrapping, clamping, floating bits and exact buffer lengths", () => {
  expect(JSON.__cursorSupports<CursorTyped>()).toBe(true);
  const out = JSON.parse<CursorTyped>(
    '{"bytes":[0,1,255,256],"signed":[32767,32768,-32769],"clamped":[-1.9,1.9,254.9,1e100],"floats":[0.1,-0,5e-324]}',
  );
  __collect();
  expect(out.signed[0]).toBe(<i16>32767);
  expect(out.signed[1]).toBe(<i16>-32768);
  expect(out.signed[2]).toBe(<i16>32767);
  expect(out.signed.buffer.byteLength).toBe(6);
  expect(out.clamped[0]).toBe(<u8>0);
  expect(out.clamped[1]).toBe(<u8>1);
  expect(out.clamped[2]).toBe(<u8>254);
  expect(out.clamped[3]).toBe(<u8>255);
  expect(out.clamped.buffer.byteLength).toBe(4);
  expect(reinterpret<u32>(out.floats[0])).toBe(0x3dcccccd);
  expect(reinterpret<u32>(out.floats[1])).toBe(0x80000000);
  expect(out.floats[2]).toBe(<f32>0.0);
  expect(out.floats.buffer.byteLength).toBe(12);
  expect(out.bytes.byteLength).toBe(4);
  expect(Uint8Array.wrap(out.bytes)[3]).toBe(<u8>0);
  const bad: string[] = [
    '{"signed":[1.5]}',
    '{"bytes":[-1]}',
    '{"floats":[1,]}',
    '{"clamped":[1e]}',
    '{"signed":[1,\u000b2]}',
  ];
  for (let i = 0; i < bad.length; i++) {
    typedInput = bad[i];
    expect((): void => {
      JSON.parse<CursorTyped>(typedInput);
    }).toThrow();
  }
});
