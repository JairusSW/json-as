/** Scientific Notation Integer Parsing - SNIP
 * This is absolutely the fastest algorithm I could think of while adding full support for Scientific Notation
 * Loads 32 bits and retrieves the high/low bits.
 * The reason why we only load 4 bytes at a time is that numbers in the 32-bit range are 7 chars long at most.
 * Using SIMD or 64 bit loads would only work well when parsing large 128+ numbers.
 *
 * Here are some benchmarks
 * Parsing: "12345"
 * Results are spread over 5000ms
 *
 * SNIP: 270M iterations
 * ATOI: 285M iterations
 * ParseInt: 176M iterations
 *
 * @param str - Any number. Can include scientific notation.
 */
// @ts-ignore: Decorator
@inline export function snip_fast<T extends number>(str: string, len: u32 = 0, offset: u32 = 0): T {
  if (isSigned<T>()) {
    const firstChar: u32 = load<u16>(changetype<usize>(str));
    if (firstChar == 48) return 0 as T;
    const isNegative = firstChar == 45; // Check if the number is negative
    let val: T = 0 as T;
    if (len == 0) len = u32(str.length << 1);
    if (isNegative) {
      offset += 2;
      if (len >= 4) {
        // 32-bit route
        for (; offset < len - 3; offset += 4) {
          const ch = load<u32>(changetype<usize>(str) + <usize>offset);
          const low = ch & 0xffff;
          const high = ch >> 16;
          // 9 is 57. The highest group of two numbers is 114, so if a e or an E is included, this will fire.
          if (low > 57) {
            // The first char (f) is E or e
            // We push the offset up by two and apply the notation.
            if (load<u16>(changetype<usize>(str) + <usize>offset + 2) == 45) {
              return -(val / 10 ** (__atoi_fast<u32>(str, offset + 6, offset + 8) - 1)) as T;
            } else {
              // Inlined this operation instead of using a loop
              return -(val * 10 ** (__atoi_fast<u32>(str, offset + 2, offset + 4) + 1)) as T;
            }
          } else if (high > 57) {
            // The first char (f) is E or e
            // We push the offset up by two and apply the notation.
            if (load<u16>(changetype<usize>(str) + <usize>offset + 4) == 45) {
              return -(val / 10 ** (__atoi_fast<u32>(str, offset + 6, offset + 8) - 1)) as T;
            } else {
              // Inlined this operation instead of using a loop
              return -(val * 10 ** (__atoi_fast<u32>(str, offset + 4, offset + 6) + 1)) as T;
            }
          } else {
            val = (val * 100 + (low - 48) * 10 + (high - 48)) as T;
          }
        }
      }
      // Finish up the remainder with 16 bits.
      for (; offset < len; offset += 2) {
        const ch = load<u16>(changetype<usize>(str) + <usize>offset);
        // 9 is 57. E and e are larger. Assumes valid JSON.
        if (ch > 57) {
          // The first char (f) is E or e
          // We push the offset up by two and apply the notation.
          if (load<u16>(changetype<usize>(str) + <usize>offset + 2) == 45) {
            return -(val / 10 ** (__atoi_fast<u32>(str, offset + 6, offset + 8) - 1)) as T;
          } else {
            // Inlined this operation instead of using a loop
            return -(val * 10 ** (__atoi_fast<u32>(str, offset + 2, offset + 4) + 1)) as T;
          }
        } else {
          val = (val * 10 + (ch - 48)) as T;
        }
      }
      return -val as T;
    } else {
      if (len >= 4) {
        // Duplet 16 bit lane load
        for (; offset < len - 3; offset += 4) {
          const ch = load<u32>(changetype<usize>(str) + <usize>offset);
          const low = ch & 0xffff;
          const high = ch >> 16;
          // 9 is 57. The highest group of two numbers is 114, so if a e or an E is included, this will fire.
          if (low > 57) {
            // The first char (f) is E or e
            // We push the offset up by two and apply the notation.
            if (load<u16>(changetype<usize>(str) + <usize>offset + 2) == 45) {
              return (val / 10 ** (__atoi_fast<u32>(str, offset + 6, offset + 8) - 1)) as T;
            } else {
              // Inlined this operation instead of using a loop
              return (val * 10 ** (__atoi_fast<u32>(str, offset + 2, offset + 4) + 1)) as T;
            }
          } else if (high > 57) {
            if (load<u16>(changetype<usize>(str) + <usize>offset + 4) == 45) {
              return (val / 10 ** (__atoi_fast<u32>(str, offset + 6, offset + 8) - 1)) as T;
            } else {
              // Inlined this operation instead of using a loop
              return (val * 10 ** (__atoi_fast<u32>(str, offset + 4, offset + 6) + 1)) as T;
            }
          } else {
            // Optimized with multiplications and shifts.
            val = (val * 100 + (low - 48) * 10 + (high - 48)) as T;
          }
        }
      }
      // Cover the remaining numbers with 16 bit loads.
      for (; offset < len; offset += 2) {
        const ch = load<u16>(changetype<usize>(str) + <usize>offset);
        // 0's char is 48 and 9 is 57. Anything above this range would signify an exponent (e or E).
        // e is 101 and E is 69.
        if (ch > 57) {
          if (load<u16>(changetype<usize>(str) + <usize>offset + 2) == 45) {
            val = (val / 10 ** (__atoi_fast<u32>(str, offset + 6, offset + 8) - 1)) as T;
          } else {
            // Inlined this operation instead of using a loop
            val = (val * 10 ** (__atoi_fast<u32>(str, offset + 2, offset + 4) + 1)) as T;
          }
          return val as T;
        } else {
          val = (val * 10 + (ch - 48)) as T;
        }
      }
      return val as T;
    }
  } else {
    const firstChar: u32 = load<u16>(changetype<usize>(str));
    if (firstChar == 48) return 0 as T;
    let val: T = 0 as T;
    if (len == 0) len = u32(str.length << 1);
    if (len >= 4) {
      // Duplet 16 bit lane load
      for (; offset < len - 3; offset += 4) {
        const ch = load<u32>(changetype<usize>(str) + <usize>offset);
        const low = ch & 0xffff;
        const high = ch >> 16;
        // 9 is 57. The highest group of two numbers is 114, so if a e or an E is included, this will fire.
        if (low > 57) {
          // The first char (f) is E or e
          // We push the offset up by two and apply the notation.
          if (load<u16>(changetype<usize>(str) + <usize>offset + 2) == 45) {
            return (val / 10 ** (__atoi_fast<u32>(str, offset + 6, offset + 8) - 1)) as T;
          } else {
            // Inlined this operation instead of using a loop
            return (val * 10 ** (__atoi_fast<u32>(str, offset + 2, offset + 4) + 1)) as T;
          }
        } else if (high > 57) {
          if (load<u16>(changetype<usize>(str) + <usize>offset + 4) == 45) {
            return (val / 10 ** (__atoi_fast<u32>(str, offset + 6, offset + 8) - 1)) as T;
          } else {
            // Inlined this operation instead of using a loop
            return (val * 10 ** (__atoi_fast<u32>(str, offset + 4, offset + 6) + 1)) as T;
          }
        } else {
          // Optimized with multiplications and shifts.
          val = (val * 100 + (low - 48) * 10 + (high - 48)) as T;
        }
      }
    }
    // Cover the remaining numbers with 16 bit loads.
    for (; offset < len; offset += 2) {
      const ch = load<u16>(changetype<usize>(str) + <usize>offset);
      // 0's char is 48 and 9 is 57. Anything above this range would signify an exponent (e or E).
      // e is 101 and E is 69.
      if (ch > 57) {
        if (load<u16>(changetype<usize>(str) + <usize>offset + 2) == 45) {
          return (val / 10 ** (__atoi_fast<u32>(str, offset + 6, offset + 8) - 1)) as T;
        } else {
          // Inlined this operation instead of using a loop
          return (val * 10 ** (__atoi_fast<u32>(str, offset + 2, offset + 4) + 1)) as T;
        }
      } else {
        val = (val * 10 + (ch - 48)) as T;
      }
    }
    return val as T;
  }
}

