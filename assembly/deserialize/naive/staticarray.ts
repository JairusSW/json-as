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
