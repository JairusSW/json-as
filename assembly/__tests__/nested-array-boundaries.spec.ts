import { JSON } from "..";
import { describe, expect } from "as-test";
import { deserializeStaticArray } from "../deserialize/naive/staticarray";


@json
class NestedStrings {
  values: string[][] = [];
  tail: i32 = 0;
}

describe("Nested integer arrays replace reused elements instead of appending", () => {
  const first = [99];
  const second = [98, 97];
  const out = [first, second];
  const parsed = JSON.parse<i32[][]>("[[1,2],[3]]", out);
  expect(changetype<usize>(parsed)).toBe(changetype<usize>(out));
  expect(JSON.stringify(parsed)).toBe("[[1,2],[3]]");
  expect(JSON.stringify(first)).toBe("[99]");
  expect(JSON.stringify(second)).toBe("[98,97]");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[4]]", out))).toBe("[[4]]");
  expect(JSON.stringify(JSON.parse<i32[][]>("[]", out))).toBe("[]");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[],[5],[6,7]]", out))).toBe(
    "[[],[5],[6,7]]",
  );
});

describe("Nested dynamic arrays replace reused contents", () => {
  const first = [JSON.Value.from(99)];
  const out = [first];
  const parsed = JSON.parse<JSON.Value[][]>('[[],[1,"[",true,null]]', out);
  expect(changetype<usize>(parsed)).toBe(changetype<usize>(out));
  expect(JSON.stringify(parsed)).toBe('[[],[1,"[",true,null]]');
  expect(JSON.stringify(first)).toBe("[99]");
  expect(JSON.stringify(JSON.parse<JSON.Value[][]>('[["]",false]]', out))).toBe(
    '[["]",false]]',
  );
  expect(JSON.stringify(JSON.parse<JSON.Value[][]>("[]", out))).toBe("[]");
});

describe("Nested string arrays ignore brackets inside strings", () => {
  const inputs = [
    '[["["]]',
    '[["]"]]',
    '[["[ ] { } ,"],["left[","right]"]]',
    '[["a\\\"[","b\\\"]","slash\\\\"],[],["tail"]]',
  ];
  const out: string[][] = [["old"]];
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    expect(JSON.stringify(JSON.parse<string[][]>(input))).toBe(input);
    expect(JSON.stringify(JSON.parse<string[][]>(input, out))).toBe(input);
  }
});

describe("Nested arrays keep the correct bounds at deeper levels", () => {
  const input = '[[["["],["]"]],[],[["x\\\"["],[]]]';
  expect(JSON.stringify(JSON.parse<string[][][]>(input))).toBe(input);
  const out: string[][][] = [[["old"]], [["stale"]]];
  expect(JSON.stringify(JSON.parse<string[][][]>(input, out))).toBe(input);
  expect(JSON.stringify(JSON.parse<string[][][]>("[[[]]]", out))).toBe(
    "[[[]]]",
  );
  expect(JSON.stringify(JSON.parse<string[][][]>("[]", out))).toBe("[]");
});

describe("Nested arrays support whitespace and nullable inner arrays", () => {
  const input = ' \n [ [ "[" ] , [ "]" , "x" ] , [ ] ] \t ';
  expect(JSON.stringify(JSON.parse<string[][]>(input))).toBe(
    '[["["],["]","x"],[]]',
  );
  const nullable = JSON.parse<(i32[] | null)[]>("[null,[1,2],null,[]]");
  expect(JSON.stringify(nullable)).toBe("[null,[1,2],null,[]]");
  expect(
    JSON.stringify(JSON.parse<(i32[] | null)[]>("[[3],null]", nullable)),
  ).toBe("[[3],null]");
});

describe("Nested float arrays replace their destination slots", () => {
  const first: f64[] = [99.5];
  const out: f64[][] = [first];
  const parsed = JSON.parse<f64[][]>("[[1.25,-2.5],[],[3.75]]", out);
  expect(JSON.stringify(parsed)).toBe("[[1.25,-2.5],[],[3.75]]");
  expect(JSON.stringify(first)).toBe("[99.5]");
  expect(JSON.stringify(JSON.parse<f64[][]>("[[]]", out))).toBe("[[]]");
});

describe("Nested array reuse does not merge aliased inner slots", () => {
  const shared = [99];
  const out = [shared, shared];
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3]]", out))).toBe(
    "[[1],[2,3]]",
  );
  expect(JSON.stringify(shared)).toBe("[99]");
  const dynamicShared = [JSON.Value.from(99)];
  const dynamicOut = [dynamicShared, dynamicShared];
  expect(
    JSON.stringify(JSON.parse<JSON.Value[][]>("[[1],[2,3]]", dynamicOut)),
  ).toBe("[[1],[2,3]]");
  expect(JSON.stringify(dynamicShared)).toBe("[99]");
});

describe("Nested StaticArray values use quote-aware bounds", () => {
  const input = '[["["],["]","slash\\\\"],[]]';
  expect(
    JSON.stringify(JSON.parse<StaticArray<StaticArray<string>>>(input)),
  ).toBe(input);
  expect(JSON.stringify(JSON.parse<StaticArray<string[]>>(input))).toBe(input);
  let out: StaticArray<StaticArray<string>> = [["old"]];
  const start = changetype<usize>(input);
  out = deserializeStaticArray<StaticArray<StaticArray<string>>>(
    start,
    start + ((<usize>input.length) << 1),
    changetype<usize>(out),
  );
  expect(JSON.stringify(out)).toBe(input);
});

describe("Nested array fields preserve quoted brackets in both field orders", () => {
  const expected = '{"values":[["["],["]"],[]],"tail":4}';
  expect(JSON.stringify(JSON.parse<NestedStrings>(expected))).toBe(expected);
  const reordered = '{ "tail" : 4, "values" : [ ["["], ["]"], [] ] }';
  expect(JSON.stringify(JSON.parse<NestedStrings>(reordered))).toBe(expected);
  const out = new NestedStrings();
  out.values = [["old"]];
  expect(JSON.stringify(JSON.parse<NestedStrings>(reordered, out))).toBe(
    expected,
  );
  expect(
    JSON.stringify(JSON.parse<NestedStrings>('{"values":[],"tail":5}', out)),
  ).toBe('{"values":[],"tail":5}');
});
