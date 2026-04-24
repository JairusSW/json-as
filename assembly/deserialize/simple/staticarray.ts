import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { JSON } from "../..";
import { deserializeArbitraryArray } from "./array/arbitrary";
import { deserializeArrayArray } from "./array/array";
import { deserializeBooleanArray } from "./array/bool";
import { deserializeBoxArray } from "./array/box";
import { deserializeFloatArray } from "./array/float";
import { deserializeIntegerArray } from "./array/integer";
import { deserializeMapArray } from "./array/map";
import { deserializeObjectArray } from "./array/object";
import { deserializeRawArray } from "./array/raw";
import { deserializeStructArray } from "./array/struct";
import { deserializeStringArray } from "./array/string";
import { deserializeStaticArrayBoolean } from "./staticarray/bool";
import { deserializeStaticArrayFloat } from "./staticarray/float";
import { deserializeStaticArrayInteger } from "./staticarray/integer";
import { deserializeStaticArrayString } from "./staticarray/string";
import { scanValueEnd } from "../swar/array/shared";


@inline function materializeStaticArray<T extends StaticArray<any>>(src: valueof<T>[], dst: usize): T {
  const byteLength = <usize>src.length * sizeof<valueof<T>>();
  let out = dst;

  if (!out) {
    out = __new(byteLength, idof<T>());
  } else if (changetype<OBJECT>(out - TOTAL_OVERHEAD).rtSize != byteLength) {
    out = __renew(out, byteLength);
  }

  const typed = changetype<T>(out);
  for (let i = 0; i < src.length; i++) {
    unchecked((typed[i] = unchecked(src[i])));
  }
  return typed;
}

export function deserializeStaticArray<T extends StaticArray<any>>(srcStart: usize, srcEnd: usize, dst: usize): T {
  if (isString<valueof<T>>()) {
    return changetype<T>(deserializeStaticArrayString(srcStart, srcEnd, dst));
  } else if (isBoolean<valueof<T>>()) {
    return deserializeStaticArrayBoolean<T>(srcStart, srcEnd, dst);
  } else if (isInteger<valueof<T>>()) {
    return deserializeStaticArrayInteger<T>(srcStart, srcEnd, dst);
  } else if (isFloat<valueof<T>>()) {
    return deserializeStaticArrayFloat<T>(srcStart, srcEnd, dst);
  } else if (isArray<valueof<T>>()) {
    return materializeStaticArray<T>(deserializeArrayArray<valueof<T>[]>(srcStart, srcEnd, 0), dst);
  } else if (isManaged<valueof<T>>() || isReference<valueof<T>>()) {
    const type = changetype<nonnull<valueof<T>>>(0);
    if (type instanceof StaticArray) {
      return materializeStaticArray<T>(deserializeArrayArray<valueof<T>[]>(srcStart, srcEnd, 0), dst);
    } else if (type instanceof JSON.Value) {
      return materializeStaticArray<T>(changetype<valueof<T>[]>(deserializeArbitraryArray(srcStart, srcEnd, 0)), dst);
    } else if (type instanceof JSON.Box) {
      return materializeStaticArray<T>(changetype<valueof<T>[]>(deserializeBoxArray<valueof<T>[]>(srcStart, srcEnd, 0)), dst);
    } else if (type instanceof JSON.Obj) {
      return materializeStaticArray<T>(deserializeObjectArray<valueof<T>[]>(srcStart, srcEnd, 0), dst);
    } else if (type instanceof JSON.Raw) {
      return materializeStaticArray<T>(changetype<valueof<T>[]>(deserializeRawArray(srcStart, srcEnd, 0)), dst);
    } else if (type instanceof Map) {
      return materializeStaticArray<T>(deserializeMapArray<valueof<T>[]>(srcStart, srcEnd, 0), dst);
      // @ts-ignore: supplied by transform
    } else if (isDefined(type.__DESERIALIZE_CUSTOM)) {
      return materializeStaticArray<T>(deserializeStructArray<valueof<T>[]>(srcStart, srcEnd, 0), dst);
      // @ts-ignore: supplied by transform
    } else if (isDefined(type.__DESERIALIZE_SLOW) || isDefined(type.__DESERIALIZE_FAST)) {
      return materializeStaticArray<T>(deserializeStructArray<valueof<T>[]>(srcStart, srcEnd, 0), dst);
    }
  }

  throw new Error("Could not parse static array of type " + nameof<T>() + "!");
}


@inline export function deserializeStaticArrayField<T extends StaticArray<any>>(srcStart: usize, srcEnd: usize, dstObj: usize, dstOffset: usize = 0): usize {
  const valueEnd = scanValueEnd(srcStart, srcEnd);
  if (!valueEnd) throw new Error("Failed to parse JSON!");

  const fieldPtr = dstObj + dstOffset;
  const out = deserializeStaticArray<T>(srcStart, valueEnd, load<usize>(fieldPtr));
  store<T>(fieldPtr, out);
  return valueEnd;
}
