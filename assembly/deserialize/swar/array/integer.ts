import { deserializeIntegerArray_NAIVE } from "../../naive/array/integer";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../../custom/chars";
import { isSpace } from "../../../util";
import { ensureArrayElementSlot, ensureArrayField } from "./shared";
import { parse4Digits_PairMul } from "../../../util/swar-int";

// Store helpers parameterised on the element type `E` directly, so they
// serve both `Array<E>` and `TypedArray<E>` callers. The integer-array
// callers below all pass `valueof<T>` and AS folds the resulting tower of
// `sizeof<E>` comparisons at compile time — same codegen as the prior
// `T extends number[]` version, but reusable from `swar/typedarray.ts`.
@inline function storeSignedIntegerE<E extends number>(
  slot: usize,
  value: i64,
): void {
  if (sizeof<E>() == sizeof<i8>()) {
    store<i8>(slot, <i8>value);
  } else if (sizeof<E>() == sizeof<i16>()) {
    store<i16>(slot, <i16>value);
  } else if (sizeof<E>() == sizeof<i32>()) {
    store<i32>(slot, <i32>value);
  } else if (sizeof<E>() == sizeof<isize>()) {
    store<isize>(slot, <isize>value);
  } else {
    store<i64>(slot, value);
  }
}


@inline function storeUnsignedIntegerE<E extends number>(
  slot: usize,
  value: u64,
): void {
  if (sizeof<E>() == sizeof<u8>()) {
    store<u8>(slot, <u8>value);
  } else if (sizeof<E>() == sizeof<u16>()) {
    store<u16>(slot, <u16>value);
  } else if (sizeof<E>() == sizeof<u32>()) {
    store<u32>(slot, <u32>value);
  } else if (sizeof<E>() == sizeof<usize>()) {
    store<usize>(slot, <usize>value);
  } else {
    store<u64>(slot, value);
  }
}

// The four parse helpers below take a `slot` pointer (`writePtr`) and store
// the value directly via `store<valueof<T>>(slot, ...)`. The outer dispatcher
// owns the array's `out.length = maxElements` pre-allocation and the
// `writePtr` advance, so the per-element `Array.push` capacity check and
// length write are eliminated for every integer width, not just the u8/i8
// narrow-lane path.
// Parsers are also E-parameterised so they're shareable with
// `swar/typedarray.ts`. The body is byte-identical to the prior version
// modulo s/valueof<T>/E/.
@inline export function parseSignedIntegerScalar<E extends number>(
  srcStart: usize,
  srcEnd: usize,
  slot: usize,
): usize {
  let negative = false;
  let code = load<u16>(srcStart);
  if (code == 45) {
    negative = true;
    srcStart += 2;
    if (srcStart >= srcEnd) return 0;
    code = load<u16>(srcStart);
  }

  let digit = <u32>code - 48;
  if (digit > 9) return 0;

  let value: u64 = digit;
  srcStart += 2;
  while (srcStart < srcEnd) {
    digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }

  storeSignedIntegerE<E>(slot, negative ? -(<i64>value) : <i64>value);
  return srcStart;
}


@inline export function parseUnsignedIntegerScalar<E extends number>(
  srcStart: usize,
  srcEnd: usize,
  slot: usize,
): usize {
  let digit = <u32>load<u16>(srcStart) - 48;
  if (digit > 9) return 0;

  let value: u64 = digit;
  srcStart += 2;
  while (srcStart < srcEnd) {
    digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }

  storeUnsignedIntegerE<E>(slot, value);
  return srcStart;
}


@inline export function parseSignedIntegerSWAR<E extends number>(
  srcStart: usize,
  srcEnd: usize,
  slot: usize,
): usize {
  let negative = false;
  let code = load<u16>(srcStart);
  if (code == 45) {
    negative = true;
    srcStart += 2;
    if (srcStart >= srcEnd) return 0;
    code = load<u16>(srcStart);
  }

  let digit = <u32>code - 48;
  if (digit > 9) return 0;

  let value: u64 = digit;
  srcStart += 2;

  // Signed scan uses parse4 + scalar only (matches the asymmetric tuning in
  // swar/integer.ts:deserializeIntegerField_SWAR). The leading minus shifts
  // the digit run into parse8's "terminator-in-load" zone where validate-fail
  // is common, so parse4's smaller failure unit wins.
  //
  // i8 tops out at 3 digits (-128..127), so the 4-digit kernel can never fire
  // and the failing load + range check just burns cycles. Gate on the lane
  // width so AS folds the loop away at compile time.
  if (sizeof<E>() > 1) {
    while (srcStart + 6 < srcEnd) {
      const parsed = parse4Digits_PairMul(load<u64>(srcStart));
      if (parsed == U32.MAX_VALUE) break;
      value = value * 10000 + parsed;
      srcStart += 8;
    }
  }

  while (srcStart < srcEnd) {
    digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }

  storeSignedIntegerE<E>(slot, negative ? -(<i64>value) : <i64>value);
  return srcStart;
}


