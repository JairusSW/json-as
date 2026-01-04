import { mask_to_string } from "./util/masks";

console.log(mask_to_string(changetype<usize>("\"abc")));
console.log(mask_to_string(backslash_mask_unsafe(0x0000000000005c5c)));
console.log(mask_to_string(backslash_mask(0x0000000000005c5c)));

/**
 * Computes a per-lane mask identifying UTF-16 code units whose **low byte**
 * is the ASCII backslash (`'\\'`, 0x5C).
 *
 * The mask is produced in two stages:
 * 1. Detects bytes equal to 0x5C using a SWAR equality test.
 * 2. Clears matches where 0x5C appears in the **high byte** of a UTF-16 code unit,
 *    ensuring only valid low-byte backslashes are reported.
 *
 * Each matching lane sets itself to 0x80.
 */
// @ts-ignore: decorator
@inline function backslash_mask(block: u64): u64 {
  const b = block ^ 0x005C_005C_005C_005C;
  const backslash_mask = (b - 0x0001_0001_0001_0001) & ~b & 0x0080_0080_0080_0080;
  const high_byte_mask =
    ~(((block - 0x0100_0100_0100_0100) & ~block & 0x8000_8000_8000_8000)
      ^ 0x8000_8000_8000_8000) >> 8;
  return backslash_mask & high_byte_mask;
}

/**
 * Computes a per-lane mask identifying UTF-16 code units whose **low byte**
 * is the ASCII backslash (`'\\'`, 0x5C).
 *
 * Each matching lane sets itself to 0x80.
 * 
 * WARNING: The low byte of a code unit *may* be a backslash, thus triggering false positives!
 * This is useful for a hot path where it is possible to detect the false positive scalarly.
 */
// @ts-ignore: decorator
@inline function backslash_mask_unsafe(block: u64): u64 {
  const b = block ^ 0x005C_005C_005C_005C;
  const backslash_mask = (b - 0x0001_0001_0001_0001) & ~b & 0x0080_0080_0080_0080;
  return backslash_mask;
}
