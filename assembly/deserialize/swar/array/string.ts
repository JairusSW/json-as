import {
  BRACKET_LEFT,
  BRACKET_RIGHT,
  COMMA,
  NULL_WORD_U64,
} from "../../../custom/chars";
import { isSpace } from "../../../util";
import { ensureArrayElementSlot, ensureArrayField } from "./shared";
import { deserializeStringField_SWAR } from "../string";

function skipStringArrayWhitespace(srcStart: usize, srcEnd: usize): usize {
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
  return srcStart;
}

function deserializeStringArrayBody<T extends string[]>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
): usize {
  let index = 0;
  // Reused struct fields normally retain their array backing store. Cache the
  // original slot range so the common path avoids an Array.length load and
  // growth branch for every string.
  const reusableLength = out.length;
  const reusableDataStart = out.dataStart;
  const elementSize = sizeof<valueof<T>>();

  do {
    if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
    srcStart += 2;
    srcStart = skipStringArrayWhitespace(srcStart, srcEnd);
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      out.length = 0;
      return srcStart + 2;
    }

    while (srcStart < srcEnd) {
      const slot =
        index < reusableLength
          ? reusableDataStart + <usize>index * elementSize
          : ensureArrayElementSlot<T>(out, index);
      // Null fast path for `(string | null)[]`. "null" is 4 UTF-16 chars
      // = 8 bytes, exactly one u64 compare. Store 0 (the AS null reference)
      // and skip 8 bytes.
      //
      // We accept null tokens unconditionally rather than gating on
      // `isNullable<valueof<T>>()` - AS's `valueof` of a nullable-array
      // element type doesn't always preserve the nullable marker through
      // the dispatcher's `<T>` cast, so the gate would mis-fire for the
      // very case it's meant to handle. The runtime cost on plain
      // `string[]` arrays is one extra u64 compare per element; a
      // well-formed `string[]` input never matches it.
      if (srcStart + 8 <= srcEnd && load<u64>(srcStart) == NULL_WORD_U64) {
        store<usize>(slot, 0);
        srcStart += 8;
      } else {
        srcStart = deserializeStringField_SWAR<valueof<T>>(
          srcStart,
          srcEnd,
          slot,
        );
      }
      if (!srcStart) break;
      srcStart = skipStringArrayWhitespace(srcStart, srcEnd);
      if (srcStart >= srcEnd) break;

      const code = load<u16>(srcStart);
      if (code == COMMA) {
        srcStart += 2;
        srcStart = skipStringArrayWhitespace(srcStart, srcEnd);
        index++;
        continue;
      }
      if (code == BRACKET_RIGHT) {
        const nextLen = index + 1;
        if (out.length != nextLen) out.length = nextLen;
        return srcStart + 2;
      }
      break;
    }
  } while (false);

  throw new Error("Failed to parse JSON!");
}

export function deserializeStringArrayField<T extends string[]>(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  return deserializeStringArrayBody<T>(
    srcStart,
    srcEnd,
    ensureArrayField<T>(fieldPtr),
  );
}

// Top-level entry for `JSON.parse<string[]>` / `JSON.parse<(string | null)[]>`.
//
// Pre-grows the destination array to a worst-case bound in one allocation,
// then writes elements via `writePtr` direct stores. This sidesteps the
// per-element growth cost of `deserializeStringArrayBody`'s
// `ensureArrayElementSlot` path. The incremental runtime zero-initializes
// new allocations, so `null` slots need no per-element store on cold
// arrays (we still write 0 to handle reused arrays whose old refs would
// otherwise leak through).
export function deserializeStringArray_SWAR<T extends string[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );

  // Worst-case sizing: shortest possible element is `""` followed by `,` =
  // 6 UTF-16 bytes, so `(srcLen + 5) / 6` upper-bounds the count. Clamp to
  // AS's BLOCK_MAXSIZE / sizeof<string ref> = (1<<28) - 4 elements; payloads
  // that exceed this would fail the `out.length =` setter anyway. For a
  // 1 GiB UTF-16 source that maxes at ~256M slot allocation = ~1 GiB.
  const elementSize: usize = sizeof<usize>();
  const maxBlockElements: i32 = i32((<usize>0x40000000 - 16) / elementSize);
  let maxElements: i32 = i32((<usize>(srcEnd - srcStart) + 5) / 6);
  if (maxElements < 0 || maxElements > maxBlockElements) {
    maxElements = maxBlockElements;
  }
  if (out.length < maxElements) out.length = maxElements;

  const dataStart: usize = out.dataStart;
  let writePtr: usize = dataStart;
  const writePtrLimit: usize = dataStart + <usize>maxElements * elementSize;

  // Caller guarantees srcStart is at the opening `[`.
  if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) {
    out.length = 0;
    return out;
  }
  srcStart += 2;
  srcStart = skipStringArrayWhitespace(srcStart, srcEnd);
  if (srcStart < srcEnd && load<u16>(srcStart) == BRACKET_RIGHT) {
    out.length = 0;
    return out;
  }

  while (srcStart < srcEnd && writePtr < writePtrLimit) {
    // Null fast path: one u64 compare.
    if (srcStart + 8 <= srcEnd && load<u64>(srcStart) == NULL_WORD_U64) {
      store<usize>(writePtr, 0);
      srcStart += 8;
    } else {
      srcStart = deserializeStringField_SWAR<valueof<T>>(
        srcStart,
        srcEnd,
        writePtr,
      );
      if (!srcStart) break;
    }
    writePtr += elementSize;
    srcStart = skipStringArrayWhitespace(srcStart, srcEnd);
    if (srcStart >= srcEnd) break;

    const code = load<u16>(srcStart);
    if (code == COMMA) {
      srcStart += 2;
      srcStart = skipStringArrayWhitespace(srcStart, srcEnd);
      continue;
    }
    if (code == BRACKET_RIGHT) {
      const finalLen = i32(<usize>(writePtr - dataStart) / elementSize);
      if (out.length != finalLen) out.length = finalLen;
      return out;
    }
    break;
  }

  throw new Error("Failed to parse JSON!");
}
