import { deserializeStaticArrayInteger } from "./staticarray/integer";
import { deserializeStaticArrayFloat } from "./staticarray/float";
import { deserializeStaticArrayBoolean } from "./staticarray/bool";
import { deserializeStaticArrayString } from "./staticarray/string";
import { deserializeStaticArrayArray } from "./staticarray/array";
import { deserializeStaticArrayStruct } from "./staticarray/struct";

export function deserializeStaticArray<T extends StaticArray<any>>(srcStart: usize, srcEnd: usize, dst: usize): T {
  if (isString<valueof<T>>()) {
    return <T>deserializeStaticArrayString(srcStart, srcEnd, dst);
  } else if (isBoolean<valueof<T>>()) {
    return deserializeStaticArrayBoolean<T>(srcStart, srcEnd, dst);
  } else if (isInteger<valueof<T>>()) {
    return deserializeStaticArrayInteger<T>(srcStart, srcEnd, dst);
  } else if (isFloat<valueof<T>>()) {
    return deserializeStaticArrayFloat<T>(srcStart, srcEnd, dst);
  } else if (isArrayLike<valueof<T>>()) {
    return deserializeStaticArrayArray<T>(srcStart, srcEnd, dst);
  } else if (isManaged<valueof<T>>() || isReference<valueof<T>>()) {
    const type = changetype<nonnull<valueof<T>>>(0);
    if (isDefined(type.__DESERIALIZE)) {
      return deserializeStaticArrayStruct<T>(srcStart, srcEnd, dst);
    }
    throw new Error("Could not parse static array of type " + nameof<T>() + "!");
  } else {
    throw new Error("Could not parse static array of type " + nameof<T>() + "!");
  }
}
