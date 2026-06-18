import { JSON, JSONMode } from "../..";
import { deserializeArbitraryArray } from "../naive/array/arbitrary";
import { deserializeArrayArray } from "../naive/array/array";
import { deserializeBooleanArray } from "../naive/array/bool";
import { deserializeBoxArray } from "../naive/array/box";
import { deserializeFloatArray_NAIVE } from "../naive/array/float";
import { deserializeGenericArray } from "../naive/array/generic";
import { deserializeIntegerArray_NAIVE } from "../naive/array/integer";
import { deserializeMapArray } from "../naive/array/map";
import { deserializeObjectArray } from "../naive/array/object";
import { deserializeRawArray } from "../naive/array/raw";
import { deserializeStringArray_NAIVE } from "../naive/array/string";
import { deserializeStructArray } from "../naive/array/struct";
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
    // SWAR/SIMD routes through the same `Into` helper used by the
    // struct-field path; that helper carries the `null` token fast path
    // for `(string | null)[]`. NAIVE keeps the naive scanner, which
    // currently only handles non-nullable string arrays. The naive
    // variant's static `string[]` return type is bit-identical to
    // `(string | null)[]` so `changetype<T>` is a runtime no-op.
    if (JSON_MODE == JSONMode.SWAR || JSON_MODE == JSONMode.SIMD) {
      return deserializeStringArray_SWAR<T>(srcStart, srcEnd, dst);
    }
    return changetype<T>(deserializeStringArray_NAIVE(srcStart, srcEnd, dst));
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
    if (type instanceof JSON.Value) {
      return deserializeArbitraryArray(srcStart, srcEnd, dst) as T;
    } else if (type instanceof JSON.Box) {
      return deserializeBoxArray<T>(srcStart, srcEnd, dst);
    } else if (type instanceof JSON.Obj) {
      return deserializeObjectArray<T>(srcStart, srcEnd, dst);
    } else if (type instanceof JSON.Raw) {
      return deserializeRawArray(srcStart, srcEnd, dst) as T;
    } else if (type instanceof Date) {
      return deserializeGenericArray<T>(srcStart, srcEnd, dst);
    } else if (type instanceof Set) {
      return deserializeGenericArray<T>(srcStart, srcEnd, dst);
    } else if (type instanceof Map) {
      return deserializeMapArray<T>(srcStart, srcEnd, dst);
      // @ts-ignore: defined by transform
    } else if (isDefined(type.__DESERIALIZE_CUSTOM)) {
      return deserializeStructArray<T>(srcStart, srcEnd, dst);
      // @ts-ignore: defined by transform
    } else if (
      isDefined(type.__DESERIALIZE_SLOW) ||
      isDefined(type.__DESERIALIZE_FAST)
    ) {
      return deserializeStructArray_SWAR<T>(srcStart, srcEnd, dst);
    }
    throw new Error("Could not parse array of type " + nameof<T>() + "!");
  } else {
    throw new Error("Could not parse array of type " + nameof<T>() + "!");
  }
}
