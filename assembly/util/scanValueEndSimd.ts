import {
  BACK_SLASH,
  BRACE_LEFT,
  BRACE_RIGHT,
  BRACKET_LEFT,
  BRACKET_RIGHT,
  COMMA,
  QUOTE,
} from "../custom/chars";
import { isSpace } from "./isSpace";

// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_QUOTE = i16x8.splat(<i16>QUOTE);
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_BACK_SLASH = i16x8.splat(<i16>BACK_SLASH);
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_BRACE_RIGHT = i16x8.splat(<i16>BRACE_RIGHT);
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_BRACKET_RIGHT = i16x8.splat(<i16>BRACKET_RIGHT);
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_COMMA = i16x8.splat(<i16>COMMA);
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_SPACE = i16x8.splat(0x20);
// JSON whitespace besides space is the contiguous range 0x09..0x0d
// (tab/LF/VT/FF/CR), matched as `(c - 9) u<= 4` - one sub + one unsigned
// compare instead of five equality tests. Exact: matches `isSpace` with no
// false positives.
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_WS_LO = i16x8.splat(0x09);
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_WS_SPAN = i16x8.splat(0x04);
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_BRACKET_LEFT = i16x8.splat(<i16>BRACKET_LEFT);
// Clears bit 5 (0x20), folding `{`/`}` onto `[`/`]` so one pair of compares
// matches either bracket flavor. No ASCII char besides `[{`/`]}` folds onto
// `[`/`]`, so the structural mask stays exact.
// @ts-expect-error: @lazy is a valid decorator
@lazy const SPLAT_BRACKET_FOLD = i16x8.splat(<i16>0xffdf);

function quoteOrBackslashMask(block: v128): i32 {
  return i16x8.bitmask(
    v128.or(i16x8.eq(block, SPLAT_QUOTE), i16x8.eq(block, SPLAT_BACK_SLASH)),
  );
}

// Lanes equal to `"`, `{`, `}`, `[`, or `]` - the only bytes that, outside a
// string, change depth or open a string. Everything else (digits, `:`, `,`,
// whitespace, true/false/null) can be bulk-skipped between them.
function structuralOrQuoteMask(block: v128): i32 {
  const folded = v128.and(block, SPLAT_BRACKET_FOLD);
  const brackets = v128.or(
    i16x8.eq(folded, SPLAT_BRACKET_LEFT),
    i16x8.eq(folded, SPLAT_BRACKET_RIGHT),
  );
  return i16x8.bitmask(v128.or(brackets, i16x8.eq(block, SPLAT_QUOTE)));
}

function scalarTerminatorMask(block: v128): i32 {
  const structural = v128.or(
    v128.or(i16x8.eq(block, SPLAT_COMMA), i16x8.eq(block, SPLAT_BRACE_RIGHT)),
    i16x8.eq(block, SPLAT_BRACKET_RIGHT),
  );
  // (c - 9) u<= 4  covers tab/LF/VT/FF/CR; space handled separately.
  const whitespace = v128.or(
    i16x8.le_u(i16x8.sub(block, SPLAT_WS_LO), SPLAT_WS_SPAN),
    i16x8.eq(block, SPLAT_SPACE),
  );
  return i16x8.bitmask(v128.or(structural, whitespace));
}

function scanQuotedValueEnd_SIMD(srcStart: usize, srcEnd: usize): usize {
  srcStart += 2;
  const srcEnd16 = srcEnd >= 16 ? srcEnd - 16 : 0;

  while (srcStart <= srcEnd16) {
    const block = load<v128>(srcStart);
    const mask = quoteOrBackslashMask(block);
    if (mask == 0) {
      srcStart += 16;
      continue;
    }

    const laneIdx = usize(ctz(mask) << 1);
    const srcIdx = srcStart + laneIdx;
    const code = load<u16>(srcIdx);
    if (code == QUOTE) return srcIdx + 2;
    if (srcIdx + 2 >= srcEnd) return 0;
    srcStart = srcIdx + 4;
  }

  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (code == QUOTE) return srcStart + 2;
    if (code == BACK_SLASH) {
      if (srcStart + 2 >= srcEnd) return 0;
      srcStart += 4;
      continue;
    }
    srcStart += 2;
  }

  return 0;
}

