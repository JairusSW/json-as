import { JSON } from "../../..";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import {
  ensureArrayElementSlot,
  ensureArrayField,
  scanValueEnd,
} from "./shared";


@inline function deserializeObjectArrayBody<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
): usize {
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
      const valueStart = srcStart;
      const valueEnd = scanValueEnd(valueStart, srcEnd);
      if (!valueEnd) break;

      const value = JSON.__deserialize<valueof<T>>(
        valueStart,
        valueEnd,
        changetype<usize>(load<valueof<T>>(slot)),
      );
      store<valueof<T>>(slot, value);
      srcStart = valueEnd;

      const code = load<u16>(srcStart);
      if (code == COMMA) {
        srcStart += 2;
        index++;
        continue;
      }
      if (code == BRACKET_RIGHT) {
        const nextLen = index + 1;
        if (out.length != nextLen) out.length = nextLen;
        return srcStart + 2;
      }
      break;
    }
  } while (false);

  throw new Error("Failed to parse JSON!");
}


@inline export function deserializeObjectArrayField<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  return deserializeObjectArrayBody<T>(
    srcStart,
    srcEnd,
    ensureArrayField<T>(fieldPtr),
  );
}
