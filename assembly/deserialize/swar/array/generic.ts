import { JSON } from "../../..";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { ensureArrayElementSlot, ensureArrayField, scanValueEnd } from "./shared";

@inline export function deserializeGenericArrayInto<T extends unknown[]>(srcStart: usize, srcEnd: usize, out: T): usize {

  if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) throw new Error("Failed to parse JSON!");
  srcStart += 2;
  if (srcStart >= srcEnd) throw new Error("Failed to parse JSON!");
  if (load<u16>(srcStart) == BRACKET_RIGHT) return srcStart + 2;

  let index = 0;

  while (srcStart < srcEnd) {
    const valueEnd = scanValueEnd(srcStart, srcEnd);
    if (!valueEnd || valueEnd <= srcStart) break;

    const slot = ensureArrayElementSlot<T>(out, index++);
    store<valueof<T>>(slot, JSON.__deserialize<valueof<T>>(srcStart, valueEnd));
    srcStart = valueEnd;

    if (srcStart >= srcEnd) break;
    const code = load<u16>(srcStart);
    if (code == COMMA) {
      srcStart += 2;
      continue;
    }
    if (code == BRACKET_RIGHT) {
      out.length = index;
      return srcStart + 2;
    }
    break;
  }

  throw new Error("Failed to parse JSON!");
}

@inline export function deserializeGenericArrayField<T extends unknown[]>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  return deserializeGenericArrayInto<T>(srcStart, srcEnd, ensureArrayField<T>(fieldPtr));
}
