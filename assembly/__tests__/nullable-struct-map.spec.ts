import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class NullableMapItem {
  n: i32 = 0;
  name: string = "";
}


@json
class NullableMapHolder {
  values: Map<string, NullableMapItem | null> = new Map<
    string,
    NullableMapItem | null
  >();
}

let invalidMapInput = "";
function rejectsMap(source: string): void {
  invalidMapInput = source;
  expect((): void => {
    JSON.parse<Map<string, NullableMapItem | null>>(invalidMapInput);
  }).toThrow();
}

describe("Nullable struct map values", () => {
  expect((): void => {
    JSON.parse<Map<string, NullableMapItem | null>>('{"a":null}');
  }).not.toThrow();
  const single = JSON.parse<Map<string, NullableMapItem | null>>('{"a":null}');
  expect(single.size).toBe(1);
  expect(single.has("a")).toBe(true);
  expect(single.get("a") == null).toBe(true);

  const mixed = JSON.parse<Map<string, NullableMapItem | null>>(
    ' { "a" : null \t, "b" : {"n":2,"name":"value"}, "c": null\r\n } ',
  );
  expect(mixed.size).toBe(3);
  expect(mixed.get("a") == null).toBe(true);
  expect(mixed.get("b")!.n).toBe(2);
  expect(mixed.get("b")!.name).toBe("value");
  expect(mixed.get("c") == null).toBe(true);
});

describe("Nullable struct map output reuse", () => {
  const out = JSON.parse<Map<string, NullableMapItem | null>>(
    '{"a":{"n":1,"name":"old"},"b":null,"stale":{"n":9,"name":"stale"}}',
  );
  const result = JSON.parse<Map<string, NullableMapItem | null>>(
    '{"a":null,"b":{"n":2,"name":"new"}}',
    out,
  );
  expect(changetype<usize>(result)).toBe(changetype<usize>(out));
  expect(out.size).toBe(2);
  expect(out.get("a") == null).toBe(true);
  expect(out.get("b")!.n).toBe(2);
  expect(out.has("stale")).toBe(false);
  const reused = out.get("b");
  JSON.parse<Map<string, NullableMapItem | null>>(
    '{"b":{"n":3,"name":"again"},"a":{"n":4,"name":"back"}}',
    out,
  );
  expect(changetype<usize>(out.get("b"))).toBe(changetype<usize>(reused));
  expect(out.get("b")!.n).toBe(3);
  expect(out.get("a")!.n).toBe(4);
  JSON.parse<Map<string, NullableMapItem | null>>(
    '{"b":null,"a":null,"b":{"n":5,"name":"last"}}',
    out,
  );
  expect(out.size).toBe(2);
  expect(out.get("a") == null).toBe(true);
  expect(out.get("b")!.n).toBe(5);
  JSON.parse<Map<string, NullableMapItem | null>>('{"a":null}', out);
  expect(out.size).toBe(1);
  expect(out.has("b")).toBe(false);
  expect(out.get("a") == null).toBe(true);
  JSON.parse<Map<string, NullableMapItem | null>>("{}", out);
  expect(out.size).toBe(0);
});

describe("Nullable map fields and nonnullable controls", () => {
  const holder = JSON.parse<NullableMapHolder>(
    '{"values":{"a":null,"b":{"n":7,"name":"nested"}}}',
  );
  expect(holder.values.get("a") == null).toBe(true);
  expect(holder.values.get("b")!.n).toBe(7);
  JSON.parse<NullableMapHolder>('{"values":{"b":null}}', holder);
  expect(holder.values.size).toBe(1);
  expect(holder.values.get("b") == null).toBe(true);
  expect(holder.values.has("a")).toBe(false);
  const control = JSON.parse<Map<string, NullableMapItem>>(
    '{"a":{"n":8,"name":"control"}}',
  );
  expect(control.get("a").n).toBe(8);
});

describe("Nullable map null tokens are bounded", () => {
  rejectsMap('{"a":nul}');
  rejectsMap('{"a":nullx}');
  rejectsMap('{"a":null false}');
  rejectsMap('{"a":"null"}');
  expect((): void => {
    JSON.parse<Map<string, NullableMapItem>>('{"a":null}');
  }).toThrow();
});
