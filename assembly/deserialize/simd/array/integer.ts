import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { deserializeIntegerArray_SLOW } from "../../swar/array/integer";

const ASCII_LANE_MASK_4: u64 = 0x00ff00ff00ff00ff;
const ASCII_ZERO_4: u64 = 0x0030003000300030;

@lazy const SPLAT_30 = i16x8.splat(0x30);
@lazy const SPLAT_09 = i16x8.splat(9);
@lazy const ZERO_I16X8 = i16x8.splat(0);
@lazy const ZERO_I32X4 = i32x4.splat(0);
@lazy const PACK_WEIGHTS_10_1 = i8x16(10, 1, 10, 1, 10, 1, 10, 1, 0, 0, 0, 0, 0, 0, 0, 0);
@lazy const PAIR_WEIGHTS_100_1 = i16x8(100, 1, 100, 1, 0, 0, 0, 0);


@inline function pushSignedInteger<T extends number[]>(out: T, value: i64): void {
  if (sizeof<valueof<T>>() == sizeof<i8>()) {
    out.push(<valueof<T>>(<i8>value));
  } else if (sizeof<valueof<T>>() == sizeof<i16>()) {
    out.push(<valueof<T>>(<i16>value));
  } else if (sizeof<valueof<T>>() == sizeof<i32>()) {
    out.push(<valueof<T>>(<i32>value));
  } else if (sizeof<valueof<T>>() == sizeof<isize>()) {
    out.push(<valueof<T>>(<isize>value));
  } else {
    out.push(<valueof<T>>value);
  }
}


@inline function pushUnsignedInteger<T extends number[]>(out: T, value: u64): void {
  if (sizeof<valueof<T>>() == sizeof<u8>()) {
    out.push(<valueof<T>>(<u8>value));
  } else if (sizeof<valueof<T>>() == sizeof<u16>()) {
    out.push(<valueof<T>>(<u16>value));
  } else if (sizeof<valueof<T>>() == sizeof<u32>()) {
    out.push(<valueof<T>>(<u32>value));
  } else if (sizeof<valueof<T>>() == sizeof<usize>()) {
    out.push(<valueof<T>>(<usize>value));
  } else {
    out.push(<valueof<T>>value);
  }
}

@inline function storeSignedInteger<T extends number[]>(slot: usize, value: i64): void {
  if (sizeof<valueof<T>>() == sizeof<i8>()) {
    store<i8>(slot, <i8>value);
  } else if (sizeof<valueof<T>>() == sizeof<i16>()) {
    store<i16>(slot, <i16>value);
  } else if (sizeof<valueof<T>>() == sizeof<i32>()) {
    store<i32>(slot, <i32>value);
  } else if (sizeof<valueof<T>>() == sizeof<isize>()) {
    store<isize>(slot, <isize>value);
  } else {
    store<i64>(slot, value);
  }
}

@inline function storeUnsignedInteger<T extends number[]>(slot: usize, value: u64): void {
  if (sizeof<valueof<T>>() == sizeof<u8>()) {
    store<u8>(slot, <u8>value);
  } else if (sizeof<valueof<T>>() == sizeof<u16>()) {
    store<u16>(slot, <u16>value);
  } else if (sizeof<valueof<T>>() == sizeof<u32>()) {
    store<u32>(slot, <u32>value);
  } else if (sizeof<valueof<T>>() == sizeof<usize>()) {
    store<usize>(slot, <usize>value);
  } else {
    store<u64>(slot, value);
  }
}


@inline function tryParseEightDigitsSIMD(srcStart: usize, value: u64): u64 {
  const block = load<v128>(srcStart);
  const digits = i16x8.sub(block, SPLAT_30);
  if (v128.any_true(i16x8.gt_u(digits, SPLAT_09))) return 0;

  const packed = i8x16.narrow_i16x8_u(digits, ZERO_I16X8);
  const products = i16x8.extmul_low_i8x16_u(packed, PACK_WEIGHTS_10_1);
  const pairs = i32x4.extadd_pairwise_i16x8_u(products);
  const pairs16 = i16x8.narrow_i32x4_u(pairs, ZERO_I32X4);
  const groups = i32x4.dot_i16x8_s(pairs16, PAIR_WEIGHTS_100_1);

  const lo = i32x4.extract_lane(groups, 0);
  const hi = i32x4.extract_lane(groups, 1);
  return value * 100000000 + (<u64>lo * 10000 + <u64>hi);
}


@inline function parseSignedIntegerSIMD<T extends number[]>(srcStart: usize, srcEnd: usize, out: T): usize {
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

  let value: u64 = digit;
  srcStart += 2;

  while (srcStart + 14 < srcEnd) {
    const next = tryParseEightDigitsSIMD(srcStart, value);
    if (!next) break;
    value = next;
    srcStart += 16;
  }

  while (srcStart < srcEnd) {
    digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }

  pushSignedInteger<T>(out, negative ? -(<i64>value) : <i64>value);
  return srcStart;
}


