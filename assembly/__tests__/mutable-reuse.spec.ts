import { JSON } from "..";
import { describe, expect } from "as-test";


@json class RawOwner {
  a: JSON.Raw = JSON.Raw.from("{}");
  b: Map<string, JSON.Raw> = new Map();
}


@json class Views {
  a: Uint8Array = new Uint8Array(2);
  b: Uint8Array = new Uint8Array(2);
}


@json class Dates {
  a: Date = new Date(0);
  b: Date = new Date(0);
}
describe("Raw reuse respects sharing across fields and maps", () => {
  const out = new RawOwner();
  out.b.set("x", out.a);
  JSON.parse<RawOwner>('{"a":{"n":1},"b":{"x":{"n":2}}}', out);
  expect(out.a.data).toBe('{"n":1}');
  expect(out.b.get("x").data).toBe('{"n":2}');
});
describe("distinct Raw wrappers cannot overwrite shared string storage", () => {
  const shared = '{"n":0}' + " ".repeat(80);
  const out = new Map<string, JSON.Raw>();
  out.set("a", JSON.Raw.from(shared));
  out.set("b", JSON.Raw.from(shared));
  JSON.parse<Map<string, JSON.Raw>>('{"a":{"n":1},"b":{"n":2}}', out);
  expect(out.get("a").data).toBe('{"n":1}');
  expect(out.get("b").data).toBe('{"n":2}');
});
describe("distinct typed views cannot overwrite shared backing storage", () => {
  const out = new Views();
  const buffer = new ArrayBuffer(2);
  out.a = Uint8Array.wrap(buffer);
  out.b = Uint8Array.wrap(buffer);
  JSON.parse<Views>('{"a":[1,2],"b":[3,4]}', out);
  expect(JSON.stringify(out)).toBe('{"a":[1,2],"b":[3,4]}');
});
describe("Date destinations stay independent under reuse", () => {
  const out = new Dates();
  out.b = out.a;
  JSON.parse<Dates>(
    '{"a":"1970-01-01T00:00:00.000Z","b":"1970-01-01T00:00:01.000Z"}',
    out,
  );
  expect(out.a.getTime()).toBe(<i64>0);
  expect(out.b.getTime()).toBe(<i64>1000);
});
