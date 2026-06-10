import { ptrToStr } from "../../../util/ptrToStr";
import { scientific } from "../../../util/scientific";
import { deserializeFloatField_NAIVE } from "../../naive/float";
import { deserializeFloatArray_NAIVE } from "../../naive/array/float";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { ensureArrayElementSlot, ensureArrayField } from "./shared";
import { parse4Digits_PairMul } from "../../../util/swar-int";
import { loadPow10, MAX_EXACT_MANTISSA, MAX_EXACT_POW10 } from "../float";
import { isSpace } from "../../../util";

function skipFloatArrayWhitespace(srcStart: usize, srcEnd: usize): usize {
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  return srcStart;
}
function fallbackStore<E>(origStart: usize, end: usize, slot: usize): void {
  const s = ptrToStr(origStart, end);
  if (sizeof<E>() == sizeof<f32>()) {
    store<f32>(slot, f32.parse(s));
  } else {
    store<f64>(slot, f64.parse(s));
  }
}

/**
 * Inline single-pass Lemire-style float element parser for arrays.
 *
 * Bit-identical output to `f64.parse` / `f32.parse`: u64 mantissa
 * accumulation is exact, and `<f64>mantissa * pow10[exp]` is correctly
 * rounded for the fast-path range (mantissa <= 2^53, |exp| <= 22).
 * Pathological inputs (oversized mantissa or exponent) fall back to
 * `f*.parse` over the float's own substring, again matching the NAIVE
 * baseline.
 *
 * Returns the advanced source position on success, or `0` to signal "bail
 * to the per-element NAIVE path" only for truly malformed input (no leading
 * digit, lone minus, malformed exponent suffix). Valid-but-out-of-range
 * numbers are handled inline.
 */
export function parseFloatElementSWAR<E>(
  srcStart: usize,
  srcEnd: usize,
  slot: usize,
): usize {
  const origStart = srcStart;
  let p = srcStart;
  let negative = false;
  let code = load<u16>(p);
  if (code == 45) {
    negative = true;
    p += 2;
    if (p >= srcEnd) return 0;
    code = load<u16>(p);
  }

  let firstDigit = <u32>code - 48;
  if (firstDigit > 9) return 0;

  // Integer mantissa: scalar (most JSON integers are 1-3 digits).
  let mantissa: u64 = 0;
  let intDigits: i32 = 0;
  while (p < srcEnd) {
    const d = <u32>load<u16>(p) - 48;
    if (d > 9) break;
    mantissa = mantissa * 10 + <u64>d;
    intDigits++;
    p += 2;
  }

  // Fractional mantissa: parse4 SWAR stride + scalar tail. Same u64
  // accumulator as the integer part - exponent compensates for fracDigits.
  let fracDigits: i32 = 0;
  if (p < srcEnd && load<u16>(p) == 46) {
    p += 2;
    while (p + 6 < srcEnd) {
      const parsed = parse4Digits_PairMul(load<u64>(p));
      if (parsed == U32.MAX_VALUE) break;
      mantissa = mantissa * 10_000 + <u64>parsed;
      fracDigits += 4;
      p += 8;
    }
    while (p < srcEnd) {
      const d = <u32>load<u16>(p) - 48;
      if (d > 9) break;
      mantissa = mantissa * 10 + <u64>d;
      fracDigits++;
      p += 2;
    }
  }

  const mantDigits = intDigits + fracDigits;
  let exponent: i32 = -fracDigits;

  // Optional `e[+-]NNN` suffix.
  if (p < srcEnd) {
    code = load<u16>(p);
    if (code == 101 || code == 69) {
      const expStart = p;
      p += 2;
      if (p >= srcEnd) {
        fallbackStore<E>(origStart, expStart, slot);
        return expStart;
      }
      let expNeg = false;
      const sc = load<u16>(p);
      if (sc == 45) {
        expNeg = true;
        p += 2;
      } else if (sc == 43) {
        p += 2;
      }
      if (p >= srcEnd) {
        fallbackStore<E>(origStart, expStart, slot);
        return expStart;
      }
      let exp: i32 = 0;
      let expDigits: i32 = 0;
      while (p < srcEnd) {
        const d = <u32>load<u16>(p) - 48;
        if (d > 9) break;
        exp = exp * 10 + <i32>d;
        expDigits++;
        if (expDigits > 4) {
          fallbackStore<E>(origStart, p, slot);
          return p;
        }
        p += 2;
      }
      if (expDigits == 0) {
        fallbackStore<E>(origStart, expStart, slot);
        return expStart;
      }
      exponent += expNeg ? -exp : exp;
    }
  }

  // Lemire fast path: mantissa <= 2^53 and |exp| <= 22 means a single fmul
  // on two exactly-representable operands, correctly rounded.
  let result: f64;
  if (
    mantDigits <= 19 &&
    mantissa <= MAX_EXACT_MANTISSA &&
    exponent <= MAX_EXACT_POW10 &&
    exponent >= -MAX_EXACT_POW10
  ) {
    result = <f64>mantissa;
    if (exponent > 0) {
      result *= loadPow10(<u32>exponent);
    } else if (exponent < 0) {
      result /= loadPow10(<u32>-exponent);
    }
  } else if (mantDigits <= 19) {
    // Mantissa fits in u64 but the fast-path constraints don't hold. Call
    // `scientific` directly with our already-parsed mantissa+exp, skipping
    // the `ptrToStr` allocation + strtod re-parse.
    result = scientific(mantissa, exponent);
  } else {
    // >19 mantissa digits - beyond u64 capacity, may need strtod's sticky-bit
    // pattern. Hand off to f*.parse on the float's substring.
    fallbackStore<E>(origStart, p, slot);
    return p;
  }
  if (negative) result = -result;

  if (sizeof<E>() == sizeof<f32>()) {
    store<f32>(slot, <f32>result);
  } else {
    store<f64>(slot, result);
  }
  return p;
}

