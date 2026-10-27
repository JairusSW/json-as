import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class NullableRawMapHolder {
  values: Map<string, JSON.Raw | null> = new Map<string, JSON.Raw | null>();
}

function checkOutputReuse<T>(value: T, expected: string): void {
  let out = JSON.stringify<T>(value);
  expect(out).toBe(expected);
  out = JSON.stringify<T>(value, out);
  expect(out).toBe(expected);
  out = JSON.stringify<string>("x", out);
  expect(out).toBe('"x"');
  out = JSON.stringify<T>(value, out);
  expect(out).toBe(expected);
}

describe("Should serialize actual null Raw map values", () => {
  const values = new Map<string, JSON.Raw | null>();
  checkOutputReuse(values, "{}");
  values.set("first", null);
  checkOutputReuse(values, '{"first":null}');
  values.set("last", null);
  checkOutputReuse(values, '{"first":null,"last":null}');
});

describe("Should preserve Raw JSON alongside actual null values", () => {
  const values = new Map<string, JSON.Raw | null>();
  values.set("first", null);
  values.set("rawNull", new JSON.Raw("null"));
  values.set("quotedNull", new JSON.Raw('"null"'));
  values.set("object", new JSON.Raw('{"n":1}'));
  values.set("middle", null);
  values.set('escaped"key', new JSON.Raw('[true,"x"]'));
  values.set("last", null);
  checkOutputReuse(
    values,
    '{"first":null,"rawNull":null,"quotedNull":"null","object":{"n":1},"middle":null,"escaped\\"key":[true,"x"],"last":null}',
  );
});

describe("Should serialize nested nullable Raw maps after mutation", () => {
  const holder = new NullableRawMapHolder();
  holder.values.set("item", new JSON.Raw('{"n":1}'));
  let out = JSON.stringify(holder);
  expect(out).toBe('{"values":{"item":{"n":1}}}');
  holder.values.set("item", null);
  out = JSON.stringify(holder, out);
  expect(out).toBe('{"values":{"item":null}}');
  holder.values.set("item", new JSON.Raw("[1,2,3]"));
  out = JSON.stringify(holder, out);
  expect(out).toBe('{"values":{"item":[1,2,3]}}');
  holder.values.clear();
  out = JSON.stringify(holder, out);
  expect(out).toBe('{"values":{}}');
});

describe("Should preserve the nonnullable Raw map path", () => {
  const values = new Map<string, JSON.Raw>();
  values.set("rawNull", new JSON.Raw("null"));
  values.set("quotedNull", new JSON.Raw('"null"'));
  values.set("object", new JSON.Raw('{"n":1}'));
  checkOutputReuse(
    values,
    '{"rawNull":null,"quotedNull":"null","object":{"n":1}}',
  );
});
