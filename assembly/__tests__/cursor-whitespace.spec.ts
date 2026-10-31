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

function reference(ptr: usize, end: usize): usize {
  while (ptr < end) {
    const code = load<u16>(ptr);
    if (code != 32 && code != 9 && code != 10 && code != 13) break;
    ptr += 2;
  }
  return ptr;
}

describe("Checked whitespace scanning distinguishes every UTF-16 unit", () => {
  const value = " ".repeat(64) + "!";
  const probe = changetype<string>(__new(value.length << 1, idof<string>()));
  const ptr = changetype<usize>(probe);
  memory.copy(ptr, changetype<usize>(value), value.length << 1);
  const end = ptr + (value.length << 1);
  let mismatches = 0;
  for (let lane: usize = 0; lane < 32; lane++) {
    const at = ptr + (lane << 1);
    for (let code: u32 = 0; code <= 0xffff; code++) {
      store<u16>(at, <u16>code);
      const white = code == 32 || code == 9 || code == 10 || code == 13;
      if (skipCursorWhitespace(ptr, end) != (white ? end - 2 : at))
        mismatches++;
    }
    store<u16>(at, 32);
  }
  expect(mismatches).toBe(0);
});

describe("Checked whitespace respects every bounded prefix and mixed run", () => {
  const values = [
    " ".repeat(96) + "!",
    "\n" + " ".repeat(96) + "!",
    ("\t\n\r" + " ".repeat(19)).repeat(5) + "!",
    " ".repeat(64) + "\u0120" + " ".repeat(32),
    " ".repeat(64) + "\v" + " ".repeat(32),
    " ".repeat(64) + "\f" + " ".repeat(32),
  ];
  let mismatches = 0;
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const ptr = changetype<usize>(value);
    for (let start = 0; start <= 32; start++) {
      for (let stop = start; stop <= value.length; stop++) {
        const at = ptr + (start << 1);
        const end = ptr + (stop << 1);
        if (skipCursorWhitespace(at, end) != reference(at, end)) mismatches++;
      }
    }
  }
  expect(mismatches).toBe(0);
});

describe("Public validation checks grammar around long indentation", () => {
  for (let length = 0; length < 65; length++) {
    const pad = "\n" + " ".repeat(length);
    const value =
      pad + '{"a":' + pad + "[1," + pad + "2]," + pad + '"b":true}' + pad;
    expect(JSON.validate(value)).toBe(true);
    expect(JSON.validate(pad + "[1," + pad + "]")).toBe(false);
    expect(JSON.validate(pad + '{"x":' + pad + "}")).toBe(false);
    expect(JSON.validate(pad + "\u0120[]")).toBe(false);
    expect(JSON.validate(pad + "\v[]")).toBe(false);
    expect(JSON.validate(pad + "\f[]")).toBe(false);
  }
});
