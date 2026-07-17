// Whitespace-run scanner selected once for large pretty JSON documents.

// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_SPACE = i16x8.splat(0x20);
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_WS_LO = i16x8.splat(9);
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_WS_SPAN = i16x8.splat(4);
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_LF = i16x8.splat(10);


@inline
function whitespaceMask(block: v128): i32 {
  return i16x8.bitmask(
    v128.or(
      i16x8.eq(block, SPLAT_SPACE),
      i16x8.le_u(i16x8.sub(block, SPLAT_WS_LO), SPLAT_WS_SPAN),
    ),
  );
}

/** Detect an eight-space indentation run near the document head. */
export function hasLongPrettyIndent_SIMD(srcStart: usize, srcEnd: usize): bool {
  const sampleEnd = min(srcEnd, srcStart + 4096);
  const vectorEnd = sampleEnd >= 16 ? sampleEnd - 16 : 0;
  while (srcStart <= vectorEnd) {
    let mask = i16x8.bitmask(i16x8.eq(load<v128>(srcStart), SPLAT_LF));
    while (mask != 0) {
      const newline = srcStart + ((<usize>ctz(mask)) << 1);
      if (
        newline + 18 <= srcEnd &&
        !v128.any_true(v128.xor(load<v128>(newline, 2), i16x8.splat(0x20)))
      )
        return true;
      mask &= mask - 1;
    }
    srcStart += 16;
  }
  return false;
}

/** `srcStart` is known to point at JSON whitespace. */
export function skipPrettyWhitespace_SIMD(
  srcStart: usize,
  srcEnd: usize,
): usize {
  srcStart += 2;
  if (srcStart >= srcEnd) return srcStart;
  let code = load<u16>(srcStart);
  if (code != 0x20 && code - 9 > 4) return srcStart;

  const vectorEnd = srcEnd >= 16 ? srcEnd - 16 : 0;
  while (srcStart <= vectorEnd) {
    const mask = whitespaceMask(load<v128>(srcStart));
    if (mask == 0xff) {
      srcStart += 16;
      continue;
    }
    srcStart += (<usize>ctz(~mask & 0xff)) << 1;
    return srcStart;
  }
  do {
    srcStart += 2;
    if (srcStart >= srcEnd) return srcStart;
    code = load<u16>(srcStart);
  } while (code == 0x20 || code - 9 <= 4);
  return srcStart;
}
