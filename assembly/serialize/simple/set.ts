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
function reservePrimitiveSet<T>(len: i32): void {
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

export function serializeSet<T extends Set<any>>(src: T): void {
  const srcSize = src.size;
  if (srcSize == 0) {
    bs.proposeSize(4);
    store<u32>(bs.offset, 6094939); // []
    bs.offset += 4;
    return;
  }
  if (isBoolean<indexof<T>>() || isInteger<indexof<T>>() || isFloat<indexof<T>>() || isString<indexof<T>>()) {
    reservePrimitiveSet<indexof<T>>(srcSize);
  } else {
    bs.proposeSize(4 + <u32>(srcSize - 1) * 2);
  }

  const values = src.values();
  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;

  const end = srcSize - 1;
  for (let i = 0; i < end; i++) {
    const block = unchecked(values[i]);
    if (isString<indexof<T>>()) {
      serializeString(block as string);
    } else if (isBoolean<indexof<T>>()) {
      serializeBoolUnsafe(<bool>block);
    } else if (isInteger<indexof<T>>()) {
      serializeIntegerUnsafe<indexof<T>>(block);
    } else if (isFloat<indexof<T>>()) {
      if (sizeof<indexof<T>>() == 4) serializeFloat32Unsafe(<f32>block);
      else serializeFloat64Unsafe(<f64>block);
    } else {
      // @ts-ignore: type
      JSON.__serialize<indexof<T>>(block);
    }
    store<u16>(bs.offset, COMMA);
    bs.offset += 2;
  }

  const lastBlock = unchecked(values[end]);
  if (isString<indexof<T>>()) {
    serializeString(lastBlock as string);
  } else if (isBoolean<indexof<T>>()) {
    serializeBoolUnsafe(<bool>lastBlock);
  } else if (isInteger<indexof<T>>()) {
    serializeIntegerUnsafe<indexof<T>>(lastBlock);
  } else if (isFloat<indexof<T>>()) {
    if (sizeof<indexof<T>>() == 4) serializeFloat32Unsafe(<f32>lastBlock);
    else serializeFloat64Unsafe(<f64>lastBlock);
  } else {
    // @ts-ignore: type
    JSON.__serialize<indexof<T>>(lastBlock);
  }
  store<u16>(bs.offset, BRACKET_RIGHT);
  bs.offset += 2;
}
