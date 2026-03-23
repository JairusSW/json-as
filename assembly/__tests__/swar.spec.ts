import { describe, expect } from "as-test";
import { hex4_to_u16_swar, u16_to_hex4_swar } from "../util/swar";

function lane0(block: u64): u16 {
  return <u16>block;
}

function lane1(block: u64): u16 {
  return <u16>(block >> 16);
}

function lane2(block: u64): u16 {
  return <u16>(block >> 32);
}

function lane3(block: u64): u16 {
  return <u16>(block >> 48);
}

describe("SWAR hex helpers should encode known u16 values into UTF-16 hex lanes", () => {
  let block = u16_to_hex4_swar(0x0000);
  expect(lane0(block)).toBe(0x30);
  expect(lane1(block)).toBe(0x30);
  expect(lane2(block)).toBe(0x30);
  expect(lane3(block)).toBe(0x30);

  block = u16_to_hex4_swar(0x1234);
  expect(lane0(block)).toBe(0x31);
  expect(lane1(block)).toBe(0x32);
  expect(lane2(block)).toBe(0x33);
  expect(lane3(block)).toBe(0x34);

  block = u16_to_hex4_swar(0xabcd);
  expect(lane0(block)).toBe(0x61);
  expect(lane1(block)).toBe(0x62);
  expect(lane2(block)).toBe(0x63);
  expect(lane3(block)).toBe(0x64);

  block = u16_to_hex4_swar(0xf00d);
  expect(lane0(block)).toBe(0x66);
  expect(lane1(block)).toBe(0x30);
  expect(lane2(block)).toBe(0x30);
  expect(lane3(block)).toBe(0x64);
});

describe("SWAR hex helpers should decode known UTF-16 hex lanes into u16 values", () => {
  expect(hex4_to_u16_swar(0x0030_0030_0030_0030)).toBe(0x0000);
  expect(hex4_to_u16_swar(0x0034_0033_0032_0031)).toBe(0x1234);
  expect(hex4_to_u16_swar(0x0064_0063_0062_0061)).toBe(0xabcd);
  expect(hex4_to_u16_swar(0x0064_0030_0030_0066)).toBe(0xf00d);
});

describe("SWAR hex helpers should round-trip representative values", () => {
  const values = [<u16>0x0000, <u16>0x0001, <u16>0x000f, <u16>0x0010, <u16>0x00ff, <u16>0x0100, <u16>0x1234, <u16>0xabcd, <u16>0xd800, <u16>0xdc00, <u16>0xffff];

  for (let i = 0; i < values.length; i++) {
    const code = unchecked(values[i]);
    expect(hex4_to_u16_swar(u16_to_hex4_swar(code))).toBe(code);
  }
});

describe("SWAR hex helpers should round-trip the full u16 range", () => {
  let failed = -1;
  for (let code: u32 = 0; code <= 0xffff; code++) {
    if (hex4_to_u16_swar(u16_to_hex4_swar(<u16>code)) != <u16>code) {
      failed = <i32>code;
      break;
    }
  }
  expect(failed).toBe(-1);
});
