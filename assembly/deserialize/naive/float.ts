import { ptrToStr } from "../../util/ptrToStr";
import { isSpace } from "../../util";

// Strict RFC 8259 number-grammar check over [srcStart, srcEnd) (surrounding
// whitespace tolerated). Throws on any deviation: leading zeros, a bare `-`, a
// fraction / exponent with no digits, a `+` sign, hex, Inf/NaN, or trailing
// garbage. f64.parse alone is lenient (parses a numeric prefix and ignores the
// rest), so this guard is what makes the naive value path reject malformed
// numbers like `0e`, `-01`, `1.`, `2.e3`, `0x42`.
function validateJSONNumber(srcStart: usize, srcEnd: usize): void {
  let ptr = srcStart;
  while (ptr < srcEnd && isSpace(load<u16>(ptr))) ptr += 2;
  let end = srcEnd;
  while (end > ptr && isSpace(load<u16>(end - 2))) end -= 2;
  if (ptr >= end) throw new Error("Invalid JSON number: empty");

  if (load<u16>(ptr) == 45) ptr += 2; // optional minus
  if (ptr >= end) throw new Error("Invalid JSON number: bare '-'");

  // Library extension (non-RFC, intentionally supported + tested): the literals
  // NaN / Infinity / -Infinity. Hand these to f64.parse without strict checking.
  const lead = load<u16>(ptr);
  if (lead == 78 || lead == 110 || lead == 73 || lead == 105) return; // N n I i

  // integer part: lone 0, or [1-9] digit*
  const first = load<u16>(ptr);
  if (first == 48) {
    ptr += 2;
    if (ptr < end && <u32>(load<u16>(ptr) - 48) <= 9)
      throw new Error("Invalid JSON number: leading zero");
  } else if (<u32>(first - 48) <= 9) {
    ptr += 2;
    while (ptr < end && <u32>(load<u16>(ptr) - 48) <= 9) ptr += 2;
  } else {
    throw new Error("Invalid JSON number: expected digit");
  }

  // optional fraction: '.' digit+
  if (ptr < end && load<u16>(ptr) == 46) {
    ptr += 2;
    if (ptr >= end || <u32>(load<u16>(ptr) - 48) > 9)
      throw new Error("Invalid JSON number: fraction needs a digit");
    while (ptr < end && <u32>(load<u16>(ptr) - 48) <= 9) ptr += 2;
  }

  // optional exponent: ('e'|'E') ['+'|'-'] digit+
  if (ptr < end) {
    const e = load<u16>(ptr);
    if (e == 101 || e == 69) {
      ptr += 2;
      if (ptr < end) {
        const sign = load<u16>(ptr);
        if (sign == 43 || sign == 45) ptr += 2;
      }
      if (ptr >= end || <u32>(load<u16>(ptr) - 48) > 9)
        throw new Error("Invalid JSON number: exponent needs a digit");
      while (ptr < end && <u32>(load<u16>(ptr) - 48) <= 9) ptr += 2;
    }
  }

  if (ptr != end) throw new Error("Invalid JSON number: trailing characters");
}

// @ts-ignore: inline
@inline export function deserializeFloat_NAIVE<T>(
  srcStart: usize,
  srcEnd: usize,
): T {
  validateJSONNumber(srcStart, srcEnd);
  // @ts-ignore
  const type: T = 0;
  // @ts-ignore
  if (type instanceof f64) return f64.parse(ptrToStr(srcStart, srcEnd));
  // @ts-ignore
  return f32.parse(ptrToStr(srcStart, srcEnd));
}

function scanFloatEnd(srcStart: usize, srcEnd: usize): usize {
  let ptr = srcStart;
  if (ptr < srcEnd && load<u16>(ptr) == 45) ptr += 2; // optional minus

  while (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (<u32>code - 48 > 9) break;
    ptr += 2;
  }

  if (ptr < srcEnd && load<u16>(ptr) == 46) {
    ptr += 2;
    while (ptr < srcEnd) {
      const code = load<u16>(ptr);
      if (<u32>code - 48 > 9) break;
      ptr += 2;
    }
  }

  if (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (code == 101 || code == 69) {
      ptr += 2;
      if (ptr < srcEnd) {
        const sign = load<u16>(ptr);
        if (sign == 45 || sign == 43) ptr += 2;
      }
      while (ptr < srcEnd) {
        const code = load<u16>(ptr);
        if (<u32>code - 48 > 9) break;
        ptr += 2;
      }
    }
  }

  return ptr;
}

// @ts-ignore: inline
@inline export function deserializeFloatField_NAIVE<T extends number>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  const fieldPtr = dstObj + dstOffset;
  const end = scanFloatEnd(srcStart, srcEnd);

  if (sizeof<T>() == sizeof<f32>()) {
    store<f32>(fieldPtr, f32.parse(ptrToStr(srcStart, end)));
  } else {
    store<f64>(fieldPtr, f64.parse(ptrToStr(srcStart, end)));
  }

  return end;
}
