import { bs } from "../../../lib/as-bs";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../custom/chars";
import { serializeFloat32Unsafe, serializeFloat64Unsafe } from "./float";
import { serializeIntegerUnsafe } from "./integer";


@inline
function maxIntegerBytes<T extends number>(): u32 {
  if (sizeof<T>() == 1) return isSigned<T>() ? 8 : 6;
  if (sizeof<T>() == 2) return isSigned<T>() ? 12 : 10;
  if (sizeof<T>() == 4) return isSigned<T>() ? 22 : 20;
  return isSigned<T>() ? 42 : 40;
}


@inline
function reserveTypedArray<T extends ArrayLike<number>>(len: i32): void {
  if (len <= 0) return;
  if (isFloat<valueof<T>>()) {
    bs.proposeSize(4 + <u32>len * (sizeof<valueof<T>>() == 4 ? 34 : 66));
  } else {
    bs.proposeSize(4 + <u32>len * (maxIntegerBytes<valueof<T>>() + 2));
  }
}


@inline
function serializeTypedArrayElement<T extends ArrayLike<number>>(src: T, index: i32): void {
  if (isFloat<valueof<T>>()) {
    if (sizeof<valueof<T>>() == 4) serializeFloat32Unsafe(<f32>unchecked(src[index]));
    else serializeFloat64Unsafe(<f64>unchecked(src[index]));
  } else {
    serializeIntegerUnsafe<valueof<T>>(unchecked(src[index]));
  }
}

export function serializeTypedArray<T extends ArrayLike<number>>(src: T): void {
  const len = src.length;
  const end = len - 1;
  if (end == -1) {
    bs.proposeSize(4);
    store<u32>(bs.offset, 6094939);
    bs.offset += 4;
    return;
  }
  reserveTypedArray<T>(len);

  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;

  for (let i = 0; i < end; i++) {
    serializeTypedArrayElement(src, i);
    store<u16>(bs.offset, COMMA);
    bs.offset += 2;
  }

  serializeTypedArrayElement(src, end);
  store<u16>(bs.offset, BRACKET_RIGHT);
  bs.offset += 2;
}

export function serializeArrayBufferUnsafe(srcStart: usize, byteLength: i32): void {
  const end = byteLength - 1;

  if (end == -1) {
    bs.proposeSize(4);
    store<u32>(bs.offset, 6094939);
    bs.offset += 4;
    return;
  }
  bs.proposeSize(4 + <u32>byteLength * 8);

  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;

  for (let i = 0; i < end; i++) {
    serializeIntegerUnsafe<u8>(load<u8>(srcStart + <usize>i));
    store<u16>(bs.offset, COMMA);
    bs.offset += 2;
  }

  serializeIntegerUnsafe<u8>(load<u8>(srcStart + <usize>end));
  store<u16>(bs.offset, BRACKET_RIGHT);
  bs.offset += 2;
}