@inline export function parseUnsignedIntegerSWAR<E extends number>(
  srcStart: usize,
  srcEnd: usize,
  slot: usize,
): usize {
  // Narrow-type path mirrors the NAIVE structure: a tight scan loop to find
  // the element terminator, then a fixed-count fold with no per-digit break.
  // TurboFan tends to schedule this better than a single combined
  // scan-and-fold loop because the fold has no data-dependent exit.
  if (sizeof<E>() <= 2) {
    const first = <u32>load<u16>(srcStart) - 48;
    if (first > 9) return 0;
    const lastIndex = srcStart;
    srcStart += 2;
    while (srcStart < srcEnd) {
      const c = <u32>load<u16>(srcStart) - 48;
      if (c > 9) break;
      srcStart += 2;
    }
    let value: u64 = 0;
    let p = lastIndex;
    while (p < srcStart) {
      value = value * 10 + (<u32>load<u16>(p) - 48);
      p += 2;
    }
    storeUnsignedIntegerE<E>(slot, value);
    return srcStart;
  }

  let digit = <u32>load<u16>(srcStart) - 48;
  if (digit > 9) return 0;

  let value: u64 = digit;
  srcStart += 2;

  // Array unsigned path uses parse4 + scalar (not parse8 + scalar as in the
  // struct-field path swar/integer.ts:deserializeUnsignedField_SWAR). The
  // bench corpus for arrays mixes element widths (e.g. 1/4/7/10 digits in
  // u32-64mib), so most parse8 strides hit the `,` separator mid-load and
  // pay the load+validate cost for a guaranteed miss. parse4 has a smaller
  // failure unit and matches the typical 1-4 digit run between separators.
  while (srcStart + 6 < srcEnd) {
    const parsed = parse4Digits_PairMul(load<u64>(srcStart));
    if (parsed == U32.MAX_VALUE) break;
    value = value * 10000 + parsed;
    srcStart += 8;
  }

  while (srcStart < srcEnd) {
    digit = <u32>load<u16>(srcStart) - 48;
    if (digit > 9) break;
    value = value * 10 + digit;
    srcStart += 2;
  }

  storeUnsignedIntegerE<E>(slot, value);
  return srcStart;
}


@inline function skipIntegerArrayWhitespace(
  srcStart: usize,
  srcEnd: usize,
): usize {
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) {
    srcStart += 2;
  }
  return srcStart;
}

// @ts-ignore: Decorator valid here
export function deserializeIntegerArray_SLOW<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );
  let index = 0;

  out.length = 0;
  if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) {
    throw new Error("Failed to parse JSON!");
  }

  srcStart += 2;
  while (srcStart < srcEnd) {
    srcStart = skipIntegerArrayWhitespace(srcStart, srcEnd);
    if (srcStart >= srcEnd) break;

    let code = load<u16>(srcStart);
    if (code == BRACKET_RIGHT) return out;

    if (isSigned<valueof<T>>()) {
      let negative = false;
      if (code == 45) {
        negative = true;
        srcStart += 2;
        if (srcStart >= srcEnd) break;
        code = load<u16>(srcStart);
      }

      let digit = <u32>code - 48;
      if (digit > 9) break;

      let value: u64 = digit;
      srcStart += 2;
      while (srcStart < srcEnd) {
        digit = <u32>load<u16>(srcStart) - 48;
        if (digit > 9) break;
        value = value * 10 + digit;
        srcStart += 2;
      }

      storeSignedIntegerE<valueof<T>>(
        ensureArrayElementSlot<T>(out, index),
        negative ? -(<i64>value) : <i64>value,
      );
    } else {
      let digit = <u32>code - 48;
      if (digit > 9) break;

      let value: u64 = digit;
      srcStart += 2;
      while (srcStart < srcEnd) {
        digit = <u32>load<u16>(srcStart) - 48;
        if (digit > 9) break;
        value = value * 10 + digit;
        srcStart += 2;
      }

      storeUnsignedIntegerE<valueof<T>>(
        ensureArrayElementSlot<T>(out, index),
        value,
      );
    }

    index++;
    srcStart = skipIntegerArrayWhitespace(srcStart, srcEnd);
    if (srcStart >= srcEnd) break;

    code = load<u16>(srcStart);
    if (code == COMMA) {
      srcStart += 2;
      continue;
    }
    if (code == BRACKET_RIGHT) return out;
    break;
  }

  throw new Error("Failed to parse JSON!");
}


