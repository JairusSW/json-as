import { JSON } from "../../..";
import { deserializeGenericArrayBody } from "./generic";
import { ensureArrayField } from "./shared";

export function deserializeRawArrayField(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  return deserializeGenericArrayBody<JSON.Raw[]>(
    srcStart,
    srcEnd,
    ensureArrayField<JSON.Raw[]>(fieldPtr),
  );
}
