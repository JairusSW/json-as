import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class NullableCollections {
  array: Array<string | null> = [null, "array"];
  staticArray: StaticArray<string | null> = ["static", null];
  set: Set<string | null> = new Set<string | null>().add(null).add("set");
}


@json
class NullableCustomElement {
  value: i32 = 7;


  @serializer("string")
  serialize(self: NullableCustomElement): string {
    return JSON.stringify(self.value.toString());
  }
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

describe("Should serialize nullable strings in arrays", () => {
  expect(JSON.stringify<Array<string | null>>([])).toBe("[]");
  expect(JSON.stringify<Array<string | null>>(["", "a"])).toBe('["","a"]');
  expect(JSON.stringify<Array<string | null>>([null])).toBe("[null]");
  expect(JSON.stringify<Array<string | null>>([null, null])).toBe(
    "[null,null]",
  );
  expect(JSON.stringify<Array<string | null>>(["a", null])).toBe('["a",null]');
  expect(JSON.stringify<Array<string | null>>([null, "a"])).toBe('[null,"a"]');
  checkOutputReuse<Array<string | null>>(
    [null, "", "a", null, 'quote"\\\n', null],
    '[null,"","a",null,"quote\\"\\\\\\n",null]',
  );
});

describe("Should serialize nullable strings in static arrays", () => {
  expect(JSON.stringify<StaticArray<string | null>>([])).toBe("[]");
  expect(JSON.stringify<StaticArray<string | null>>(["", "a"])).toBe(
    '["","a"]',
  );
  expect(JSON.stringify<StaticArray<string | null>>([null])).toBe("[null]");
  expect(JSON.stringify<StaticArray<string | null>>([null, null])).toBe(
    "[null,null]",
  );
  expect(JSON.stringify<StaticArray<string | null>>(["a", null])).toBe(
    '["a",null]',
  );
  expect(JSON.stringify<StaticArray<string | null>>([null, "a"])).toBe(
    '[null,"a"]',
  );
  checkOutputReuse<StaticArray<string | null>>(
    [null, "", "a", null, 'quote"\\\n', null],
    '[null,"","a",null,"quote\\"\\\\\\n",null]',
  );
});

describe("Should serialize nullable strings in sets", () => {
  expect(JSON.stringify(new Set<string | null>())).toBe("[]");
  expect(JSON.stringify(new Set<string | null>().add("").add("a"))).toBe(
    '["","a"]',
  );
  expect(JSON.stringify(new Set<string | null>().add(null))).toBe("[null]");
  expect(JSON.stringify(new Set<string | null>().add("a").add(null))).toBe(
    '["a",null]',
  );
  expect(JSON.stringify(new Set<string | null>().add(null).add("a"))).toBe(
    '[null,"a"]',
  );
  checkOutputReuse<Set<string | null>>(
    new Set<string | null>().add("").add(null).add('quote"\\\n'),
    '["",null,"quote\\"\\\\\\n"]',
  );
});

describe("Should serialize nested nullable collections", () => {
  checkOutputReuse<NullableCollections>(
    new NullableCollections(),
    '{"array":[null,"array"],"staticArray":["static",null],"set":[null,"set"]}',
  );
  expect(
    JSON.stringify<Array<Array<string | null> | null>>([
      null,
      ["a", null],
      null,
    ]),
  ).toBe('[null,["a",null],null]');
});

describe("Should handle null before array custom serialization", () => {
  expect(JSON.stringify<Array<NullableCustomElement | null>>([null])).toBe(
    "[null]",
  );
  expect(
    JSON.stringify<Array<NullableCustomElement | null>>([
      null,
      new NullableCustomElement(),
      null,
    ]),
  ).toBe('[null,"7",null]');
});

describe("Should preserve non-nullable string collection paths", () => {
  checkOutputReuse<string[]>(
    ["", "a", 'quote"\\\n'],
    '["","a","quote\\"\\\\\\n"]',
  );
  checkOutputReuse<StaticArray<string>>(
    ["", "a", 'quote"\\\n'],
    '["","a","quote\\"\\\\\\n"]',
  );
  checkOutputReuse<Set<string>>(
    new Set<string>().add("").add("a").add('quote"\\\n'),
    '["","a","quote\\"\\\\\\n"]',
  );
});
