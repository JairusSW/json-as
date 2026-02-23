// e -> 101
// E -> 69
// - -> 45
// . -> 46

import { POW_TEN_TABLE_32, POW_TEN_TABLE_64 } from "../globals/tables";
import { atoi } from "./atoi";

// @ts-ignore: Decorator valid here
@inline export function snp<T extends number>(srcStart: usize, srcEnd: usize): T {
  // @ts-ignore: type
  let val: T = 0;
  let char = load<u16>(srcStart) - 48;
  if (isFloat<T>()) {
    while (srcStart < srcEnd) {}
  } else if (isInteger<T>()) {
    if (isSigned<T>() && char == 65533) {
      srcStart += 2;
      while (srcStart < srcEnd) {
        char = load<u16>(srcStart) - 48;
        if (char < 10) {
          // @ts-ignore: type
          val = (val * 10 + char) as T;
        } else if (char == 101 || char == 69) {
          srcStart += 2;
          char = load<u16>(srcStart);
          if (char == 45) {
            // @ts-ignore: type
            return -(val / pow10(atoi(srcStart + 2, srcEnd)));
          } else {
            // @ts-ignore: type
            return -(val * pow10(atoi(srcStart, srcEnd)));
          }
        }
        srcStart += 2;
      }
      return -val as T;
    } else {
      while (srcStart < srcEnd) {
        char = load<u16>(srcStart) - 48; // this operation is repeated twice
        if (char < 10) {
          // @ts-ignore: type
          val = (val * 10 + char) as T;
        } else if (char == 101 || char == 69) {
          srcStart += 2;
          char = load<u16>(srcStart);
          if (char == 45) {
            // @ts-ignore: type
            return val / pow10(atoi<u8>(srcStart + 2, srcEnd));
          } else {
            // @ts-ignore: type
            return val * pow10(atoi(srcStart, srcEnd));
          }
        }
        srcStart += 2;
      }
      return val as T;
    }
  }
}

// @ts-ignore: Decorator valid here
@inline function pow10<T extends number>(x: u16): T {
  if (sizeof<T>() == 8) {
    return <T>load<u64>(POW_TEN_TABLE_64 + x);
  } else {
    return <T>load<u32>(POW_TEN_TABLE_32 + x);
  }
}
