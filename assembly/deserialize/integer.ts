import { atoi } from "../util/atoi";

// @ts-ignore: inline
@inline export function deserializeInteger<T>(srcStart: usize, srcEnd: usize): T {
  return atoi<T>(srcStart, srcEnd);
}

// @ts-ignore: inline
@inline export function deserializeIntegerField<T extends number>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  let negative = false;
  if (load<u16>(srcStart) == 45) {
    negative = true;
    srcStart += 2;
    if (srcStart >= srcEnd) unreachable();
  }

  let digit = <u32>load<u16>(srcStart) - 48;
  if (digit > 9) unreachable();

  let value: u64 = digit;
  srcStart += 2;
  while (srcStart < srcEnd) {
    digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }

  if (sizeof<T>() == sizeof<i8>()) {
    store<i8>(fieldPtr, negative ? -(<i8>value) : <i8>value);
  } else if (sizeof<T>() == sizeof<i16>()) {
    store<i16>(fieldPtr, negative ? -(<i16>value) : <i16>value);
  } else if (sizeof<T>() == sizeof<i32>()) {
    store<i32>(fieldPtr, negative ? -(<i32>value) : <i32>value);
  } else if (sizeof<T>() == sizeof<isize>()) {
    store<isize>(fieldPtr, negative ? -(<isize>value) : <isize>value);
  } else {
    store<i64>(fieldPtr, negative ? -(<i64>value) : <i64>value);
  }

  return srcStart;
}
