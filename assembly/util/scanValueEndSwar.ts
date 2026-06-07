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

// SWAR analogue of `scanValueEndSimd.ts`, processing four UTF-16 lanes per
// 64-bit word for the SWAR build mode (no SIMD feature). Each mask is a fast
// FILTER — a matched lane is re-checked with a real `load<u16>` before acting —
// so the masks may over-match non-ASCII lanes whose low byte equals a target
// (the verify rejects them). Lane byte offset within a hit word is
// `ctz(mask) >> 3` (detection bit sits at lane*16 + 7).

const ONES: u64 = 0x0001_0001_0001_0001;
const HI: u64 = 0x0080_0080_0080_0080;

// 16-bit-lane "equals" partials (pre-`& HI`); OR several, then `& HI` once.
function eqPart(block: u64, splat: u64): u64 {
  const t = block ^ splat;
  return (t - ONES) & ~t;
}

const S_QUOTE: u64 = 0x0022_0022_0022_0022;
const S_BACK_SLASH: u64 = 0x005c_005c_005c_005c;

function quoteOrBackslashMask(block: u64): u64 {
  return (eqPart(block, S_QUOTE) | eqPart(block, S_BACK_SLASH)) & HI;
}

function scanQuotedValueEnd_SWAR(srcStart: usize, srcEnd: usize): usize {
  srcStart += 2;
  const srcEnd8 = srcEnd >= 8 ? srcEnd - 8 : 0;

  // Fast-skip 8-byte windows until a real quote (return) or a backslash, then
  // hand off to the precise scalar tail (which resolves escape runs). The mask
  // is a filter, so each candidate lane is verified with a real `load<u16>`;
  // non-ASCII lanes that spuriously match are skipped (neither quote nor
  // backslash), and `srcStart` is left at the window start for the tail.
  while (srcStart <= srcEnd8) {
    let mask = quoteOrBackslashMask(load<u64>(srcStart));
    if (mask == 0) {
      srcStart += 8;
      continue;
    }
    do {
      const srcIdx = srcStart + (usize(ctz(mask)) >> 3);
      mask &= mask - 1;
      const code = load<u16>(srcIdx);
      if (code == QUOTE) return srcIdx + 2;
      if (code == BACK_SLASH) break;
    } while (mask != 0);
    break;
  }

  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (code == QUOTE && load<u16>(srcStart - 2) != BACK_SLASH)
      return srcStart + 2;
    srcStart += 2;
  }
  return 0;
}

function scanCompositeValueEnd_SWAR(srcStart: usize, srcEnd: usize): usize {
  // Scalar depth tracking (structural tokens are sparse; a bulk token-mask scan
  // loses to a tight loop on token-dense objects) with SWAR quoted-skip for
  // nested string values — where the long runs are.
  let depth: i32 = 1;
  let ptr = srcStart + 2;
  while (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (code == QUOTE) {
      ptr = scanQuotedValueEnd_SWAR(ptr, srcEnd);
      if (!ptr) return 0;
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

function scanScalarValueEnd_SWAR(srcStart: usize, srcEnd: usize): usize {
  // Scalars (number/true/false/null) are short, so a plain scalar terminator
  // scan beats setting up SWAR masks per word.
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

/**
 * SWAR `scanValueEnd`: position just past the value at `srcStart`. Strings and
 * objects/arrays use the SWAR token scans above; scalars use a short scalar
 * loop. Returns 0 on empty input or an unterminated string/composite.
 */
export function scanValueEnd_SWAR<T>(srcStart: usize, srcEnd: usize): usize {
  if (srcStart >= srcEnd) return 0;
  const first = load<u16>(srcStart);

  if (isString<nonnull<T>>() && first == QUOTE)
    return scanQuotedValueEnd_SWAR(srcStart, srcEnd);
  if (isArray<nonnull<T>>() && first == BRACKET_LEFT)
    return scanCompositeValueEnd_SWAR(srcStart, srcEnd);
  if (
    (isManaged<nonnull<T>>() || isReference<nonnull<T>>()) &&
    first == BRACE_LEFT
  )
    return scanCompositeValueEnd_SWAR(srcStart, srcEnd);

  if (first == QUOTE) return scanQuotedValueEnd_SWAR(srcStart, srcEnd);
  if (first == BRACE_LEFT || first == BRACKET_LEFT)
    return scanCompositeValueEnd_SWAR(srcStart, srcEnd);
  return scanScalarValueEnd_SWAR(srcStart, srcEnd);
}
