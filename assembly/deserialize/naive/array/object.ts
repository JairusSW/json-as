import { deserializeReferenceArray } from "./reference";

export function deserializeObjectArray<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  return deserializeReferenceArray<T>(srcStart, srcEnd, dst);
}
