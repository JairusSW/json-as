import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class StrictPublicScalar {
  integer: i32 = 0;
  float: f64 = 0.0;
  text: string = "";
  enabled: bool = false;
}

let strictPublicInput = "";
const strictReuseOut = new StrictPublicScalar();

function expectStrictPublicReject(source: string): void {
  strictPublicInput = source;
  expect((): void => {
    JSON.parse<StrictPublicScalar>(strictPublicInput);
  }).toThrow();
}

describe("strict public parsing works with either fast-path configuration", () => {
  const parsed = JSON.parse<StrictPublicScalar>(
    '{"integer":7,"float":1.5,"text":"ok","enabled":true}',
  );
  expect(parsed.integer).toBe(7);
  expect(parsed.float).toBe(1.5);
  expect(parsed.text).toBe("ok");
  expect(parsed.enabled).toBe(true);

  const empty = JSON.parse<StrictPublicScalar>("{}");
  expect(empty.integer).toBe(0);
  expect(empty.text).toBe("");
});

describe("strict float fields accept complete fallback tokens", () => {
  expect(JSON.parse<StrictPublicScalar>('{"float":1e00001}').float).toBe(10.0);
  expect(JSON.parse<StrictPublicScalar>('{"float":1e+00001}').float).toBe(10.0);
  expect(JSON.parse<StrictPublicScalar>('{"float":1e-00001}').float).toBe(0.1);
  expect(
    JSON.parse<StrictPublicScalar>('{"float":1.234567890123456789}').float >
      1.23,
  ).toBe(true);
});

describe("strict malformed input is rejected before mutating reused output", () => {
  strictReuseOut.integer = 100;
  strictReuseOut.float = 200.0;
  strictReuseOut.text = "sentinel";
  strictReuseOut.enabled = true;

  strictPublicInput = '{"integer":1,"float":01}';
  expect((): void => {
    JSON.parse<StrictPublicScalar>(strictPublicInput, strictReuseOut);
  }).toThrow();

  expect(strictReuseOut.integer).toBe(100);
  expect(strictReuseOut.float).toBe(200.0);
  expect(strictReuseOut.text).toBe("sentinel");
  expect(strictReuseOut.enabled).toBe(true);
});

describe("strict truncated scalar objects fail recoverably", () => {
  expectStrictPublicReject("");
  expectStrictPublicReject("   ");
  expectStrictPublicReject("{");
  expectStrictPublicReject('{"');
  expectStrictPublicReject('{"integer"');
  expectStrictPublicReject('{"integer":');
  expectStrictPublicReject('{"enabled":t');
  expectStrictPublicReject('{"enabled":fals');
  expectStrictPublicReject('{"text":"\\');
  expectStrictPublicReject('{"text":"\\u');
  expectStrictPublicReject('{"text":"\\u1');
});
