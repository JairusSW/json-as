import { JSON } from "../../..";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { deserializeFloatArrayInto } from "./float";
import { ensureArrayField, scanValueEnd } from "./shared";


@inline function deserializeArrayArrayInto<T extends unknown[][]>(srcStart: usize, srcEnd: usize, out: T): usize {
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
      if (isFloat<valueof<valueof<T>>>()) {
        let value: valueof<T>;
        if (index < out.length) {
          value = unchecked(out[index]);
        } else {
          value = changetype<valueof<T>>(instantiate<nonnull<valueof<T>>>());
          out.push(value);
        }
        srcStart = deserializeFloatArrayInto<valueof<T>>(srcStart, srcEnd, value);
        if (!srcStart || srcStart >= srcEnd) break;
      } else if (isArray<valueof<valueof<T>>>()) {
        let value: valueof<T>;
        if (index < out.length) {
          value = unchecked(out[index]);
        } else {
          value = changetype<valueof<T>>(instantiate<nonnull<valueof<T>>>());
          out.push(value);
        }
        srcStart = deserializeArrayArrayInto<valueof<T>>(srcStart, srcEnd, value);
        if (!srcStart || srcStart >= srcEnd) break;
      } else {
        const valueEnd = scanValueEnd(srcStart, srcEnd);
        if (!valueEnd || valueEnd <= srcStart) break;

        let valuePtr: usize = 0;
        if (index < out.length) {
          valuePtr = changetype<usize>(unchecked(out[index]));
        }
        const value = JSON.__deserialize<valueof<T>>(srcStart, valueEnd, valuePtr);
        if (index < out.length) unchecked((out[index] = value));
        else out.push(value);
        srcStart = valueEnd;
      }

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


@inline export function deserializeArrayArrayField<T extends unknown[][]>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  return deserializeArrayArrayInto<T>(srcStart, srcEnd, ensureArrayField<T>(fieldPtr));
}
