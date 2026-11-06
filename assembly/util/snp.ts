import { POW_TEN_TABLE_32, POW_TEN_TABLE_64 } from "../globals/tables";
import { parseDecimalF32, parseDecimalF64 } from "./parseDecimal";
import { markProductionParseError } from "../deserialize/error";

/** Parses a decimal float or an integer with an optional decimal exponent. */
export function snp<T extends number>(srcStart: usize, srcEnd: usize): T {
  if (isFloat<T>()) {
    return sizeof<T>() == 4
      ? <T>parseDecimalF32(srcStart, srcEnd)
      : <T>parseDecimalF64(srcStart, srcEnd);
  }
  let negative = false;
  if (srcStart < srcEnd && load<u16>(srcStart) == 45) {
    negative = true;
    srcStart += 2;
  }
  const digitStart = srcStart;
  let value: u64 = 0;
  while (srcStart < srcEnd) {
    const digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }
  if (srcStart == digitStart) {
    markProductionParseError();
    return <T>0;
  }
  if (srcStart < srcEnd && (load<u16>(srcStart) == 101 || load<u16>(srcStart) == 69)) {
    srcStart += 2;
    let divide = false;
    if (srcStart < srcEnd && (load<u16>(srcStart) == 45 || load<u16>(srcStart) == 43)) {
      divide = load<u16>(srcStart) == 45;
      srcStart += 2;
    }
    const exponentStart = srcStart;
    let exponent: u32 = 0;
    while (srcStart < srcEnd) {
      const digit = <u32>load<u16>(srcStart) - 48;
      if (digit > 9) break;
      // Beyond 64, every positive power is zero modulo 2^64; every
      // negative power truncates this integer to zero. Saturate safely.
      exponent = min<u32>(64, exponent * 10 + digit);
      srcStart += 2;
    }
    if (srcStart == exponentStart) {
      markProductionParseError();
      return <T>0;
    }
    if (divide) value = exponent >= 20 ? 0 : value / pow10(exponent);
    else value *= pow10(exponent);
  }
  if (srcStart != srcEnd) {
    markProductionParseError();
    return <T>0;
  }
  return negative ? <T>(0 - value) : <T>value;
}

function pow10(exponent: u32): u64 {
  if (exponent < 10) return load<u32>(POW_TEN_TABLE_32 + (<usize>exponent << 2));
  if (exponent < 20) return load<u64>(POW_TEN_TABLE_64 + (<usize>exponent << 3));
  if (exponent >= 64) return 0;
  let result: u64 = 1;
  let base: u64 = 10;
  while (exponent != 0) {
    if (exponent & 1) result *= base;
    exponent >>= 1;
    base *= base;
  }
  return result;
}
