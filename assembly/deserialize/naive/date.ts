import { deserializeString } from "../index/string";
import { takeProductionParseError } from "../error";
import { isSpace } from "../../util";

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
  const d = Date.fromString(text);

  // Return a new object instead of the one that the parser returned.
  // This may seem redundant, but it addresses the issue when Date
  // is globally aliased to wasi_Date (or some other superclass).
  if (dst) {
    const out = changetype<Date>(dst);
    out.setTime(d.getTime());
    return out;
  }
  return new Date(d.getTime());
}