/**
 * Implementation of ATOI. Can be much much faster with SIMD.
 */

// @ts-ignore
@inline export function __atoi_fast<T extends number>(str: string, start: u32 = 0, end: u32 = 0): T {
  // @ts-ignore
  let val: T = 0;
  if (!end) end = start + u32(str.length << 1);
  if (isSigned<T>()) {
    // Negative path
    if (load<u16>(changetype<usize>(str) + <usize>start) == 45) {
      start += 2;
      for (; start < end; start += 2) {
        val = (val * 10 + (load<u16>(changetype<usize>(str) + <usize>start) - 48)) as T;
      }
      return -val as T;
    } else {
      for (; start < end; start += 2) {
        val = (val * 10 + (load<u16>(changetype<usize>(str) + <usize>start) - 48)) as T;
      }
      return val as T;
    }
  } else {
    for (; start < end; start += 2) {
      val = (val * 10 + (load<u16>(changetype<usize>(str) + <usize>start) - 48)) as T;
    }
    return val as T;
  }
}

/**
 * Parses an integer using __atoi_fast and applies the appended exponential number to it as scientific notation.
 * Benchmark: Hovers around 30m ops/s
 * Only safe if the string is valid.
 * @param str integer to parse. example: 123e1, 123e-1, 123E100
 * @returns
 */

