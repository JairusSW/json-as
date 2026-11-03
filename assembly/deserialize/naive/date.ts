import { deserializeString } from "../index/string";
import { takeProductionParseError } from "../error";
import { isSpace } from "../../util";

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

export function deserializeDate(
  srcStart: usize,
  srcEnd: usize,
  dst: usize = 0,
): Date {
  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;
  const text = deserializeString(srcStart, srcEnd);
  if (changetype<usize>(text) == 0) {
    takeProductionParseError();
    throw new Error("Expected a JSON date string");
  }
  const time = parseDateTime(text);

  // Return a new object instead of the one that the parser returned.
  // This may seem redundant, but it addresses the issue when Date
  // is globally aliased to wasi_Date (or some other superclass).
  if (dst) {
    const out = changetype<Date>(dst);
    out.setTime(time);
    return out;
  }
  return new Date(time);
}
