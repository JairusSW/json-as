import { ensureArrayField } from "./shared";


@inline export function deserializeMapArrayField<T extends Map<any, any>[]>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  ensureArrayField<T>(fieldPtr);
  throw new Error("Failed to parse JSON!");
}
