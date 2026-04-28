import { bs } from "../../../lib/as-bs";
import { COMMA, BRACKET_RIGHT, BRACKET_LEFT } from "../../custom/chars";
import { JSON } from "../..";
import { serializeBoolUnsafe } from "./bool";
import { serializeFloat32Unsafe, serializeFloat64Unsafe } from "./float";
import { serializeIntegerUnsafe } from "./integer";
import { serializeString } from "../index/string";


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
  JSON.__serialize<T>(value);
}

export function serializeArray<T extends any[]>(src: T): void {
  const len = src.length;
  const end = len - 1;
  let i = 0;
  if (end == -1) {
    bs.proposeSize(4);
    store<u32>(bs.offset, 6094939);
    bs.offset += 4;
    return;
  }
  if (isBoolean<valueof<T>>() || isInteger<valueof<T>>() || isFloat<valueof<T>>() || isString<valueof<T>>()) {
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
