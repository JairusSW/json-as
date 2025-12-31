import { special_mask} from "./serialize/swar/string";
import { mask_to_string } from "./util/masks";

function testSpecialMask(input: string, expected: string, description: string): void {
  const ptr = changetype<usize>(input);
  const block = load<u64>(ptr);
  const mask = special_mask(block);
  const mask_str = mask_to_string(mask).trim();
  if (mask_str != expected) {
    console.log("Failed: " + description);
    console.log("  Input:    " + mask_to_string(block));
    console.log("  Got:      " + mask_str);
    console.log("  Expected: " + expected.toString());
    process.exit(1);
  }
  console.log("Passed: " + description);
}

// ------------------------
// Simple ASCII
// ------------------------
testSpecialMask("abcd", "0x00 00 00 00 00 00 00 00", "Plain ASCII no escape");

// ------------------------
// Quote / backslash
// ------------------------
testSpecialMask('a"b\\c', "0x00 80 00 00 00 80 00 00", 'Quote and backslash');

// ------------------------
// Control chars
// ------------------------
testSpecialMask("\u0000\u0001\u001F", "0x00 80 00 80 00 80 00 80", 'Control chars <0x20');

// ------------------------
// Surrogate
// ------------------------
testSpecialMask("\uD83D\uDE00ab", "0x00 00 00 00 80 00 80 00", 'Paired surrogate (😀)');

// ------------------------
// Mixed ASCII + surrogate + escape
// ------------------------
testSpecialMask('A\uD83D"B', "0x00 00 00 80 80 00 00 00", 'Mixed ASCII + surrogate + escape');

// ------------------------
// BMP non-ASCII (should not trigger mask)
// ------------------------
testSpecialMask("©é漢a", "0x00 00 80 00 00 00 00 00", "BMP non-ASCII characters");

// ------------------------
// Edge: unpaired high surrogate
// ------------------------
testSpecialMask("\uD83Dabc", "0x00 00 00 00 00 00 80 00", "Unpaired high surrogate");

// ------------------------
// Edge: unpaired low surrogate
// ------------------------
testSpecialMask("\uDE00abc", "0x00 00 00 00 00 00 80 00", "Unpaired low surrogate");

console.log("All special_mask_optimized_magic tests passed!");
