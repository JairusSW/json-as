const DECIMAL_BASE: u64 = 1_000_000_000;

/**
 * Small positive integer used only by the rare long-decimal rounding path.
 * Base 1e9 makes conversion to a decimal string linear in the limb count.
 */
class DecimalBigUInt {
  private limbs: Array<u32> = new Array<u32>();

  static fromU64(value: u64): DecimalBigUInt {
    const result = new DecimalBigUInt();
    do {
      result.limbs.push(<u32>(value % DECIMAL_BASE));
      value /= DECIMAL_BASE;
    } while (value);
    return result;
  }

  add(other: DecimalBigUInt): void {
    const length = max(this.limbs.length, other.limbs.length);
    let carry: u64 = 0;
    for (let i = 0; i < length || carry; i++) {
      if (i == this.limbs.length) this.limbs.push(0);
      let sum = <u64>this.limbs[i] + carry;
      if (i < other.limbs.length) sum += other.limbs[i];
      if (sum >= DECIMAL_BASE) {
        sum -= DECIMAL_BASE;
        carry = 1;
      } else {
        carry = 0;
      }
      this.limbs[i] = <u32>sum;
    }
  }

  multiplySmall(multiplier: u32): void {
    let carry: u64 = 0;
    for (let i = 0; i < this.limbs.length; i++) {
      const product = <u64>this.limbs[i] * multiplier + carry;
      this.limbs[i] = <u32>(product % DECIMAL_BASE);
      carry = product / DECIMAL_BASE;
    }
    if (carry) this.limbs.push(<u32>carry);
  }

  multiplyPowerOfTwo(power: i32): void {
    while (power-- > 0) this.multiplySmall(2);
  }

  multiplyPowerOfFive(power: i32): void {
    while (power-- > 0) this.multiplySmall(5);
  }

  toDecimalString(): string {
    const last = this.limbs.length - 1;
    let top = this.limbs[last];
    let topDigits = 1;
    for (let value = top; value >= 10; value /= 10) topDigits++;
    const length = topDigits + last * 9;
    const result = changetype<string>(__new(length << 1, idof<string>()));
    const out = changetype<usize>(result);
    let offset = length;
    for (let i = 0; i <= last; i++) {
      let value = this.limbs[i];
      const digits = i == last ? topDigits : 9;
      for (let j = 0; j < digits; j++) {
        offset--;
        store<u16>(out + ((<usize>offset) << 1), <u16>(48 + (value % 10)));
        value /= 10;
      }
    }
    return result;
  }
}

function binarySignificand(bits: u64): u64 {
  const exponent = <u32>((bits >> 52) & 0x7ff);
  if (!exponent) return bits & 0x000fffffffffffff;
  // Treat infinity as the virtual next value 2^1024. Its midpoint with the
  // largest finite value is exactly the round-to-infinity threshold.
  if (exponent == 0x7ff) return (<u64>1) << 52;
  return ((<u64>1) << 52) | (bits & 0x000fffffffffffff);
}

function binaryExponent(bits: u64): i32 {
  const exponent = <i32>((bits >> 52) & 0x7ff);
  if (!exponent) return -1074;
  if (exponent == 0x7ff) return 972;
  return exponent - 1023 - 52;
}

/**
 * Choose between adjacent positive binary64 values by comparing the original
 * decimal exactly with their midpoint. Returns a negative, zero, or positive
 * value when the decimal is below, equal to, or above the midpoint.
 */
export function compareDecimalToMidpoint(
  significantStart: usize,
  significantDigits: i32,
  decimalExponent: i32,
  lower: f64,
  upper: f64,
): i32 {
  let lowerBits = reinterpret<u64>(lower);
  let upperBits = reinterpret<u64>(upper);
  if (lowerBits > upperBits) {
    const swap = lowerBits;
    lowerBits = upperBits;
    upperBits = swap;
  }

  const lowerExponent = binaryExponent(lowerBits);
  const upperExponent = binaryExponent(upperBits);
  const commonExponent = min(lowerExponent, upperExponent);

  const midpoint = DecimalBigUInt.fromU64(binarySignificand(lowerBits));
  midpoint.multiplyPowerOfTwo(lowerExponent - commonExponent);
  const upperInteger = DecimalBigUInt.fromU64(binarySignificand(upperBits));
  upperInteger.multiplyPowerOfTwo(upperExponent - commonExponent);
  midpoint.add(upperInteger);

  // The sum above still needs division by two to become the midpoint.
  const midpointBinaryExponent = commonExponent - 1;
  let midpointDecimalExponent = 0;
  if (midpointBinaryExponent >= 0) {
    midpoint.multiplyPowerOfTwo(midpointBinaryExponent);
  } else {
    midpoint.multiplyPowerOfFive(-midpointBinaryExponent);
    midpointDecimalExponent = midpointBinaryExponent;
  }

  const midpointDigits = midpoint.toDecimalString();
  const decimalOrder = <i64>significantDigits + decimalExponent;
  const midpointOrder = <i64>midpointDigits.length + midpointDecimalExponent;
  if (decimalOrder != midpointOrder)
    return decimalOrder < midpointOrder ? -1 : 1;

  const length = max(significantDigits, midpointDigits.length);
  let source = significantStart;
  for (let i = 0; i < length; i++) {
    let decimalDigit: u16 = 0;
    if (i < significantDigits) {
      while (load<u16>(source) == 46) source += 2;
      decimalDigit = load<u16>(source) - 48;
      source += 2;
    }
    const midpointDigit = <u16>(
      (i < midpointDigits.length ? midpointDigits.charCodeAt(i) - 48 : 0)
    );
    if (decimalDigit != midpointDigit)
      return decimalDigit < midpointDigit ? -1 : 1;
  }
  return 0;
}
