import { ptrToStr } from "../../../util/ptrToStr";
import { scientific } from "../../../util/scientific";
import { deserializeFloatField_NAIVE } from "../../naive/float";
import { deserializeFloatArray_NAIVE } from "../../naive/array/float";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { ensureArrayElementSlot, ensureArrayField } from "./shared";
import {
  parse4Digits_PairMul,
  parse8Digits_PairMul,
} from "../../../util/swar-int";
import { loadPow10, MAX_EXACT_MANTISSA, MAX_EXACT_POW10 } from "../float";
import { isSpace } from "../../../util";
import {
  eiselLemire22,
  eiselLemireMinus14,
  eiselLemireMinus14_54Bit,
} from "../../../util/eisel-lemire";
import { markProductionParseError } from "../../error";

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

// Cold companion to the 14-digit GeoJSON hot path. Keeping the less common
// fixed widths out of `parseFloatElementSWAR` preserves its compact branch
// layout while avoiding the generic digit loops for the remaining coordinate
// shapes seen in real GeoJSON payloads.
function parseGeoAlternateFixed<E>(
  p: usize,
  srcEnd: usize,
  slot: usize,
  negative: bool,
  firstDigit: u32,
): usize {
  if (p + 20 >= srcEnd) return 0;
  let intDigits = 0;
  if (load<u16>(p, 4) == 46) {
    intDigits = 2;
  } else if (load<u16>(p, 6) == 46) {
    intDigits = 3;
  } else {
    return 0;
  }

  const frac = p + <usize>((intDigits + 1) << 1);
  let fracDigits = 0;
  let term = frac + 12;
  let termCode = load<u16>(term);
  if (termCode == COMMA || termCode == BRACKET_RIGHT || isSpace(termCode)) {
    fracDigits = 6;
  } else {
    term = frac + 30;
    if (term >= srcEnd) return 0;
    termCode = load<u16>(term);
    if (termCode == COMMA || termCode == BRACKET_RIGHT || isSpace(termCode)) {
      fracDigits = 15;
    } else {
      term = frac + 26;
      termCode = load<u16>(term);
      if (termCode == COMMA || termCode == BRACKET_RIGHT || isSpace(termCode)) {
        fracDigits = 13;
      } else {
        return 0;
      }
    }
  }

  const d1 = <u32>load<u16>(p, 2) - 48;
  const d2 = intDigits == 3 ? <u32>load<u16>(p, 4) - 48 : <u32>0;
  if (d1 > 9 || d2 > 9) return 0;
  const whole =
    intDigits == 2
      ? <u64>(firstDigit * 10 + d1)
      : <u64>(firstDigit * 100 + d1 * 10 + d2);

  let mantissa: u64;
  if (fracDigits == 6) {
    const a = parse4Digits_PairMul(load<u64>(frac));
    const d4 = <u32>load<u16>(frac, 8) - 48;
    const d5 = <u32>load<u16>(frac, 10) - 48;
    if (a == U32.MAX_VALUE || d4 > 9 || d5 > 9) return 0;
    mantissa = whole * 1_000_000 + <u64>a * 100 + <u64>(d4 * 10 + d5);
  } else {
    const a = parse8Digits_PairMul(load<u64>(frac), load<u64>(frac, 8));
    const c = parse4Digits_PairMul(load<u64>(frac, 16));
    const d12 = <u32>load<u16>(frac, 24) - 48;
    if (a == U32.MAX_VALUE || c == U32.MAX_VALUE || d12 > 9) return 0;
    if (fracDigits == 13) {
      mantissa =
        whole * 10_000_000_000_000 + <u64>a * 100_000 + <u64>c * 10 + <u64>d12;
    } else {
      const d13 = <u32>load<u16>(frac, 26) - 48;
      const d14 = <u32>load<u16>(frac, 28) - 48;
      if (d13 > 9 || d14 > 9) return 0;
      mantissa =
        whole * 1_000_000_000_000_000 +
        <u64>a * 10_000_000 +
        <u64>c * 1_000 +
        <u64>(d12 * 100 + d13 * 10 + d14);
    }
  }

  let result: f64;
  if (fracDigits == 6) {
    result = <f64>mantissa / loadPow10(6);
  } else if (fracDigits == 15) {
    result = eiselLemire22(mantissa, -15);
  } else {
    result =
      mantissa <= MAX_EXACT_MANTISSA
        ? <f64>mantissa / loadPow10(13)
        : eiselLemire22(mantissa, -13);
  }
  if (negative) result = -result;
  if (sizeof<E>() == sizeof<f32>()) {
    store<f32>(slot, <f32>result);
  } else {
    store<f64>(slot, result);
  }
  return term;
}

