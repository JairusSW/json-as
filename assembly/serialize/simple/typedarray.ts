import { bs } from "../../../lib/as-bs";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../custom/chars";
import { serializeFloat } from "./float";
import { serializeInteger } from "./integer";


@inline
function serializeTypedArrayElement<T extends ArrayLike<number>>(src: T, index: i32): void {
  if (isFloat<valueof<T>>()) {
    serializeFloat<valueof<T>>(unchecked(src[index]));
  } else {
    serializeInteger<valueof<T>>(unchecked(src[index]));
  }
}

export function serializeTypedArray<T extends ArrayLike<number>>(src: T): void {
  bs.proposeSize(4);
  const end = src.length - 1;
  if (end == -1) {
    store<u32>(bs.offset, 6094939);
    bs.offset += 4;
    return;
  }

  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;

  for (let i = 0; i < end; i++) {
    serializeTypedArrayElement(src, i);
    bs.growSize(2);
    store<u16>(bs.offset, COMMA);
    bs.offset += 2;
  }

  serializeTypedArrayElement(src, end);
  store<u16>(bs.offset, BRACKET_RIGHT);
  bs.offset += 2;
}

export function serializeArrayBufferUnsafe(srcStart: usize, byteLength: i32): void {
  const end = byteLength - 1;

  bs.proposeSize(4);
  if (end == -1) {
    store<u32>(bs.offset, 6094939);
    bs.offset += 4;
    return;
  }

  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;

  for (let i = 0; i < end; i++) {
    serializeInteger<u8>(load<u8>(srcStart + <usize>i));
    bs.growSize(2);
    store<u16>(bs.offset, COMMA);
    bs.offset += 2;
  }

  serializeInteger<u8>(load<u8>(srcStart + <usize>end));
  store<u16>(bs.offset, BRACKET_RIGHT);
  bs.offset += 2;
}
