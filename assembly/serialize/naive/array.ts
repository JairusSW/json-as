import { bs } from "../../../lib/as-bs";
import { COMMA, BRACKET_RIGHT, BRACKET_LEFT } from "../../custom/chars";
import { JSON } from "../..";
import { serializeBoolUnsafe } from "./bool";
import { serializeFloat32Unsafe, serializeFloat64Unsafe } from "./float";
import { serializeIntegerUnsafe } from "./integer";
import { serializeString } from "../index/string";
import { writeFloatUnsafe, writeDoubleUnsafe } from "../../util/zmij";


@inline
function maxIntegerBytes<T extends number>(): u32 {
  if (sizeof<T>() == 1) return isSigned<T>() ? 8 : 6;
  if (sizeof<T>() == 2) return isSigned<T>() ? 12 : 10;
  if (sizeof<T>() == 4) return isSigned<T>() ? 22 : 20;
  return isSigned<T>() ? 42 : 40;
}


@inline
function reservePrimitiveArray<T>(len: i32): void {
  if (len <= 0) return;
  if (isBoolean<T>()) {
    bs.proposeSize(4 + <u32>len * 12);
  } else if (isInteger<T>()) {
    bs.proposeSize(4 + <u32>len * (maxIntegerBytes<T>() + 2));
  } else if (isFloat<T>()) {
    bs.proposeSize(4 + <u32>len * (sizeof<T>() == 4 ? 34 : 66));
  } else {
    bs.proposeSize(4 + <u32>(len - 1) * 2);
  }
}


@inline
function serializeArrayElement<T>(value: T): void {
  if (isString<T>()) {
    serializeString(value as string);
    return;
  }
  if (isBoolean<T>()) {
    serializeBoolUnsafe(<bool>value);
    return;
  }
  if (isInteger<T>()) {
    serializeIntegerUnsafe<T>(value);
    return;
  }
  if (isFloat<T>()) {
    if (sizeof<T>() == 4) serializeFloat32Unsafe(<f32>value);
    else serializeFloat64Unsafe(<f64>value);
    return;
  }
  if (isManaged<T>() || isReference<T>()) {
    // Preserve runtime custom serializers for subclass instances stored in
    // parent-typed arrays before falling back to the static dispatcher.
    // @ts-ignore: transform-defined at runtime when present
    if (isDefined(value.__SERIALIZE_CUSTOM)) {
      // @ts-ignore: transform-defined at runtime when present
      value.__SERIALIZE_CUSTOM();
      return;
    }
  }
  JSON.__serialize<T>(value);
}

// ---------------------------------------------------------------------------
// Specialized fast paths
// ---------------------------------------------------------------------------
//
// `bool[]` and `u8[]` / `i8[]` serializers fold the element write and the
// trailing comma into a single per-element store. The outer dispatcher
// emits `[` once, the loop emits `VALUE,` once per element, and the closing
// `]` overwrites the trailing comma. This eliminates the separate
// comma-store + advance per element that the generic `serializeArray` does.

// `"true,"` packed UTF-16: `t,r,u,e,,` lanes 0..4 = bytes 0..9.
@inline const TRUE_COMMA_LO: u64 = 0x0065_0075_0072_0074;


@inline const TRUE_COMMA_HI: u16 = 0x002c;
// `"false,"` packed UTF-16: `f,a,l,s,e,,` lanes 0..5 = bytes 0..11.
@inline const FALSE_COMMA_LO: u64 = 0x0073_006c_0061_0066;


@inline const FALSE_COMMA_HI: u32 = 0x002c_0065;

function serializeBoolArrayFast(src: bool[]): void {
  const len = src.length;
  // Worst case: every element is `"false,"` = 12 bytes; plus 4 for `[]`.
  bs.proposeSize(4 + <u32>len * 12);
  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;
  if (len == 0) {
    store<u16>(bs.offset, BRACKET_RIGHT);
    bs.offset += 2;
    return;
  }

  const dataStart = src.dataStart;
  for (let i: i32 = 0; i < len; i++) {
    if (load<bool>(dataStart + <usize>i)) {
      store<u64>(bs.offset, TRUE_COMMA_LO);
      store<u16>(bs.offset, TRUE_COMMA_HI, 8);
      bs.offset += 10;
    } else {
      store<u64>(bs.offset, FALSE_COMMA_LO);
      store<u32>(bs.offset, FALSE_COMMA_HI, 8);
      bs.offset += 12;
    }
  }
  // Overwrite the final trailing comma with `]`.
  store<u16>(bs.offset - 2, BRACKET_RIGHT);
}

