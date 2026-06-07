import { JSON } from "../../..";
import { deserializeGenericArrayBody } from "./generic";
import { ensureArrayField } from "./shared";

export function deserializeArbitraryArrayField(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  return deserializeGenericArrayBody<JSON.Value[]>(
    srcStart,
    srcEnd,
    ensureArrayField<JSON.Value[]>(fieldPtr),
  );
}
