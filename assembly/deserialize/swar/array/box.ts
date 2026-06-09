import { JSON } from "../../..";
import { deserializeGenericArrayBody } from "./generic";
import { ensureArrayField } from "./shared";

export function deserializeBoxArrayField<T extends JSON.Box<any>[]>(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  return deserializeGenericArrayBody<T>(
    srcStart,
    srcEnd,
    ensureArrayField<T>(fieldPtr),
  );
}
