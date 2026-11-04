import { deserializeString } from "../index/string";
import { takeProductionParseError } from "../error";
import { isSpace } from "../../util";

// A sentinel outside Date's representable millisecond range.
export const NON_CANONICAL_DATE: i64 = i64.MIN_VALUE;

/** Decode the serializer's ISO spelling without substring/token allocations.
 * Other spellings retain the ordinary Date parser's compatibility behavior. */
export function parseCanonicalDate(start: usize, end: usize): i64 {
  const length = <i32>((end - start) >> 1);
  let year = 0;
  let prefix = 0;
  let sign = 1;
  if (length == 27) {
    const code = load<u16>(start);
    if (code != 43 && code != 45) return NON_CANONICAL_DATE;
    sign = code == 45 ? -1 : 1;
    prefix = 3;
  } else if (length != 24) return NON_CANONICAL_DATE;
  const yearDigits = 4 + (prefix ? 2 : 0);
  for (let i = 0; i < yearDigits; i++) {
    const digit =
      <u32>load<u16>(start + ((<usize>(i + (prefix ? 1 : 0))) << 1)) - 48;
    if (digit > 9) return NON_CANONICAL_DATE;
    year = year * 10 + digit;
  }
  year *= sign;
  if (sign < 0 && year == 0) return NON_CANONICAL_DATE;
  const rest = start + ((<usize>(4 + prefix)) << 1);
  if (
    load<u16>(rest) != 45 ||
    load<u16>(rest + 6) != 45 ||
    load<u16>(rest + 12) != 84 ||
    load<u16>(rest + 18) != 58 ||
    load<u16>(rest + 24) != 58 ||
    load<u16>(rest + 30) != 46 ||
    load<u16>(rest + 38) != 90
  )
    return NON_CANONICAL_DATE;
  let month = 0,
    day = 0,
    hour = 0,
    minute = 0,
    second = 0,
    milli = 0;
  for (let i = 1; i < 19; i++) {
    if (i == 3 || i == 6 || i == 9 || i == 12 || i == 15) continue;
    const digit = <u32>load<u16>(rest + ((<usize>i) << 1)) - 48;
    if (digit > 9) return NON_CANONICAL_DATE;
    if (i < 3) month = month * 10 + digit;
    else if (i < 6) day = day * 10 + digit;
    else if (i < 9) hour = hour * 10 + digit;
    else if (i < 12) minute = minute * 10 + digit;
    else if (i < 15) second = second * 10 + digit;
    else milli = milli * 10 + digit;
  }
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return NON_CANONICAL_DATE;
  const leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
  const days =
    month == 2
      ? leap
        ? 29
        : 28
      : month == 4 || month == 6 || month == 9 || month == 11
        ? 30
        : 31;
  if (day > days) return NON_CANONICAL_DATE;
  // Date.UTC gives 0..99 the legacy 1900 offset. A full Gregorian cycle
  // preserves the calendar while keeping those years out of that special case.
  const shift = year >= 0 && year < 100;
  const time =
    Date.UTC(
      shift ? year + 400 : year,
      month - 1,
      day,
      hour,
      minute,
      second,
      milli,
    ) - (shift ? <i64>12622780800000 : 0);
  return time >= -8640000000000000 && time <= 8640000000000000
    ? time
    : NON_CANONICAL_DATE;
}

/** Stock AS 0.28 splits negative years on '-'. Handle the canonical signed
 * six-digit form emitted by toISOString before delegating other spellings. */
export function parseDateTime(text: string): i64 {
  if (
    text.length == 27 &&
    text.charCodeAt(0) == 45 &&
    text.charCodeAt(7) == 45 &&
    text.charCodeAt(10) == 45 &&
    text.charCodeAt(13) == 84 &&
    text.charCodeAt(26) == 90
  ) {
    let year = 0;
    for (let i = 1; i <= 6; i++) {
      const digit = text.charCodeAt(i) - 48;
      if (<u32>digit > 9) return Date.fromString(text).getTime();
      year = year * 10 + digit;
    }
    // Parse month/day/time in a leap year, then restore the signed year.
    const result = Date.fromString("2000" + text.substring(7));
    result.setUTCFullYear(-year);
    return result.getTime();
  }
  return Date.fromString(text).getTime();
}

export function deserializeDate<T extends Date = Date>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize = 0,
): T {
  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;
  let time = NON_CANONICAL_DATE;
  if (
    srcEnd >= srcStart + 4 &&
    load<u16>(srcStart) == 34 &&
    load<u16>(srcEnd - 2) == 34
  )
    time = parseCanonicalDate(srcStart + 2, srcEnd - 2);
  if (time == NON_CANONICAL_DATE) {
    const text = deserializeString(srcStart, srcEnd);
    if (changetype<usize>(text) == 0) {
      takeProductionParseError();
      throw new Error("Expected a JSON date string");
    }
    time = parseDateTime(text);
  }

  // Return a new object instead of the one that the parser returned.
  // This may seem redundant, but it addresses the issue when Date
  // is globally aliased to wasi_Date (or some other superclass).
  if (dst) {
    const out = changetype<T>(dst);
    out.setTime(time);
    return out;
  }
  return instantiate<T>(time);
}