/**
 * Top-level SWAR float-array deserializer (`f64[]` / `f32[]`).
 *
 * Worst-case sizing matches the NAIVE variant: each element occupies >=
 * 2 UTF-16 chars (`D,`), so `(srcEnd - srcStart) >> 2` upper-bounds the
 * element count. `f64`/`f32` are unmanaged so AS skips zero-fill on
 * `length=`, making the over-allocation effectively free; the trailing
 * `out.length` trim recovers the true count.
 *
 * The fast loop writes directly through `writePtr` (eliminating the
 * per-element `Array.push` capacity check + length write) and inlines
 * `parseFloatElementSWAR` (eliminating the double-scan that
 * `deserializeFloatArray_NAIVE` performs: scan-to-terminator +
 * `JSON.__deserialize` re-parse). If the inline parser bails (truly
 * malformed input), we hand off to the NAIVE path with the pre-allocated
 * buffer retained so capacity is reused.
 */
export function deserializeFloatArray_SWAR<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );
  const originalSrcStart = srcStart;

  const elementSize = sizeof<valueof<T>>();
  const maxElements = i32((<usize>(srcEnd - srcStart)) >> 2);
  if (maxElements > 0) out.length = maxElements;
  const dataStart = out.dataStart;
  let writePtr = dataStart;

  do {
    if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
    srcStart += 2;
    srcStart = skipFloatArrayWhitespace(srcStart, srcEnd);
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      out.length = 0;
      return out;
    }

    while (srcStart < srcEnd) {
      const next = parseFloatElementSWAR<valueof<T>>(
        srcStart,
        srcEnd,
        writePtr,
      );
      if (!next) break;
      writePtr += elementSize;
      srcStart = skipFloatArrayWhitespace(next, srcEnd);
      if (srcStart >= srcEnd) break;

      const code = load<u16>(srcStart);
      if (code == COMMA) {
        srcStart += 2;
        srcStart = skipFloatArrayWhitespace(srcStart, srcEnd);
        continue;
      }
      if (code == BRACKET_RIGHT) {
        out.length = i32(<usize>(writePtr - dataStart) / elementSize);
        return out;
      }
      break;
    }
  } while (false);

  return deserializeFloatArray_NAIVE<T>(
    originalSrcStart,
    srcEnd,
    changetype<usize>(out),
  );
}

/**
 * Field/into variant - parses `[..]` into the existing `out` array and
 * returns the cursor past the closing `]`.
 *
 * Worst-case pre-sizing (`(srcEnd - srcStart) >> 2`) used by the top-level
 * SWAR entry is unsafe here: nested callers pass the *outer* container's
 * `srcEnd`, so on `f64[][][]` payloads like canada.json each tiny inner
 * `[lon,lat]` would over-allocate megabytes of f64 capacity. Instead we
 * use `ensureArrayElementSlot`'s grow-or-reuse strategy.
 */
export function deserializeFloatArrayBody<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
): usize {
  let index = 0;

  do {
    if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
    srcStart += 2;
    srcStart = skipFloatArrayWhitespace(srcStart, srcEnd);
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      out.length = 0;
      return srcStart + 2;
    }

    while (srcStart < srcEnd) {
      const slot = ensureArrayElementSlot<T>(out, index);
      let next = parseFloatElementSWAR<valueof<T>>(srcStart, srcEnd, slot);
      if (!next) {
        next = deserializeFloatField_NAIVE<valueof<T>>(srcStart, srcEnd, slot);
      }
      srcStart = next;
      if (!srcStart) break;
      srcStart = skipFloatArrayWhitespace(srcStart, srcEnd);
      if (srcStart >= srcEnd) break;

      const code = load<u16>(srcStart);
      if (code == COMMA) {
        srcStart += 2;
        srcStart = skipFloatArrayWhitespace(srcStart, srcEnd);
        index++;
        continue;
      }
      if (code == BRACKET_RIGHT) {
        // Skip the `out.length =` call when the length is already correct.
        // `ensureArrayElementSlot` only grows (never shrinks), so when this
        // array is being reused with the same shape (canada's `[lon,lat]`
        // pairs across thousands of geometries) the length is unchanged
        // and the AS runtime's `ensureCapacity` call is pure overhead.
        const nextLen = index + 1;
        if (out.length != nextLen) out.length = nextLen;
        return srcStart + 2;
      }
      break;
    }
  } while (false);

  throw new Error("Failed to parse JSON!");
}
export function deserializeFloatArrayField<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  return deserializeFloatArrayBody<T>(
    srcStart,
    srcEnd,
    ensureArrayField<T>(fieldPtr),
  );
}
