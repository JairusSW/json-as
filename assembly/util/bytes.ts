import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { STRING_SIZE_MASK } from "./runtime";

export function bytes<T>(o: T): i32 {
  if (isInteger<T>() || isFloat<T>()) {
    return sizeof<T>();
  } else if (isManaged<T>() || isReference<T>()) {
    const size = changetype<OBJECT>(
      changetype<usize>(o) - TOTAL_OVERHEAD,
    ).rtSize;
    return isString<nonnull<T>>() ? size & STRING_SIZE_MASK : size;
  } else {
    throw new Error("Cannot convert type " + nameof<T>() + " to bytes!");
  }
}
