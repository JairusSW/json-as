import { deserializeStructArray_SWAR } from "../../swar/array/struct";

// Use the same quote-aware, bounds-taking worker as the public array path.
export function deserializeStructArray<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  return deserializeStructArray_SWAR<T>(srcStart, srcEnd, dst);
}
