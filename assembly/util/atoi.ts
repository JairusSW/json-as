/**
 * ATOI optimized for non-exponential integers
 * @param str
 * @returns
 */
// @ts-ignore: inline
@inline export function atoi<T>(srcStart: usize, srcEnd: usize): T {
  // @ts-ignore: type
  let val: T = 0;
  if (isSigned<T>()) {
    if (load<u16>(srcStart) == 45) {
      srcStart += 2;
      while (srcStart < srcEnd) {
        // @ts-ignore: type
        val = (val * 10 + (load<u16>(srcStart) - 48)) as T;
        srcStart += 2;
      }
      return -val as T;
    } else {
      while (srcStart < srcEnd) {
        // @ts-ignore: type
        val = (val * 10 + (load<u16>(srcStart) - 48)) as T;
        srcStart += 2;
      }
      return val as T;
    }
  } else {
    while (srcStart < srcEnd) {
      // @ts-ignore: type
      val = (val * 10 + (load<u16>(srcStart) - 48)) as T;
      srcStart += 2;
    }
    return val as T;
  }
}
