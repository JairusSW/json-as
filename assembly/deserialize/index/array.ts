import { JSON, JSONMode } from "../..";
import { deserializeArbitraryArray } from "../naive/array/arbitrary";
import { deserializeArrayArray } from "../naive/array/array";
import { deserializeBooleanArray } from "../naive/array/bool";
import { deserializeBoxArray } from "../naive/array/box";
import { deserializeFloatArray_NAIVE } from "../naive/array/float";
import {
  deserializeCustomArray,
  deserializeGenericArray,
} from "../naive/array/generic";
import { deserializeIntegerArray_NAIVE } from "../naive/array/integer";
import { deserializeMapArray } from "../naive/array/map";
import { deserializeObjectArray } from "../naive/array/object";
import { deserializeRawArray } from "../naive/array/raw";
import { deserializeStringArray_NAIVE } from "../naive/array/string";
import { deserializeStructArray_SWAR } from "../swar/array/struct";
import { deserializeIntegerArray_SIMD } from "../simd/array/integer";
import { deserializeIntegerArray_SWAR } from "../swar/array/integer";
import { deserializeFloatArray_SWAR } from "../swar/array/float";
import { deserializeStringArray_SWAR } from "../swar/array/string";

export {
  deserializeArrayField,
  deserializeArrayField as deserializeArrayField_SWAR,
} from "../swar/array";

export function deserializeArray<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  if (isString<valueof<T>>()) {
    // Preserve element nullability before entering the narrower string-array
    // helper signatures used by the individual mode implementations.
    if (JSON_MODE == JSONMode.SWAR || JSON_MODE == JSONMode.SIMD) {
      return deserializeStringArray_SWAR<T>(
        srcStart,
        srcEnd,
        dst,
        isNullable<valueof<T>>(),
      );
    }
    return changetype<T>(
      deserializeStringArray_NAIVE<T>(
        srcStart,
        srcEnd,
        dst,
        isNullable<valueof<T>>(),
      ),
    );
  } else if (isBoolean<valueof<T>>()) {
    return deserializeBooleanArray<T>(srcStart, srcEnd, dst);
  } else if (isInteger<valueof<T>>()) {
    if (JSON_MODE == JSONMode.SIMD) {
      // @ts-ignore: integer array branch
      return deserializeIntegerArray_SIMD<T>(srcStart, srcEnd, dst);
    } else if (JSON_MODE == JSONMode.SWAR) {
      // @ts-ignore: integer array branch
      return deserializeIntegerArray_SWAR<T>(srcStart, srcEnd, dst);
    } else {
      // @ts-ignore: integer array branch
      return deserializeIntegerArray_NAIVE<T>(srcStart, srcEnd, dst);
    }
  } else if (isFloat<valueof<T>>()) {
    if (JSON_MODE == JSONMode.SWAR || JSON_MODE == JSONMode.SIMD) {
      // @ts-ignore: float array branch
      return deserializeFloatArray_SWAR<T>(srcStart, srcEnd, dst);
    }
    return deserializeFloatArray_NAIVE<T>(srcStart, srcEnd, dst);
  } else if (isArray<valueof<T>>()) {
    return deserializeArrayArray<T>(srcStart, srcEnd, dst);
  } else if (isManaged<valueof<T>>() || isReference<valueof<T>>()) {
    const type = changetype<nonnull<valueof<T>>>(0);
    // @ts-expect-error: generated custom reader
    if (isDefined(type.__DESERIALIZE_CUSTOM))
      return deserializeCustomArray<T>(srcStart, srcEnd, dst);
    // @ts-expect-error: generated object reader
    if (
      isDefined(type.__DESERIALIZE_SLOW) ||
      isDefined(type.__DESERIALIZE_FAST)
    )
      return deserializeStructArray_SWAR<T>(srcStart, srcEnd, dst);
    if (type instanceof JSON.Value) {
      if (isNullable<valueof<T>>())
        return deserializeGenericArray<T>(srcStart, srcEnd, dst);
      return deserializeArbitraryArray<T>(srcStart, srcEnd, dst) as T;
    } else if (type instanceof JSON.Box) {
      return deserializeBoxArray<T>(srcStart, srcEnd, dst);
    } else if (type instanceof JSON.Obj) {
      return deserializeObjectArray<T>(srcStart, srcEnd, dst);
    } else if (type instanceof JSON.Raw) {
      return deserializeRawArray<T>(srcStart, srcEnd, dst) as T;
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
      type instanceof ArrayBuffer ||
      type instanceof Date ||
      type instanceof Set ||
      type instanceof StaticArray ||
      type instanceof JSON.Arr
    ) {
      return deserializeGenericArray<T>(srcStart, srcEnd, dst);
    } else if (type instanceof Map) {
      return deserializeMapArray<T>(srcStart, srcEnd, dst);
    }
    throw new Error("Could not parse array of type " + nameof<T>() + "!");
  } else {
    throw new Error("Could not parse array of type " + nameof<T>() + "!");
  }
}
