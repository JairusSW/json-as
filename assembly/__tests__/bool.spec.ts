import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class BoolEnvelope {
  value: bool = false;
  flags: bool[] = [];
}

describe("Should serialize booleans", () => {
  expect(JSON.stringify<bool>(true)).toBe("true");
  expect(JSON.stringify<bool>(false)).toBe("false");
});

describe("Should deserialize booleans", () => {
  expect(JSON.parse<boolean>("true").toString()).toBe("true");
  expect(JSON.parse<boolean>("false").toString()).toBe("false");
});

describe("Should preserve the current invalid-boolean fallback contract", () => {
  expect(JSON.parse<boolean>("truX").toString()).toBe("false");
  expect(JSON.parse<boolean>("falsX").toString()).toBe("false");
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

describe("Should round-trip boolean arrays and nested arrays", () => {
  expect(JSON.stringify(JSON.parse<bool[]>("[true,false,true,false]"))).toBe(
    "[true,false,true,false]",
  );
  expect(JSON.stringify(JSON.parse<bool[][]>("[[true],[false,true]]"))).toBe(
    "[[true],[false,true]]",
  );
});

describe("Should handle boolean whitespace and nesting cases", () => {
  expect(JSON.stringify(JSON.parse<bool[]>("[ true , false , true ]"))).toBe(
    "[true,false,true]",
  );
  expect(
    JSON.stringify(JSON.parse<bool[][]>("[[ true ], [ false , true ], []]")),
  ).toBe("[[true],[false,true],[]]");
});

describe("Should deserialize booleans in object wrappers", () => {
  // Reaches deserializeBooleanArrayBody / deserializeBooleanArrayField in
  // SWAR/SIMD mode via the transform-generated __DESERIALIZE_FAST: the
  // pre-initialized `flags: bool[] = []` field forces the `Into` path on
  // a populated body, and the empty-body case below forces the
  // `BRACKET_RIGHT` short-circuit branch.
  const parsed = JSON.parse<BoolEnvelope>(
    '{"value":true,"flags":[false,true,false]}',
  );
  expect(parsed.value.toString()).toBe("true");
  expect(parsed.flags.length.toString()).toBe("3");
  expect(parsed.flags[0].toString()).toBe("false");
  expect(parsed.flags[1].toString()).toBe("true");
  expect(JSON.stringify(parsed)).toBe(
    '{"value":true,"flags":[false,true,false]}',
  );

  const empty = JSON.parse<BoolEnvelope>('{"value":false,"flags":[]}');
  expect(empty.flags.length).toBe(0);
  expect(JSON.stringify(empty)).toBe('{"value":false,"flags":[]}');
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
