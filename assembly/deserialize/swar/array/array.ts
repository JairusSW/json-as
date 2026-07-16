import { JSON } from "../../..";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { deserializeFloatArrayBody } from "./float";
import { ensureArrayField, scanValueEnd, skipWhitespace } from "./shared";

export function deserializeArrayArrayBody<T extends unknown[][]>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
): usize {
  let index = 0;
  const reusableLength = out.length;
  const reusableDataStart = out.dataStart;
  const elementSize = sizeof<valueof<T>>();

  do {
    if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
    srcStart += 2;
    srcStart = skipWhitespace(srcStart, srcEnd);
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      out.length = 0;
      return srcStart + 2;
    }

    while (srcStart < srcEnd) {
      if (isFloat<valueof<valueof<T>>>()) {
        let value: valueof<T>;
        if (index < reusableLength) {
          value = load<valueof<T>>(
            reusableDataStart + <usize>index * elementSize,
          );
        } else {
          value = changetype<valueof<T>>(instantiate<valueof<T>>());
          out.push(value);
        }
        srcStart = deserializeFloatArrayBody<valueof<T>>(
          srcStart,
          srcEnd,
          value,
        );
        if (!srcStart || srcStart >= srcEnd) break;
      } else if (isArray<valueof<valueof<T>>>()) {
        let value: valueof<T>;
        if (index < reusableLength) {
          value = load<valueof<T>>(
            reusableDataStart + <usize>index * elementSize,
          );
        } else {
          value = changetype<valueof<T>>(instantiate<valueof<T>>());
          out.push(value);
        }
        srcStart = deserializeArrayArrayBody<valueof<T>>(
          srcStart,
          srcEnd,
          value,
        );
        if (!srcStart || srcStart >= srcEnd) break;
      } else {
        const valueEnd = scanValueEnd(srcStart, srcEnd);
        if (!valueEnd || valueEnd <= srcStart) break;

        let valuePtr: usize = 0;
        if (index < reusableLength) {
          valuePtr = changetype<usize>(
            load<valueof<T>>(reusableDataStart + <usize>index * elementSize),
          );
        }
        const value = JSON.__deserialize<valueof<T>>(
          srcStart,
          valueEnd,
          valuePtr,
        );
        if (index < reusableLength) {
          store<valueof<T>>(
            reusableDataStart + <usize>index * elementSize,
            value,
          );
        } else {
          out.push(value);
        }
        srcStart = valueEnd;
      }

      srcStart = skipWhitespace(srcStart, srcEnd);
      const code = load<u16>(srcStart);
      if (code == COMMA) {
        srcStart += 2;
        srcStart = skipWhitespace(srcStart, srcEnd);
        index++;
        continue;
      }
      if (code == BRACKET_RIGHT) {
        // Skip the runtime `ensureCapacity` call when the length is already
        // correct (the array is being reused with the same shape, e.g.
        // canada's geometry rings across repeated parses).
        const nextLen = index + 1;
        if (reusableLength != nextLen) out.length = nextLen;
        return srcStart + 2;
      }
      break;
    }
  } while (false);

  throw new Error("Failed to parse JSON!");
}

export function deserializeArrayArrayField<T extends unknown[][]>(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  return deserializeArrayArrayBody<T>(
    srcStart,
    srcEnd,
    ensureArrayField<T>(fieldPtr),
  );
}
