import {
  JSON
} from ".";
import {
  bs
} from "../lib/as-bs";
import {
  expect
} from "./__tests__/lib";
import {
  serializeString_SIMD
} from "./serialize/simd/string";
import {
  serializeString_SWAR
} from "./serialize/swar/string";
@lazy
const ONES: u64 = 72340172838076673;
@lazy
const HIGHS: u64 = -9187201950435737472;
@lazy
const LANE_MASK_LOW: u64 = 71777214294589695;
@inline
function json_escapable_byte_mask(x: u64): u64 {
  x = x ^ -71777214294589696;
  const is_ascii: u64 = HIGHS & ~x;
  const xor2: u64 = x ^ 144680345676153346;
  const lt32_or_eq34: u64 = xor2 - 2387225703656530209;
  const sub92: u64 = x ^ 6655295901103053916;
  const eq92: u64 = sub92 - ONES;
  const high_bits: u64 = (lt32_or_eq34 | eq92) & is_ascii;
  return high_bits;
}
function to_u64(s: string): u64 {
  return load<u64>(changetype<usize>(s));
}
export function mask_to_string(mask: u64): string {
  let result = "0x";
  for (let i = 7; i >= 0; i--) {
    const byte = u8((mask >> (i * 8)) & 255);
    const hi = (byte >> 4) & 15;
    const lo = byte & 15;
    result += hi < 10 ? String.fromCharCode(48 + hi) : String.fromCharCode(55 + hi);
    result += lo < 10 ? String.fromCharCode(48 + lo) : String.fromCharCode(55 + lo);
    result += " ";
  }
  return result;
}
function test_mask(input: string, expected_mask: u64, description: string): void {
  const mask = json_escapable_byte_mask(to_u64(input));
  const pass = mask == expected_mask;
  console.log((pass ? "✓ " : "✗ ") + description);
  if (!pass) {
    console.log("  Input: \"" + input + "\"");
    console.log("  Expected: " + mask_to_string(expected_mask));
    console.log("  Got:      " + mask_to_string(mask));
    process.exit(1);
  }
}
console.log("=== No Escapes Needed ===");
test_mask("abcd", 0, "Regular ASCII letters");
test_mask("ABCD", 0, "Uppercase letters");
test_mask("1234", 0, "Numbers");
test_mask("test", 0, "Common word");
test_mask("____", 0, "Underscores");
test_mask("....", 0, "Periods");
test_mask("!#$%", 0, "Safe symbols");
test_mask("&*()", 0, "More symbols");
test_mask("+,-.", 0, "Math symbols");
console.log();
console.log("=== Quote Character (34 / 0x22) ===");
test_mask("\"abc", 128, "Quote at position 0");
test_mask("a\"bc", 8388608, "Quote at position 1");
test_mask("ab\"c", 549755813888, "Quote at position 2");
test_mask("abc\"", 36028797018963968, "Quote at position 3");
test_mask("\"\"\"\"", 36029346783166592, "All quotes");
console.log();
console.log("=== Backslash Character (92 / 0x5C) ===");
test_mask("\babc", 128, "Backslash at position 0");
test_mask("a\bbc", 8388608, "Backslash at position 1");
test_mask("ab\bc", 549755813888, "Backslash at position 2");
test_mask("abc\b", 36028797018963968, "Backslash at position 3");
test_mask("\b\b\b\b", 36029346783166592, "All backslashes");
console.log();
console.log("=== Control Characters (< 32) ===");
test_mask("\0abc", 128, "Null character at position 0");
test_mask("\nabc", 128, "Newline at position 0");
test_mask("\rabc", 128, "Carriage return at position 0");
test_mask("\tabc", 128, "Tab at position 0");
test_mask("a\nbc", 8388608, "Newline at position 1");
test_mask("ab\nc", 549755813888, "Newline at position 2");
test_mask("abc\n", 36028797018963968, "Newline at position 3");
console.log();
console.log("=== Boundary Cases ===");
test_mask("abc", 128, "Character 31 (should escape)");
test_mask(" abc", 0, "Space (32, should NOT escape)");
test_mask("!abc", 0, "Character 33 (should NOT escape)");
console.log();
console.log("=== Mixed Scenarios ===");
test_mask("\"\nabc", 128 | 8388608, "Quote + newline");
test_mask("\"\babc", 128 | 8388608, "Quote + backslash");
test_mask("\"\b\nabc", 128 | 8388608 | 549755813888, "Quote + backslash + newline");
test_mask("a\"\tb", 8388608 | 549755813888, "Quote + tab at pos 1-2");
console.log();
console.log("=== Multiple Escapes ===");
test_mask("\"\"\b\b", 8388736 | 36029346774777856, "All 4 positions need escape");
test_mask("a\"b\b", 8388608 | 36028797018963968, "Quote at pos 1, backslash at pos 3");
test_mask("\"a\bb", 128 | 549755813888, "Quote at pos 0, backslash at pos 2");
console.log();
console.log("=== Edge Cases ===");
test_mask("", 36029346783166592, "All control characters (1-4)");
test_mask("  ", 128 | 8388608, "Characters 30-31, then two spaces");
test_mask("]}~", 0, "High safe ASCII (125-127)");
console.log();
console.log("=== Specific JSON Escape Sequences ===");
test_mask("\f\n\r", 36029346783166592, "Backspace, form feed, newline, carriage return");
test_mask("\"\b\f", 36029346783166592, "Quote, backslash, backspace, form feed");
console.log();
function get_lane(mask: u64): u64 {
  return ctz(mask) >> 3;
}
function clearLane(mask: u64, lane_index: u32): u64 {
  return mask & ~(255 << (lane_index << 3));
}
expect(get_lane(128)).toBe(0);
expect(get_lane(8388608)).toBe(2);
expect(get_lane(549755813888)).toBe(4);
expect(get_lane(36028797018963968)).toBe(6);
let x: u64 = 36029346783166592;
expect(get_lane(x = clearLane(x, 0))).toBe(2);
expect(get_lane(x = clearLane(x, 2))).toBe(4);
expect(get_lane(x = clearLane(x, 4))).toBe(6);
serializeString_SWAR("\0\t\n\v\f\rabcdefg");
expect(bs.out<string>()).toBe("\"\bu0000\bu0001\bu0002\bu0003\bu0004\bu0005\bu0006\bu0007\bb\bt\bn\bu000b\bf\br\bu000eabcdefg\"");
