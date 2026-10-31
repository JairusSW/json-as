import { JSONMode } from "..";
import { bs } from "../../lib/as-bs";
import { parseDecimalF64 } from "../util/parseDecimal";
import { ptrToStr } from "../util/ptrToStr";
import { loadPow10, MAX_EXACT_MANTISSA } from "./swar/float";

// Checked readers consume one value and return the first cursor after it, or
// zero on failure. They never consume a parent separator or trailing space.
export const MAX_CURSOR_DEPTH: i32 = 256;


@inline
export function isCursorWhitespace(code: u16): bool {
  return code == 32 || code == 9 || code == 10 || code == 13;
}


@inline
export function skipCursorWhitespace(ptr: usize, end: usize): usize {
  while (ptr < end && isCursorWhitespace(load<u16>(ptr))) ptr += 2;
  return ptr;
}


@inline
function digit(code: u16): bool {
  return <u32>(code - 48) <= 9;
}


@inline
function hex(code: u16): i32 {
  if (digit(code)) return code - 48;
  const lower = code | 32;
  return lower >= 97 && lower <= 102 ? lower - 87 : -1;
}

// Find a candidate event using full UTF-16 lanes. SWAR masks can have borrow
// false positives, which the scalar event handler verifies before acting.
@inline
function plainStringEnd(ptr: usize, end: usize): usize {
  if (JSON_MODE == JSONMode.SIMD) {
    while (ptr + 16 <= end) {
      const block = v128.load(ptr);
      const special = v128.or(
        v128.or(
          i16x8.eq(block, i16x8.splat(34)),
          i16x8.eq(block, i16x8.splat(92)),
        ),
        i16x8.lt_u(block, i16x8.splat(32)),
      );
      const mask = i8x16.bitmask(special);
      if (mask) return ptr + <usize>ctz(mask);
      ptr += 16;
    }
  } else if (JSON_MODE == JSONMode.SWAR) {
    while (ptr + 8 <= end) {
      const block = load<u64>(ptr);
      const quote = block ^ 0x0022_0022_0022_0022;
      const slash = block ^ 0x005c_005c_005c_005c;
      const control = block & 0xffe0_ffe0_ffe0_ffe0;
      const mask =
        (((quote - 0x0001_0001_0001_0001) & ~quote) |
          ((slash - 0x0001_0001_0001_0001) & ~slash) |
          ((control - 0x0001_0001_0001_0001) & ~control)) &
        0x0080_0080_0080_0080;
      if (mask) return ptr + (usize(ctz(mask)) >> 3);
      ptr += 8;
    }
  }
  while (ptr < end) {
    const code = load<u16>(ptr);
    if (code == 34 || code == 92 || code < 32) break;
    ptr += 2;
  }
  return ptr;
}


@inline
function copyRun(start: usize, end: usize): void {
  const size = end - start;
  if (!size) return;
  bs.ensureSize(<u32>size);
  memory.copy(bs.offset, start, size);
  bs.offset += size;
}

// The discard specialization never touches bs or allocates decoded text. The
// materializing specialization borrows scratch only after the first escape.
@inline
function stringCursor(
  start: usize,
  end: usize,
  dst: usize,
  materialize: bool,
): u64 {
  if (start >= end || load<u16>(start) != 34) return 0;
  const payload = start + 2;
  let ptr = payload;
  let escaped = false;
  let mark: usize = 0;
  while (ptr < end) {
    const run = ptr;
    ptr = plainStringEnd(ptr, end);
    if (materialize && escaped) copyRun(run, ptr);
    if (ptr >= end) break;
    const code = load<u16>(ptr);
    if (code == 34) {
      if (materialize) {
        let value: string;
        if (escaped) {
          value = bs.sliceOut<string>(mark);
        } else {
          const size = ptr - payload;
          value = size ? changetype<string>(__new(size, idof<string>())) : "";
          if (size) memory.copy(changetype<usize>(value), payload, size);
        }
        store<string>(dst, value);
      }
      return ((<u64>(ptr + 2)) << 1) | (escaped ? 1 : 0);
    }
    if (code < 32) break;
    if (code != 92) {
      // A SWAR candidate may be an ordinary non-ASCII code unit.
      if (materialize && escaped) copyRun(ptr, ptr + 2);
      ptr += 2;
      continue;
    }
    if (!escaped) {
      if (materialize) {
        mark = bs.offset - bs.buffer;
        copyRun(payload, ptr);
      }
      escaped = true;
    }
    ptr += 2;
    if (ptr >= end) break;
    const escape = load<u16>(ptr);
    let decoded: u16 = 0;
    if (escape == 117) {
      if (ptr + 10 > end) break;
      const a = hex(load<u16>(ptr, 2));
      const b = hex(load<u16>(ptr, 4));
      const c = hex(load<u16>(ptr, 6));
      const d = hex(load<u16>(ptr, 8));
      if ((a | b | c | d) < 0) break;
      decoded = <u16>((a << 12) | (b << 8) | (c << 4) | d);
      ptr += 10;
    } else {
      if (escape == 34 || escape == 92 || escape == 47) decoded = escape;
      else if (escape == 98) decoded = 8;
      else if (escape == 102) decoded = 12;
      else if (escape == 110) decoded = 10;
      else if (escape == 114) decoded = 13;
      else if (escape == 116) decoded = 9;
      else break;
      ptr += 2;
    }
    if (materialize) {
      bs.ensureSize(2);
      store<u16>(bs.offset, decoded);
      bs.offset += 2;
    }
  }
  if (materialize && escaped) bs.offset = bs.buffer + mark;
  return 0;
}

