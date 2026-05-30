import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { isSpace } from "../../../util";
import { ensureArrayElementSlot, ensureArrayField } from "./shared";


@inline function skipStructArrayWhitespace(
  srcStart: usize,
  srcEnd: usize,
): usize {
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  return srcStart;
}

// Per-element worker for `@json class Foo[]` fields. Each element is a
// managed reference whose value is produced by the transform-generated
// `__DESERIALIZE_FAST` / `__DESERIALIZE_SLOW` methods, so the loop pattern
// is structurally different from primitive-array bodies:
//
//   - The slot stores a *reference*; reused arrays may already hold an
//     allocated instance whose fields we just overwrite. Only allocate +
//     `__INITIALIZE` when the slot is null.
//   - `__DESERIALIZE_FAST` returns the cursor past the closing `}` on
//     success, or `0` to signal "bail to slow path". We mirror the
//     dispatcher in `JSON.__deserialize` here: try FAST first, fall back
//     to SLOW on `0`.
//   - Whitespace is skipped at each separator boundary so struct-array
//     fields tolerate the same `[ {...} , {...} ]` shape that top-level
//     `JSON.parse` does.
@inline function deserializeStructArrayBody<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
): usize {
  let index = 0;

  do {
    if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
    srcStart += 2;
    srcStart = skipStructArrayWhitespace(srcStart, srcEnd);
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      out.length = 0;
      return srcStart + 2;
    }

    while (srcStart < srcEnd) {
      const slot = ensureArrayElementSlot<T>(out, index);
      let value = load<valueof<T>>(slot);
      if (changetype<usize>(value) == 0) {
        value = changetype<valueof<T>>(
          __new(offsetof<nonnull<valueof<T>>>(), idof<nonnull<valueof<T>>>()),
        );
        // @ts-ignore: supplied by transform
        if (isDefined(changetype<nonnull<valueof<T>>>(value).__INITIALIZE)) {
          // @ts-ignore: supplied by transform
          changetype<nonnull<valueof<T>>>(value).__INITIALIZE();
        }
        store<valueof<T>>(slot, value);
      }

      let next: usize = 0;
      if (
        // @ts-ignore: supplied by transform
        isDefined(changetype<nonnull<valueof<T>>>(value).__DESERIALIZE_FAST)
      ) {
        // @ts-ignore: supplied by transform
        next = changetype<nonnull<valueof<T>>>(value).__DESERIALIZE_FAST<
          valueof<T>
        >(srcStart, srcEnd, value);
      }
      if (!next) {
        // @ts-ignore: supplied by transform
        next = changetype<nonnull<valueof<T>>>(value).__DESERIALIZE_SLOW<
          valueof<T>
        >(srcStart, srcEnd, value);
      }
      if (!next) break;
      srcStart = next;
      srcStart = skipStructArrayWhitespace(srcStart, srcEnd);
      if (srcStart >= srcEnd) break;

      const code = load<u16>(srcStart);
      if (code == COMMA) {
        srcStart += 2;
        srcStart = skipStructArrayWhitespace(srcStart, srcEnd);
        index++;
        continue;
      }
      if (code == BRACKET_RIGHT) {
        // Skip `ensureCapacity` when the reused array already has the
        // right length (e.g. canada-style geometry rings whose count
        // matches a previous parse).
        const nextLen = index + 1;
        if (out.length != nextLen) out.length = nextLen;
        return srcStart + 2;
      }
      break;
    }
  } while (false);

  throw new Error("Failed to parse JSON!");
}


@inline export function deserializeStructArrayField<T extends unknown[]>(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  return deserializeStructArrayBody<T>(
    srcStart,
    srcEnd,
    ensureArrayField<T>(fieldPtr),
  );
}
