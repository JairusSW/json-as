import { NativeSet } from "../../util/native-collections";
import { bs } from "../../../lib/as-bs";
import { COMMA, BRACKET_RIGHT, BRACKET_LEFT } from "../../custom/chars";
import { JSON } from "../..";
import { serializeBoolUnsafe } from "./bool";
import { serializeFloat32Unsafe, serializeFloat64Unsafe } from "./float";
import { serializeIntegerUnsafe } from "./integer";
import { serializeString } from "../index/string";


@unmanaged class SerializableSetEntry<K> {
  key: K;
  taggedNext: usize;
}

function serializePrimitiveSet<T extends Set<any>>(src: T): void {
  const size = changetype<NativeSet<indexof<T>>>(src).nativeSize();
  reservePrimitiveSet<indexof<T>>(size);
  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;
  const base = changetype<usize>(src);
  const entries = load<usize>(base, offsetof<T>("entries"));
  const count = load<i32>(base, offsetof<T>("entriesOffset"));
  const align = max<usize>(sizeof<indexof<T>>(), sizeof<usize>()) - 1;
  const stride =
    (offsetof<SerializableSetEntry<indexof<T>>>() + align) & ~align;
  let wrote = false;
  for (let i = 0; i < count; i++) {
    const entry = changetype<SerializableSetEntry<indexof<T>>>(
      entries + <usize>i * stride,
    );
    if (entry.taggedNext & 1) continue;
    const value = entry.key;
    if (wrote) {
      store<u16>(bs.offset, COMMA);
      bs.offset += 2;
    }
    if (isBoolean<indexof<T>>()) serializeBoolUnsafe(<bool>value);
    else if (isInteger<indexof<T>>()) serializeIntegerUnsafe<indexof<T>>(value);
    else if (sizeof<indexof<T>>() == 4) serializeFloat32Unsafe(<f32>value);
    else serializeFloat64Unsafe(<f64>value);
    wrote = true;
  }
  store<u16>(bs.offset, BRACKET_RIGHT);
  bs.offset += 2;
}

function maxIntegerBytes<T extends number>(): u32 {
  if (sizeof<T>() == 1) return isSigned<T>() ? 8 : 6;
  if (sizeof<T>() == 2) return isSigned<T>() ? 12 : 10;
  if (sizeof<T>() == 4) return isSigned<T>() ? 22 : 20;
  return isSigned<T>() ? 42 : 40;
}

function reservePrimitiveSet<T>(len: i32): void {
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
  const srcSize = changetype<NativeSet<indexof<T>>>(src).nativeSize();
  if (srcSize == 0) {
    bs.proposeSize(4);
    store<u32>(bs.offset, 6094939); // []
    bs.offset += 4;
    return;
  }
  if (
    isBoolean<indexof<T>>() ||
    isInteger<indexof<T>>() ||
    isFloat<indexof<T>>()
  ) {
    serializePrimitiveSet<T>(src);
    return;
  }
  if (
    isBoolean<indexof<T>>() ||
    isInteger<indexof<T>>() ||
    isFloat<indexof<T>>() ||
    isString<indexof<T>>()
  ) {
    reservePrimitiveSet<indexof<T>>(srcSize);
  } else {
    bs.proposeSize(4 + <u32>(srcSize - 1) * 2);
  }

  const values = changetype<NativeSet<indexof<T>>>(src).nativeValues();
  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;

  const end = srcSize - 1;
  for (let i = 0; i < end; i++) {
    const block = unchecked(values[i]);
    if (isString<indexof<T>>() && !isNullable<indexof<T>>()) {
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
  if (isString<indexof<T>>() && !isNullable<indexof<T>>()) {
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
