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