function parseFixed14Pair<E>(
  srcStart: usize,
  srcEnd: usize,
  dataStart: usize,
): usize {
  let p0 = srcStart;
  let negative0 = false;
  if (load<u16>(p0) == 45) {
    negative0 = true;
    p0 += 2;
  }
  if (p0 + 36 >= srcEnd) return 0;
  const first0 = <u32>load<u16>(p0) - 48;
  if (first0 > 9) return 0;
  let intDigits0 = 0;
  if (load<u16>(p0, 4) == 46) {
    intDigits0 = 2;
  } else if (load<u16>(p0, 6) == 46) {
    intDigits0 = 3;
  } else {
    return 0;
  }
  const frac0 = p0 + <usize>((intDigits0 + 1) << 1);
  const term0 = frac0 + 28;
  if (load<u16>(term0) != COMMA) return 0;

  let p1 = term0 + 2;
  if (load<u16>(p1) == 32) p1 += 2;
  let negative1 = false;
  if (load<u16>(p1) == 45) {
    negative1 = true;
    p1 += 2;
  }
  if (p1 + 36 >= srcEnd) return 0;
  const first1 = <u32>load<u16>(p1) - 48;
  if (first1 > 9) return 0;
  let intDigits1 = 0;
  if (load<u16>(p1, 4) == 46) {
    intDigits1 = 2;
  } else if (load<u16>(p1, 6) == 46) {
    intDigits1 = 3;
  } else {
    return 0;
  }
  const frac1 = p1 + <usize>((intDigits1 + 1) << 1);
  const term1 = frac1 + 28;
  if (load<u16>(term1) != BRACKET_RIGHT) return 0;

  const a0 = parse8Digits_PairMul(load<u64>(frac0), load<u64>(frac0, 8));
  const c0 = parse4Digits_PairMul(load<u64>(frac0, 16));
  const d012 = <u32>load<u16>(frac0, 24) - 48;
  const d013 = <u32>load<u16>(frac0, 26) - 48;
  const d01 = <u32>load<u16>(p0, 2) - 48;
  const d02 = intDigits0 == 3 ? <u32>load<u16>(p0, 4) - 48 : <u32>0;
  if (
    a0 == U32.MAX_VALUE ||
    c0 == U32.MAX_VALUE ||
    d012 > 9 ||
    d013 > 9 ||
    d01 > 9 ||
    d02 > 9
  )
    return 0;

  const a1 = parse8Digits_PairMul(load<u64>(frac1), load<u64>(frac1, 8));
  const c1 = parse4Digits_PairMul(load<u64>(frac1, 16));
  const d112 = <u32>load<u16>(frac1, 24) - 48;
  const d113 = <u32>load<u16>(frac1, 26) - 48;
  const d11 = <u32>load<u16>(p1, 2) - 48;
  const d12 = intDigits1 == 3 ? <u32>load<u16>(p1, 4) - 48 : <u32>0;
  if (
    a1 == U32.MAX_VALUE ||
    c1 == U32.MAX_VALUE ||
    d112 > 9 ||
    d113 > 9 ||
    d11 > 9 ||
    d12 > 9
  )
    return 0;

  const whole0 =
    intDigits0 == 2
      ? <u64>(first0 * 10 + d01)
      : <u64>(first0 * 100 + d01 * 10 + d02);
  const whole1 =
    intDigits1 == 2
      ? <u64>(first1 * 10 + d11)
      : <u64>(first1 * 100 + d11 * 10 + d12);
  const mantissa0 =
    whole0 * 100_000_000_000_000 +
    <u64>a0 * 1_000_000 +
    <u64>c0 * 100 +
    <u64>(d012 * 10 + d013);
  const mantissa1 =
    whole1 * 100_000_000_000_000 +
    <u64>a1 * 1_000_000 +
    <u64>c1 * 100 +
    <u64>(d112 * 10 + d113);

  let value0 =
    mantissa0 <= MAX_EXACT_MANTISSA
      ? <f64>mantissa0 / loadPow10(14)
      : mantissa0 < (<u64>1) << 54
        ? eiselLemireMinus14_54Bit(mantissa0)
        : eiselLemireMinus14(mantissa0);
  let value1 =
    mantissa1 <= MAX_EXACT_MANTISSA
      ? <f64>mantissa1 / loadPow10(14)
      : mantissa1 < (<u64>1) << 54
        ? eiselLemireMinus14_54Bit(mantissa1)
        : eiselLemireMinus14(mantissa1);
  if (negative0) value0 = -value0;
  if (negative1) value1 = -value1;
  if (sizeof<E>() == sizeof<f32>()) {
    store<f32>(dataStart, <f32>value0);
    store<f32>(dataStart + sizeof<E>(), <f32>value1);
  } else {
    store<f64>(dataStart, value0);
    store<f64>(dataStart + sizeof<E>(), value1);
  }
  return term1 + 2;
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

  // GeoJSON coordinates overwhelmingly use one of these two fixed layouts:
  // `DD.ffffffffffffff` or `DDD.ffffffffffffff`. Recognize them before the
  // generic scan so the common case avoids four loop exits (including the
  // guaranteed failing parse4 probe at the fraction terminator). Each parse4
  // still validates its lanes; malformed or exponent-bearing values fall
  // through unchanged to the fully general parser below.
  if (ASC_FEATURE_SIMD && p + 36 < srcEnd) {
    let intDigitsFast = 0;
    if (load<u16>(p, 4) == 46) {
      intDigitsFast = 2;
    } else if (load<u16>(p, 6) == 46) {
      intDigitsFast = 3;
    }
    if (intDigitsFast != 0) {
      const frac = p + <usize>((intDigitsFast + 1) << 1);
      const term = frac + 28;
      const termCode = load<u16>(term);
      if (termCode == COMMA || termCode == BRACKET_RIGHT || isSpace(termCode)) {
        const a = parse8Digits_PairMul(load<u64>(frac), load<u64>(frac, 8));
        const c = parse4Digits_PairMul(load<u64>(frac, 16));
        const d12 = <u32>load<u16>(frac, 24) - 48;
        const d13 = <u32>load<u16>(frac, 26) - 48;
        const d1 = <u32>load<u16>(p, 2) - 48;
        const d2 = intDigitsFast == 3 ? <u32>load<u16>(p, 4) - 48 : <u32>0;
        if (
          a != U32.MAX_VALUE &&
          c != U32.MAX_VALUE &&
          d1 <= 9 &&
          d2 <= 9 &&
          d12 <= 9 &&
          d13 <= 9
        ) {
          const whole =
            intDigitsFast == 2
              ? <u64>(firstDigit * 10 + d1)
              : <u64>(firstDigit * 100 + d1 * 10 + d2);
          const mantissa =
            whole * 100_000_000_000_000 +
            <u64>a * 1_000_000 +
            <u64>c * 100 +
            <u64>(d12 * 10 + d13);
          let result =
            mantissa <= MAX_EXACT_MANTISSA
              ? <f64>mantissa / loadPow10(14)
              : mantissa < (<u64>1) << 54
                ? eiselLemireMinus14_54Bit(mantissa)
                : eiselLemireMinus14(mantissa);
          if (negative) result = -result;
          if (sizeof<E>() == sizeof<f32>()) {
            store<f32>(slot, <f32>result);
          } else {
            store<f64>(slot, result);
          }
          return term;
        }
      }
    }
  }

  if (ASC_FEATURE_SIMD) {
    const alternateEnd = parseGeoAlternateFixed<E>(
      p,
      srcEnd,
      slot,
      negative,
      firstDigit,
    );
    if (alternateEnd) return alternateEnd;
  }

  return parseFloatElementGeneric<E>(origStart, srcEnd, slot);
}

