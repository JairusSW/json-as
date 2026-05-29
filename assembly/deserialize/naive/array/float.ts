import { isSpace } from "../../../util";
import { COMMA, BRACKET_RIGHT } from "../../../custom/chars";
import { JSON } from "../../..";

/**
 * Float-array deserializer (`f64[]` / `f32[]`).
 *
 * Worst-case sizing: every element is at least `D,` = 2 UTF-16 chars = 4
 * bytes (a single-digit value followed by `,` or `]`). The `srcLen >> 2`
 * upper bound holds even for valid JSON containing negative or fractional
 * widths, because each element advance still consumes >= 4 bytes.
 *
 * f64/f32 are unmanaged so AS skips zero-fill on `length=`. The parse loop
 * writes through a direct `writePtr` pointer, eliminating `Array.push`'s
 * per-element capacity check + length write. Final `out.length` is trimmed
 * to the actual element count.
 */
export function deserializeFloatArray_NAIVE<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );

  const elementSize = sizeof<valueof<T>>();
  const maxElements = i32((<usize>(srcEnd - srcStart)) >> 2);
  if (maxElements > 0) out.length = maxElements;
  const dataStart = out.dataStart;
  let writePtr = dataStart;

  let lastIndex: usize = 0;
  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (<u32>code - 48 <= 9 || code == 45) {
      lastIndex = srcStart;
      srcStart += 2;
      while (srcStart < srcEnd) {
        const c = load<u16>(srcStart);
        if (c == COMMA || c == BRACKET_RIGHT || isSpace(c)) {
          const value = JSON.__deserialize<valueof<T>>(lastIndex, srcStart);
          store<valueof<T>>(writePtr, value);
          writePtr += elementSize;
          break;
        }
        srcStart += 2;
      }
    }
    srcStart += 2;
  }

  out.length = i32(<usize>(writePtr - dataStart) / elementSize);
  return out;
}
