import { isSpace } from "./isSpace";
import { ptrToStr } from "./ptrToStr";
import { scientific } from "./scientific";
import { compareDecimalToMidpoint } from "./decimal-midpoint";

/**
 * Parse a validated decimal token to binary64. Longer inputs use a 19-digit
 * Eisel-Lemire interval and resolve its rare ambiguous case with an exact
 * decimal-to-binary midpoint comparison.
 */
export function parseDecimalF64(srcStart: usize, srcEnd: usize): f64 {
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;

  const tokenStart = srcStart;
  let negative = false;
  if (srcStart < srcEnd && load<u16>(srcStart) == 45) {
    negative = true;
    srcStart += 2;
  }
  if (srcStart >= srcEnd) return f64.parse(ptrToStr(tokenStart, srcEnd));

  // Preserve the library's default NaN / Infinity extension.
  if (<u32>(load<u16>(srcStart) - 48) > 9)
    return f64.parse(ptrToStr(tokenStart, srcEnd));

  let mantissa: u64 = 0;
  let keptDigits = 0;
  let droppedDigits = 0;
  let fractionDigits = 0;
  let significant = false;
  let significantStart: usize = 0;
  let fraction = false;
  let ptr = srcStart;

  while (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (code == 46 && !fraction) {
      fraction = true;
      ptr += 2;
      continue;
    }
    const digit = <u32>(code - 48);
    if (digit > 9) break;
    if (fraction) fractionDigits++;
    if (significant || digit != 0) {
      if (!significant) significantStart = ptr;
      significant = true;
      if (keptDigits < 19) {
        mantissa = mantissa * 10 + digit;
        keptDigits++;
      } else {
        droppedDigits++;
      }
    }
    ptr += 2;
  }

  let explicitExponent = 0;
  if (ptr < srcEnd && (load<u16>(ptr) == 101 || load<u16>(ptr) == 69)) {
    ptr += 2;
    let exponentNegative = false;
    if (ptr < srcEnd) {
      const sign = load<u16>(ptr);
      if (sign == 45 || sign == 43) {
        exponentNegative = sign == 45;
        ptr += 2;
      }
    }
    while (ptr < srcEnd) {
      const digit = <u32>(load<u16>(ptr) - 48);
      if (digit > 9) break;
      explicitExponent = min(10_000, explicitExponent * 10 + <i32>digit);
      ptr += 2;
    }
    if (exponentNegative) explicitExponent = -explicitExponent;
  }

  if (!significant) return negative ? -0.0 : 0.0;
  const decimalExponent = explicitExponent - fractionDigits;
  const exponent = decimalExponent + droppedDigits;
  let value: f64;
  if (droppedDigits) {
    const lower = scientific(mantissa, exponent);
    const upper = scientific(mantissa + 1, exponent);
    const lowerBits = reinterpret<u64>(lower);
    const upperBits = reinterpret<u64>(upper);
    if (lowerBits == upperBits) {
      value = lower;
    } else {
      const comparison = compareDecimalToMidpoint(
        significantStart,
        keptDigits + droppedDigits,
        decimalExponent,
        lower,
        upper,
      );
      if (comparison < 0) {
        value = lower;
      } else if (comparison > 0) {
        value = upper;
      } else {
        value = (lowerBits & 1) == 0 ? lower : upper;
      }
    }
  } else {
    value = scientific(mantissa, exponent);
  }
  if (negative) value = -value;
  return value;
}

/** Narrow only after resolving the rare binary64 result exactly on an f32
 * midpoint. Decimal digits distinguish either side even when f64 cannot. */
export function roundDecimalF32(start: usize, end: usize, value: f64): f32 {
  const negative = value < 0 || reinterpret<u64>(value) >> 63 != 0;
  const magnitude = abs(value);
  const rounded = <f32>magnitude;
  if (!isFinite(magnitude) || <f64>rounded == magnitude) return <f32>value;
  const bits = reinterpret<u32>(rounded);
  let low: u32;
  let high: u32;
  if (<f64>rounded > magnitude) {
    low = bits - 1;
    high = bits;
  } else {
    low = bits;
    high = bits + 1;
  }
  const lower = <f64>reinterpret<f32>(low);
  const upper =
    high == 0x7f800000
      ? 340282366920938463463374607431768211456.0
      : <f64>reinterpret<f32>(high);
  if (magnitude != (lower + upper) * 0.5) return <f32>value;

  while (start < end && isSpace(load<u16>(start))) start += 2;
  if (load<u16>(start) == 45) start += 2;
  let significantStart: usize = 0;
  let digits = 0;
  let fractionDigits = 0;
  let fraction = false;
  let p = start;
  while (p < end) {
    const c = load<u16>(p);
    if (c == 46) {
      fraction = true;
      p += 2;
      continue;
    }
    if (<u32>(c - 48) > 9) break;
    if (fraction) fractionDigits++;
    if (significantStart || c != 48) {
      if (!significantStart) significantStart = p;
      digits++;
    }
    p += 2;
  }
  let exponent = 0;
  if (p < end && (load<u16>(p) == 101 || load<u16>(p) == 69)) {
    p += 2;
    let minus = false;
    if (p < end && (load<u16>(p) == 43 || load<u16>(p) == 45)) {
      minus = load<u16>(p) == 45;
      p += 2;
    }
    while (p < end && <u32>(load<u16>(p) - 48) <= 9) {
      exponent = min(10_000, exponent * 10 + <i32>(load<u16>(p) - 48));
      p += 2;
    }
    if (minus) exponent = -exponent;
  }
  const comparison = compareDecimalToMidpoint(
    significantStart,
    digits,
    exponent - fractionDigits,
    lower,
    upper,
  );
  const result =
    comparison < 0 ? low : comparison > 0 ? high : (low & 1) == 0 ? low : high;
  return reinterpret<f32>(result | (negative ? 0x80000000 : 0));
}

export function parseDecimalF32(start: usize, end: usize): f32 {
  return roundDecimalF32(start, end, parseDecimalF64(start, end));
}
