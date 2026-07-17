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
  // Walk every structural event in a loaded block before advancing. This is
  // substantially cheaper for object-heavy values than restarting a SIMD hunt
  // after every short key: one v128 load now covers all quotes and brackets in
  // its eight UTF-16 lanes. Brackets inside strings are ignored, and a closing
  // quote is active only when preceded by an even-length backslash run.
  let depth: i32 = 1;
  let ptr = srcStart + 2;
  const srcEnd16 = srcEnd >= 16 ? srcEnd - 16 : 0;
  let inString = false;

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
