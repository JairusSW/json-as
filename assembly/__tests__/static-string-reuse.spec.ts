import { JSON } from "..";
import { describe, expect } from "as-test";


@json class StringPair {
  a: StaticArray<string> = [];
  b: StaticArray<string> = [];
}
describe("static string destinations protect shared arrays and elements", () => {
  const shared = "x".repeat(80);
  const out = new StringPair();
  out.a = [shared];
  out.b = [shared];
  JSON.parse<StringPair>('{"a":["first"],"b":["second"]}', out);
  expect(out.a[0]).toBe("first");
  expect(out.b[0]).toBe("second");
  out.b = out.a;
  JSON.parse<StringPair>('{"a":["left"],"b":["right"]}', out);
  __collect();
  expect(out.a[0]).toBe("left");
  expect(out.b[0]).toBe("right");
});
describe("static string destinations cannot overwrite input", () => {
  const input = '{"a":["' + "x".repeat(100) + '"],"b":[]}';
  const original = '{"a":["' + "x".repeat(100) + '"],"b":[]}';
  const out = new StringPair();
  out.a = [input];
  JSON.parse<StringPair>(input, out);
  expect(input).toBe(original);
  expect(out.a[0]).toBe("x".repeat(100));
});
