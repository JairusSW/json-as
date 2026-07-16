import { JSON } from "..";
import { describe, expect } from "as-test";

describe("Should serialize JSON.Raw", () => {
  expect(
    JSON.stringify<JSON.Raw>(JSON.Raw.from('{"x":1.0,"y":2.0,"z":3.0}')),
  ).toBe('{"x":1.0,"y":2.0,"z":3.0}');
});

describe("Should deserialize JSON.Raw", () => {
  expect(JSON.parse<JSON.Raw>('{"x":1.0,"y":2.0,"z":3.0}').toString()).toBe(
    '{"x":1.0,"y":2.0,"z":3.0}',
  );
});

describe("Should serialize Map<string, JSON.Raw>", () => {
  const m1 = new Map<string, JSON.Raw>();
  m1.set("hello", new JSON.Raw('"world"'));
  m1.set("pos", new JSON.Raw('{"x":1.0,"y":2.0,"z":3.0}'));

  expect(JSON.stringify(m1)).toBe(
    '{"hello":"world","pos":{"x":1.0,"y":2.0,"z":3.0}}',
  );
});

describe("Should deserialize Map<string, JSON.Raw>", () => {
  const m1 = JSON.parse<Map<string, JSON.Raw>>(
    '{"hello":"world","pos":{"x":1.0,"y":2.0,"z":3.0}}',
  );
  expect(JSON.stringify(m1)).toBe(
    '{"hello":"world","pos":{"x":1.0,"y":2.0,"z":3.0}}',
  );
});

describe("Should reuse mapped Raw values", () => {
  const raws = JSON.parse<Map<string, JSON.Raw>>('{"a":{"x":1},"b":[2,3]}');
  const firstA = raws.get("a");
  const reused = JSON.parse<Map<string, JSON.Raw>>(
    '{"a":{"x":4},"b":[5]}',
    raws,
  );

  expect(reused === raws).toBe(true);
  expect(reused.get("a") === firstA).toBe(true);
  // Serialization reads the renewed backing string without replacing wrappers.
  expect(JSON.stringify(reused)).toBe('{"a":{"x":4},"b":[5]}');
  expect(reused.get("a").data).toBe('{"x":4}');

  // Explicit mutation still replaces the renewed backing string normally.
  reused.get("a").set("false");
  expect(JSON.stringify(reused)).toBe('{"a":false,"b":[5]}');
});

describe("Should reuse pre-seeded Raw values across size changes", () => {
  const seeded = new Map<string, JSON.Raw>();
  const raw = new JSON.Raw("null");
  seeded.set("a", raw);

  JSON.parse<Map<string, JSON.Raw>>(
    '{"a":{"aMuchLongerPayload":[1,2,3]}}',
    seeded,
  );
  expect(seeded.get("a") === raw).toBe(true);
  expect(seeded.get("a").data).toBe('{"aMuchLongerPayload":[1,2,3]}');

  JSON.parse<Map<string, JSON.Raw>>('{"a":0}', seeded);
  expect(seeded.get("a") === raw).toBe(true);
  expect(seeded.get("a").data).toBe("0");
});

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe(
    '"regression"',
  );
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe(
    '["a","b","c"]',
  );
});

describe("Should handle additional JSON.Raw round trips", () => {
  const rawArray = JSON.parse<JSON.Raw[]>(
    '[{"x":"brace } and quote \\\\\\" ok"},[1,2,3],"abc def",false]',
  );
  expect(rawArray[0].toString()).toBe('{"x":"brace } and quote \\\\\\" ok"}');
  expect(rawArray[1].toString()).toBe("[1,2,3]");
  expect(rawArray[2].toString()).toBe('"abc def"');
  expect(rawArray[3].toString()).toBe("false");
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe(
    "[[1],[2,3],[]]",
  );
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe(
    '"line\\nbreak"',
  );
});
