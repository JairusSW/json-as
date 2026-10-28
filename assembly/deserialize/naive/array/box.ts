import { deserializeGenericArray } from "./generic";

export function deserializeBoxArray<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  return deserializeGenericArray<T>(srcStart, srcEnd, dst);
}
