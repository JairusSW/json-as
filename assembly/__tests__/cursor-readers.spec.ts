import { JSON } from "..";
import { describe, expect } from "as-test";
import { bs } from "../../lib/as-bs";
import {
  readCursorString,
  readCursorNumber,
  skipCursorString,
  scanCursorString,
  skipCursorNumber,
  skipCheckedValue,
  validateCursor,
  MAX_CURSOR_DEPTH,
} from "../deserialize/cursor";
import { validateJSON } from "../util/validateJson";

class StringSlot {
  value: string = "unchanged";
}
class NumberSlot {
  value: f64 = 0;
  integer: i64 = 0;
}

function parseString(source: string, slot: StringSlot): usize {
  const start = changetype<usize>(source);
  return readCursorString(
    start,
    start + ((<usize>source.length) << 1),
    changetype<usize>(slot),
    offsetof<StringSlot>("value"),
  );
}

describe("Checked string cursors consume one token and materialize its decoded contents", () => {
  const slot = new StringSlot();
  const inputs: string[] = [
    '""',
    '"plain"',
    '"a\\nb\\t\\u4e2d\\uD800"',
    '"\\\"\\\\\\/\\b\\f\\r"',
    '"Ā中￿"',
  ];
  const values: string[] = [
    "",
    "plain",
    "a\nb\t中\ud800",
    '"\\/\b\f\r',
    "Ā中￿",
  ];
  for (let i = 0; i < inputs.length; i++) {
    const source = inputs[i] + ',"next"';
    const start = changetype<usize>(source);
    const end = start + ((<usize>source.length) << 1);
    expect(parseString(source, slot)).toBe(
      start + ((<usize>inputs[i].length) << 1),
    );
    expect(slot.value == values[i]).toBe(true);
    expect((scanCursorString(start, end) & 1) != 0).toBe(
      inputs[i].includes("\\"),
    );
    expect(skipCursorString(start, end)).toBe(
      start + ((<usize>inputs[i].length) << 1),
    );
  }
});

describe("Checked strings reject malformed tokens and restore borrowed scratch", () => {
  const bad: string[] = [
    '"',
    '"\\',
    '"a\\q"',
    '"\\u"',
    '"\\u123"',
    '"\\u12xz"',
    '"a\nb"',
    '"a\u0000b"',
    '"good\\nthen\u0001"',
  ];
  const slot = new StringSlot();
  for (let i = 0; i < bad.length; i++) {
    slot.value = "unchanged";
    const mark = bs.offset - bs.buffer;
    expect(parseString(bad[i], slot)).toBe(<usize>0);
    expect(slot.value).toBe("unchanged");
    expect(bs.offset - bs.buffer).toBe(mark);
  }
});

describe("String events at every vector lane obey token boundaries", () => {
  const slot = new StringSlot();
  for (let n = 0; n < 40; n++) {
    const prefix = "x".repeat(n);
    const valid = '"' + prefix + '"\u0001';
    const start = changetype<usize>(valid);
    expect(parseString(valid, slot)).toBe(start + ((<usize>(n + 2)) << 1));
    expect(slot.value == prefix).toBe(true);
    expect(validateCursor(valid)).toBe(false);
    expect(parseString('"' + prefix + '\u0001"', slot)).toBe(<usize>0);
    const escaped = '"' + prefix + '\\u0001tail"';
    expect(parseString(escaped, slot) != 0).toBe(true);
    expect(slot.value == prefix + "\u0001tail").toBe(true);
  }
});

