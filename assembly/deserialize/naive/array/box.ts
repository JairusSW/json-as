import { deserializeCustomArray } from "./generic";

export function deserializeBoxArray<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  return deserializeCustomArray<T>(srcStart, srcEnd, dst);
}
