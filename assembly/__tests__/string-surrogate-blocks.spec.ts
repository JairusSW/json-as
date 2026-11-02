import { JSON } from "..";
import { describe, expect } from "as-test";
import { bs } from "../../lib/as-bs";
import { serializeString_NAIVE } from "../serialize/naive/string";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { STRING_SIZE_MASK } from "../util/runtime";

function invalidateUnsafeStringMutation(value: string): void {
  const object = changetype<OBJECT>(changetype<usize>(value) - TOTAL_OVERHEAD);
  object.rtSize &= STRING_SIZE_MASK;
}

function scalar(src: string): string {
  serializeString_NAIVE(src);
  return bs.out<string>();
}

describe("Vector string blocks agree with scalar output for every UTF-16 lane", () => {
  const pattern = "a😀b😀c😀d😀e";
  const probe = changetype<string>(__new(pattern.length << 1, idof<string>()));
  const ptr = changetype<usize>(probe);
  let mismatches = 0;
  for (let lane: usize = 0; lane < 8; lane++) {
    memory.copy(ptr, changetype<usize>(pattern), pattern.length << 1);
    for (let code: u32 = 0; code <= 0xffff; code++) {
      store<u16>(ptr + (lane << 1), <u16>code);
      invalidateUnsafeStringMutation(probe);
      if (JSON.stringify(probe) != scalar(probe)) mismatches++;
    }
  }
  expect(mismatches).toBe(0);
});

describe("Surrogate pairs crossing vector blocks preserve bounds and escapes", () => {
  const tails = [
    "😀",
    "\ud800",
    "\udc00",
    '😀"',
    "\ud800x",
    "😀\udfff",
    "\ud800\ud800",
    "é\u00ff\u4eff",
  ];
  for (let prefix = 0; prefix < 40; prefix++) {
    for (let i = 0; i < tails.length; i++) {
      const value = "a".repeat(prefix) + tails[i];
      expect(JSON.stringify(value)).toBe(scalar(value));
    }
  }
});

describe("Packed Unicode scan checks the second vector for every UTF-16 unit", () => {
  const pattern = "，，，，，，，，abcdefghijklmnopq";
  const probe = changetype<string>(__new(pattern.length << 1, idof<string>()));
  const ptr = changetype<usize>(probe);
  let mismatches = 0;
  memory.copy(ptr, changetype<usize>(pattern), pattern.length << 1);
  for (let code: u32 = 0; code <= 0xffff; code++) {
    store<u16>(ptr + ((8 + 15) << 1), <u16>code);
    invalidateUnsafeStringMutation(probe);
    if (JSON.stringify(probe) != scalar(probe)) mismatches++;
  }
  const boundaries: u32[] = [
    0, 0x1f, 0x22, 0x5c, 0x7f, 0x80, 0xff, 0x7fff, 0x8000, 0xd7ff, 0xd800,
    0xdbff, 0xdc00, 0xdfff, 0xe000, 0xffff,
  ];
  for (let lane: usize = 0; lane < 16; lane++) {
    memory.copy(ptr, changetype<usize>(pattern), pattern.length << 1);
    for (let i = 0; i < boundaries.length; i++) {
      store<u16>(ptr + ((8 + lane) << 1), <u16>boundaries[i]);
      invalidateUnsafeStringMutation(probe);
      if (JSON.stringify(probe) != scalar(probe)) mismatches++;
    }
  }
  expect(mismatches).toBe(0);
});

describe("Unicode scan continuation agrees with scalar output in every lane", () => {
  const pattern = "，，，，，，，，a😀b😀c😀d😀e";
  const probe = changetype<string>(__new(pattern.length << 1, idof<string>()));
  const ptr = changetype<usize>(probe);
  let mismatches = 0;
  for (let lane: usize = 0; lane < 8; lane++) {
    memory.copy(ptr, changetype<usize>(pattern), pattern.length << 1);
    for (let code: u32 = 0; code <= 0xffff; code++) {
      store<u16>(ptr + ((lane + 8) << 1), <u16>code);
      invalidateUnsafeStringMutation(probe);
      if (JSON.stringify(probe) != scalar(probe)) mismatches++;
    }
  }
  expect(mismatches).toBe(0);
});
