import {
  BACK_SLASH,
  BRACE_LEFT,
  BRACE_RIGHT,
  BRACKET_LEFT,
  BRACKET_RIGHT,
  COLON,
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
// (tab/LF/VT/FF/CR), matched as `(c - 9) u<= 4` — one sub + one unsigned
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

// Lanes equal to `"`, `{`, `}`, `[`, or `]` — the only bytes that, outside a
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
  // Process structural tokens scalar-side (cheap, and token-dense regions stay
  // in a tight loop), but bulk-skip the bytes between them: nested string VALUES
  // via the vectorized quoted scan (URLs, base64, prose), and runs of digits /
  // punctuation / whitespace (numeric arrays like coordinate lists) via a
  // vectorized hunt for the next `"`/`{`/`}`/`[`/`]`.
  let depth: i32 = 1;
  let ptr = srcStart + 2;
  const srcEnd16 = srcEnd >= 16 ? srcEnd - 16 : 0;
  while (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (code == QUOTE) {
      ptr = scanQuotedValueEnd_SIMD(ptr, srcEnd);
      if (!ptr) return 0;
      continue;
    }
    const folded = code & 0xffdf;
    if (folded == BRACKET_LEFT) {
      // `[` or `{`
      depth++;
      ptr += 2;
      continue;
    }
    if (folded == BRACKET_RIGHT) {
      // `]` or `}`
      if (--depth == 0) return ptr + 2;
      ptr += 2;
      continue;
    }
    ptr += 2;
    // `,` and `:` sit one byte from the next token, so vectorizing them only
    // adds SIMD setup on string-dense objects — stay scalar. Other fillers
    // (number digits, whitespace, true/false/null) can run long; vectorize past
    // them to the next `"`/`{`/`}`/`[`/`]`.
    if (code == COMMA || code == COLON) continue;
    while (ptr <= srcEnd16) {
      const mask = structuralOrQuoteMask(load<v128>(ptr));
      if (mask == 0) {
        ptr += 16;
        continue;
      }
      ptr += usize(ctz(mask) << 1);
      break;
    }
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
