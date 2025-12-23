// Constants
// @ts-ignore: decorator allowed
@lazy const LANE_MASK_HIGH: u64 = 0xFF00_FF00_FF00_FF00;
// @ts-ignore: decorator allowed
@lazy const LANE_MASK_LOW: u64 = 0x00FF_00FF_00FF_00FF;
// @ts-ignore: decorator allowed
@lazy const ONES: u64 = 0x0101010101010101;
// @ts-ignore: decorator allowed
@lazy const HIGHS: u64 = 0x8080808080808080;
// @ts-ignore: decorator allowed
@lazy const QUOTE_MASK: u64 = 0x0022_0022_0022_0022;
// @ts-ignore: decorator allowed
@lazy const BACKSLASH_MASK: u64 = 0x005C_005C_005C_005C;
// @ts-ignore: decorator allowed
@lazy const CONTROL_MASK: u64 = 0x0020_0020_0020_0020;

// ============================================================================
// EQUALITY COMPARISON: v64x4_eq
// Returns 0xFF in low bytes where x == y, 0x00 otherwise
// ============================================================================

// ORIGINAL: Your baseline
@inline function v64x4_eq_original(x: u64, y: u64): u64 {
  const v = (x ^ y) | LANE_MASK_HIGH;
  const m = (((v >> 1) | ONES) - v) & ONES;
  return (m >> 7) * 0xff & LANE_MASK_LOW;
}

// OPT1: Remove redundant final mask
// Since you apply & HIGHS later, the expansion to full bytes is needed
// But the & LANE_MASK_LOW is redundant
@inline function v64x4_eq_opt1(x: u64, y: u64): u64 {
  const v = (x ^ y) | LANE_MASK_HIGH;
  const m = (((v >> 1) | ONES) - v) & ONES;
  return (m >> 7) * 0xff;
}

// OPT2: Use standard hasless algorithm
@inline function v64x4_eq_opt2(x: u64, y: u64): u64 {
  const diff = (x ^ y) & LANE_MASK_LOW;
  const zero = (diff - ONES) & (~diff) & HIGHS;
  return (zero >> 7) * 0xff;
}

// OPT3: Simplified - fewest operations
// Most efficient for your use case
@inline function v64x4_eq_opt3(x: u64, y: u64): u64 {
  const diff = (x ^ y) & LANE_MASK_LOW;
  const zero = (diff - ONES) & (~diff);
  return (zero >> 7) * 0xff;
}

// OPT4: Alternative formulation
@inline function v64x4_eq_opt4(x: u64, y: u64): u64 {
  const v = (x ^ y) | LANE_MASK_HIGH;
  const m = ((v >> 1) - v + ONES);
  return (m >> 7) * 0xff;
}

// ============================================================================
// LESS-THAN UNSIGNED: v64x4_ltu
// Returns 0xFF in low bytes where a < b, 0x00 otherwise
// ============================================================================

// ORIGINAL: Your baseline
@inline function v64x4_ltu_original(a: u64, b: u64): u64 {
  return (((a | HIGHS) - (b & ~HIGHS)) | (a ^ b)) ^ (a | ~b);
}

// OPT1: Simplified boolean algebra
// (X | Y) ^ (X | Z) = X ^ (X | Y | Z) when optimizing XOR patterns
@inline function v64x4_ltu_opt1(a: u64, b: u64): u64 {
  const sub = (a | HIGHS) - (b & ~HIGHS);
  const xor_val = a ^ b;
  return (sub | xor_val) ^ (a | ~b);
}

// OPT2: Standard SWAR less-than using hasless
// a < b equivalent to hasless(a - b, 0) when b <= a would not underflow
@inline function v64x4_ltu_opt2(a: u64, b: u64): u64 {
  const a_low = a & LANE_MASK_LOW;
  const b_low = b & LANE_MASK_LOW;
  // Compute (a - b) with borrow detection
  const diff = (a_low | HIGHS) - b_low;
  const borrow = diff & HIGHS;
  return (borrow >> 7) * 0xff;
}

// OPT3: Alternative using XOR trick
@inline function v64x4_ltu_opt3(a: u64, b: u64): u64 {
  const a_low = a & LANE_MASK_LOW;
  const b_low = b & LANE_MASK_LOW;
  const xor_val = a_low ^ b_low;
  const sub = (a_low | HIGHS) - b_low;
  const lt = (xor_val & b_low) | (~xor_val & sub);
  return (lt >> 7) * 0xff;
}

// OPT4: Direct computation - clearest logic
// For 16-bit lanes, check if low byte of a < low byte of b
@inline function v64x4_ltu_opt4(a: u64, b: u64): u64 {
  const a_low = a & LANE_MASK_LOW;
  const b_low = b & LANE_MASK_LOW;
  // Flip high bit to use signed comparison
  const diff = (a_low ^ HIGHS) - (b_low ^ HIGHS);
  return (diff >> 7) * 0xff;
}

// OPT5: Minimal operations
@inline function v64x4_ltu_opt5(a: u64, b: u64): u64 {
  const diff = ((a & LANE_MASK_LOW) | HIGHS) - (b & LANE_MASK_LOW);
  return (~diff >> 7) * 0xff;
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

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

  // Test with "\"b\"c" - bytes 22, 62, 22, 63
  // Comparing with CONTROL_MASK (0x20 repeated)
  // 0x22 < 0x20? No
  // 0x62 < 0x20? No  
  // 0x22 < 0x20? No
  // 0x63 < 0x20? No
  // So expect all zeros
  
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
  
  // Test with bytes that should be less than 0x20
  // Create test data: 0x10, 0x1F, 0x00, 0x19
  console.log("");
  console.log("=== LESS-THAN TEST 2 ===");
  const test_bytes: StaticArray<u8> = [0x10, 0x00, 0x1F, 0x00, 0x00, 0x00, 0x19, 0x00];
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