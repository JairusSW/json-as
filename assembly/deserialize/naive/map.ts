import { JSON } from "../..";
import {
  COMMA,
  BRACE_LEFT,
  QUOTE,
  BRACE_RIGHT,
  COLON,
} from "../../custom/chars";
import { isSpace, scanStringEnd } from "../../util";
import { scanValueEnd } from "../../util/scanValueEnd";
import { lastValueEnd, parseValue } from "./object";

// @ts-ignore: Decorator is valid here
@inline function deserializeMapKey<T>(start: usize, end: usize): T {
  const keyText = JSON.__deserialize<string>(start - 2, end + 2);
  if (isString<T>()) return changetype<T>(keyText);
  return JSON.parse<T>(keyText);
}

export function deserializeMap<T extends Map<any, any>>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );

  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;

  if (srcStart - srcEnd == 0)
    throw new Error("Input string had zero length or was all whitespace");
  if (load<u16>(srcStart) != BRACE_LEFT)
    throw new Error(
      "Expected '{' at start of object at position " +
        (srcEnd - srcStart).toString(),
    );
  if (load<u16>(srcEnd - 2) != BRACE_RIGHT)
    throw new Error(
      "Expected '}' at end of object at position " +
        (srcEnd - srcStart).toString(),
    );

  deserializeMapBody<T>(srcStart, srcEnd, changetype<T>(out));
  return changetype<T>(out);
}

/**
 * Shared single-pass map-body parser used by both the top-level and struct-field
 * entry points. Dynamic `JSON.Value` values are parsed in one pass via
 * {@link parseValue}; typed values are bounds-scanned with {@link scanValueEnd}
 * because their generated deserializers take exact `(start, end)` bounds.
 */
// @ts-ignore: Decorator is valid here
@inline export function deserializeMapBody<T extends Map<any, any>>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
): usize {
  let arbitraryValue = false;
  if (isManaged<valueof<T>>() || isReference<valueof<T>>()) {
    // @ts-ignore: instanceof on the (reference) value type
    arbitraryValue = changetype<nonnull<valueof<T>>>(0) instanceof JSON.Value;
  }

  if (srcStart >= srcEnd || load<u16>(srcStart) != BRACE_LEFT)
    throw new Error("Failed to parse JSON!");
  srcStart += 2;
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  if (srcStart >= srcEnd) throw new Error("Failed to parse JSON!");
  if (load<u16>(srcStart) == BRACE_RIGHT) return srcStart + 2;

  while (srcStart < srcEnd) {
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (load<u16>(srcStart) != QUOTE) break;

    const keyStart = srcStart + 2;
    const keyEnd = scanStringEnd(srcStart, srcEnd);
    if (keyEnd >= srcEnd) break;

    srcStart = keyEnd + 2;
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd || load<u16>(srcStart) != COLON) break;
    srcStart += 2;
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;

    if (isReference<valueof<T>>() && arbitraryValue) {
      const val = parseValue(srcStart, srcEnd);
      // @ts-ignore: type — valueof<T> is JSON.Value in this branch
      changetype<nonnull<T>>(out).set(
        deserializeMapKey<indexof<T>>(keyStart, keyEnd),
        changetype<valueof<T>>(changetype<usize>(val)),
      );
      srcStart = lastValueEnd();
    } else {
      const valueEnd = scanValueEnd(srcStart, srcEnd);
      if (!valueEnd || valueEnd <= srcStart) break;
      // @ts-ignore: type
      changetype<nonnull<T>>(out).set(
        deserializeMapKey<indexof<T>>(keyStart, keyEnd),
        JSON.__deserialize<valueof<T>>(srcStart, valueEnd),
      );
      srcStart = valueEnd;
    }

    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;
    const code = load<u16>(srcStart);
    if (code == COMMA) {
      srcStart += 2;
      while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
      continue;
    }
    if (code == BRACE_RIGHT) return srcStart + 2;
    break;
  }

  throw new Error("Failed to parse JSON!");
}

// @ts-ignore: Decorator is valid here
@inline export function deserializeMapField<T extends Map<any, any>>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  const fieldPtr = dstObj + dstOffset;
  let out = load<T>(fieldPtr);
  if (!changetype<usize>(out)) {
    out = changetype<T>(instantiate<T>());
    store<T>(fieldPtr, out);
  } else {
    // Reusing an existing field map — clear it before repopulating. Fresh maps
    // (deserializeMap / deserializeMapArray) skip this.
    changetype<nonnull<T>>(out).clear();
  }
  return deserializeMapBody<T>(srcStart, srcEnd, out);
}
