import { BRACKET_LEFT, BRACKET_RIGHT, COMMA, FALSE_WORD_U64, TRUE_WORD_U64 } from "../../../custom/chars";
import { ensureArrayElementSlot, ensureArrayField } from "./shared";


@inline export function deserializeBooleanArrayInto<T extends boolean[]>(srcStart: usize, srcEnd: usize, out: T): usize {
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
      const block = load<u64>(srcStart);
      if (block == TRUE_WORD_U64) {
        store<valueof<T>>(slot, true);
        srcStart += 8;
      } else if (block == FALSE_WORD_U64) {
        store<valueof<T>>(slot, false);
        srcStart += 10;
      } else {
        break;
      }

      if (srcStart >= srcEnd) break;
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


@inline export function deserializeBooleanArrayField<T extends boolean[]>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  return deserializeBooleanArrayInto<T>(srcStart, srcEnd, ensureArrayField<T>(fieldPtr));
}