function parseFloatElementGeneric<E>(
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
  const firstDigit = <u32>code - 48;
  if (firstDigit > 9) return 0;

  // Integer mantissa: scalar (most JSON integers are 1-3 digits).
  let mantissa: u64 = 0;
  const intStart = p;
  while (p < srcEnd) {
    const d = <u32>load<u16>(p) - 48;
    if (d > 9) break;
    mantissa = mantissa * 10 + <u64>d;
    p += 2;
  }
  const intDigits = <i32>((p - intStart) >> 1);

  // Fractional mantissa: parse4 SWAR stride + scalar tail. Same u64
  // accumulator as the integer part - exponent compensates for fracDigits.
  let fracStart = p;
  if (p < srcEnd && load<u16>(p) == 46) {
    p += 2;
    fracStart = p;
    while (p + 6 < srcEnd) {
      const parsed = parse4Digits_PairMul(load<u64>(p));
      if (parsed == U32.MAX_VALUE) break;
      mantissa = mantissa * 10_000 + <u64>parsed;
      p += 8;
    }
    while (p < srcEnd) {
      const d = <u32>load<u16>(p) - 48;
      if (d > 9) break;
      mantissa = mantissa * 10 + <u64>d;
      p += 2;
    }
  }
  const fracDigits = <i32>((p - fracStart) >> 1);

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
    // Eisel-Lemire handles the overwhelmingly common medium exponent range
    // without the u64 division/modulo in `scientific`'s scaledown path.
    result =
      exponent >= -22 && exponent <= 22
        ? eiselLemire22(mantissa, exponent)
        : scientific(mantissa, exponent);
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
@inline
export function deserializeFloatArrayBody<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
): usize {
  let index = 0;
  const reusableLength = load<i32>(
    changetype<usize>(out),
    offsetof<T>("length_"),
  );
  const reusableDataStart = out.dataStart;
  const elementSize = sizeof<valueof<T>>();

  do {
    if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
    srcStart += 2;
    srcStart = skipFloatArrayWhitespace(srcStart, srcEnd);
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      out.length = 0;
      return srcStart + 2;
    }

    // GeoJSON's innermost coordinate arrays are overwhelmingly reused
    // `[longitude,latitude]` pairs. Unroll that stable-shape case so neither
    // element pays the generic index/capacity selection or loop backedge. A
    // mismatch restores the first-value cursor and falls through unchanged.
    if (ASC_FEATURE_SIMD && reusableLength == 2) {
      const firstStart = srcStart;
      const pairEnd = parseFixed14Pair<valueof<T>>(
        srcStart,
        srcEnd,
        reusableDataStart,
      );
      if (pairEnd) return pairEnd;
      let next = parseFloatElementSWAR<valueof<T>>(
        srcStart,
        srcEnd,
        reusableDataStart,
      );
      if (next) {
        srcStart = next;
        if (srcStart < srcEnd && load<u16>(srcStart) != COMMA)
          srcStart = skipFloatArrayWhitespace(srcStart, srcEnd);
        if (srcStart < srcEnd && load<u16>(srcStart) == COMMA) {
          srcStart += 2;
          if (srcStart < srcEnd && load<u16>(srcStart) == 32) {
            srcStart += 2;
          } else {
            srcStart = skipFloatArrayWhitespace(srcStart, srcEnd);
          }
          next = parseFloatElementSWAR<valueof<T>>(
            srcStart,
            srcEnd,
            reusableDataStart + elementSize,
          );
          if (next) {
            srcStart = next;
            if (srcStart < srcEnd && load<u16>(srcStart) != BRACKET_RIGHT)
              srcStart = skipFloatArrayWhitespace(srcStart, srcEnd);
            if (srcStart < srcEnd && load<u16>(srcStart) == BRACKET_RIGHT)
              return srcStart + 2;
          }
        }
      }
      srcStart = firstStart;
    }

    while (srcStart < srcEnd) {
      const slot =
        index < reusableLength
          ? reusableDataStart + <usize>index * elementSize
          : ensureArrayElementSlot<T>(out, index);
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
        if (reusableLength != nextLen) out.length = nextLen;
        return srcStart + 2;
      }
      break;
    }
  } while (false);

  markProductionParseError();
  return 0;
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
