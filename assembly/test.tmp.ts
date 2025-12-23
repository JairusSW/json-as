@lazy
const LANE_MASK_HIGH: u64 = -71777214294589696;
@lazy
const LANE_MASK_LOW: u64 = 71777214294589695;
@lazy
const ONES: u64 = 72340172838076673;
@lazy
const HIGHS: u64 = -9187201950435737472;
@lazy
const QUOTE_MASK: u64 = 9570295239278626;
@lazy
const BACKSLASH_MASK: u64 = 25896093000400988;
@lazy
const CONTROL_MASK: u64 = 9007336695791648;
@inline
function v64x4_eq_original(x: u64, y: u64): u64 {
  const v = (x ^ y) | LANE_MASK_HIGH;
  const m = (((v >> 1) | ONES) - v) & ONES;
  return (m >> 7) * 255 & LANE_MASK_LOW;
}
@inline
function v64x4_eq_opt1(x: u64, y: u64): u64 {
  const v = (x ^ y) | LANE_MASK_HIGH;
  const m = (((v >> 1) | ONES) - v) & ONES;
  return (m >> 7) * 255;
}
@inline
function v64x4_eq_opt2(x: u64, y: u64): u64 {
  const diff = (x ^ y) & LANE_MASK_LOW;
  const zero = (diff - ONES) & (~diff) & HIGHS;
  return (zero >> 7) * 255;
}
@inline
function v64x4_eq_opt3(x: u64, y: u64): u64 {
  const diff = (x ^ y) & LANE_MASK_LOW;
  const zero = (diff - ONES) & (~diff);
  return (zero >> 7) * 255;
}
@inline
function v64x4_eq_opt4(x: u64, y: u64): u64 {
  const v = (x ^ y) | LANE_MASK_HIGH;
  const m = ((v >> 1) - v + ONES);
  return (m >> 7) * 255;
}
@inline
function v64x4_ltu_original(a: u64, b: u64): u64 {
  return (((a | HIGHS) - (b & ~HIGHS)) | (a ^ b)) ^ (a | ~b);
}
@inline
function v64x4_ltu_opt1(a: u64, b: u64): u64 {
  const sub = (a | HIGHS) - (b & ~HIGHS);
  const xor_val = a ^ b;
  return (sub | xor_val) ^ (a | ~b);
}
@inline
function v64x4_ltu_opt2(a: u64, b: u64): u64 {
  const a_low = a & LANE_MASK_LOW;
  const b_low = b & LANE_MASK_LOW;
  const diff = (a_low | HIGHS) - b_low;
  const borrow = diff & HIGHS;
  return (borrow >> 7) * 255;
}
@inline
function v64x4_ltu_opt3(a: u64, b: u64): u64 {
  const a_low = a & LANE_MASK_LOW;
  const b_low = b & LANE_MASK_LOW;
  const xor_val = a_low ^ b_low;
  const sub = (a_low | HIGHS) - b_low;
  const lt = (xor_val & b_low) | (~xor_val & sub);
  return (lt >> 7) * 255;
}
@inline
function v64x4_ltu_opt4(a: u64, b: u64): u64 {
  const a_low = a & LANE_MASK_LOW;
  const b_low = b & LANE_MASK_LOW;
  const diff = (a_low ^ HIGHS) - (b_low ^ HIGHS);
  return (diff >> 7) * 255;
}
@inline
function v64x4_ltu_opt5(a: u64, b: u64): u64 {
  const diff = ((a & LANE_MASK_LOW) | HIGHS) - (b & LANE_MASK_LOW);
  return (~diff >> 7) * 255;
}
const input = load<u64>(changetype<usize>("\"b\"c"));
console.log("=== EQUALITY TEST ===");
console.log("Input:    " + vis(input));
console.log("Expected: 0000000000000000000000001000000000000000000000000000000010000000");
console.log("");
console.log("Original: " + vis(v64x4_eq_original(input, QUOTE_MASK) & HIGHS));
console.log("Opt1:     " + vis(v64x4_eq_opt1(input, QUOTE_MASK) & HIGHS));
console.log("Opt2:     " + vis(v64x4_eq_opt2(input, QUOTE_MASK) & HIGHS));
console.log("Opt3:     " + vis(v64x4_eq_opt3(input, QUOTE_MASK) & HIGHS));
console.log("Opt4:     " + vis(v64x4_eq_opt4(input, QUOTE_MASK) & HIGHS));
const input1 = load<u64>(changetype<usize>("\0b\nd"));
console.log("=== LESS-THAN TEST 1 ===");
console.log("Input:    " + vis(input1));
console.log("Control:  " + vis(CONTROL_MASK));
console.log("Expected: 0000000000000000000000001000000000000000000000000000000010000000");
console.log("");
console.log("Original: " + vis(v64x4_ltu_original(input1 & LANE_MASK_LOW, CONTROL_MASK) & HIGHS));
console.log("Opt1:     " + vis(v64x4_ltu_opt1(input1 & LANE_MASK_LOW, CONTROL_MASK) & HIGHS));
console.log("Opt2:     " + vis(v64x4_ltu_opt2(input1 & LANE_MASK_LOW, CONTROL_MASK) & HIGHS));
console.log("Opt3:     " + vis(v64x4_ltu_opt3(input1 & LANE_MASK_LOW, CONTROL_MASK) & HIGHS));
console.log("Opt4:     " + vis(v64x4_ltu_opt4(input1 & LANE_MASK_LOW, CONTROL_MASK) & HIGHS));
console.log("Opt5:     " + vis(v64x4_ltu_opt5(input1 & LANE_MASK_LOW, CONTROL_MASK) & HIGHS));
console.log("");
console.log("=== LESS-THAN TEST 2 ===");
const test_bytes: StaticArray<u8> = [16, 0, 31, 0, 0, 0, 25, 0];
const input2 = load<u64>(changetype<usize>(test_bytes));
console.log("Input:    " + vis(input2));
console.log("Control:  " + vis(CONTROL_MASK));
console.log("Expected: 1000000000000000100000000000000010000000000000001000000000000000");
console.log("");
console.log("Original: " + vis(v64x4_ltu_original(input2 & LANE_MASK_LOW, CONTROL_MASK) & HIGHS));
console.log("Opt1:     " + vis(v64x4_ltu_opt1(input2 & LANE_MASK_LOW, CONTROL_MASK) & HIGHS));
console.log("Opt2:     " + vis(v64x4_ltu_opt2(input2 & LANE_MASK_LOW, CONTROL_MASK) & HIGHS));
console.log("Opt3:     " + vis(v64x4_ltu_opt3(input2 & LANE_MASK_LOW, CONTROL_MASK) & HIGHS));
console.log("Opt4:     " + vis(v64x4_ltu_opt4(input2 & LANE_MASK_LOW, CONTROL_MASK) & HIGHS));
console.log("Opt5:     " + vis(v64x4_ltu_opt5(input2 & LANE_MASK_LOW, CONTROL_MASK) & HIGHS));
function vis(value: u64): string {
  let out = "";
  for (let i = 63; i >= 0; i--) {
    out += ((value >> i) & 1) != 0 ? "1" : "0";
  }
  return out;
}