function scanCompositeValueEnd_SIMD(srcStart: usize, srcEnd: usize): usize {
  // Classify bounded batches, then visit structural events in source order.
  // Quote parity removes brackets inside strings without visiting every quote.
  // Escaped batches retain the scalar backslash-parity check.
  let depth: i32 = 1;
  let ptr = srcStart + 2;
  const srcEnd16 = srcEnd >= 16 ? srcEnd - 16 : 0;
  let inString = false;

  // Classify 64 UTF-16 code units per bounded batch. Packing before
  // classification halves the vector comparisons and mask extractions; walk
  // every event in order so a closing root still stops inside the batch.
  const srcEnd128 = srcEnd >= 128 ? srcEnd - 128 : 0;
  while (ptr <= srcEnd128) {
    const packed0 = i8x16.narrow_i16x8_u(load<v128>(ptr), load<v128>(ptr + 16));
    const packed1 = i8x16.narrow_i16x8_u(
      load<v128>(ptr + 32),
      load<v128>(ptr + 48),
    );
    const packed2 = i8x16.narrow_i16x8_u(
      load<v128>(ptr + 64),
      load<v128>(ptr + 80),
    );
    const packed3 = i8x16.narrow_i16x8_u(
      load<v128>(ptr + 96),
      load<v128>(ptr + 112),
    );
    let mask: u64 =
      (<u64>packedStructuralOrQuoteMask(packed0)) |
      ((<u64>packedStructuralOrQuoteMask(packed1)) << 16) |
      ((<u64>packedStructuralOrQuoteMask(packed2)) << 32) |
      ((<u64>packedStructuralOrQuoteMask(packed3)) << 48);
    const quotes: u64 =
      (<u64>i8x16.bitmask(i8x16.eq(packed0, i8x16.splat(34)))) |
      ((<u64>i8x16.bitmask(i8x16.eq(packed1, i8x16.splat(34)))) << 16) |
      ((<u64>i8x16.bitmask(i8x16.eq(packed2, i8x16.splat(34)))) << 32) |
      ((<u64>i8x16.bitmask(i8x16.eq(packed3, i8x16.splat(34)))) << 48);
    // Quote-free batches retain the carry state. Otherwise a prefix XOR
    // identifies all lanes inside strings, including a string from the prior batch.
    if (quotes == 0) {
      if (inString) mask = 0;
    } else {
      const slashes = i8x16.bitmask(
        v128.or(
          v128.or(
            i8x16.eq(packed0, i8x16.splat(92)),
            i8x16.eq(packed1, i8x16.splat(92)),
          ),
          v128.or(
            i8x16.eq(packed2, i8x16.splat(92)),
            i8x16.eq(packed3, i8x16.splat(92)),
          ),
        ),
      );
      // Escapes need the scalar parity check, including a run ending in the
      // previous batch. Keep its exact behavior before resuming the wide loop.
      if (slashes || (inString && load<u16>(ptr - 2) == BACK_SLASH)) {
        while (mask != 0) {
          const lane = usize(ctz(mask) << 1);
          mask &= mask - 1;
          const eventPtr = ptr + lane;
          const code = load<u16>(eventPtr);

          if (code == QUOTE) {
            if (!inString) {
              inString = true;
            } else {
              let slash = eventPtr - 2;
              let escaped = false;
              while (slash > srcStart && load<u16>(slash) == BACK_SLASH) {
                escaped = !escaped;
                slash -= 2;
              }
              if (!escaped) inString = false;
            }
            continue;
          }
          if (inString) continue;

          const folded = code & 0xffdf;
          if (folded == BRACKET_LEFT) {
            depth++;
          } else if (folded == BRACKET_RIGHT && --depth == 0) {
            return eventPtr + 2;
          }
        }

        ptr += 128;
        continue;
      }
      let inside = quotes;
      inside ^= inside << 1;
      inside ^= inside << 2;
      inside ^= inside << 4;
      inside ^= inside << 8;
      inside ^= inside << 16;
      inside ^= inside << 32;
      if (inString) inside = ~inside;
      inString = <i64>inside < 0;
      mask &= ~inside & ~quotes;
    }
    while (mask != 0) {
      const lane = usize(ctz(mask) << 1);
      mask &= mask - 1;
      const eventPtr = ptr + lane;
      const folded = load<u16>(eventPtr) & 0xffdf;
      if (folded == BRACKET_LEFT) depth++;
      else if (folded == BRACKET_RIGHT && --depth == 0) return eventPtr + 2;
    }
    ptr += 128;
  }

  while (ptr <= srcEnd16) {
    let mask = structuralOrQuoteMask(load<v128>(ptr));
    while (mask != 0) {
      const lane = usize(ctz(mask) << 1);
      mask &= mask - 1;
      const eventPtr = ptr + lane;
      const code = load<u16>(eventPtr);

      if (code == QUOTE) {
        if (!inString) {
          inString = true;
        } else {
          let slash = eventPtr - 2;
          let escaped = false;
          while (slash > srcStart && load<u16>(slash) == BACK_SLASH) {
            escaped = !escaped;
            slash -= 2;
          }
          if (!escaped) inString = false;
        }
        continue;
      }
      if (inString) continue;

      const folded = code & 0xffdf;
      if (folded == BRACKET_LEFT) {
        depth++;
      } else if (folded == BRACKET_RIGHT && --depth == 0) {
        return eventPtr + 2;
      }
    }
    ptr += 16;
  }

  while (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (code == QUOTE) {
      if (!inString) {
        inString = true;
      } else {
        let slash = ptr - 2;
        let escaped = false;
        while (slash > srcStart && load<u16>(slash) == BACK_SLASH) {
          escaped = !escaped;
          slash -= 2;
        }
        if (!escaped) inString = false;
      }
    } else if (!inString) {
      const folded = code & 0xffdf;
      if (folded == BRACKET_LEFT) {
        depth++;
      } else if (folded == BRACKET_RIGHT && --depth == 0) {
        return ptr + 2;
      }
    }
    ptr += 2;
  }
  return 0;
}

