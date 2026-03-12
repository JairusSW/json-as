import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { ensureArrayElementSlot, ensureArrayField } from "./shared";


@inline export function deserializeObjectArrayField<T extends unknown[]>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  const out = ensureArrayField<T>(fieldPtr);
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
      let value = load<valueof<T>>(slot);
      if (changetype<usize>(value) == 0) {
        value = changetype<valueof<T>>(instantiate<nonnull<valueof<T>>>());
        store<valueof<T>>(slot, value);
      }

      srcStart = changetype<nonnull<valueof<T>>>(value).__DESERIALIZE<valueof<T>>(srcStart, srcEnd, value);
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
