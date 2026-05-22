import {
  BRACE_LEFT,
  BRACE_RIGHT,
  BRACKET_LEFT,
  BRACKET_RIGHT,
  COMMA,
  QUOTE,
} from "../custom/chars";
import { scanStringEnd } from "./stringScan";

/**
 * Pure-scalar value-end scanner used by the NAIVE container deserializers.
 *
 * Returns the position immediately after the value that begins at `srcStart`:
 *
 * - For a quoted string: position past the closing `"` (uses scalar
 *   {@link scanStringEnd}).
 * - For an object/array: position past the matching `}`/`]`, tracking depth
 *   and skipping nested quoted strings.
 * - For anything else: position of the first `,`, `]`, or `}` (the value's
 *   structural terminator).
 *
 * Returns `0` when the input is empty or no terminator is found.
 *
 * Mirrors the semantics of `deserialize/swar/array/shared.ts:scanValueEnd`
 * but stays scalar so `simple/` callers don't pull SWAR into the correctness
 * baseline.
 */
// @ts-ignore: inline
@inline export function scanValueEnd(srcStart: usize, srcEnd: usize): usize {
  if (srcStart >= srcEnd) return 0;
  const first = load<u16>(srcStart);

  if (first == QUOTE) {
    const end = scanStringEnd(srcStart, srcEnd);
    return end >= srcEnd ? 0 : end + 2;
  }

  if (first == BRACE_LEFT || first == BRACKET_LEFT) {
    let depth: i32 = 1;
    let ptr = srcStart + 2;
    while (ptr < srcEnd) {
      const code = load<u16>(ptr);
      if (code == QUOTE) {
        const end = scanStringEnd(ptr, srcEnd);
        if (end >= srcEnd) return 0;
        ptr = end + 2;
        continue;
      }
      if (code == BRACE_LEFT || code == BRACKET_LEFT) {
        depth++;
      } else if (code == BRACE_RIGHT || code == BRACKET_RIGHT) {
        if (--depth == 0) return ptr + 2;
      }
      ptr += 2;
    }
    return 0;
  }

  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (code == COMMA || code == BRACKET_RIGHT || code == BRACE_RIGHT)
      return srcStart;
    srcStart += 2;
  }

  return 0;
}
