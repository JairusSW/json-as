import { JSON } from "../..";
import { BRACKET_LEFT, BRACKET_RIGHT, BRACE_LEFT, BRACE_RIGHT, CHAR_F, CHAR_T, COMMA, QUOTE } from "../../custom/chars";
import { isSpace, atoi, scanStringEnd } from "../../util";

// @ts-expect-error: Decorator valid here
@inline function scanSetElementEnd(srcStart: usize, srcEnd: usize): usize {
  const first = load<u16>(srcStart);

  if (first == QUOTE) {
    const end = scanStringEnd(srcStart, srcEnd);
    return end < srcEnd ? end + 2 : 0;
  }

  if (first == BRACE_LEFT || first == BRACKET_LEFT) {
    let depth: i32 = 1;
    let ptr = srcStart + 2;

    while (ptr < srcEnd) {
      const code = load<u16>(ptr);
      if (code == QUOTE) {
        ptr = scanStringEnd(ptr, srcEnd);
        if (ptr >= srcEnd) return 0;
      } else if (code == BRACE_LEFT || code == BRACKET_LEFT) {
        depth++;
      } else if (code == BRACE_RIGHT || code == BRACKET_RIGHT) {
        if (--depth == 0) return ptr + 2;
      }
      ptr += 2;
    }

    return 0;
  }

  let ptr = srcStart;
  while (ptr < srcEnd) {
    const code = load<u16>(ptr);
    if (code == COMMA || code == BRACKET_RIGHT) return ptr;
    ptr += 2;
  }

  return 0;
}

function deserializeSetDirect<T extends Set<any>>(srcStart: usize, srcEnd: usize, out: nonnull<T>, allowWhitespace: bool = false): usize {
  if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) throw new Error("Expected '[' at start of set");

  srcStart += 2;
  if (allowWhitespace) while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  if (srcStart >= srcEnd) throw new Error("Unterminated set");
  if (load<u16>(srcStart) == BRACKET_RIGHT) return srcStart + 2;

  while (srcStart < srcEnd) {
    if (allowWhitespace) while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    const code = load<u16>(srcStart);

    // @ts-ignore: type
    if (isString<indexof<T>>()) {
      if (code != QUOTE) break;
      const end = scanStringEnd(srcStart, srcEnd);
      if (end >= srcEnd) break;
      // @ts-ignore: type
      out.add(JSON.__deserialize<indexof<T>>(srcStart, end + 2));
      srcStart = end + 2;
      // @ts-ignore: type
    } else if (isBoolean<indexof<T>>()) {
      if (code == CHAR_T) {
        // @ts-ignore: type
        out.add(<indexof<T>>true);
        srcStart += 8;
      } else if (code == CHAR_F) {
        // @ts-ignore: type
        out.add(<indexof<T>>false);
        srcStart += 10;
      } else {
        break;
      }
      // @ts-ignore: type
    } else if (isInteger<indexof<T>>()) {
      if (code - 48 > 9 && code != 45) break;
      let ptr = srcStart + 2;
      while (ptr < srcEnd) {
        const next = load<u16>(ptr);
        if (next == COMMA || next == BRACKET_RIGHT || (allowWhitespace && isSpace(next))) break;
        ptr += 2;
      }
      // @ts-ignore: type
      out.add(atoi<indexof<T>>(srcStart, ptr));
      srcStart = ptr;
      // @ts-ignore: type
    } else if (isFloat<indexof<T>>()) {
      if (code - 48 > 9 && code != 45) break;
      let ptr = srcStart + 2;
      while (ptr < srcEnd) {
        const next = load<u16>(ptr);
        if (next == COMMA || next == BRACKET_RIGHT || (allowWhitespace && isSpace(next))) break;
        ptr += 2;
      }
      // @ts-ignore: type
      out.add(JSON.__deserialize<indexof<T>>(srcStart, ptr));
      srcStart = ptr;
      // @ts-ignore: type
    } else if (isManaged<indexof<T>>() || isReference<indexof<T>>()) {
      const end = scanSetElementEnd(srcStart, srcEnd);
      if (!end) break;
      // @ts-ignore: type
      out.add(JSON.__deserialize<indexof<T>>(srcStart, end));
      srcStart = end;
    } else {
      break;
    }

    if (allowWhitespace) while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;
    const next = load<u16>(srcStart);
    if (next == COMMA) {
      srcStart += 2;
      if (allowWhitespace) while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
      continue;
    }
    if (next == BRACKET_RIGHT) return srcStart + 2;
    break;
  }

  throw new Error("Failed to parse JSON!");
}

export function deserializeSet<T extends Set<any>>(srcStart: usize, srcEnd: usize, dst: usize): T {
  const out = changetype<nonnull<T>>(dst || changetype<usize>(instantiate<T>()));
  out.clear();

  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;

  if (srcStart >= srcEnd) throw new Error("Input string had zero length or was all whitespace");
  const end = deserializeSetDirect<T>(srcStart, srcEnd, out, true);
  if (end != srcEnd) throw new Error("Expected ']' at end of set");
  return out;
}

// @ts-expect-error: Decorator valid here
@inline export function deserializeSetField<T extends Set<any>>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  let out = load<T>(fieldPtr);
  if (!changetype<usize>(out)) {
    out = changetype<T>(instantiate<T>());
    store<T>(fieldPtr, out);
  } else {
    changetype<nonnull<T>>(out).clear();
  }
  return deserializeSetDirect<T>(srcStart, srcEnd, changetype<nonnull<T>>(out));
}