@inline function parseUnsignedIntegerSIMD<T extends number[]>(srcStart: usize, srcEnd: usize, out: T): usize {
  let digit = <u32>load<u16>(srcStart) - 48;
  if (digit > 9) return 0;

  let value: u64 = digit;
  srcStart += 2;

  while (srcStart + 14 < srcEnd) {
    const next = tryParseEightDigitsSIMD(srcStart, value);
    if (!next) break;
    value = next;
    srcStart += 16;
  }

  while (srcStart < srcEnd) {
    digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }

  pushUnsignedInteger<T>(out, value);
  return srcStart;
}

// @ts-ignore: Decorator valid here
export function deserializeIntegerArray_SIMD<T extends number[]>(srcStart: usize, srcEnd: usize, dst: usize): T {
  const out = changetype<nonnull<T>>(dst || changetype<usize>(instantiate<T>()));
  const originalSrcStart = srcStart;
  const reusableLength = out.length;

  if (reusableLength != 0) {
    const dataStart = out.dataStart;
    let index = 0;

    do {
      if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
      srcStart += 2;
      if (srcStart >= srcEnd) break;
      if (load<u16>(srcStart) == BRACKET_RIGHT) {
        out.length = 0;
        return out;
      }

      if (isSigned<valueof<T>>()) {
        while (srcStart < srcEnd) {
          let negative = false;
          let code = load<u16>(srcStart);
          if (code == 45) {
            negative = true;
            srcStart += 2;
            if (srcStart >= srcEnd) break;
            code = load<u16>(srcStart);
          }

          let digit = <u32>code - 48;
          if (digit > 9) break;

          let value: u64 = digit;
          srcStart += 2;
          while (srcStart + 14 < srcEnd) {
            const next = tryParseEightDigitsSIMD(srcStart, value);
            if (!next) break;
            value = next;
            srcStart += 16;
          }
          while (srcStart < srcEnd) {
            digit = <u32>load<u16>(srcStart) - 48;
            if (digit > 9) break;
            value = value * 10 + digit;
            srcStart += 2;
          }

          if (index >= reusableLength) break;
          storeSignedInteger<T>(dataStart + ((<usize>index) << alignof<valueof<T>>()), negative ? -(<i64>value) : <i64>value);
          index++;
          if (srcStart >= srcEnd) break;

          code = load<u16>(srcStart);
          if (code == COMMA) {
            srcStart += 2;
            continue;
          }
          if (code == BRACKET_RIGHT) {
            out.length = index;
            return out;
          }
          break;
        }
      } else {
        while (srcStart < srcEnd) {
          let digit = <u32>load<u16>(srcStart) - 48;
          if (digit > 9) break;

          let value: u64 = digit;
          srcStart += 2;
          while (srcStart + 14 < srcEnd) {
            const next = tryParseEightDigitsSIMD(srcStart, value);
            if (!next) break;
            value = next;
            srcStart += 16;
          }
          while (srcStart < srcEnd) {
            digit = <u32>load<u16>(srcStart) - 48;
            if (digit > 9) break;
            value = value * 10 + digit;
            srcStart += 2;
          }

          if (index >= reusableLength) break;
          storeUnsignedInteger<T>(dataStart + ((<usize>index) << alignof<valueof<T>>()), value);
          index++;
          if (srcStart >= srcEnd) break;

          const code = load<u16>(srcStart);
          if (code == COMMA) {
            srcStart += 2;
            continue;
          }
          if (code == BRACKET_RIGHT) {
            out.length = index;
            return out;
          }
          break;
        }
      }
    } while (false);

    srcStart = originalSrcStart;
  }

  out.length = 0;

  do {
    if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
    srcStart += 2;
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) return out;

    if (isSigned<valueof<T>>()) {
      while (srcStart < srcEnd) {
        srcStart = parseSignedIntegerSIMD<T>(srcStart, srcEnd, out);
        if (!srcStart || srcStart >= srcEnd) break;

        const code = load<u16>(srcStart);
        if (code == COMMA) {
          srcStart += 2;
          continue;
        }
        if (code == BRACKET_RIGHT) return out;
        break;
      }
    } else {
      while (srcStart < srcEnd) {
        srcStart = parseUnsignedIntegerSIMD<T>(srcStart, srcEnd, out);
        if (!srcStart || srcStart >= srcEnd) break;

        const code = load<u16>(srcStart);
        if (code == COMMA) {
          srcStart += 2;
          continue;
        }
        if (code == BRACKET_RIGHT) return out;
        break;
      }
    }
  } while (false);

  return deserializeIntegerArray_SLOW<T>(originalSrcStart, srcEnd, changetype<usize>(out));
}
