import { COMMA, BRACKET_LEFT, BRACKET_RIGHT } from "../../custom/chars";
import { deserializeFloat_NAIVE } from "./float";
import { atoi, isSpace } from "../../util";
import {
  validateJSONIntegerToken,
  validateJSONNumberToken,
  validateJSONNumberTokenLoose,
} from "../../util/validateJson";
import { markProductionParseError } from "../error";

function validateLooseIntegerToken(ptr: usize, end: usize, signed: bool): bool {
  if (ptr < end && load<u16>(ptr) == 45) {
    if (!signed) return false;
    ptr += 2;
  }
  const digitStart = ptr;
  while (ptr < end && <u32>(load<u16>(ptr) - 48) <= 9) ptr += 2;
  return ptr > digitStart && ptr == end;
}

function isValidTypedArrayToken<T extends ArrayLike<number>>(
  start: usize,
  end: usize,
): bool {
  if (changetype<T>(0) instanceof Uint8ClampedArray || isFloat<valueof<T>>()) {
    return JSON_STRICT
      ? validateJSONNumberToken(start, end)
      : validateJSONNumberTokenLoose(start, end);
  }
  return JSON_STRICT
    ? validateJSONIntegerToken(start, end, isSigned<valueof<T>>())
    : validateLooseIntegerToken(start, end, isSigned<valueof<T>>());
}

// Validate the complete root and count elements before allocating or mutating
// a destination. Returns -1 on malformed input.
function countTypedArrayElements<T extends ArrayLike<number>>(
  srcStart: usize,
  srcEnd: usize,
): i32 {
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  while (srcEnd > srcStart && isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;
  if (
    srcStart >= srcEnd ||
    load<u16>(srcStart) != BRACKET_LEFT ||
    load<u16>(srcEnd - 2) != BRACKET_RIGHT
  )
    return -1;

  srcStart += 2;
  srcEnd -= 2;
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  if (srcStart == srcEnd) return 0;

  let count = 0;
  while (true) {
    const tokenStart = srcStart;
    while (srcStart < srcEnd) {
      const code = load<u16>(srcStart);
      if (code == COMMA || isSpace(code)) break;
      srcStart += 2;
    }
    if (
      srcStart == tokenStart ||
      !isValidTypedArrayToken<T>(tokenStart, srcStart)
    )
      return -1;
    count++;

    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart == srcEnd) return count;
    if (load<u16>(srcStart) != COMMA) return -1;
    srcStart += 2;
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart == srcEnd) return -1;
  }
  return -1;
}

function populateTypedArray<T extends ArrayLike<number>>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
  count: i32,
): void {
  srcStart += 2;
  for (let index = 0; index < count; index++) {
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    const tokenStart = srcStart;
    while (srcStart < srcEnd) {
      const code = load<u16>(srcStart);
      if (code == COMMA || code == BRACKET_RIGHT || isSpace(code)) break;
      srcStart += 2;
    }

    if (changetype<T>(0) instanceof Uint8ClampedArray) {
      unchecked(
        (changetype<Uint8ClampedArray>(out)[index] = <i32>(
          max<f64>(
            0,
            min<f64>(255, deserializeFloat_NAIVE<f64>(tokenStart, srcStart)),
          )
        )),
      );
    } else if (isFloat<valueof<T>>()) {
      unchecked(
        (out[index] = deserializeFloat_NAIVE<valueof<T>>(tokenStart, srcStart)),
      );
    } else {
      unchecked((out[index] = atoi<valueof<T>>(tokenStart, srcStart)));
    }

    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (index + 1 < count) srcStart += 2;
  }
}

export function deserializeTypedArray_NAIVE<T extends ArrayLike<number>>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize = 0,
): T {
  const count = countTypedArrayElements<T>(srcStart, srcEnd);
  if (count < 0) {
    markProductionParseError();
    return changetype<T>(0);
  }
  let out = changetype<T>(dst || changetype<usize>(instantiate<T>(count)));
  if (out.length != count) out = changetype<T>(instantiate<T>(count));
  populateTypedArray<T>(srcStart, srcEnd, out, count);
  return out;
}

export function deserializeArrayBuffer_NAIVE(
  srcStart: usize,
  srcEnd: usize,
  dst: usize = 0,
): ArrayBuffer {
  const count = countTypedArrayElements<Uint8Array>(srcStart, srcEnd);
  if (count < 0) {
    markProductionParseError();
    return changetype<ArrayBuffer>(0);
  }
  let out = dst ? changetype<ArrayBuffer>(dst) : new ArrayBuffer(count);
  if (out.byteLength != count) out = new ArrayBuffer(count);

  const outStart = changetype<usize>(out);
  srcStart += 2;
  for (let index = 0; index < count; index++) {
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    const tokenStart = srcStart;
    while (srcStart < srcEnd) {
      const code = load<u16>(srcStart);
      if (code == COMMA || code == BRACKET_RIGHT || isSpace(code)) break;
      srcStart += 2;
    }
    store<u8>(outStart + index, atoi<u8>(tokenStart, srcStart));
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (index + 1 < count) srcStart += 2;
  }
  return out;
}
