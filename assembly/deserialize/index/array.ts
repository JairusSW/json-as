import { JSON, JSONMode } from "../..";
import { deserializeArbitraryArray } from "../simple/array/arbitrary";
import { deserializeArrayArray } from "../simple/array/array";
import { deserializeBooleanArray } from "../simple/array/bool";
import { deserializeBoxArray } from "../simple/array/box";
import { deserializeFloatArray } from "../simple/array/float";
import { deserializeIntegerArray as deserializeIntegerArray_NAIVE } from "../simple/array/integer";
import { deserializeMapArray } from "../simple/array/map";
import { deserializeObjectArray } from "../simple/array/object";
import { deserializeRawArray } from "../simple/array/raw";
import { deserializeStringArray } from "../simple/array/string";
import { deserializeStructArray } from "../simple/array/struct";
import { deserializeIntegerArray_SWAR } from "../swar/array/integer";

export { deserializeArrayField, deserializeArrayField as deserializeArrayField_SWAR } from "../swar/array";

export function deserializeArray<T extends unknown[]>(srcStart: usize, srcEnd: usize, dst: usize): T {
  if (isString<valueof<T>>()) {
    return <T>deserializeStringArray(srcStart, srcEnd, dst);
  } else if (isBoolean<valueof<T>>()) {
    return deserializeBooleanArray<T>(srcStart, srcEnd, dst);
  } else if (isInteger<valueof<T>>()) {
    if (JSON_MODE == JSONMode.SIMD || JSON_MODE == JSONMode.SWAR) {
      // @ts-ignore: integer array branch
      return deserializeIntegerArray_SWAR<T>(srcStart, srcEnd, dst);
    } else {
      // @ts-ignore: integer array branch
      return deserializeIntegerArray_NAIVE<T>(srcStart, srcEnd, dst);
    }
  } else if (isFloat<valueof<T>>()) {
    return deserializeFloatArray<T>(srcStart, srcEnd, dst);
  } else if (isArray<valueof<T>>()) {
    return deserializeArrayArray<T>(srcStart, srcEnd, dst);
  } else if (isManaged<valueof<T>>() || isReference<valueof<T>>()) {
    const type = changetype<nonnull<valueof<T>>>(0);
    if (type instanceof JSON.Value) {
      return deserializeArbitraryArray(srcStart, srcEnd, dst) as T;
    } else if (type instanceof JSON.Box) {
      return deserializeBoxArray<T>(srcStart, srcEnd, dst);
    } else if (type instanceof JSON.Obj) {
      return deserializeObjectArray<T>(srcStart, srcEnd, dst);
    } else if (type instanceof JSON.Raw) {
      return deserializeRawArray(srcStart, srcEnd, dst) as T;
    } else if (type instanceof Map) {
      return deserializeMapArray<T>(srcStart, srcEnd, dst);
      // @ts-ignore: defined by transform
    } else if (isDefined(type.__DESERIALIZE_CUSTOM)) {
      return deserializeStructArray<T>(srcStart, srcEnd, dst);
      // @ts-ignore: defined by transform
    } else if (isDefined(type.__DESERIALIZE)) {
      return deserializeStructArray<T>(srcStart, srcEnd, dst);
    }
    throw new Error("Could not parse array of type " + nameof<T>() + "!");
  } else {
    throw new Error("Could not parse array of type " + nameof<T>() + "!");
  }
}
