import { deserializeFloatField } from "../../simple/float";
import { deserializeFloatArray as deserializeFloatArray_NAIVE } from "../../simple/array/float";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { ensureArrayElementSlot, ensureArrayField } from "./shared";
import { parse4Digits_PairMul } from "../../../util/swar-int";

// @ts-ignore: inline
@inline function pow10Fast(exponent: u32): f64 {
  if (exponent == 0) return 1.0;
  if (exponent == 1) return 10.0;
  if (exponent == 2) return 100.0;
  if (exponent == 3) return 1e3;
  if (exponent == 4) return 1e4;
  if (exponent == 5) return 1e5;
  if (exponent == 6) return 1e6;
  if (exponent == 7) return 1e7;
  if (exponent == 8) return 1e8;
  if (exponent == 9) return 1e9;
  if (exponent == 10) return 1e10;
  if (exponent == 11) return 1e11;
  if (exponent == 12) return 1e12;
  if (exponent == 13) return 1e13;
  if (exponent == 14) return 1e14;
  if (exponent == 15) return 1e15;
  if (exponent == 16) return 1e16;
  if (exponent == 17) return 1e17;
  if (exponent == 18) return 1e18;
  let result = 1.0;
  if (exponent & 1) result *= 1e1;
  if (exponent & 2) result *= 1e2;
  if (exponent & 4) result *= 1e4;
  if (exponent & 8) result *= 1e8;
  if (exponent & 16) result *= 1e16;
  if (exponent & 32) result *= 1e32;
  if (exponent & 64) result *= 1e64;
  if (exponent & 128) result *= 1e128;
  if (exponent & 256) result *= 1e256;
  return result;
}

/**
 * Inline single-pass float element parser.
 *
 * Returns the advanced `srcStart` on success, or `0` to signal "bail to the
 * NAIVE path" (no digits, malformed exponent, or fractional-fold overflow).
 *
 * Semantics mirror `deserializeFloat` from `simple/float.ts` exactly:
 *   - integer part accumulated in `f64` via mul-add (no semantic change)
 *   - fractional part accumulated in a `u64` then `value += frac / 10^k`
 *   - exponent applied as one final mul or div
 *
 * The wins over `deserializeFloat`:
 *   - single pass over the digits (no preliminary "scan to terminator"
 *     loop like `deserializeFloatArray` had)
 *   - direct `store<f32|f64>` to the array slot, no return-by-value
 *   - SWAR 4-digit fold on the fractional `u64` accumulator, which is
 *     where wide payloads (e.g. `3.141592653589793`) spend their cycles
 *
 * Bail (`return 0`) on:
 *   - first character is not a digit / `-`
 *   - `e` / `E` not followed by a digit after the optional sign
 *   - more than 18 fractional digits (would overflow the `u64` accumulator)
 */
