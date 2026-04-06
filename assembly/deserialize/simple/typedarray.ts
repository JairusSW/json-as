import { COMMA, BRACKET_RIGHT } from "../../custom/chars";
import { deserializeFloat } from "./float";
import { atoi, isSpace } from "../../util";


@inline function countTypedArrayElements(srcStart: usize, srcEnd: usize): i32 {
  let count = 0;

  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (code - 48 <= 9 || code == 45) {
      count++;
      srcStart += 2;

      while (srcStart < srcEnd) {
        const code = load<u16>(srcStart);
        if (code == COMMA || code == BRACKET_RIGHT || isSpace(code)) break;
        srcStart += 2;
      }
    }

    srcStart += 2;
  }

  return count;
}

export function deserializeTypedArray<T extends ArrayLike<number>>(srcStart: usize, srcEnd: usize, dst: usize = 0): T {
  const count = countTypedArrayElements(srcStart, srcEnd);
  let out = changetype<T>(dst || changetype<usize>(instantiate<T>(count)));

  if (out.length != count) {
    out = changetype<T>(instantiate<T>(count));
  }

  let index = 0;
  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (code - 48 <= 9 || code == 45) {
      const lastIndex = srcStart;
      srcStart += 2;

      while (srcStart < srcEnd) {
        const code = load<u16>(srcStart);
        if (code == COMMA || code == BRACKET_RIGHT || isSpace(code)) {
          if (isFloat<valueof<T>>()) {
            unchecked((out[index++] = deserializeFloat<valueof<T>>(lastIndex, srcStart)));
          } else {
            unchecked((out[index++] = atoi<valueof<T>>(lastIndex, srcStart)));
          }
          break;
        }
        srcStart += 2;
      }
    }

    srcStart += 2;
  }

  return out;
}

export function deserializeArrayBuffer(srcStart: usize, srcEnd: usize, dst: usize = 0): ArrayBuffer {
  const count = countTypedArrayElements(srcStart, srcEnd);
  let out = dst ? changetype<ArrayBuffer>(dst) : new ArrayBuffer(count);

  if (out.byteLength != count) {
    out = new ArrayBuffer(count);
  }

  const outStart = changetype<usize>(out);
  let index: usize = 0;

  while (srcStart < srcEnd) {
    const code = load<u16>(srcStart);
    if (code - 48 <= 9 || code == 45) {
      const lastIndex = srcStart;
      srcStart += 2;

      while (srcStart < srcEnd) {
        const code = load<u16>(srcStart);
        if (code == COMMA || code == BRACKET_RIGHT || isSpace(code)) {
          store<u8>(outStart + index++, atoi<u8>(lastIndex, srcStart));
          break;
        }
        srcStart += 2;
      }
    }

    srcStart += 2;
  }

  return out;
}
