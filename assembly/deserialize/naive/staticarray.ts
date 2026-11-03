import { deserializeStructArrayBody } from "../swar/array/struct";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { isSpace } from "../../util";
import { reuseComposite } from "../parseMode";
import { resizeStaticArray } from "../../util/resizeStaticArray";
import { deserializeArray as deserializeReferenceArray } from "../index/array";
import { deserializeStaticArrayString } from "./staticarray/string";
import { deserializeStaticArrayBoolean } from "./staticarray/bool";
import { deserializeStaticArrayFloat } from "./staticarray/float";
import { deserializeStaticArrayInteger } from "./staticarray/integer";
import { scanValueEnd } from "../../util/scanValueEnd";

function materializeStaticArray<T extends StaticArray<any>>(
  src: valueof<T>[],
  dst: usize,
): T {
  if (changetype<usize>(src) == 0) return changetype<T>(0);
  const len = src.length;
  const typed = resizeStaticArray<T>(dst, len);
  for (let i = 0; i < len; i++) {
    unchecked((typed[i] = unchecked(src[i])));
  }
  return typed;
}

export function deserializeStaticArray<T extends StaticArray<any>>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  if (isString<valueof<T>>()) {
    return deserializeStaticArrayString<T>(srcStart, srcEnd, dst);
  } else if (isBoolean<valueof<T>>()) {
    return deserializeStaticArrayBoolean<T>(srcStart, srcEnd, dst);
  } else if (isInteger<valueof<T>>()) {
    return deserializeStaticArrayInteger<T>(srcStart, srcEnd, dst);
  } else if (isFloat<valueof<T>>()) {
    return deserializeStaticArrayFloat<T>(srcStart, srcEnd, dst);
  } else if (isManaged<valueof<T>>() || isReference<valueof<T>>()) {
    const existing = changetype<T>(dst);
    const type = changetype<nonnull<valueof<T>>>(0);
    // Cold paths and callback-capable types preserve ordinary element dispatch.
    // A live instance supplies metadata without null virtual dispatch.
    if (
      isDefined(type.__DESERIALIZE_REUSE_PURE) &&
      !isDefined(type.__DESERIALIZE_CUSTOM)
    ) {
      if (dst && existing.length != 0) {
        let eligible = false;
        for (let i = 0; i < existing.length; i++) {
          const value = unchecked(existing[i]);
          if (!changetype<usize>(value)) continue;
          if (
            changetype<OBJECT>(changetype<usize>(value) - TOTAL_OVERHEAD)
              .rtId != idof<nonnull<valueof<T>>>()
          ) {
            eligible = false;
            break;
          }
          if (
            !changetype<nonnull<valueof<T>>>(value).__DESERIALIZE_REUSE_PURE()
          ) {
            eligible = false;
            break;
          }
          eligible = true;
        }
        if (eligible) {
          const length = countReferenceElements(srcStart, srcEnd);
          if (length < 0) throw new Error("Failed to parse JSON!");
          const out = resizeStaticArray<T>(dst, length);
          const next = deserializeStructArrayBody<T>(srcStart, srcEnd, out);
          let end = next;
          while (end < srcEnd && isSpace(load<u16>(end))) end += 2;
          if (!next || end != srcEnd) throw new Error("Failed to parse JSON!");
          return out;
        }
      }
    }
    // Share representation precedence and supported element types with Array.
    return materializeStaticArray<T>(
      deserializeReferenceArray<valueof<T>[]>(srcStart, srcEnd, 0),
      dst,
    );
  }
  throw new Error("Could not parse static array of type " + nameof<T>() + "!");
}

export function deserializeStaticArrayField<T extends StaticArray<any>>(
  srcStart: usize,
  srcEnd: usize,
  dstObj: usize,
  dstOffset: usize = 0,
): usize {
  const valueEnd = scanValueEnd(srcStart, srcEnd);
  if (!valueEnd) throw new Error("Failed to parse JSON!");

  const fieldPtr = dstObj + dstOffset;
  const out = deserializeStaticArray<T>(
    srcStart,
    valueEnd,
    reuseComposite(load<usize>(fieldPtr), fieldPtr),
  );
  store<T>(fieldPtr, out);
  return valueEnd;
}

// Structural counting never invokes element codecs or initializes child models.
function countReferenceElements(start: usize, end: usize): i32 {
  while (end > start && isSpace(load<u16>(end - 2))) end -= 2;
  if (end < start + 4 || load<u16>(start) != 91 || load<u16>(end - 2) != 93)
    return -1;
  let ptr = start + 2;
  let count = 0;
  while (ptr < end && isSpace(load<u16>(ptr))) ptr += 2;
  if (ptr == end - 2) return 0;
  while (ptr < end - 2) {
    const next = scanValueEnd(ptr, end - 2);
    if (!next || next <= ptr) return -1;
    count++;
    ptr = next;
    while (ptr < end && isSpace(load<u16>(ptr))) ptr += 2;
    if (ptr == end - 2) return count;
    if (load<u16>(ptr) != 44) return -1;
    ptr += 2;
    while (ptr < end && isSpace(load<u16>(ptr))) ptr += 2;
    if (ptr >= end - 2) return -1;
  }
  return -1;
}
