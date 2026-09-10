// SWAR-mode TypedArray / ArrayBuffer deserializer.
//
// The naive variant in `../naive/typedarray.ts` does two scalar passes
// (count digit-starts, then call `JSON.__deserialize` per element which
// re-scans the same digits). This rewrite replaces both passes:
//
//   - **No count pass.** Narrow lanes use their non-amplifying source upper
//     bound. Wider lanes start from a capped buffer and grow geometrically,
//     then `__renew` to the exact byte count. Whitespace therefore cannot
//     multiply source size into a large speculative allocation.
//
//   - **Inline parse.** The integer parsers come from `./array/integer.ts`
//     (refactored to take element type `E` so the same
//     `parseSignedIntegerSWAR` serves `Array<i32>` and `Int32Array`).
//     The float parser comes from `./array/float.ts`. Stores write
//     directly to `dataStart + index * elementSize`, bypassing the
//     typed-array's bounds-checked `[]=` setter.

import { isSpace } from "../../util";
import { BRACKET_LEFT, BRACKET_RIGHT, COMMA } from "../../custom/chars";
import { parseFloatElementSWAR } from "./array/float";
import {
  parseSignedIntegerSWAR,
  parseUnsignedIntegerSWAR,
} from "./array/integer";
import { markProductionParseError } from "../error";

/**
 * SWAR TypedArray deserializer.
 *
 * Counts commas (with empty-body detection), allocates the typed array
 * at the exact size, then parses each element inline with no per-call
 * function dispatch. Stores write directly to `dataStart + idx *
 * elementSize`, bypassing the typed-array's bounds-checked `[]=` setter.
 *
 * Falls through to the underlying SWAR float / integer parsers; the
 * element type (`f32/f64/u8/i32/...`) is detected via `isFloat<E>()` /
 * `isSigned<E>()` and AS folds the type dispatch at compile time.
 */
export function deserializeTypedArray_SWAR<T extends ArrayLike<number>>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize = 0,
): T {
  // Find the opening `[`, then skip whitespace to the first non-WS char.
  while (srcStart < srcEnd) {
    const ch = load<u16>(srcStart);
    if (ch == BRACKET_LEFT) {
      srcStart += 2;
      break;
    }
    srcStart += 2;
  }
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;

  // Empty-array fast path.
  if (srcStart >= srcEnd || load<u16>(srcStart) == BRACKET_RIGHT) {
    let out = changetype<T>(dst || changetype<usize>(instantiate<T>(0)));
    if (out.length != 0) out = changetype<T>(instantiate<T>(0));
    return out;
  }

  const elementSize = sizeof<valueof<T>>();
  const sourceBound = i32((<usize>(srcEnd - srcStart)) >> 2) + 1;
  // One- and two-byte lanes cannot allocate more output bytes than the source
  // itself, even at the densest valid encoding. Wider lanes are capped at a
  // 64 KiB initial buffer so whitespace cannot multiply attacker-controlled
  // input into a large speculative allocation.
  const initialLimit =
    elementSize <= 2 ? sourceBound : i32(65_536 / elementSize);
  const initialCapacity =
    sourceBound < initialLimit ? sourceBound : initialLimit;
  let out = changetype<T>(
    dst || changetype<usize>(instantiate<T>(initialCapacity)),
  );
  let capacity = out.length;
  if (capacity == 0) {
    capacity = initialCapacity > 0 ? initialCapacity : 1;
    out = changetype<T>(instantiate<T>(capacity));
  }

  let dataStart = out.dataStart;
  let writePtr = dataStart;

  // Parse loop. Each element parses into the slot at `writePtr`, then
  // the separator (`,` or `]`) is consumed. Whitespace surrounding the
  // separator is skipped to match the naive variant's behaviour.
  while (srcStart < srcEnd) {
    const count = i32(<usize>(writePtr - dataStart) / elementSize);
    if (count == capacity) {
      if (capacity > i32.MAX_VALUE >> 1) {
        markProductionParseError();
        return changetype<T>(0);
      }
      const nextCapacity = capacity << 1;
      const grown = changetype<T>(instantiate<T>(nextCapacity));
      memory.copy(grown.dataStart, dataStart, <usize>capacity * elementSize);
      out = grown;
      capacity = nextCapacity;
      dataStart = out.dataStart;
      writePtr = dataStart + <usize>count * elementSize;
    }

    let next: usize = 0;
    if (isFloat<valueof<T>>()) {
      next = parseFloatElementSWAR<valueof<T>>(srcStart, srcEnd, writePtr);
    } else if (isSigned<valueof<T>>()) {
      next = parseSignedIntegerSWAR<valueof<T>>(srcStart, srcEnd, writePtr);
    } else {
      next = parseUnsignedIntegerSWAR<valueof<T>>(srcStart, srcEnd, writePtr);
    }
    if (!next) {
      markProductionParseError();
      return changetype<T>(0);
    }
    writePtr += elementSize;
    srcStart = next;
    if (srcStart >= srcEnd) break;

    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;
    const ch = load<u16>(srcStart);
    if (ch == COMMA) {
      srcStart += 2;
      while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
      continue;
    }
    if (ch == BRACKET_RIGHT) break;
    break;
  }

  // Trim to actual count. `out.length =` on a typed-array isn't legal
  // (length is read-only), so we shrink the underlying ArrayBufferView
  // directly: `__renew` the buffer to the actual byte length and
  // update the view's `byteLength` and `dataStart`. AS's TypedArray
  // structure has `buffer`, `dataStart` (= buffer), `byteLength`
  // (capacity in bytes) in that order - same layout as ArrayBufferView.
  const actualCount = i32(<usize>(writePtr - dataStart) / elementSize);
  if (actualCount != capacity) {
    const actualBytes = <usize>actualCount * elementSize;
    const oldBuffer = changetype<ArrayBuffer>(
      load<usize>(changetype<usize>(out)),
    );
    const newBuffer = __renew(changetype<usize>(oldBuffer), actualBytes);
    // Update buffer, dataStart, byteLength on the view.
    store<usize>(changetype<usize>(out), newBuffer);
    store<usize>(
      changetype<usize>(out),
      newBuffer,
      offsetof<ArrayBufferView>("dataStart"),
    );
    store<i32>(
      changetype<usize>(out),
      i32(actualBytes),
      offsetof<ArrayBufferView>("byteLength"),
    );
    __link(changetype<usize>(out), newBuffer, false);
  }

  return out;
}