// @ts-expect-error: decorators valid here
@inline export function parseFloatElementSWAR<E>(
  srcStart: usize,
  srcEnd: usize,
  slot: usize,
): usize {
  let negative = false;
  let code = load<u16>(srcStart);
  if (code == 45) {
    negative = true;
    srcStart += 2;
    if (srcStart >= srcEnd) return 0;
    code = load<u16>(srcStart);
  }

  let digit = <u32>code - 48;
  if (digit > 9) return 0;

  let value: f64 = <f64>digit;
  srcStart += 2;
  while (srcStart < srcEnd) {
    digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10.0 + <f64>digit;
    srcStart += 2;
  }

  if (srcStart < srcEnd && load<u16>(srcStart) == 46) {
    srcStart += 2;
    let fraction: u64 = 0;
    let fracDigits: u32 = 0;

    // SWAR 4-digit fold for the fractional accumulator. Each successful
    // stride feeds 4 ASCII digits into the u64 with a single load + a
    // handful of ALU ops, vs. 4 separate `load<u16>` + branch iterations
    // in the scalar tail below.
    while (srcStart + 6 < srcEnd) {
      const parsed = parse4Digits_PairMul(load<u64>(srcStart));
      if (parsed == U32.MAX_VALUE) break;
      fraction = fraction * 10000 + parsed;
      fracDigits += 4;
      srcStart += 8;
      // u64 caps at ~19 significant digits; bail if we'd risk overflow on
      // the next stride. The NAIVE path falls back to `f64.parse` which
      // handles arbitrarily long fractions.
      if (fracDigits >= 16) return 0;
    }
    while (srcStart < srcEnd) {
      digit = <u32>load<u16>(srcStart) - 48;
      if (digit > 9) break;
      fraction = fraction * 10 + digit;
      fracDigits += 1;
      srcStart += 2;
    }
    if (fracDigits > 18) return 0;
    if (fracDigits != 0) value += <f64>fraction / pow10Fast(fracDigits);
  }

  if (srcStart < srcEnd) {
    code = load<u16>(srcStart);
    if (code == 101 || code == 69) {
      srcStart += 2;
      if (srcStart >= srcEnd) return 0;

      let expNeg = false;
      code = load<u16>(srcStart);
      if (code == 45 || code == 43) {
        expNeg = code == 45;
        srcStart += 2;
        if (srcStart >= srcEnd) return 0;
        code = load<u16>(srcStart);
      }

      let exponent = <u32>code - 48;
      if (exponent > 9) return 0;
      srcStart += 2;
      while (srcStart < srcEnd) {
        digit = <u32>load<u16>(srcStart) - 48;
        if (digit > 9) break;
        exponent = exponent * 10 + digit;
        srcStart += 2;
      }

      const power = pow10Fast(exponent);
      value = expNeg ? value / power : value * power;
    }
  }

  if (negative) value = -value;

  if (sizeof<E>() == sizeof<f32>()) {
    store<f32>(slot, <f32>value);
  } else {
    store<f64>(slot, value);
  }
  return srcStart;
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
 * `JSON.__deserialize` re-parse). If the inline parser bails (no
 * digits, malformed exponent, wide fraction), we hand off to the NAIVE
 * path with the pre-allocated buffer retained so capacity is reused.
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
      srcStart = next;
      if (srcStart >= srcEnd) break;

      const code = load<u16>(srcStart);
      if (code == COMMA) {
        srcStart += 2;
        continue;
      }
      if (code == BRACKET_RIGHT) {
        out.length = i32(<usize>(writePtr - dataStart) / elementSize);
        return out;
      }
      break;
    }
  } while (false);

  // Fast path bailed (whitespace, malformed numbers, or fraction wider than
  // the u64 accumulator). Hand off to the NAIVE path with the same `dst`;
  // it resets `out.length` to 0 and re-parses from the original input,
  // reusing the already-allocated buffer for capacity.
  return deserializeFloatArray_NAIVE<T>(
    originalSrcStart,
    srcEnd,
    changetype<usize>(out),
  );
}

/**
 * Field/into variant — parses `[..]` into the existing `out` array and
 * returns the cursor past the closing `]`.
 *
 * Worst-case pre-sizing (`(srcEnd - srcStart) >> 2`) used by the top-level
 * SWAR entry is unsafe here: nested callers pass the *outer* container's
 * `srcEnd`, so on `f64[][][]` payloads like canada.json each tiny inner
 * `[lon,lat]` would over-allocate megabytes of f64 capacity. Instead we
 * use `ensureArrayElementSlot`'s grow-or-reuse strategy and only swap the
 * per-element `deserializeFloatField` call for the inline SWAR parser,
 * which is where the speedup actually lives (single-pass parse + SWAR
 * 4-digit fold on the fractional accumulator).
 */
@inline export function deserializeFloatArrayInto<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
): usize {
  let index = 0;

  do {
    if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
    srcStart += 2;
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      out.length = 0;
      return srcStart + 2;
    }

    while (srcStart < srcEnd) {
      const slot = ensureArrayElementSlot<T>(out, index);
      let next = parseFloatElementSWAR<valueof<T>>(srcStart, srcEnd, slot);
      if (!next) {
        next = deserializeFloatField<valueof<T>>(srcStart, srcEnd, slot);
      }
      srcStart = next;
      if (!srcStart || srcStart >= srcEnd) break;

      const code = load<u16>(srcStart);
      if (code == COMMA) {
        srcStart += 2;
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


@inline export function deserializeFloatArrayField<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  return deserializeFloatArrayInto<T>(
    srcStart,
    srcEnd,
    ensureArrayField<T>(fieldPtr),
  );
}
