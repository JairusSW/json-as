function v64x4_should_escape(x: u64): u64 {
  console.log("input:        " + mask_to_string(x));
  const non_ascii_lanes = (x & 0x8000_8000_8000_8000) >> 8;
  const hi = x & 0xff00_ff00_ff00_ff00;
  const lo = x & 0x00ff_00ff_00ff_00ff;
  const is_cp_or_surrogate = (x & 0x8080_8080_8080_8080)
  x &= 0x00ff_00ff_00ff_00ff;
  const is_ascii = 0x0080_0080_0080_0080 & ~x; // lane remains 0x80 if ascii
  const lt32 = (x - 0x0020_0020_0020_0020);
  const sub34 = x ^ 0x0022_0022_0022_0022;
  const eq34 = (sub34 - 0x0001_0001_0001_0001);
  const sub92 = x ^ 0x005C_005C_005C_005C;
  const eq92 = (sub92 - 0x0001_0001_0001_0001);
  console.log("low:          " + mask_to_string(lo));
  console.log("high:         " + mask_to_string(hi));
  console.log("is_cp_or_sur: " + mask_to_string(is_cp_or_surrogate));
  console.log("is_non_ascii: " + mask_to_string(non_ascii_lanes));
  console.log("is_ascii:     " + mask_to_string(is_ascii));
  console.log("lt32:         " + mask_to_string(lt32));
  console.log("sub34:        " + mask_to_string(sub34));
  console.log("eq34:         " + mask_to_string(eq34));
  console.log("eq92:         " + mask_to_string(eq92));
  console.log("pre:          " + mask_to_string((lt32 | eq34 | eq92) & is_ascii));
  console.log("out:          " + mask_to_string(((lt32 | eq34 | eq92) & is_ascii) & ~is_cp_or_surrogate));
  console.log("out:          " + mask_to_string((lt32 | eq34 | eq92) & is_ascii));
  return ((lt32 | eq34 | eq92) & is_ascii) & ~non_ascii_lanes
}

function mask_to_string(mask: u64): string {
  let result = "0x";
  for (let i = 7; i >= 0; i--) {
    const byte = u8((mask >> (i * 8)) & 0xFF);
    const hi = (byte >> 4) & 0xF;
    const lo = byte & 0xF;
    result += String.fromCharCode(hi < 10 ? 48 + hi : 55 + hi);
    result += String.fromCharCode(lo < 10 ? 48 + lo : 55 + lo);
    result += " ";
  }
  return result;
}

function test_mask(input: string, expected_mask: u64, description: string): void {
  const i = load<u64>(changetype<usize>(input));
  const mask = v64x4_should_escape(i);
  const pass = mask == expected_mask;
  console.log((pass ? "✓ " : "✗ ") + description);
  console.log("  Input:    " + mask_to_string(i));
  console.log("  Expected: " + mask_to_string(expected_mask));
  console.log("  Got:      " + mask_to_string(mask));
  if (!pass) process.exit(1);
}

// ------------------------
// 1. Plain ASCII text
// ------------------------
console.log("=== Plain ASCII text ===");
test_mask("Abcz", 0x0, "Letters 'A','b','c','z'");
test_mask("0129", 0x0, "Numbers '0'-'9'");
test_mask(" !#~", 0x0, "Safe symbols");

// ------------------------
// 2. Quote and Backslash
// ------------------------
console.log("=== Quote and Backslash ===");
test_mask("\"\\" + "AA", 0x0000000000800080, "Quote + backslash lanes 0 and 1");
test_mask("A\"\\" + "A", 0x0000008000800000, "Quote lane1, backslash lane2");

// ------------------------
// 3. Control Codes
// ------------------------
console.log("=== Control Codes ===");
test_mask("\0\n\u001F\u001B", 0x0080008000800080, "Control codes 0,10,31,27");
test_mask("\t\n\r\u0010", 0x0080008000800080, "Control codes 9,10,13,16");

// ------------------------
// 4. Surrogate / Codepoint
// ------------------------
console.log("=== Surrogate / Codepoint ===");
test_mask("\uD83D\uDE00\uD83D\uDE00", 0x0000000000000000, "Surrogates lane0/1 and 2/3");
test_mask("A\uD83D\uDE00B", 0x0000000000000000, "ASCII lane0/3, surrogate lane1/2");

// ------------------------
// 5. Mixed ASCII + Unicode
// ------------------------
console.log("=== Mixed ASCII + Unicode ===");
test_mask("A©漢🚀", 0x0000000000000000, "Mixed ASCII + codepoints");
test_mask("\"\uD83D\\B", 0x0000008000000080, "Quote lane0, surrogate lane1, backslash lane2, ASCII lane3");