function scanScalarValueEnd_SIMD(srcStart: usize, srcEnd: usize): usize {
  const srcEnd16 = srcEnd >= 16 ? srcEnd - 16 : 0;
  while (srcStart <= srcEnd16) {
    const mask = scalarTerminatorMask(load<v128>(srcStart));
    if (mask == 0) {
      srcStart += 16;
      continue;
    }
    return srcStart + usize(ctz(mask) << 1);
  }

  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (
      code == COMMA ||
      code == BRACKET_RIGHT ||
      code == BRACE_RIGHT ||
      isSpace(code)
    )
      return srcStart;
    srcStart += 2;
  }

  return srcStart;
}

export function scanValueEnd_SIMD<T>(srcStart: usize, srcEnd: usize): usize {
  if (srcStart >= srcEnd) return 0;
  const first = load<u16>(srcStart);

  if (isString<nonnull<T>>() && first == QUOTE)
    return scanQuotedValueEnd_SIMD(srcStart, srcEnd);
  if (isArray<nonnull<T>>() && first == BRACKET_LEFT)
    return scanCompositeValueEnd_SIMD(srcStart, srcEnd);
  if (
    (isManaged<nonnull<T>>() || isReference<nonnull<T>>()) &&
    first == BRACE_LEFT
  )
    return scanCompositeValueEnd_SIMD(srcStart, srcEnd);

  if (first == QUOTE) return scanQuotedValueEnd_SIMD(srcStart, srcEnd);
  if (first == BRACE_LEFT || first == BRACKET_LEFT)
    return scanCompositeValueEnd_SIMD(srcStart, srcEnd);
  return scanScalarValueEnd_SIMD(srcStart, srcEnd);
}

// Code units outside the byte range narrow to either 0 or 255; other bytes
// are preserved. Neither saturation result matches a quote or bracket, so this
// predicate stays exact for all UTF-16 code units, including surrogates.
function packedStructuralOrQuoteMask(packed: v128): i32 {
  // Relative to '[', the four brackets have byte offsets 0, 2, 32 and 34.
  // Clearing just those two bits after subtraction matches exactly that set,
  // including with wrapping byte subtraction. Saturated non-ASCII lanes still
  // cannot match. This replaces folding plus two bracket comparisons.
  const brackets = i8x16.eq(
    v128.and(i8x16.sub(packed, i8x16.splat(91)), i8x16.splat(<i8>0xdd)),
    i8x16.splat(0),
  );
  return i8x16.bitmask(
    v128.or(brackets, i8x16.eq(packed, i8x16.splat(34))),
  );
}
