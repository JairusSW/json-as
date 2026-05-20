import { deserializeObjectStructArrayInto, ensureArrayField } from "./shared";


@inline export function deserializeStructArrayInto<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
): usize {
  return deserializeObjectStructArrayInto<T>(srcStart, srcEnd, out);
}


@inline export function deserializeStructArrayField<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  return deserializeObjectStructArrayInto<T>(
    srcStart,
    srcEnd,
    ensureArrayField<T>(fieldPtr),
  );
}
