import { BRACKET_LEFT, BRACKET_RIGHT } from "../../../custom/chars";
import { JSON } from "../../../";
import { parseArrayBody } from "../object";

export function deserializeArrayArray<T extends unknown[][]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );

  // Compile-time: is each inner array a dynamic JSON.Value[] (vs a typed array)?
  let arbitraryInner = false;
  if (isManaged<valueof<valueof<T>>>() || isReference<valueof<valueof<T>>>()) {
    // @ts-ignore: instanceof on the (reference) inner element type
    arbitraryInner =
      changetype<nonnull<valueof<valueof<T>>>>(0) instanceof JSON.Value;
  }

  srcStart += 2; // skip the outer '['

  if (isReference<valueof<valueof<T>>>() && arbitraryInner) {
    // Single-pass: each inner `[...]` is a JSON.Value[] parsed in one scan
    // (this also correctly skips ']' inside strings, unlike the depth scan).
    while (srcStart < srcEnd) {
      if (load<u16>(srcStart) == BRACKET_LEFT) {
        const inner = instantiate<JSON.Value[]>();
        srcStart = parseArrayBody(inner, srcStart + 2, srcEnd);
        // @ts-ignore: valueof<T> is JSON.Value[] in this branch
        out.push(changetype<valueof<T>>(changetype<usize>(inner)));
      } else {
        srcStart += 2;
      }
    }
    return out;
  }

  // Typed inner arrays: scan each element's bounds, then hand the exact range
  // to its generated (bounds-taking) deserializer.
  let lastIndex: usize = 0;
  let depth: u32 = 0;
  while (srcStart < srcEnd - 2) {
    const code = load<u16>(srcStart);
    if (code == BRACKET_LEFT && depth++ == 0) {
      lastIndex = srcStart;
    } else if (code == BRACKET_RIGHT && --depth == 0) {
      out.push(JSON.__deserialize<valueof<T>>(lastIndex, srcStart + 2));
    }
    srcStart += 2;
  }
  return out;
}