describe("Number cursors validate grammar while preserving numeric conversion", () => {
  const slot = new NumberSlot();
  const inputs: string[] = [
    "0",
    "-0",
    "12",
    "-9223372036854775808",
    "1.25",
    "1e+2",
    "1e-22",
    "5e-324",
    "1.7976931348623157e308",
    "1.234567890123456789",
    "1e999999999999999999999",
  ];
  const values: f64[] = [
    0.0,
    -0.0,
    12.0,
    -9223372036854775808.0,
    1.25,
    100.0,
    1e-22,
    5e-324,
    1.7976931348623157e308,
    1.234567890123456789,
    Infinity,
  ];
  for (let i = 0; i < inputs.length; i++) {
    const source = inputs[i] + ",false";
    const start = changetype<usize>(source);
    const end = start + ((<usize>source.length) << 1);
    const next = start + ((<usize>inputs[i].length) << 1);
    expect(
      readCursorNumber<f64>(
        start,
        end,
        changetype<usize>(slot) + offsetof<NumberSlot>("value"),
      ),
    ).toBe(next);
    expect(reinterpret<u64>(slot.value)).toBe(reinterpret<u64>(values[i]));
    expect(skipCursorNumber(start, end)).toBe(next);
  }
  const integer = "-9223372036854775808";
  const start = changetype<usize>(integer);
  expect(
    readCursorNumber<i64>(
      start,
      start + ((<usize>integer.length) << 1),
      changetype<usize>(slot) + offsetof<NumberSlot>("integer"),
    ) != 0,
  ).toBe(true);
  expect(slot.integer).toBe(i64.MIN_VALUE);
  const bad: string[] = [
    "",
    "-",
    "+1",
    "01",
    "-01",
    "1.",
    "1e",
    "1e+",
    ".1",
    "NaN",
    "Infinity",
  ];
  for (let i = 0; i < bad.length; i++) {
    const ptr = changetype<usize>(bad[i]);
    expect(skipCursorNumber(ptr, ptr + ((<usize>bad[i].length) << 1))).toBe(
      <usize>0,
    );
  }
});

describe("Checked discard validates nested grammar and preserves exact cursor position", () => {
  const valid: string[] = [
    "null",
    "true",
    "false",
    "[]",
    "{}",
    '[1,{"a":[null,false,"\\u0000"]}]',
    '{"a":1,"a":2}',
    ' { "key" : [ 1, 2 ] }',
  ];
  for (let i = 0; i < valid.length; i++) {
    const source = valid[i] + ",trailing";
    const start = changetype<usize>(source);
    expect(skipCheckedValue(start, start + ((<usize>source.length) << 1))).toBe(
      start + ((<usize>valid[i].length) << 1),
    );
    expect(validateCursor(valid[i])).toBe(true);
    expect(validateCursor(source)).toBe(false);
  }
  const invalid: string[] = [
    "",
    "[",
    "{",
    "[1,]",
    '{"a":1,}',
    '{"a" 1}',
    '{"a":}',
    "[,1]",
    "[true false]",
    '{"a":1 "b":2}',
    "[1}",
    "{]",
    "\u00a0true",
    "true\u000b",
  ];
  for (let i = 0; i < invalid.length; i++)
    expect(validateCursor(invalid[i])).toBe(false);
  const deepest =
    "[".repeat(MAX_CURSOR_DEPTH) + "0" + "]".repeat(MAX_CURSOR_DEPTH);
  expect(validateCursor(deepest)).toBe(true);
  expect(validateCursor("[" + deepest + "]")).toBe(false);
  expect(validateCursor("[1,]")).toBe(false);
  expect(validateCursor('{"recovered":[true]}')).toBe(true);
});

describe("Checked discard agrees with the independent validator over deterministic mutations", () => {
  const seeds: string[] = [
    '{"a":[0,-1.5e2,true,null,"x\\n中"]}',
    '[{},[],"\\uD800",false]',
    '"a\\u0000b"',
  ];
  const replacements: string[] = [
    "",
    " ",
    ",",
    ":",
    "[",
    "]",
    "{",
    "}",
    '"',
    "\\",
    "0",
    "x",
    "\u0001",
    "Ā",
  ];
  for (let seed = 0; seed < seeds.length; seed++) {
    const source = seeds[seed];
    for (let i = 0; i <= source.length; i++) {
      for (let j = 0; j < replacements.length; j++) {
        const mutated =
          source.slice(0, i) + replacements[j] + source.slice(i + 1);
        expect(validateCursor(mutated)).toBe(validateJSON(mutated));
      }
    }
  }
});

describe("Public syntax validation always uses strict grammar without poisoning parsing", () => {
  expect(JSON.validate('{"x":[1,true,"\\uD800"]}')).toBe(true);
  expect(JSON.validate('{"x":01}')).toBe(false);
  expect(JSON.validate('{"x":[1,]}')).toBe(false);
  expect(JSON.validate("NaN")).toBe(false);
  expect(JSON.validate("0e+1")).toBe(true);
  if (!JSON_STRICT) expect(isNaN(JSON.parse<f64>("NaN"))).toBe(true);
});
