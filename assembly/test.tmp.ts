import {
  bs
} from "../lib/as-bs";
import {
  describe,
  expect,
  it
} from "./__tests__/lib";
import {
  deserializeString_SIMD
} from "./deserialize/simd/string";
import {
  deserializeString
} from "./deserialize/simple/string";
import {
  serializeString
} from "./serialize/simple/string";
import {
  bytes
} from "./util";
function roundTrip(str: string): string {
  serializeString(str);
  const serialized = bs.out<string>();
  return deserializeString_SIMD(changetype<usize>(serialized), changetype<usize>(serialized) + bytes(serialized));
}
describe("deserializeString_SIMD", () => {
  it("handles simple ASCII", () => {
    const str = "Hello, World!";
    expect(roundTrip(str)).toBe(str);
  });
  it("handles quotes and backslashes", () => {
    const str = `He said: "Hello\bWorld"`;
    expect(roundTrip(str)).toBe(str);
  });
  it("handles control characters 0x00-0x1F", () => {
    let str = "";
    for (let i = 0; i < 32; i++) str += String.fromCharCode(i);
    expect(roundTrip(str)).toBe(str);
  });
  it("handles unicode characters", () => {
    const str = "🌍🚀✨ — 漢字";
    expect(roundTrip(str)).toBe(str);
  });
  it("handles mixed content", () => {
    const str = `Line1\nLine2\tTabbed\bBackslash"QuoteEnd`;
    expect(roundTrip(str)).toBe(str);
  });
  it("handles empty string", () => {
    const str = "";
    expect(roundTrip(str)).toBe(str);
  });
  it("handles very long strings", () => {
    let str = "";
    for (let i = 0; i < 5000; i++) str += "abc123\b\"";
    expect(roundTrip(str)).toBe(str);
  });
  it("handles strings ending with escape sequences", () => {
    expect(roundTrip("EndsWithBackslash\b")).toBe("EndsWithBackslash\b");
    expect(roundTrip("EndsWithQuote\"")).toBe("EndsWithQuote\"");
  });
  it("handles all byte values 0-255", () => {
    let str = "";
    for (let i = 0; i < 256; i++) str += String.fromCharCode(i);
    expect(roundTrip(str)).toBe(str);
  });
  it("handles consecutive escape sequences", () => {
    const str = "\b\"\b\"\bu0041\bu0042\bu0043\b\b";
    expect(roundTrip(str)).toBe(str);
  });
  it("handles boundary cases near SIMD lanes", () => {
    let str = "";
    for (let i = 0; i < 16; i++) str += String.fromCharCode(65 + i);
    str += "\b\"";
    expect(roundTrip(str)).toBe(str);
    str = "1234567890123456\bu0041";
    expect(roundTrip(str)).toBe(str);
  });
});
