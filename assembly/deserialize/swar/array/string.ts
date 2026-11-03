import {
  BRACKET_LEFT,
  BRACKET_RIGHT,
  COMMA,
  NULL_WORD_U64,
} from "../../../custom/chars";
import { isSpace } from "../../../util";
import { ensureArrayElementSlot, ensureArrayField } from "./shared";
import { deserializeStringField_SWAR } from "../string";
import { markProductionParseError } from "../../error";

function skipStringArrayWhitespace(srcStart: usize, srcEnd: usize): usize {
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  return srcStart;
}

function deserializeStringArrayBody<T extends string[]>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
  nullable: bool,
): usize {
  let index = 0;
  // Reused struct fields normally retain their array backing store. Cache the
  // original slot range so the common path avoids an Array.length load and
  // growth branch for every string.
  const reusableLength = load<i32>(
    changetype<usize>(out),
    offsetof<T>("length_"),
  );
  const reusableDataStart = out.dataStart;
  const elementSize = sizeof<valueof<T>>();

  do {
    if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
    srcStart += 2;
    srcStart = skipStringArrayWhitespace(srcStart, srcEnd);
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      out.length = 0;
      return srcStart + 2;
    }

    while (srcStart < srcEnd) {
      const slot =
        index < reusableLength
          ? reusableDataStart + <usize>index * elementSize
          : ensureArrayElementSlot<T>(out, index);
      // Only nullable element types accept a null token.
      if (srcStart + 8 <= srcEnd && load<u64>(srcStart) == NULL_WORD_U64) {
        if (!nullable) break;
        store<usize>(slot, 0);
        srcStart += 8;
      } else {
        srcStart = deserializeStringField_SWAR<valueof<T>>(
          srcStart,
          srcEnd,
          slot,
        );
      }
      if (!srcStart) break;
      srcStart = skipStringArrayWhitespace(srcStart, srcEnd);
      if (srcStart >= srcEnd) break;

      const code = load<u16>(srcStart);
      if (code == COMMA) {
        srcStart += 2;
        srcStart = skipStringArrayWhitespace(srcStart, srcEnd);
        index++;
        continue;
      }
      if (code == BRACKET_RIGHT) {
        const nextLen = index + 1;
        if (reusableLength != nextLen) out.length = nextLen;
        return srcStart + 2;
      }
      break;
    }
  } while (false);

  markProductionParseError();
  return 0;
}

export function deserializeStringArrayField<T extends string[]>(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
  nullable: bool = false,
): usize {
  return deserializeStringArrayBody<T>(
    srcStart,
    srcEnd,
    ensureArrayField<T>(fieldPtr),
    nullable,
  );
}

// Root arrays use the same geometric growth policy as field arrays. Token
// byte lengths do not predict element counts, especially for long strings.
export function deserializeStringArray_SWAR<T extends string[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
  nullable: bool = false,
): T {
  const out = changetype<T>(dst || changetype<usize>(instantiate<T>()));
  const next = deserializeStringArrayBody<T>(srcStart, srcEnd, out, nullable);
  if (!next || skipStringArrayWhitespace(next, srcEnd) != srcEnd) {
    markProductionParseError();
    return changetype<T>(0);
  }
  return out;
}
