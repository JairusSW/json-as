import { JSON } from "../..";
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
import { deserializeArrayArrayInto } from "./array/array";
import { deserializeBooleanArrayInto } from "./array/bool";
import { deserializeFloatArrayInto } from "./array/float";
import { deserializeGenericArrayInto } from "./array/generic";
import { deserializeIntegerArrayInto } from "./array/integer";
import { deserializeObjectArrayInto } from "./array/object";
import { deserializeStringArrayInto } from "./array/string";
import { deserializeStructArrayInto } from "./array/struct";


@inline export function deserializeArrayField<T extends unknown[]>(srcStart: usize, srcEnd: usize, dstObj: usize, dstOffset: usize = 0): usize {
  const fieldPtr = dstObj + dstOffset;
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
    } else if (type instanceof Date) {
      return deserializeGenericArrayField<T>(srcStart, srcEnd, fieldPtr);
    } else if (type instanceof Set) {
      return deserializeGenericArrayField<T>(srcStart, srcEnd, fieldPtr);
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

@inline export function deserializeArrayInto_SWAR<T extends unknown[]>(srcStart: usize, srcEnd: usize, out: T): usize {
  if (isString<valueof<T>>()) {
    return deserializeStringArrayInto<T>(srcStart, srcEnd, out);
  } else if (isBoolean<valueof<T>>()) {
    return deserializeBooleanArrayInto<T>(srcStart, srcEnd, out);
  } else if (isInteger<valueof<T>>()) {
    return deserializeIntegerArrayInto<T>(srcStart, srcEnd, out);
  } else if (isFloat<valueof<T>>()) {
    return deserializeFloatArrayInto<T>(srcStart, srcEnd, out);
  } else if (isArray<valueof<T>>()) {
    return deserializeArrayArrayInto<T>(srcStart, srcEnd, out);
  } else if (isManaged<valueof<T>>() || isReference<valueof<T>>()) {
    const type = changetype<nonnull<valueof<T>>>(0);
    if (type instanceof JSON.Value) {
      return deserializeGenericArrayInto<T>(srcStart, srcEnd, out);
    } else if (type instanceof JSON.Box) {
      throw new Error("Failed to parse JSON!");
    } else if (type instanceof JSON.Obj) {
      return deserializeObjectArrayInto<T>(srcStart, srcEnd, out);
    } else if (type instanceof JSON.Raw) {
      throw new Error("Failed to parse JSON!");
    } else if (type instanceof Date) {
      return deserializeGenericArrayInto<T>(srcStart, srcEnd, out);
    } else if (type instanceof Set) {
      return deserializeGenericArrayInto<T>(srcStart, srcEnd, out);
    } else if (type instanceof Map) {
      throw new Error("Failed to parse JSON!");
      // @ts-ignore: defined by transform
    } else if (isDefined(type.__DESERIALIZE_CUSTOM)) {
      return deserializeStructArrayInto<T>(srcStart, srcEnd, out);
      // @ts-ignore: defined by transform
    } else if (isDefined(type.__DESERIALIZE)) {
      return deserializeStructArrayInto<T>(srcStart, srcEnd, out);
    }
    throw new Error("Could not parse array field of type " + nameof<T>() + "!");
  } else {
    throw new Error("Could not parse array field of type " + nameof<T>() + "!");
  }
}