@inline function deserializeIntegerArrayImpl<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
  useSWAR: bool,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );
  const originalSrcStart = srcStart;
  const reusableLength = out.length;

  if (useSWAR && reusableLength != 0) {
    const dataStart = out.dataStart;
    let index = 0;

    do {
      if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
      srcStart += 2;
      if (srcStart >= srcEnd) break;
      if (load<u16>(srcStart) == BRACKET_RIGHT) {
        out.length = 0;
        return out;
      }

      if (isSigned<valueof<T>>()) {
        while (srcStart < srcEnd) {
          let negative = false;
          let code = load<u16>(srcStart);
          if (code == 45) {
            negative = true;
            srcStart += 2;
            if (srcStart >= srcEnd) break;
            code = load<u16>(srcStart);
          }

          let digit = <u32>code - 48;
          if (digit > 9) break;

          let value: u64 = digit;
          srcStart += 2;

          if (sizeof<valueof<T>>() > 1) {
            while (srcStart + 6 < srcEnd) {
              const parsed = parse4Digits_PairMul(load<u64>(srcStart));
              if (parsed == U32.MAX_VALUE) break;
              value = value * 10000 + parsed;
              srcStart += 8;
            }
          }

          while (srcStart < srcEnd) {
            digit = <u32>load<u16>(srcStart) - 48;
            if (digit > 9) break;
            value = value * 10 + digit;
            srcStart += 2;
          }

          if (index >= reusableLength) break;
          storeSignedIntegerE<valueof<T>>(
            dataStart + <usize>index * sizeof<valueof<T>>(),
            negative ? -(<i64>value) : <i64>value,
          );
          index++;
          if (srcStart >= srcEnd) break;

          code = load<u16>(srcStart);
          if (code == COMMA) {
            srcStart += 2;
            continue;
          }
          if (code == BRACKET_RIGHT) {
            out.length = index;
            return out;
          }
          break;
        }
      } else {
        while (srcStart < srcEnd) {
          let digit = <u32>load<u16>(srcStart) - 48;
          if (digit > 9) break;

          let value: u64 = digit;
          srcStart += 2;

          if (sizeof<valueof<T>>() > 1) {
            while (srcStart + 6 < srcEnd) {
              const parsed = parse4Digits_PairMul(load<u64>(srcStart));
              if (parsed == U32.MAX_VALUE) break;
              value = value * 10000 + parsed;
              srcStart += 8;
            }
          }

          while (srcStart < srcEnd) {
            digit = <u32>load<u16>(srcStart) - 48;
            if (digit > 9) break;
            value = value * 10 + digit;
            srcStart += 2;
          }

          if (index >= reusableLength) break;
          storeUnsignedIntegerE<valueof<T>>(
            dataStart + <usize>index * sizeof<valueof<T>>(),
            value,
          );
          index++;
          if (srcStart >= srcEnd) break;

          const code = load<u16>(srcStart);
          if (code == COMMA) {
            srcStart += 2;
            continue;
          }
          if (code == BRACKET_RIGHT) {
            out.length = index;
            return out;
          }
          break;
        }
      }
    } while (false);

    srcStart = originalSrcStart;
  }

  // Worst-case sizing: every element is at least 1 digit + 1 delimiter = 2
  // UTF-16 chars = 4 bytes. AS skips zero-fill on `length=` for unmanaged
  // primitive types (every concrete `valueof<T>` here is an integer), so the
  // over-allocation costs only a small amount of trimmed storage at the end.
  // The parse helpers below store through `writePtr` directly, eliminating
  // `Array.push`'s per-element capacity check + length write for every
  // integer width.
  const elementSize = sizeof<valueof<T>>();
  const maxElements = i32((<usize>(srcEnd - srcStart)) >> 2);
  if (maxElements > 0) out.length = maxElements;
  const dataStart = out.dataStart;
  let writePtr = dataStart;

  do {
    if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
    srcStart += 2;
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      out.length = 0;
      return out;
    }

    if (isSigned<valueof<T>>()) {
      while (srcStart < srcEnd) {
        const next = useSWAR
          ? parseSignedIntegerSWAR<valueof<T>>(srcStart, srcEnd, writePtr)
          : parseSignedIntegerScalar<valueof<T>>(srcStart, srcEnd, writePtr);
        if (!next) break;
        writePtr += elementSize;
        srcStart = next;
        if (srcStart >= srcEnd) break;

        const code = load<u16>(srcStart);
        if (code == COMMA) {
          srcStart += 2;
          continue;
        }
        if (code == BRACKET_RIGHT) {
          out.length = i32(<usize>(writePtr - dataStart) / elementSize);
          return out;
        }
        break;
      }
    } else {
      while (srcStart < srcEnd) {
        const next = useSWAR
          ? parseUnsignedIntegerSWAR<valueof<T>>(srcStart, srcEnd, writePtr)
          : parseUnsignedIntegerScalar<valueof<T>>(srcStart, srcEnd, writePtr);
        if (!next) break;
        writePtr += elementSize;
        srcStart = next;
        if (srcStart >= srcEnd) break;

        const code = load<u16>(srcStart);
        if (code == COMMA) {
          srcStart += 2;
          continue;
        }
        if (code == BRACKET_RIGHT) {
          out.length = i32(<usize>(writePtr - dataStart) / elementSize);
          return out;
        }
        break;
      }
    }
  } while (false);

  // Fast path bailed (whitespace, malformed numbers, etc). Hand off to the
  // SLOW path which resets `out.length` to 0 and re-parses from the original
  // input. The pre-allocated buffer is retained, so SLOW's per-element
  // `ensureArrayElementSlot` grows-or-reuses through the existing capacity.
  return deserializeIntegerArray_SLOW<T>(
    originalSrcStart,
    srcEnd,
    changetype<usize>(out),
  );
}