export function readCursorString(
  start: usize,
  end: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  const field = dstObj + dstOffset;
  const token = stringCursor(start, end, field, true);
  const next = <usize>(token >> 1);
  if (next) __link(dstObj, load<usize>(field), false);
  return next;
}

export function skipCursorString(start: usize, end: usize): usize {
  return <usize>(stringCursor(start, end, 0, false) >> 1);
}

/** Packed checked key: end cursor in bits 1..32, escape-presence flag in bit 0. */
export function scanCursorString(start: usize, end: usize): u64 {
  return stringCursor(start, end, 0, false);
}

// Recognition, grammar checks, and common-case conversion share one digit
// traversal. Exact wide-decimal and binary32 conversions retain their existing
// conversion routines; a discarded number does not perform any conversion.
@inline
function numberCursor<T extends number>(
  start: usize,
  end: usize,
  dst: usize,
  materialize: bool,
): usize {
  let ptr = start;
  let negative = false;
  if (ptr < end && load<u16>(ptr) == 45) {
    negative = true;
    ptr += 2;
  }
  if (ptr >= end || !digit(load<u16>(ptr))) return 0;
  if (materialize && isInteger<T>() && !isSigned<T>() && negative) return 0;
  if (load<u16>(ptr) == 48 && ptr + 2 < end && digit(load<u16>(ptr, 2)))
    return 0;
  let mantissa: u64 = 0;
  let digits = 0;
  do {
    const value = <u64>(load<u16>(ptr) - 48);
    // Integer conversion wraps as before. Floating conversion keeps at most
    // 19 digits and falls back when the complete mantissa does not fit.
    if (materialize && (isInteger<T>() || digits < 19))
      mantissa = mantissa * 10 + value;
    digits++;
    ptr += 2;
  } while (ptr < end && digit(load<u16>(ptr)));
  let fractionDigits = 0;
  if (ptr < end && load<u16>(ptr) == 46) {
    if (materialize && isInteger<T>()) return 0;
    ptr += 2;
    if (ptr >= end || !digit(load<u16>(ptr))) return 0;
    do {
      if (digits < 19) mantissa = mantissa * 10 + <u64>(load<u16>(ptr) - 48);
      digits++;
      fractionDigits++;
      ptr += 2;
    } while (ptr < end && digit(load<u16>(ptr)));
  }
  let exponent = 0;
  let exponentNegative = false;
  if (ptr < end && (load<u16>(ptr) | 32) == 101) {
    if (materialize && isInteger<T>()) return 0;
    ptr += 2;
    if (ptr < end && (load<u16>(ptr) == 43 || load<u16>(ptr) == 45)) {
      exponentNegative = load<u16>(ptr) == 45;
      ptr += 2;
    }
    if (ptr >= end || !digit(load<u16>(ptr))) return 0;
    do {
      if (materialize && exponent < 1_000_000)
        exponent = exponent * 10 + load<u16>(ptr) - 48;
      ptr += 2;
    } while (ptr < end && digit(load<u16>(ptr)));
  }
  if (materialize) {
    if (isInteger<T>()) {
      store<T>(dst, <T>(negative ? 0 - mantissa : mantissa));
    } else if (sizeof<T>() == 4) {
      const scale = (exponentNegative ? -exponent : exponent) - fractionDigits;
      if (
        digits <= 19 &&
        mantissa <= 0x01000000 &&
        scale >= -10 &&
        scale <= 10
      ) {
        // Both operands are exact binary32 values. A binary32 operation avoids
        // introducing a double-rounding step before the final result.
        let value: f32 =
          scale < 0
            ? <f32>mantissa / <f32>loadPow10(-scale)
            : <f32>mantissa * <f32>loadPow10(scale);
        if (negative) value = -value;
        store<T>(dst, <T>value);
      } else {
        store<T>(dst, <T>f32.parse(ptrToStr(start, ptr)));
      }
    } else {
      const scale = (exponentNegative ? -exponent : exponent) - fractionDigits;
      let value: f64;
      if (
        digits <= 19 &&
        mantissa <= MAX_EXACT_MANTISSA &&
        scale >= -22 &&
        scale <= 22
      ) {
        value =
          scale < 0
            ? <f64>mantissa / loadPow10(-scale)
            : <f64>mantissa * loadPow10(scale);
        if (negative) value = -value;
      } else {
        value = parseDecimalF64(start, ptr);
      }
      store<T>(dst, <T>value);
    }
  }
  return ptr;
}

