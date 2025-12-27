function v64x4_should_escape(x: u64): u64 {
  console.log("input:        " + mask_to_string(x));
  const is_non_ascii = (x & 0xFF80_FF80_FF80_FF80);
  const hi = x & 0xff00_ff00_ff00_ff00;
  const lo = x & 0x00ff_00ff_00ff_00ff;
  x &= 0x00ff_00ff_00ff_00ff;
  const is_cp_or_surrogate = (hi & 0x8080_8080_8080_8080);
  const is_ascii = 0x0080_0080_0080_0080 & ~x; // lane remains 0x80 if ascii
  const lt32 = (x - 0x0020_0020_0020_0020);
  const sub34 = x ^ 0x0022_0022_0022_0022;
  const eq34 = (sub34 - 0x0001_0001_0001_0001);
  const sub92 = x ^ 0x005C_005C_005C_005C;
  const eq92 = (sub92 - 0x0001_0001_0001_0001);
  console.log("low:          " + mask_to_string(lo));
  console.log("high:         " + mask_to_string(hi));
  console.log("is_cp_or_sur: " + mask_to_string(is_cp_or_surrogate));
  console.log("is_non_ascii: " + mask_to_string(is_non_ascii));
  console.log("is_ascii:     " + mask_to_string(is_ascii));
  console.log("lt32:         " + mask_to_string(lt32));
  console.log("sub34:        " + mask_to_string(sub34));
  console.log("eq34:         " + mask_to_string(eq34));
  console.log("eq92:         " + mask_to_string(eq92));
  console.log("pre:          " + mask_to_string((lt32 | eq34 | eq92)));
  console.log("out:          " + mask_to_string((lt32 | eq34 | eq92) & is_ascii));
  return (((lt32 | eq34 | eq92) ^ is_cp_or_surrogate) & is_ascii);
}

function pack4(a: u16, b: u16, c: u16, d: u16): u64 {
  return (a as u64) | ((b as u64) << 16) | ((c as u64) << 32) | ((d as u64) << 48);
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

function test_mask(input: u64, expected_mask: u64, description: string): void {
  const mask = v64x4_should_escape(input);
  const pass = mask == expected_mask;
  console.log((pass ? "✓ " : "✗ ") + description);
  console.log("  Input:    " + mask_to_string(input));
  console.log("  Expected: " + mask_to_string(expected_mask));
  console.log("  Got:      " + mask_to_string(mask));
  if (!pass) {
    process.exit(1);
  }
}

// ------------------------
// 1. Plain ASCII text
// ------------------------
console.log("=== Plain ASCII text ===");
test_mask(pack4(0x0041, 0x0062, 0x0063, 0x007A), 0x0, "Letters 'A','b','c','z'");
test_mask(pack4(0x0030, 0x0031, 0x0032, 0x0039), 0x0, "Numbers '0'-'9'");
test_mask(pack4(0x0020, 0x0021, 0x0023, 0x007E), 0x0, "Safe symbols");

// ------------------------
// 2. Quote and backslash
// ------------------------
console.log("=== Quote and Backslash ===");
test_mask(pack4(0x0022, 0x0041, 0x0022, 0x0041), 0x0000008000000080, "Quotes at lanes 0 and 2");
test_mask(pack4(0x005C, 0x0041, 0x005C, 0x0041), 0x0000008000000080, "Backslashes at lanes 0 and 2");

// ------------------------
// 3. Control codes
// ------------------------
console.log("=== Control Codes ===");
test_mask(pack4(0x0000, 0x000A, 0x001F, 0x001B), 0x0080008000800080, "Control codes 0,10,31,27");

// // ------------------------
// // 4. Surrogate / codepoint check
// // ------------------------
console.log("=== Surrogate / Codepoint ===");

// // "😀A " 
test_mask(pack4(0xD83D, 0xDE00, 0xDC41, 0xDF20), 0x0000800000000000, "Surrogates at lanes 0 and 1");
