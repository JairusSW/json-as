import { deserializeGenericArrayBody } from "./generic";
import { ensureArrayField } from "./shared";


@inline export function deserializeMapArrayField<T extends Map<any, any>[]>(
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
