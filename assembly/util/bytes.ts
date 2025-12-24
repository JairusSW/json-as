import { OBJECT, TOTAL_OVERHEAD } from "rt/common";

// @ts-ignore: Decorator valid here
@inline export function bytes<T>(o: T): i32 {
  if (isInteger<T>() || isFloat<T>()) {
    return sizeof<T>();
  } else if (isManaged<T>() || isReference<T>()) {
    return changetype<OBJECT>(changetype<usize>(o) - TOTAL_OVERHEAD).rtSize;
  } else {
    throw new Error("Cannot convert type " + nameof<T>() + " to bytes!");
  }
}