/**
 * SWAR ArrayBuffer deserializer. JSON encoding is `[u8, u8, ...]` so
 * elements are always 1-3 ASCII digits (0..255). We can use the same
 * comma-count + inline-parse strategy as above, but since the result
 * is an `ArrayBuffer` rather than a `TypedArray<E>`, we use a plain
 * `store<u8>` directly.
 */
export function deserializeArrayBuffer_SWAR(
  srcStart: usize,
  srcEnd: usize,
  dst: usize = 0,
): ArrayBuffer {
  while (srcStart < srcEnd) {
    const ch = load<u16>(srcStart);
    if (ch == BRACKET_LEFT) {
      srcStart += 2;
      break;
    }
    srcStart += 2;
  }
  while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;

  if (srcStart >= srcEnd || load<u16>(srcStart) == BRACKET_RIGHT) {
    let out = dst ? changetype<ArrayBuffer>(dst) : new ArrayBuffer(0);
    if (out.byteLength != 0) out = new ArrayBuffer(0);
    return out;
  }

  // A byte array's maximum element count is bounded by half the source code
  // units, so this upper-bound allocation cannot amplify input memory.
  const initialCapacity = i32((<usize>(srcEnd - srcStart)) >> 2) + 1;
  let out = dst
    ? changetype<ArrayBuffer>(dst)
    : new ArrayBuffer(initialCapacity);
  let capacity = out.byteLength;
  if (capacity == 0) {
    capacity = initialCapacity > 0 ? initialCapacity : 1;
    out = new ArrayBuffer(capacity);
  }

  let dataStart = changetype<usize>(out);
  let writePtr: usize = 0;

  while (srcStart < srcEnd) {
    if (writePtr == <usize>capacity) {
      if (capacity > i32.MAX_VALUE >> 1) {
        markProductionParseError();
        return changetype<ArrayBuffer>(0);
      }
      const nextCapacity = capacity << 1;
      const grown = new ArrayBuffer(nextCapacity);
      memory.copy(changetype<usize>(grown), dataStart, writePtr);
      out = grown;
      capacity = nextCapacity;
      dataStart = changetype<usize>(out);
    }
    const next = parseUnsignedIntegerSWAR<u8>(
      srcStart,
      srcEnd,
      dataStart + writePtr,
    );
    if (!next) {
      markProductionParseError();
      return changetype<ArrayBuffer>(0);
    }
    writePtr += 1;
    srcStart = next;
    if (srcStart >= srcEnd) break;

    while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
    if (srcStart >= srcEnd) break;
    const ch = load<u16>(srcStart);
    if (ch == COMMA) {
      srcStart += 2;
      while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
      continue;
    }
    if (ch == BRACKET_RIGHT) break;
    break;
  }

  // Trim to actual byte count via `__renew`.
  const actualBytes = i32(writePtr);
  if (actualBytes != capacity) {
    out = changetype<ArrayBuffer>(
      __renew(changetype<usize>(out), <usize>actualBytes),
    );
  }

  return out;
}
