import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { ensureArrayElementSlot, ensureArrayField } from "./shared";


@inline export function deserializeObjectArrayInto<T extends unknown[]>(srcStart: usize, srcEnd: usize, out: T): usize {
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
        value = changetype<valueof<T>>(__new(offsetof<nonnull<valueof<T>>>(), idof<nonnull<valueof<T>>>()));
        // @ts-ignore: supplied by transform
        if (isDefined(changetype<nonnull<valueof<T>>>(value).__INITIALIZE)) {
          // @ts-ignore: supplied by transform
          changetype<nonnull<valueof<T>>>(value).__INITIALIZE();
        }
        store<valueof<T>>(slot, value);
      }

      const valueStart = srcStart;
      // @ts-ignore: supplied by transform
      if (isDefined(changetype<nonnull<valueof<T>>>(value).__DESERIALIZE_FAST)) {
        // @ts-ignore: supplied by transform
        srcStart = changetype<nonnull<valueof<T>>>(value).__DESERIALIZE_FAST<valueof<T>>(valueStart, srcEnd, value);
      } else {
        // @ts-ignore: supplied by transform
        srcStart = changetype<nonnull<valueof<T>>>(value).__DESERIALIZE_SLOW<valueof<T>>(valueStart, srcEnd, value);
      }
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

@inline export function deserializeObjectArrayField<T extends unknown[]>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  return deserializeObjectArrayInto<T>(srcStart, srcEnd, ensureArrayField<T>(fieldPtr));
}
