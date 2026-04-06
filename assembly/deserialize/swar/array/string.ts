import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { ensureArrayElementSlot, ensureArrayField } from "./shared";
import { deserializeStringField_SWAR } from "../string";


@inline export function deserializeStringArrayInto<T extends string[]>(srcStart: usize, srcEnd: usize, out: T): usize {
  let index = 0;

  do {
    if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
    srcStart += 2;
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      out.length = 0;
      return srcStart + 2;
    }

    while (srcStart < srcEnd) {
      const slot = ensureArrayElementSlot<T>(out, index);
      srcStart = deserializeStringField_SWAR<valueof<T>>(srcStart, srcEnd, slot);
      if (!srcStart || srcStart >= srcEnd) break;

      const code = load<u16>(srcStart);
      if (code == COMMA) {
        srcStart += 2;
        index++;
        continue;
      }
      if (code == BRACKET_RIGHT) {
        out.length = index + 1;
        return srcStart + 2;
      }
      break;
    }
  } while (false);

  throw new Error("Failed to parse JSON!");
}

@inline export function deserializeStringArrayField<T extends string[]>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  return deserializeStringArrayInto<T>(srcStart, srcEnd, ensureArrayField<T>(fieldPtr));
}
