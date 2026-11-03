import { JSON } from "../..";
import { deserializeCustomArrayField } from "../naive/array/generic";
import { deserializeArbitraryArrayField } from "./array/arbitrary";
import { deserializeArrayArrayField } from "./array/array";
import { deserializeBooleanArrayField } from "./array/bool";
import { deserializeBoxArrayField } from "./array/box";
import { deserializeFloatArrayField } from "./array/float";
import { deserializeGenericArrayField } from "./array/generic";
import { deserializeIntegerArrayField } from "./array/integer";
import { deserializeMapArrayField } from "./array/map";
import { deserializeObjectArrayField } from "./array/object";
import { deserializeRawArrayField } from "./array/raw";
import { deserializeStringArrayField } from "./array/string";
import { deserializeStructArrayField } from "./array/struct";

export { deserializeArrayField as deserializeArrayField_SWAR };
export function deserializeArrayField<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  const fieldPtr = dstObj + dstOffset;
  if (isString<valueof<T>>()) {
    return deserializeStringArrayField<T>(
      srcStart,
      srcEnd,
      fieldPtr,
      isNullable<valueof<T>>(),
    );
  } else if (isBoolean<valueof<T>>()) {
    return deserializeBooleanArrayField<T>(srcStart, srcEnd, fieldPtr);
  } else if (isInteger<valueof<T>>()) {
    return deserializeIntegerArrayField<T>(srcStart, srcEnd, fieldPtr);
  } else if (isFloat<valueof<T>>()) {
    return deserializeFloatArrayField<T>(srcStart, srcEnd, fieldPtr);
  } else if (isArray<valueof<T>>()) {
    return deserializeArrayArrayField<T>(srcStart, srcEnd, fieldPtr);
  } else if (isManaged<valueof<T>>() || isReference<valueof<T>>()) {
    const type = changetype<nonnull<valueof<T>>>(0);
    // User representations take precedence over inherited built-in layouts.
    // @ts-expect-error: generated custom reader
    if (isDefined(type.__DESERIALIZE_CUSTOM))
      return deserializeCustomArrayField<T>(srcStart, srcEnd, fieldPtr);
    // @ts-expect-error: generated object reader
    if (
      isDefined(type.__DESERIALIZE_SLOW) ||
      isDefined(type.__DESERIALIZE_FAST)
    )
      return deserializeStructArrayField<T>(srcStart, srcEnd, fieldPtr);
    if (type instanceof JSON.Value) {
      return deserializeArbitraryArrayField(srcStart, srcEnd, fieldPtr);
    } else if (type instanceof JSON.Box) {
      return deserializeBoxArrayField<T>(srcStart, srcEnd, fieldPtr);
    } else if (type instanceof JSON.Obj) {
      return deserializeObjectArrayField<T>(srcStart, srcEnd, fieldPtr);
    } else if (type instanceof JSON.Raw) {
      return deserializeRawArrayField(srcStart, srcEnd, fieldPtr);
    } else if (
      type instanceof Int8Array ||
      type instanceof Uint8Array ||
      type instanceof Uint8ClampedArray ||
      type instanceof Int16Array ||
      type instanceof Uint16Array ||
      type instanceof Int32Array ||
      type instanceof Uint32Array ||
      type instanceof Int64Array ||
      type instanceof Uint64Array ||
      type instanceof Float32Array ||
      type instanceof Float64Array ||
      type instanceof Date ||
      type instanceof Set ||
      type instanceof StaticArray ||
      type instanceof JSON.Arr
    ) {
      return deserializeGenericArrayField<T>(srcStart, srcEnd, fieldPtr);
    } else if (type instanceof Map) {
      return deserializeMapArrayField<T>(srcStart, srcEnd, fieldPtr);
    }
    throw new Error("Could not parse array field of type " + nameof<T>() + "!");
  } else {
    throw new Error("Could not parse array field of type " + nameof<T>() + "!");
  }
}