// @ts-ignore: Decorator valid here
export function deserializeIntegerArray_SWAR<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  // u8/i8 elements use a dedicated two-pass SWAR path: a 4-char-stride
  // comma counter pre-sizes the array so the parse pass can drop the
  // per-push capacity check and write through a direct pointer. The
  // wider-lane SWAR kernel never amortizes itself for narrow elements
  // (u8 max 3 digits) so we skip it entirely here.
  if (sizeof<valueof<T>>() <= 1) {
    return deserializeNarrowIntegerArray_SWAR<T>(srcStart, srcEnd, dst);
  }
  return deserializeIntegerArrayImpl<T>(srcStart, srcEnd, dst, true);
}

/**
 * Narrow-lane (u8/i8) integer-array deserializer.
 *
 * Two passes:
 *   1) SWAR comma counter (4 chars per stride, popcnt over the lane mask)
 *      sizes the array exactly so the parse pass can use unchecked stores.
 *   2) Walks the input NAIVE-style (skip non-digits, scan to separator,
 *      fold digits) but writes through a direct pointer, eliminating
 *      `Array.push`'s per-element capacity check and length write.
 *
 * V8 already auto-SIMDs NAIVE's scalar scan loop tighter than a hand-rolled
 * SWAR scan in pass 2, so we keep that pattern there and only pay SWAR cost
 * on the pre-count - which is a tight load-mask-popcnt loop where V8's
 * scalar code can't compete with the explicit 4-lane stride.
 */
