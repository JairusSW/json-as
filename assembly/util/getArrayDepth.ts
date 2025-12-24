/**
 * A terrible function which ascertains the depth of a certain array
 * Depending on the optimization level, this can be essentially nop
 * @returns depth of array
 */

// @ts-ignore: Decorator
export function getArrayDepth<T extends ArrayLike>(depth: i32 = 1): i32 {
  if (!isArray<T>()) {
    return 0;
  } else if (isArray<valueof<T>>()) {
    depth++;
    return getArrayDepth<valueof<T>>(depth);
  } else {
    return depth;
  }
}
