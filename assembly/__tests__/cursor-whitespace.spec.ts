import { describe, expect } from "as-test";
import { JSON } from "..";
import { skipCursorWhitespace } from "../deserialize/cursor";

const BLOCK = memory.data(24);

describe("Whitespace scan respects every UTF-16 lane and alignment", () => {
  let mismatches = 0;
  for (let offset: usize = 0; offset < 8; offset += 2) {
    const ptr = BLOCK + offset;
    for (let lane: usize = 0; lane < 4; lane++) {
      store<u64>(ptr, 0x0020_0020_0020_0020);
      for (let code: u32 = 0; code <= 0xffff; code++) {
        store<u16>(ptr + (lane << 1), <u16>code);
        const white = code == 32 || code == 9 || code == 10 || code == 13;
        const expected = white ? ptr + 8 : ptr + (lane << 1);
        if (skipCursorWhitespace(ptr, ptr + 8) != expected) mismatches++;
      }
    }
  }
  expect(mismatches).toBe(0);
});

describe("Whitespace scan preserves strict grammar and bounded tails", () => {
  const valid = ' \t\r\n[ { "x": 1.25 } , 2 ] \r\n';
  expect(JSON.validate(valid)).toBe(true);
  const controls = ["\v", "\f", "\u00a0", "\u0120", "\u2000", "\u3000"];
  for (let i = 0; i < controls.length; i++) {
    expect(JSON.validate("    " + controls[i] + "0")).toBe(false);
    expect(JSON.validate("[0,    " + controls[i] + "1]")).toBe(false);
  }
  store<u64>(BLOCK, 0x0020_0020_0020_0020);
  store<u64>(BLOCK, 0x0030_000a_000d_0009, 8);
  for (let units: usize = 0; units <= 7; units++) {
    expect(skipCursorWhitespace(BLOCK, BLOCK + (units << 1))).toBe(
      BLOCK + (units << 1),
    );
  }
  expect(skipCursorWhitespace(BLOCK, BLOCK + 16)).toBe(BLOCK + 14);
});