function deserializeNarrowIntegerArray_SWAR<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
): T {
  const out = changetype<nonnull<T>>(
    dst || changetype<usize>(instantiate<T>()),
  );

  // Worst-case sizing: every element is at least 1 digit + 1 delimiter = 2
  // UTF-16 chars = 4 bytes, so the body inside `[...]` can't hold more than
  // `(srcEnd - srcStart) / 4` elements. AS skips zero-fill on `length=` for
  // unmanaged element types, so over-allocation is essentially free here
  // and saves a full SWAR pass over the input.
  const maxElements = i32((<usize>(srcEnd - srcStart)) >> 2);
  if (maxElements > 0) out.length = maxElements;
  const dataStart = out.dataStart;
  const elementSize = sizeof<valueof<T>>();
  let writePtr = dataStart;

  while (srcStart < srcEnd) {
    // Fast paths: 1-, 2-, or 3-digit unsigned element followed by `,` packs
    // into one u64 load (covers ~100% of the typical 0..255 cycle). Ordered
    // 3 -> 2 -> 1 because 3-digit values dominate any wide-range payload;
    // the 2- and 1-digit branches cover the rest of `out`.
    if (!isSigned<valueof<T>>() && srcStart + 6 < srcEnd) {
      const block = load<u64>(srcStart);
      if (((block >> 48) & 0xffff) == COMMA) {
        const digits = (block & 0x0000_00ff_00ff_00ff) - 0x0000_0030_0030_0030;
        const oor =
          (digits | (digits + 0x0000_0006_0006_0006)) & 0x0000_fff0_fff0_fff0;
        if (oor == 0) {
          const d0 = <u32>(digits & 0xffff);
          const d1 = <u32>((digits >> 16) & 0xffff);
          const d2 = <u32>((digits >> 32) & 0xffff);
          store<valueof<T>>(writePtr, <valueof<T>>(d0 * 100 + d1 * 10 + d2));
          writePtr += elementSize;
          srcStart += 8;
          continue;
        }
      } else if (((block >> 32) & 0xffff) == COMMA) {
        const digits = (block & 0x0000_0000_00ff_00ff) - 0x0000_0000_0030_0030;
        const oor =
          (digits | (digits + 0x0000_0000_0006_0006)) & 0x0000_0000_fff0_fff0;
        if (oor == 0) {
          const d0 = <u32>(digits & 0xffff);
          const d1 = <u32>((digits >> 16) & 0xffff);
          store<valueof<T>>(writePtr, <valueof<T>>(d0 * 10 + d1));
          writePtr += elementSize;
          srcStart += 6;
          continue;
        }
      } else if (((block >> 16) & 0xffff) == COMMA) {
        const d0 = <u32>(block & 0xffff) - 48;
        if (d0 <= 9) {
          store<valueof<T>>(writePtr, <valueof<T>>d0);
          writePtr += elementSize;
          srcStart += 4;
          continue;
        }
      }
    }
    const code = load<u16>(srcStart);
    if (<u32>code - 48 <= 9 || (isSigned<valueof<T>>() && code == 45)) {
      const lastIndex = srcStart;
      srcStart += 2;
      while (srcStart < srcEnd) {
        const c = load<u16>(srcStart);
        if (c == COMMA || c == BRACKET_RIGHT || isSpace(c)) {
          let value: u64 = 0;
          let p = lastIndex;
          if (isSigned<valueof<T>>() && load<u16>(p) == 45) {
            p += 2;
            while (p < srcStart) {
              value = value * 10 + (<u32>load<u16>(p) - 48);
              p += 2;
            }
            store<valueof<T>>(writePtr, <valueof<T>>-(<i64>value));
          } else {
            while (p < srcStart) {
              value = value * 10 + (<u32>load<u16>(p) - 48);
              p += 2;
            }
            store<valueof<T>>(writePtr, <valueof<T>>value);
          }
          writePtr += elementSize;
          break;
        }
        srcStart += 2;
      }
    }
    srcStart += 2;
  }

  out.length = i32(<usize>(writePtr - dataStart) / elementSize);
  return out;
}


@inline function deserializeIntegerArrayBody<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
): usize {
  let index = 0;

  do {
    if (srcStart >= srcEnd || load<u16>(srcStart) != BRACKET_LEFT) break;
    srcStart += 2;
    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;
    if (load<u16>(srcStart) == BRACKET_RIGHT) {
      out.length = 0;
      return srcStart + 2;
    }

    while (srcStart < srcEnd) {
      const slot = ensureArrayElementSlot<T>(out, index);
      // Inline the array-optimized SWAR parser directly. The top-level
      // (`deserializeIntegerArrayImpl`) and the typed-array path
      // (`swar/typedarray.ts`) already call these — having the field path
      // call them too means the per-element parser is identical across all
      // three call sites (parse4 + scalar fold for both signed and
      // unsigned, narrow-lane special case for i8/u8/i16/u16).
      //
      // Why not `deserializeUnsignedField_SWAR` (which uses parse8 + scalar)?
      // That tuning targets the struct-single-field path where the digit
      // run is one aligned token. In an array, mixed element widths cause
      // parse8 to fail-and-retry at element boundaries — see u32-64mib's
      // 23% regression when parse8 was tried in the array path.
      srcStart = isSigned<valueof<T>>()
        ? parseSignedIntegerSWAR<valueof<T>>(srcStart, srcEnd, slot)
        : parseUnsignedIntegerSWAR<valueof<T>>(srcStart, srcEnd, slot);
      if (!srcStart) break;
      while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
      if (srcStart >= srcEnd) break;

      const code = load<u16>(srcStart);
      if (code == COMMA) {
        srcStart += 2;
        while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
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


@inline export function deserializeIntegerArrayField<T extends number[]>(
  srcStart: usize,
  srcEnd: usize,
  fieldPtr: usize,
): usize {
  return deserializeIntegerArrayBody<T>(
    srcStart,
    srcEnd,
    ensureArrayField<T>(fieldPtr),
  );
}
