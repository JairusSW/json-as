import { FALSE_WORD_U64, TRUE_WORD_U64 } from "../../../custom/chars";

/**
 * Boolean-array deserializer (used by every JSON_MODE for top-level
 * `JSON.parse<bool[]>`). Worst-case sizing is one element per `"true,"` =
 * 10 UTF-16 bytes, so pre-allocating `(srcEnd - srcStart) / 10` slots
 * upper-bounds the element count exactly once and lets the loop write
 * through a direct pointer instead of `Array.push`.
 *
 * The token check itself is already SWAR-shaped: a single `u64` load
 * matches all four chars of `true`, and the `false` case adds one `u16`
 * load to confirm the trailing `e`.
 */
export function deserializeBooleanArray<T extends boolean[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );

  // Worst case: every element is `true,` = 5 UTF-16 chars = 10 bytes.
  // `bool` is unmanaged so AS skips zero-fill on `length=`, making the
  // over-allocation essentially free.
  const maxElements = i32(<usize>(srcEnd - srcStart) / 10);
  if (maxElements > 0) out.length = maxElements;
  const dataStart = out.dataStart;
  let writePtr = dataStart;

  srcStart += 2; // skip `[`
  while (srcStart < srcEnd) {
    const block = load<u64>(srcStart);
    if (block == TRUE_WORD_U64) {
      store<bool>(writePtr, true);
      writePtr += 1;
      srcStart += 10;
    } else if (block == FALSE_WORD_U64 && load<u16>(srcStart, 8) == 101) {
      store<bool>(writePtr, false);
      writePtr += 1;
      srcStart += 12;
    } else {
      srcStart += 2;
    }
  }
  out.length = i32(writePtr - dataStart);
  return out;
}
