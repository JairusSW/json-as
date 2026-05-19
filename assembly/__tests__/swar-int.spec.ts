import { describe, expect } from "as-test";
import {
  parse4Digits_Baseline,
  parse4Digits_PairMul,
  parse4Digits_PairMul_Unsafe,
  parse8Digits_PairMul,
  parse8Digits_PairMul_Unsafe,
  parse16Digits_SWAR,
} from "../util/swar-int";

// Build a u64 holding 4 UTF-16 code units from a 4-char ASCII string.
function pack4(s: string): u64 {
  if (s.length != 4) throw new Error("pack4 expects 4 chars");
  let block: u64 = 0;
  for (let i = 0; i < 4; i++) {
    block |= (<u64>s.charCodeAt(i)) << (<u64>i * 16);
  }
  return block;
}

describe("parse4Digits - baseline and pair-multiply agree on all valid 4-digit ASCII inputs", () => {
  // Spot-check across the range: every 173rd value plus boundaries.
  const probes: u32[] = [0, 1, 9, 10, 99, 100, 999, 1000, 1234, 5678, 9999];
  for (let i = 0; i < probes.length; i++) {
    const n = unchecked(probes[i]);
    let s = n.toString();
    while (s.length < 4) s = "0" + s;
    const block = pack4(s);
    expect(parse4Digits_Baseline(block)).toBe(n);
    expect(parse4Digits_PairMul(block)).toBe(n);
    expect(parse4Digits_PairMul_Unsafe(block)).toBe(n);
  }
});

describe("parse4Digits - exhaustive sweep across 0..9999", () => {
  for (let n: u32 = 0; n < 10_000; n++) {
    let s = n.toString();
    while (s.length < 4) s = "0" + s;
    const block = pack4(s);
    const a = parse4Digits_Baseline(block);
    const b = parse4Digits_PairMul(block);
    if (a != n || b != n) {
      // Surface the first divergence for easier debugging
      expect<u32>(b).toBe(n);
      expect<u32>(a).toBe(n);
    }
  }
});

describe("parse4Digits - both safe variants reject non-digit lanes", () => {
  const cases: string[] = [
    "/123", // '/' (0x2F) just below '0'
    ":123", // ':' (0x3A) just above '9'
    "1a23",
    "12 3",
    "9999".substring(0, 3) + "/",
  ];
  for (let i = 0; i < cases.length; i++) {
    const block = pack4(unchecked(cases[i]));
    expect(parse4Digits_Baseline(block)).toBe(U32.MAX_VALUE);
    expect(parse4Digits_PairMul(block)).toBe(U32.MAX_VALUE);
  }
});

describe("parse4Digits - rejects non-ASCII UTF-16 (high byte set)", () => {
  // Lane 2 holds a non-ASCII code unit (0x0100).
  const block: u64 = 0x0033_0100_0032_0031;
  expect(parse4Digits_Baseline(block)).toBe(U32.MAX_VALUE);
  expect(parse4Digits_PairMul(block)).toBe(U32.MAX_VALUE);
});

describe("parse8Digits - exhaustive sweep across selected 8-digit values", () => {
  // Sample widely: digits of 12345678 mixed with edge cases at boundaries.
  const probes: u64[] = [
    0, 1, 9, 10, 99, 12345678, 9999_9999, 8000_0000, 1000_0000, 1234_5678,
    1010_1010,
  ];
  for (let i = 0; i < probes.length; i++) {
    const n = <u32>unchecked(probes[i]);
    let s = n.toString();
    while (s.length < 8) s = "0" + s;
    const lo = pack4(s.substring(0, 4));
    const hi = pack4(s.substring(4, 8));
    expect(parse8Digits_PairMul(lo, hi)).toBe(n);
    expect(parse8Digits_PairMul_Unsafe(lo, hi)).toBe(n);
  }
});

describe("parse8Digits - rejects invalid lanes in either half", () => {
  // High half has a non-digit at lane 0
  const lo = pack4("1234");
  const hiBad = pack4("a567");
  expect(parse8Digits_PairMul(lo, hiBad)).toBe(U32.MAX_VALUE);

  const loBad = pack4("12 4");
  const hi = pack4("5678");
  expect(parse8Digits_PairMul(loBad, hi)).toBe(U32.MAX_VALUE);
});

describe("parse16Digits_SWAR - produces correct value for 16-digit UTF-16 inputs", () => {
  // Use a packed-string helper: writes 16 ASCII digits as UTF-16 at a known
  // address, then calls parse16Digits_SWAR with that pointer.
  const buf = memory.data(32);
  const probes: u64[] = [
    0, 1, 9999_9999_9999_9999, 1234_5678_9012_3456, 8000_0000_0000_0000,
  ];
  for (let i = 0; i < probes.length; i++) {
    const n = unchecked(probes[i]);
    let s = n.toString();
    while (s.length < 16) s = "0" + s;
    // Write 16 UTF-16 code units at buf.
    for (let j = 0; j < 16; j++) {
      store<u16>(buf + ((<usize>j) << 1), <u16>s.charCodeAt(j));
    }
    expect(parse16Digits_SWAR(buf)).toBe(n);
  }
});

describe("parse16Digits_SWAR - rejects 16-digit input containing a non-digit lane", () => {
  const buf = memory.data(32);
  const s = "1234567,90123456"; // comma at position 7
  for (let j = 0; j < 16; j++) {
    store<u16>(buf + ((<usize>j) << 1), <u16>s.charCodeAt(j));
  }
  expect(parse16Digits_SWAR(buf)).toBe(U64.MAX_VALUE);
});

describe("parse8Digits - random fuzz", () => {
  // Deterministic LCG for repeatability without depending on Math.random.
  let state: u64 = 0xc0ffee;
  for (let i = 0; i < 256; i++) {
    state = state * 6364136223846793005 + 1442695040888963407;
    const n = <u32>(state % 100_000_000);
    let s = n.toString();
    while (s.length < 8) s = "0" + s;
    const lo = pack4(s.substring(0, 4));
    const hi = pack4(s.substring(4, 8));
    expect(parse8Digits_PairMul(lo, hi)).toBe(n);
  }
});
