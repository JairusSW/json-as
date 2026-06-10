import { JSON } from "..";
import { describe, expect } from "as-test";

// Round-trip fuzz for the lazy passthrough. An untouched top-level composite
// parsed as JSON.Value serializes by copying its source slice verbatim, so
// stringify(parse(x)) must equal x byte-for-byte. That makes scanValueEnd the
// thing under test: it has to find the exact end of the value, which means not
// mistaking `}` / `]` / escaped quotes inside strings for structure. The three
// scanners (naive/swar/simd) must all agree. Seeds are fixed so any failure
// reproduces.

let RNG: u32 = 1;
function srand(seed: u32): void {
  RNG = seed != 0 ? seed : 1;
}
function rand(): u32 {
  let x = RNG;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  RNG = x;
  return x;
}

// A valid JSON string literal (with surrounding quotes), biased toward the
// characters that break a naive scanner: quotes, escapes, and bare brackets.
function genString(): string {
  let s = '"';
  const len = <i32>(rand() % 14);
  for (let i = 0; i < len; i++) {
    switch (<i32>(rand() % 12)) {
      case 0:
        s += '\\"'; // escaped quote
        break;
      case 1:
        s += "\\\\"; // escaped backslash
        break;
      case 2:
        s += "}";
        break;
      case 3:
        s += "]";
        break;
      case 4:
        s += "{";
        break;
      case 5:
        s += "[";
        break;
      case 6:
        s += ",";
        break;
      case 7:
        s += ":";
        break;
      case 8:
        s += "\\n"; // escaped control char
        break;
      default:
        s += String.fromCharCode(97 + <i32>(rand() % 26));
    }
  }
  return s + '"';
}

function genValue(depth: i32): string {
  if (depth <= 0 || rand() % 3 == 0) {
    switch (<i32>(rand() % 4)) {
      case 0:
        return (<i32>(rand() % 200000) - 100000).toString();
      case 1:
        return rand() % 2 == 0 ? "true" : "false";
      case 2:
        return "null";
      default:
        return genString();
    }
  }
  if (rand() % 2 == 0) {
    const n = <i32>(rand() % 5);
    let s = "[";
    for (let i = 0; i < n; i++) {
      if (i) s += ",";
      s += genValue(depth - 1);
    }
    return s + "]";
  }
  const n = <i32>(rand() % 6);
  let s = "{";
  for (let i = 0; i < n; i++) {
    if (i) s += ",";
    s += '"f' + i.toString() + '":' + genValue(depth - 1);
  }
  return s + "}";
}

// Top level is always a composite, so the parsed Value is a single passthrough
// slice covering the whole document.
function genTop(depth: i32): string {
  return rand() % 2 == 0
    ? genValue(depth) // may be an array
    : "{" + makeObjectBody(depth) + "}";
}
function makeObjectBody(depth: i32): string {
  const n = 1 + <i32>(rand() % 5);
  let s = "";
  for (let i = 0; i < n; i++) {
    if (i) s += ",";
    s += '"f' + i.toString() + '":' + genValue(depth - 1);
  }
  return s;
}

function fuzzSeed(seed: u32, iters: i32): void {
  srand(seed);
  for (let it = 0; it < iters; it++) {
    let json = genTop(4);
    // Force a composite top level (genValue can return a scalar).
    if (json.charCodeAt(0) != 0x7b && json.charCodeAt(0) != 0x5b) {
      json = "[" + json + "]";
    }
    const v = JSON.parse<JSON.Value>(json);
    expect(JSON.stringify(v)).toBe(json); // untouched -> verbatim
  }
}

describe("fuzz: untouched round-trip, seed 0x1", () => fuzzSeed(0x1, 500));
describe("fuzz: untouched round-trip, seed 0xABCD", () =>
  fuzzSeed(0xabcd, 500));
describe("fuzz: untouched round-trip, seed 0xBADF00D", () =>
  fuzzSeed(0xbadf00d, 500));

// Explicit adversarial cases (the ones we hit during the JSON.Obj work).
describe("fuzz: hand-picked adversarial passthrough", () => {
  const cases: string[] = [
    '{"s":"a}b]c\\"d","arr":["x]","y}"]}',
    '[{"a":1},{"b":[2,3]},"]}","{["]',
    '{"empty":{},"arr":[],"nested":{"a":{"b":{"c":[]}}}}',
    '{"q":"say \\"hi\\"","back":"a\\\\b","brace":"}}}","brack":"]]]"}',
    '[1,-2,3.5,true,false,null,"",{}]',
  ];
  for (let i = 0; i < cases.length; i++) {
    const c = unchecked(cases[i]);
    expect(JSON.stringify(JSON.parse<JSON.Value>(c))).toBe(c);
  }
});

describe("fuzz: large (>16KB) value passthrough", () => {
  const big = "abc}]def".repeat(2500); // ~20KB; }/] are bare (valid) in a string
  const json = '{"big":"' + big + '","tail":1}';
  expect(JSON.stringify(JSON.parse<JSON.Value>(json))).toBe(json);
});
