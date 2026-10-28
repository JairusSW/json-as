import { deserializeReferenceArray } from "./reference";

export function deserializeMapArray<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  return deserializeReferenceArray<T>(srcStart, srcEnd, dst);
}
