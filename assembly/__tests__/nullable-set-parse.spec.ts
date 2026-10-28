import { JSON } from "..";
import { deserializeSet } from "../deserialize/naive/set";
import { describe, expect } from "as-test";


@json
class NullableSetHolder {
  values: Set<string | null> = new Set<string | null>();
  tail: i32 = 0;
}

let invalidSetInput = "";
function expectNullableSetReject(source: string): void {
  invalidSetInput = source;
  expect((): void => {
    const ptr = changetype<usize>(invalidSetInput);
    deserializeSet<Set<string | null>>(
      ptr,
      ptr + ((<usize>invalidSetInput.length) << 1),
      0,
    );
  }).toThrow();
}

describe("nullable string sets preserve actual null and quoted null", () => {
  const onlyNull = JSON.parse<Set<string | null>>("[null]");
  expect(onlyNull.size).toBe(1);
  expect(onlyNull.has(null)).toBe(true);
  const mixed = JSON.parse<Set<string | null>>('[null,"a","null",null,"a"]');
  expect(mixed.size).toBe(3);
  expect(mixed.has(null)).toBe(true);
  expect(mixed.has("a")).toBe(true);
  expect(mixed.has("null")).toBe(true);
  const values = mixed.values();
  expect(values[0] === null).toBe(true);
  expect(values[1]).toBe("a");
  expect(values[2]).toBe("null");
});

describe("nullable string sets allow whitespace around null", () => {
  const spaces = [" ", "\t", "\r", "\n", " \t\r\n"];
  for (let i = 0; i < spaces.length; i++) {
    const space = spaces[i];
    const parsed = JSON.parse<Set<string | null>>(
      space +
        "[" +
        space +
        "null" +
        space +
        "," +
        space +
        '"a"' +
        space +
        "]" +
        space,
    );
    expect(parsed.size).toBe(2);
    expect(parsed.has(null)).toBe(true);
    expect(parsed.has("a")).toBe(true);
  }
});

function parseSetInto(
  source: string,
  out: Set<string | null>,
): Set<string | null> {
  const ptr = changetype<usize>(source);
  return deserializeSet<Set<string | null>>(
    ptr,
    ptr + ((<usize>source.length) << 1),
    changetype<usize>(out),
  );
}

describe("nullable string sets clear explicit decoder output", () => {
  const out = new Set<string | null>();
  out.add("stale");
  const first = parseSetInto('["a",null]', out);
  expect(first === out).toBe(true);
  expect(out.has("stale")).toBe(false);
  expect(out.has(null)).toBe(true);
  expect(out.has("a")).toBe(true);
  const second = parseSetInto('["b"]', out);
  expect(second === out).toBe(true);
  expect(out.size).toBe(1);
  expect(out.has(null)).toBe(false);
  expect(out.has("a")).toBe(false);
  expect(out.has("b")).toBe(true);
  parseSetInto("[null]", out);
  expect(out.size).toBe(1);
  expect(out.has(null)).toBe(true);
  parseSetInto("[]", out);
  expect(out.size).toBe(0);
});

describe("nullable string set fields preserve their following field and reuse", () => {
  const out = JSON.parse<NullableSetHolder>('{"values":[null,"x"],"tail":7}');
  expect(out.values.has(null)).toBe(true);
  expect(out.values.has("x")).toBe(true);
  expect(out.tail).toBe(7);
  const reused = JSON.parse<NullableSetHolder>(
    '{"tail":9,"values":[ "y" , null ]}',
    out,
  );
  expect(reused === out).toBe(true);
  expect(reused.values.has("x")).toBe(false);
  expect(reused.values.has("y")).toBe(true);
  expect(reused.values.has(null)).toBe(true);
  expect(reused.tail).toBe(9);
});

describe("nullable string sets reject malformed null tokens", () => {
  const invalid = [
    "[n]",
    "[nu]",
    "[nul]",
    "[null",
    "[nullx]",
    "[null0]",
    "[nulltrue]",
    '[null"x"]',
    "[null null]",
    "[Null]",
    "[null,]",
  ];
  for (let i = 0; i < invalid.length; i++) expectNullableSetReject(invalid[i]);
});

describe("nonnull string sets retain their existing behavior", () => {
  const parsed = JSON.parse<Set<string>>('["null","a","a"]');
  expect(parsed.size).toBe(2);
  expect(parsed.has("null")).toBe(true);
  expect(parsed.has("a")).toBe(true);
  expect((): void => {
    const source = "[null]";
    const ptr = changetype<usize>(source);
    deserializeSet<Set<string>>(ptr, ptr + ((<usize>source.length) << 1), 0);
  }).toThrow();
});
