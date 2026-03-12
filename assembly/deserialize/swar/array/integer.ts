import { deserializeIntegerField } from "../../integer";
import { deserializeUnsignedField } from "../../unsigned";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { isSpace } from "../../../util";
import { ensureArrayElementSlot, ensureArrayField } from "./shared";

const ASCII_LANE_MASK_4: u64 = 0x00ff00ff00ff00ff;
const ASCII_ZERO_4: u64 = 0x0030003000300030;
const ASCII_RANGE_MASK_4: u64 = 0xfff0fff0fff0fff0;
const ASCII_RANGE_ADD_4: u64 = 0x0006000600060006;


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


@inline function parse4DigitsASCII(block: u64): u32 {
  const digits = (block & ASCII_LANE_MASK_4) - ASCII_ZERO_4;
  if (((digits | (digits + ASCII_RANGE_ADD_4)) & ASCII_RANGE_MASK_4) != 0) return U32.MAX_VALUE;

  return <u32>(<u32>(digits & 0xffff) * 1000 + <u32>((digits >> 16) & 0xffff) * 100 + <u32>((digits >> 32) & 0xffff) * 10 + <u32>(digits >> 48));
}


@inline function parseSignedIntegerScalar<T extends number[]>(srcStart: usize, srcEnd: usize, out: T): usize {
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
  while (srcStart < srcEnd) {
    digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }

  pushSignedInteger<T>(out, negative ? -(<i64>value) : <i64>value);
  return srcStart;
}


@inline function parseUnsignedIntegerScalar<T extends number[]>(srcStart: usize, srcEnd: usize, out: T): usize {
  let digit = <u32>load<u16>(srcStart) - 48;
  if (digit > 9) return 0;

  let value: u64 = digit;
  srcStart += 2;
  while (srcStart < srcEnd) {
    digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }

  pushUnsignedInteger<T>(out, value);
  return srcStart;
}


@inline function parseSignedIntegerSWAR<T extends number[]>(srcStart: usize, srcEnd: usize, out: T): usize {
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

  while (srcStart + 6 < srcEnd) {
    const parsed = parse4DigitsASCII(load<u64>(srcStart));
    if (parsed == U32.MAX_VALUE) break;
    value = value * 10000 + parsed;
    srcStart += 8;
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


@inline function parseUnsignedIntegerSWAR<T extends number[]>(srcStart: usize, srcEnd: usize, out: T): usize {
  let digit = <u32>load<u16>(srcStart) - 48;
  if (digit > 9) return 0;

  let value: u64 = digit;
  srcStart += 2;

  while (srcStart + 6 < srcEnd) {
    const parsed = parse4DigitsASCII(load<u64>(srcStart));
    if (parsed == U32.MAX_VALUE) break;
    value = value * 10000 + parsed;
    srcStart += 8;
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

@inline function skipIntegerArrayWhitespace(srcStart: usize, srcEnd: usize): usize {
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) {
    srcStart += 2;
  }
  return srcStart;
}

// @ts-ignore: Decorator valid here
export function deserializeIntegerArray_SLOW<T extends number[]>(srcStart: usize, srcEnd: usize, dst: usize): T {
  const out = changetype<nonnull<T>>(dst || changetype<usize>(instantiate<T>()));
  let index = 0;

  out.length = 0;
  srcStart = skipIntegerArrayWhitespace(srcStart, srcEnd);
  if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) {
    throw new Error("Failed to parse JSON!");
  }

  srcStart += 2;
  while (srcStart < srcEnd) {
    srcStart = skipIntegerArrayWhitespace(srcStart, srcEnd);
    if (srcStart >= srcEnd) break;

    let code = load<u16>(srcStart);
    if (code == BRACKET_RIGHT) return out;

    if (isSigned<valueof<T>>()) {
      let negative = false;
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
      while (srcStart < srcEnd) {
        digit = <u32>load<u16>(srcStart) - 48;
        if (digit > 9) break;
        value = value * 10 + digit;
        srcStart += 2;
      }

      storeSignedInteger<T>(ensureArrayElementSlot<T>(out, index), negative ? -(<i64>value) : <i64>value);
    } else {
      let digit = <u32>code - 48;
      if (digit > 9) break;

      let value: u64 = digit;
      srcStart += 2;
      while (srcStart < srcEnd) {
        digit = <u32>load<u16>(srcStart) - 48;
        if (digit > 9) break;
        value = value * 10 + digit;
        srcStart += 2;
      }

      storeUnsignedInteger<T>(ensureArrayElementSlot<T>(out, index), value);
    }

    index++;
    srcStart = skipIntegerArrayWhitespace(srcStart, srcEnd);
    if (srcStart >= srcEnd) break;

    code = load<u16>(srcStart);
    if (code == COMMA) {
      srcStart += 2;
      continue;
    }
    if (code == BRACKET_RIGHT) return out;
    break;
  }

  throw new Error("Failed to parse JSON!");
}


@inline function deserializeIntegerArrayImpl<T extends number[]>(srcStart: usize, srcEnd: usize, dst: usize, useSWAR: bool): T {
  const out = changetype<nonnull<T>>(dst || changetype<usize>(instantiate<T>()));
  const originalSrcStart = srcStart;
  const reusableLength = out.length;

  if (useSWAR && reusableLength != 0) {
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

          while (srcStart + 6 < srcEnd) {
            const parsed = parse4DigitsASCII(load<u64>(srcStart));
            if (parsed == U32.MAX_VALUE) break;
            value = value * 10000 + parsed;
            srcStart += 8;
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

          while (srcStart + 6 < srcEnd) {
            const parsed = parse4DigitsASCII(load<u64>(srcStart));
            if (parsed == U32.MAX_VALUE) break;
            value = value * 10000 + parsed;
            srcStart += 8;
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
        srcStart = useSWAR ? parseSignedIntegerSWAR<T>(srcStart, srcEnd, out) : parseSignedIntegerScalar<T>(srcStart, srcEnd, out);
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
        srcStart = useSWAR ? parseUnsignedIntegerSWAR<T>(srcStart, srcEnd, out) : parseUnsignedIntegerScalar<T>(srcStart, srcEnd, out);
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

// @ts-ignore: Decorator valid here
export function deserializeIntegerArray<T extends number[]>(srcStart: usize, srcEnd: usize, dst: usize): T {
  return deserializeIntegerArrayImpl<T>(srcStart, srcEnd, dst, false);
}

// @ts-ignore: Decorator valid here
export function deserializeIntegerArray_SWAR<T extends number[]>(srcStart: usize, srcEnd: usize, dst: usize): T {
  return deserializeIntegerArrayImpl<T>(srcStart, srcEnd, dst, true);
}


@inline export function deserializeIntegerArrayField<T extends number[]>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  const out = ensureArrayField<T>(fieldPtr);
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
      srcStart = isSigned<valueof<T>>() ? deserializeIntegerField<valueof<T>>(srcStart, srcEnd, slot) : deserializeUnsignedField<valueof<T>>(srcStart, srcEnd, slot);
      if (!srcStart || srcStart >= srcEnd) break;

      const code = load<u16>(srcStart);
      if (code == COMMA) {
        srcStart += 2;
        index++;
        continue;
      }
      if (code == BRACKET_RIGHT) {
        out.length = index + 1;
        return srcStart + 2;
      }
      break;
    }
  } while (false);

  throw new Error("Failed to parse JSON!");
}