// 256-entry table mapping `u8` value -> UTF-16 chars of `"DDD,"` packed in a
// u64. Unused lanes hold garbage that the next element's store overwrites.
const U8_SERIALIZE_LUT: usize = memory.data(2048); // 256 * sizeof<u64>
// 256-entry table mapping `u8` value -> byte count of the packed encoding.
const U8_SERIALIZE_LEN_LUT: usize = memory.data(256);
let _u8LutInited: bool = false;

function initU8Lut(): void {
  for (let i: i32 = 0; i < 256; i++) {
    let chars: u64;
    let bytes: u8;
    if (i < 10) {
      chars = u64(0x30 + i) | (u64(0x2c) << 16);
      bytes = 4;
    } else if (i < 100) {
      const d0 = i / 10;
      const d1 = i % 10;
      chars = u64(0x30 + d0) | (u64(0x30 + d1) << 16) | (u64(0x2c) << 32);
      bytes = 6;
    } else {
      const d0 = i / 100;
      const d1 = (i / 10) % 10;
      const d2 = i % 10;
      chars =
        u64(0x30 + d0) |
        (u64(0x30 + d1) << 16) |
        (u64(0x30 + d2) << 32) |
        (u64(0x2c) << 48);
      bytes = 8;
    }
    store<u64>(U8_SERIALIZE_LUT + ((<usize>i) << 3), chars);
    store<u8>(U8_SERIALIZE_LEN_LUT + <usize>i, bytes);
  }
  _u8LutInited = true;
}


@inline function ensureU8Lut(): void {
  if (!_u8LutInited) initU8Lut();
}

function serializeU8ArrayFast(src: u8[]): void {
  const len = src.length;
  // Worst case: every element is 3 digits + comma = 8 bytes; plus 4 for `[]`.
  bs.proposeSize(4 + <u32>len * 8);
  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;
  if (len == 0) {
    store<u16>(bs.offset, BRACKET_RIGHT);
    bs.offset += 2;
    return;
  }
  ensureU8Lut();

  const dataStart = src.dataStart;
  for (let i: i32 = 0; i < len; i++) {
    const v = <usize>load<u8>(dataStart + <usize>i);
    const chars = load<u64>(U8_SERIALIZE_LUT + (v << 3));
    const byteCount = <usize>load<u8>(U8_SERIALIZE_LEN_LUT + v);
    store<u64>(bs.offset, chars);
    bs.offset += byteCount;
  }
  store<u16>(bs.offset - 2, BRACKET_RIGHT);
}

// Specialized float-array serializer: dragonbox + trailing comma in a
// uniform per-iteration body, then overwrite the final comma with `]`. The
// generic dispatcher splits the loop into "N-1 elements with comma, then
// last element without, then `]`" — the branch on each `i < end` check
// stalls the loop's tight bs.offset advance pattern. This variant runs the
// same number of stores per iteration (dragonbox output + COMMA), but the
// uniform loop body inlines better and the trailing `]` is a single fixed
// overwrite outside the loop.
function serializeF64ArrayFast(src: f64[]): void {
  const len = src.length;
  // Worst case per element: ~24 chars for f64 + comma = 50 bytes.
  // Slight over-reserve (66) matches the existing `reservePrimitiveArray`
  // budget and keeps a safety margin for any NaN/Inf spelling.
  bs.proposeSize(4 + <u32>len * 66);
  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;
  if (len == 0) {
    store<u16>(bs.offset, BRACKET_RIGHT);
    bs.offset += 2;
    return;
  }

  // Hoist `bs.offset` into a local so the loop body has a single
  // monotonically-advancing pointer instead of two reads + two writes back
  // to the global per iteration.
  const dataStart = src.dataStart;
  let offset = bs.offset;
  for (let i: i32 = 0; i < len; i++) {
    const v = load<f64>(dataStart + ((<usize>i) << 3));
    offset = writeDoubleUnsafe(offset, v);
    store<u16>(offset, COMMA);
    offset += 2;
  }
  // Overwrite the final trailing comma with `]`.
  store<u16>(offset - 2, BRACKET_RIGHT);
  bs.offset = offset;
}