export function readCursorNumber<T extends number>(
  start: usize,
  end: usize,
  dst: usize,
): usize {
  return numberCursor<T>(start, end, dst, true);
}

export function skipCursorNumber(start: usize, end: usize): usize {
  return numberCursor<f64>(start, end, 0, false);
}

export function readCursorLiteral(start: usize, end: usize, code: u16): usize {
  if (
    code == 116 &&
    start + 8 <= end &&
    load<u64>(start) == 0x0065_0075_0072_0074
  )
    return start + 8;
  if (
    code == 102 &&
    start + 10 <= end &&
    load<u64>(start) == 0x0073_006c_0061_0066 &&
    load<u16>(start, 8) == 101
  )
    return start + 10;
  if (
    code == 110 &&
    start + 8 <= end &&
    load<u64>(start) == 0x006c_006c_0075_006e
  )
    return start + 8;
  return 0;
}

// Discard traversal cannot invoke user code. Its bounded scratch stack is used
// only until this synchronous call returns, never across materialization or a
// custom deserializer. Parent cursor parsers keep their own depth in locals.
// @ts-expect-error: @lazy is valid on module scratch storage
@lazy const DISCARD_STATES = new StaticArray<u8>(MAX_CURSOR_DEPTH);

export function skipCheckedValue(
  start: usize,
  end: usize,
  outerDepth: i32 = 0,
): usize {
  if (<u32>outerDepth > <u32>MAX_CURSOR_DEPTH) return 0;
  let ptr = start;
  let depth = 0;
  let needValue = true;
  while (true) {
    if (needValue) {
      ptr = skipCursorWhitespace(ptr, end);
      if (ptr >= end) return 0;
      const code = load<u16>(ptr);
      if (code == 91 || code == 123) {
        if (outerDepth + depth >= MAX_CURSOR_DEPTH) return 0;
        unchecked((DISCARD_STATES[depth++] = code == 91 ? 0 : 2));
        ptr += 2;
      } else {
        if (code == 34) ptr = skipCursorString(ptr, end);
        else if (code == 116 || code == 102 || code == 110)
          ptr = readCursorLiteral(ptr, end, code);
        else ptr = skipCursorNumber(ptr, end);
        if (!ptr) return 0;
        if (!depth) return ptr;
      }
      needValue = false;
    }
    ptr = skipCursorWhitespace(ptr, end);
    if (ptr >= end) return 0;
    const state = unchecked(DISCARD_STATES[depth - 1]);
    const code = load<u16>(ptr);
    if (
      (state == 0 && code == 93) ||
      (state == 2 && code == 125) ||
      (state == 1 && code == 93) ||
      (state == 4 && code == 125)
    ) {
      ptr += 2;
      if (!--depth) return ptr;
      continue;
    }
    if (state == 0) {
      unchecked((DISCARD_STATES[depth - 1] = 1));
      needValue = true;
    } else if (state == 1) {
      if (code != 44) return 0;
      ptr += 2;
      needValue = true;
    } else if (state == 2 || state == 3) {
      ptr = skipCursorString(ptr, end);
      if (!ptr) return 0;
      ptr = skipCursorWhitespace(ptr, end);
      if (ptr >= end || load<u16>(ptr) != 58) return 0;
      ptr += 2;
      unchecked((DISCARD_STATES[depth - 1] = 4));
      needValue = true;
    } else {
      if (code != 44) return 0;
      ptr += 2;
      unchecked((DISCARD_STATES[depth - 1] = 3));
    }
  }
  return 0;
}

export function validateCursor(data: string): bool {
  const start = changetype<usize>(data);
  const end = start + ((<usize>data.length) << 1);
  const next = skipCheckedValue(start, end);
  return next != 0 && skipCursorWhitespace(next, end) == end;
}