// @ts-ignore
@inline export function parseSciInteger<T extends number>(str: string): T {
  // @ts-ignore
  let val: T = 0;
  let offset = 0;
  let firstChar = load<u16>(changetype<usize>(str) + <usize>offset);
  if (firstChar == 45) {
    offset = 2;
  }
  for (; offset < str.length << 1; offset += 2) {
    const char = load<u16>(changetype<usize>(str) + <usize>offset);
    if (char == 101 || char == 69) {
      const char = load<u16>(changetype<usize>(str) + <usize>(offset += 2));
      if (char == 45) {
        // @ts-ignore
        val /= sciNote<T>(__atoi_fast<T>(str, (offset += 2)));
        // @ts-ignore
        return val;
      } else {
        // @ts-ignore
        val *= sciNote<T>(__atoi_fast<T>(str, offset));
        // @ts-ignore
        return val;
      }
    }
    // @ts-ignore
    val = (val << 1) + (val << 3) + (char - 48);
    // We use load because in this case, there is no need to have bounds-checking
  }
  if (firstChar == 45) {
    val = -val as T;
  }
  return val;
}

// @ts-ignore
@inline function sciNote<T extends number>(num: T): T {
  let res = 1;
  // @ts-ignore
  if (num > 0) {
    for (let i: T = <T>0; i < num; i++) {
      res *= 10;
    }
  } else {
    for (let i: T = <T>0; i < num; i++) {
      res /= 10;
    }
  }
  // @ts-ignore
  return res;
}

// @ts-ignore
@inline export function containsCodePoint(str: string, code: u32, start: i32, end: i32): bool {
  for (let i = start; i <= end; i++) {
    if (unsafeCharCodeAt(str, i) == code) return true;
  }
  return false;
}

// @ts-ignore: Decorator
@inline export function _intTo16(int: i32): i32 {
  if (int < 10) {
    // 0-10
    return 48 + int;
  } else {
    // a-f
    return 87 + int;
  }
}

// @ts-ignore: Decorator
@inline export function intTo16(int: i32): i32 {
  const high = int >> 4;
  const low = int & 0x0f;
  if (low < 10) {
    if (high < 10) {
      return ((48 + low) << 16) | (48 + high);
    } else {
      return ((48 + low) << 16) | (87 + high);
    }
  } else {
    if (high < 10) {
      return ((87 + low) << 16) | (48 + high);
    } else {
      return ((87 + low) << 16) | (87 + high);
    }
  }
}

// @ts-ignore: Decorator valid here
@inline export function nextPowerOf2(n: u32): u32 {
  return 1 << (32 - clz(n - 1));
}