function serializeF32ArrayFast(src: f32[]): void {
  const len = src.length;
  // Worst case for f32 is ~16 chars + comma = ~34 bytes; mirror the budget
  // used by `reservePrimitiveArray`.
  bs.proposeSize(4 + <u32>len * 34);
  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;
  if (len == 0) {
    store<u16>(bs.offset, BRACKET_RIGHT);
    bs.offset += 2;
    return;
  }

  const dataStart = src.dataStart;
  let offset = bs.offset;
  for (let i: i32 = 0; i < len; i++) {
    const v = load<f32>(dataStart + ((<usize>i) << 2));
    offset = writeFloatUnsafe(offset, v);
    store<u16>(offset, COMMA);
    offset += 2;
  }
  store<u16>(offset - 2, BRACKET_RIGHT);
  bs.offset = offset;
}

function serializeI8ArrayFast(src: i8[]): void {
  const len = src.length;
  // Worst case: every element is `-DDD,` = 5 chars = 10 bytes; plus 4 for `[]`.
  bs.proposeSize(4 + <u32>len * 10);
  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;
  if (len == 0) {
    store<u16>(bs.offset, BRACKET_RIGHT);
    bs.offset += 2;
    return;
  }
  ensureU8Lut();

  const dataStart = src.dataStart;
  for (let i: i32 = 0; i < len; i++) {
    let signed = load<i8>(dataStart + <usize>i);
    let absVal: u32;
    if (signed < 0) {
      store<u16>(bs.offset, 0x2d); // '-'
      bs.offset += 2;
      absVal = <u32>-(<i32>signed);
    } else {
      absVal = <u32>signed;
    }
    const chars = load<u64>(U8_SERIALIZE_LUT + ((<usize>absVal) << 3));
    const byteCount = <usize>load<u8>(U8_SERIALIZE_LEN_LUT + <usize>absVal);
    store<u64>(bs.offset, chars);
    bs.offset += byteCount;
  }
  store<u16>(bs.offset - 2, BRACKET_RIGHT);
}

export function serializeArray<T extends any[]>(src: T): void {
  // Specialized fast paths fold the per-element comma into the element write,
  // saving one `store<u16>` + advance per iteration. AS folds the type checks
  // at compile time so the non-matching branches don't ship.
  if (isBoolean<valueof<T>>()) {
    // @ts-expect-error: T is bool[]
    serializeBoolArrayFast(changetype<bool[]>(src));
    return;
  }
  if (
    isInteger<valueof<T>>() &&
    !isSigned<valueof<T>>() &&
    sizeof<valueof<T>>() == 1
  ) {
    // @ts-expect-error: T is u8[]
    serializeU8ArrayFast(changetype<u8[]>(src));
    return;
  }
  if (
    isInteger<valueof<T>>() &&
    isSigned<valueof<T>>() &&
    sizeof<valueof<T>>() == 1
  ) {
    // @ts-expect-error: T is i8[]
    serializeI8ArrayFast(changetype<i8[]>(src));
    return;
  }
  if (isFloat<valueof<T>>() && sizeof<valueof<T>>() == 8) {
    // @ts-expect-error: T is f64[]
    serializeF64ArrayFast(changetype<f64[]>(src));
    return;
  }
  if (isFloat<valueof<T>>() && sizeof<valueof<T>>() == 4) {
    // @ts-expect-error: T is f32[]
    serializeF32ArrayFast(changetype<f32[]>(src));
    return;
  }

  const len = src.length;
  const end = len - 1;
  let i = 0;
  if (end == -1) {
    bs.proposeSize(4);
    store<u32>(bs.offset, 6094939);
    bs.offset += 4;
    return;
  }
  if (
    isBoolean<valueof<T>>() ||
    isInteger<valueof<T>>() ||
    isFloat<valueof<T>>() ||
    isString<valueof<T>>()
  ) {
    reservePrimitiveArray<valueof<T>>(len);
  } else {
    bs.proposeSize(4 + <u32>(len - 1) * 2);
  }

  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;

  while (i < end) {
    const block = unchecked(src[i++]);
    serializeArrayElement<valueof<T>>(block);
    store<u16>(bs.offset, COMMA);
    bs.offset += 2;
  }

  const lastBlock = unchecked(src[end]);
  serializeArrayElement<valueof<T>>(lastBlock);
  store<u16>(bs.offset, BRACKET_RIGHT);
  bs.offset += 2;
}
