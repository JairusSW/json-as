import { JSON } from "../..";
import { deserializeArbitraryArrayField } from "./array/arbitrary";
import { deserializeArrayArrayField } from "./array/array";
import { deserializeBooleanArrayField } from "./array/bool";
import { deserializeBoxArrayField } from "./array/box";
import { deserializeFloatArrayField } from "./array/float";
import { deserializeIntegerArrayField } from "./array/integer";
import { deserializeMapArrayField } from "./array/map";
import { deserializeObjectArrayField } from "./array/object";
import { deserializeRawArrayField } from "./array/raw";
import { deserializeStringArrayField } from "./array/string";
import { deserializeStructArrayField } from "./array/struct";


@inline export function deserializeArrayField<T extends unknown[]>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  if (isString<valueof<T>>()) {
    return deserializeStringArrayField<T>(srcStart, srcEnd, fieldPtr);
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
    if (type instanceof JSON.Value) {
      return deserializeArbitraryArrayField(srcStart, srcEnd, fieldPtr);
    } else if (type instanceof JSON.Box) {
      return deserializeBoxArrayField<T>(srcStart, srcEnd, fieldPtr);
    } else if (type instanceof JSON.Obj) {
      return deserializeObjectArrayField<T>(srcStart, srcEnd, fieldPtr);
    } else if (type instanceof JSON.Raw) {
      return deserializeRawArrayField(srcStart, srcEnd, fieldPtr);
    } else if (type instanceof Map) {
      return deserializeMapArrayField<T>(srcStart, srcEnd, fieldPtr);
      // @ts-ignore: defined by transform
    } else if (isDefined(type.__DESERIALIZE_CUSTOM)) {
      return deserializeStructArrayField<T>(srcStart, srcEnd, fieldPtr);
      // @ts-ignore: defined by transform
    } else if (isDefined(type.__DESERIALIZE)) {
      return deserializeStructArrayField<T>(srcStart, srcEnd, fieldPtr);
    }
    throw new Error("Could not parse array field of type " + nameof<T>() + "!");
  } else {
    throw new Error("Could not parse array field of type " + nameof<T>() + "!");
  }
}
