import { COMMA } from "../custom/chars";

/** Counts comma-delimited elements in a known non-empty array body. */
export function countArrayElements(start: usize, end: usize): i32 {
  let count = 1;
  let ptr = start;
  while (ptr + 8 <= end) {
    const word = load<u64>(ptr) ^ 0x002c_002c_002c_002c;
    // Exact per-lane equality without the borrow false positives of the usual
    // `(x - 1) & ~x` zero-byte mask (notably comma followed by minus).
    const commas = ~(
      ((word & 0x7fff_7fff_7fff_7fff) + 0x7fff_7fff_7fff_7fff) |
      word |
      0x7fff_7fff_7fff_7fff
    );
    count += <i32>popcnt(commas);
    ptr += 8;
  }
  for (; ptr < end; ptr += 2) if (load<u16>(ptr) == COMMA) count++;
  return count;
}
