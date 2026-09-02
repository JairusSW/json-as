import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class StrictFastNumericFields {
  integer: i32 = 0;
  unsigned: u64 = 0;
  float: f64 = 0;
  enabled: bool = false;
}


@json
class StrictFastStringFields {
  first: string = "";
  second: string = "";
}

function expectStrictFastReject(source: string): void {
  const start = changetype<usize>(source);
  const end = start + ((<usize>source.length) << 1);
  const out = new StrictFastNumericFields();

  expect(out.__DESERIALIZE_FAST(start, end, out)).toBe(0);
}

function expectStrictStringFastReject(source: string): void {
  const start = changetype<usize>(source);
  const end = start + ((<usize>source.length) << 1);
  const out = new StrictFastStringFields();

  expect(out.__DESERIALIZE_FAST(start, end, out)).toBe(0);
}

describe("strict generated numeric paths fail malformed fields", () => {
  expectStrictFastReject('{"integer":1,}');
  expectStrictFastReject('{"integer":01}');
  expectStrictFastReject('{"integer":-}');
  expectStrictFastReject('{"unsigned":01}');
  expectStrictFastReject('{"unsigned":-1}');
  expectStrictFastReject('{"float":1.}');
  expectStrictFastReject('{"float":01.5}');
  expectStrictFastReject('{"float":1e}');
  expectStrictFastReject('{"float":NaN}');
});

describe("strict generated string paths validate complete tokens", () => {
  const valid = '{"first":"line\\nquote: \\"","second":"slash: \\\\"}';
  const start = changetype<usize>(valid);
  const end = start + ((<usize>valid.length) << 1);
  const out = new StrictFastStringFields();
  expect(out.__DESERIALIZE_FAST(start, end, out)).toBe(end);
  expect(out.first).toBe('line\nquote: "');
  expect(out.second).toBe("slash: \\");

  expectStrictStringFastReject('{"first":"line\nbreak","second":"ok"}');
  expectStrictStringFastReject('{"first":"tab\tbreak","second":"ok"}');
  expectStrictStringFastReject('{"first":"bad\\q","second":"ok"}');
  expectStrictStringFastReject('{"first":"unterminated,"second":"ok"}');
  expectStrictStringFastReject('{"first":1,"second":"ok"}');
});
