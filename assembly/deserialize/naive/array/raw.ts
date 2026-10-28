import { deserializeGenericArray } from "./generic";

// Raw values need exact JSON token ranges, including null and nested values.
export function deserializeRawArray<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  return deserializeGenericArray<T>(srcStart, srcEnd, dst);
}
