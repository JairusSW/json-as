// SWAR-mode TypedArray / ArrayBuffer deserializer.
//
// The naive variant in `../naive/typedarray.ts` does two scalar passes
// (count digit-starts, then call `JSON.__deserialize` per element which
// re-scans the same digits). This rewrite replaces both passes:
//
//   - **No count pass.** TypedArrays have a fixed length at construction,
//     so the natural approach is to count first then allocate. We tried
//     that with a SWAR comma counter - it cut the per-element cost but
//     kept us ~30% below the top-level `f64[]` path because the count
//     scan still touched the whole input twice. Instead we allocate
//     worst-case (`(srcEnd - srcStart) >> 2 + 1` elements - each
//     element needs >= "D," = 2 UTF-16 chars = 4 bytes) and `__renew`
//     the underlying buffer down to the exact byte count after parsing.
//     The over-allocation peaks at ~2-3× the final size for typical
//     payloads; the trim is a single `memory.copy` on the GC's terms.
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
/**
 * Worst-case element count: each element occupies >= 1 digit + 1
 * delimiter = 2 UTF-16 chars = 4 bytes. So `(srcEnd - srcStart) >> 2`
 * upper-bounds the count. Allocating to worst-case lets us skip a
 * full count pass over the input - at the cost of an over-allocated
 * underlying buffer that we trim via `__renew` once we know the
 * actual element count.
 *
 * For a top-level f64[] payload of ~64 MiB JSON encoding 6M floats,
 * worst-case alloc is ~16M f64 = 128 MB temporarily. We trim back
 * to ~48 MB after parse. The trim is a wasm `memory.copy` (or just
 * a length update if the runtime supports in-place shrink), much
 * cheaper than a second 64 MB scan over the input.
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
  const maxElements = i32((<usize>(srcEnd - srcStart)) >> 2) + 1;
  let out = changetype<T>(
    dst || changetype<usize>(instantiate<T>(maxElements)),
  );
  if (out.length != maxElements) {
    out = changetype<T>(instantiate<T>(maxElements));
  }

  const dataStart = out.dataStart;
  let writePtr = dataStart;

  // Parse loop. Each element parses into the slot at `writePtr`, then
  // the separator (`,` or `]`) is consumed. Whitespace surrounding the
  // separator is skipped to match the naive variant's behaviour.
  while (srcStart < srcEnd) {
    let next: usize = 0;
    if (isFloat<valueof<T>>()) {
      next = parseFloatElementSWAR<valueof<T>>(srcStart, srcEnd, writePtr);
    } else if (isSigned<valueof<T>>()) {
      next = parseSignedIntegerSWAR<valueof<T>>(srcStart, srcEnd, writePtr);
    } else {
      next = parseUnsignedIntegerSWAR<valueof<T>>(srcStart, srcEnd, writePtr);
    }
    if (!next) break;
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
  if (actualCount != maxElements) {
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

  // Worst-case byte count: each element is `D,` minimum = 4 bytes.
  const maxBytes = i32((<usize>(srcEnd - srcStart)) >> 2) + 1;
  let out = dst ? changetype<ArrayBuffer>(dst) : new ArrayBuffer(maxBytes);
  if (out.byteLength != maxBytes) {
    out = new ArrayBuffer(maxBytes);
  }

  const dataStart = changetype<usize>(out);
  let writePtr: usize = 0;

  while (srcStart < srcEnd) {
    const next = parseUnsignedIntegerSWAR<u8>(
      srcStart,
      srcEnd,
      dataStart + writePtr,
    );
    if (!next) break;
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
  if (actualBytes != maxBytes) {
    out = changetype<ArrayBuffer>(
      __renew(changetype<usize>(out), <usize>actualBytes),
    );
  }

  return out;
}
