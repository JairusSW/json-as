import { JSON, JSONMode } from "..";
import { getParseSrc } from "./naive/object";
import { deserializeFloatArrayBody } from "./swar/array/float";
import {
  MAX_CURSOR_DEPTH,
  readCursorString,
  scanCursorString,
  readCursorNumber,
  readCursorLiteral,
  skipCursorWhitespace,
  skipCheckedValue,
} from "./cursor";

export class CursorSlot<T> {
  value!: T;
}

// Type capabilities are immutable module metadata, not a validation cache for
// source pointers. Visiting entries break recursive schema cycles. Tentative
// successes are committed only after the entire root graph is proven safe.
// @ts-expect-error: @lazy is valid for module metadata
@lazy const CURSOR_CAPABILITIES = new Array<u8>(256);
// @ts-expect-error: @lazy is valid for module metadata
@lazy const CURSOR_CAPABILITY_PENDING = new Array<u32>();
export function supportsCursor<T>(depth: i32 = 0): bool {
  if (isBoolean<T>() || isInteger<T>() || isFloat<T>() || isString<T>())
    return true;
  if (depth >= MAX_CURSOR_DEPTH) return false;
  if (isReference<T>() || isManaged<T>()) {
    const type = changetype<nonnull<T>>(0);
    // @ts-expect-error: custom callbacks require prevalidation
    if (isDefined(type.__DESERIALIZE_CUSTOM)) return false;
    const id = idof<nonnull<T>>();
    if (id >= <u32>CURSOR_CAPABILITIES.length) {
      const previous = CURSOR_CAPABILITIES.length;
      const length = max(previous * 2, <i32>id + 1);
      CURSOR_CAPABILITIES.length = length;
      memory.fill(
        CURSOR_CAPABILITIES.dataStart + previous,
        0,
        length - previous,
      );
    }
    const state = unchecked(CURSOR_CAPABILITIES[id]);
    if (state) return state != 3;
    unchecked((CURSOR_CAPABILITIES[id] = 1));
    CURSOR_CAPABILITY_PENDING.push(id);
    const supported = supportsCursorType<T>(depth);
    unchecked((CURSOR_CAPABILITIES[id] = supported ? 2 : 3));
    if (!depth) {
      if (!supported) {
        // A tentative descendant may have depended on this root through a
        // cycle. Do not cache that descendant's incomplete positive result.
        for (let i = 0; i < CURSOR_CAPABILITY_PENDING.length; i++) {
          const pending = unchecked(CURSOR_CAPABILITY_PENDING[i]);
          if (unchecked(CURSOR_CAPABILITIES[pending]) == 2)
            unchecked((CURSOR_CAPABILITIES[pending] = 0));
        }
      }
      CURSOR_CAPABILITY_PENDING.length = 0;
    }
    return supported;
  }
  return false;
}

function supportsCursorType<T>(depth: i32): bool {
  const type = changetype<nonnull<T>>(0);
  if (type instanceof JSON.Box) return true;
  if (type instanceof Array || type instanceof StaticArray)
    return supportsCursor<valueof<T>>(depth + 1);
  if (type instanceof Set) return supportsCursor<indexof<T>>(depth + 1);
  if (type instanceof Map)
    return isString<indexof<T>>() && supportsCursor<valueof<T>>(depth + 1);
  if (
    type instanceof JSON.Raw ||
    type instanceof Date ||
    type instanceof JSON.Value ||
    type instanceof JSON.Obj ||
    type instanceof JSON.Arr
  )
    return true;
  if (
    type instanceof Int8Array ||
    type instanceof Uint8Array ||
    type instanceof Uint8ClampedArray ||
    type instanceof Int16Array ||
    type instanceof Uint16Array ||
    type instanceof Int32Array ||
    type instanceof Uint32Array ||
    type instanceof Int64Array ||
    type instanceof Uint64Array ||
    type instanceof Float32Array ||
    type instanceof Float64Array ||
    type instanceof ArrayBuffer
  )
    return true;
  // @ts-expect-error: immutable generated capability descriptor
  if (isDefined(type.__CURSOR_SUPPORTED)) return type.__CURSOR_SUPPORTED(depth);
  return false;
}

export function decodeCursorKey(ptr: usize, end: usize): string {
  const slot = new CursorSlot<string>();
  if (
    !readCursorString(
      ptr,
      end,
      changetype<usize>(slot),
      offsetof<CursorSlot<string>>("value"),
    )
  )
    return "";
  return slot.value;
}

/** Store one checked value and return its end, without discovering its extent
 * beforehand. The parent owns separators, whitespace, and the next value. */
export function readCursorValue<T>(
  start: usize,
  end: usize,
  dst: usize,
  offset: usize = 0,
  depth: i32 = 0,
): usize {
  if (start >= end) return 0;
  const field = dst + offset;
  if (isNullable<T>() && load<u16>(start) == 110) {
    const next = readCursorLiteral(start, end, 110);
    if (next) store<usize>(field, 0);
    return next;
  }
  if (isBoolean<T>()) {
    const code = load<u16>(start);
    if (code != 116 && code != 102) return 0;
    const next = readCursorLiteral(start, end, code);
    if (next) store<bool>(field, code == 116);
    return next;
  } else if (isInteger<T>() || isFloat<T>()) {
    return readCursorNumber<T>(start, end, field);
  } else if (isString<T>()) {
    return readCursorString(start, end, dst, offset);
  } else if (isReference<T>() || isManaged<T>()) {
    const type = changetype<nonnull<T>>(0);
    if (type instanceof JSON.Box) {
      return readCursorBox(start, end, dst, offset, depth, type, type.value);
    }
    if (type instanceof ArrayBuffer) {
      const slot = new CursorSlot<Uint8Array>();
      const next = readCursorTypedArray<Uint8Array>(
        start,
        end,
        changetype<usize>(slot),
        0,
        depth,
      );
      if (!next) return 0;
      const value = slot.value.buffer;
      store<usize>(field, changetype<usize>(value));
      __link(dst, changetype<usize>(value), false);
      return next;
    }
    if (
      type instanceof Int8Array ||
      type instanceof Uint8Array ||
      type instanceof Uint8ClampedArray ||
      type instanceof Int16Array ||
      type instanceof Uint16Array ||
      type instanceof Int32Array ||
      type instanceof Uint32Array ||
      type instanceof Int64Array ||
      type instanceof Uint64Array ||
      type instanceof Float32Array ||
      type instanceof Float64Array
    ) {
      return readCursorTypedArray<T>(start, end, dst, offset, depth);
    }
    if (type instanceof StaticArray) {
      const slot = new CursorSlot<Array<valueof<T>>>();
      const next = readCursorValue<Array<valueof<T>>>(
        start,
        end,
        changetype<usize>(slot),
        offsetof<CursorSlot<Array<valueof<T>>>>("value"),
        depth,
      );
      if (!next) return 0;
      const value = StaticArray.fromArray<valueof<T>>(slot.value);
      store<usize>(field, changetype<usize>(value));
      __link(dst, changetype<usize>(value), false);
      return next;
    }
    if (type instanceof Array) {
      if (depth >= MAX_CURSOR_DEPTH || load<u16>(start) != 91) return 0;
      const out = new Array<valueof<T>>();
      if (JSON_MODE != JSONMode.NAIVE && isFloat<valueof<T>>()) {
        const next = deserializeFloatArrayBody<nonnull<T>>(
          start,
          end,
          changetype<nonnull<T>>(out),
          true,
        );
        if (!next) return 0;
        store<usize>(field, changetype<usize>(out));
        __link(dst, changetype<usize>(out), false);
        return next;
      }
      let ptr = skipCursorWhitespace(start + 2, end);
      if (ptr < end && load<u16>(ptr) == 93) {
        store<usize>(field, changetype<usize>(out));
        __link(dst, changetype<usize>(out), false);
        return ptr + 2;
      }
      const slot = new CursorSlot<valueof<T>>();
      while (ptr < end) {
        ptr = readCursorValue<valueof<T>>(
          ptr,
          end,
          changetype<usize>(slot),
          offsetof<CursorSlot<valueof<T>>>("value"),
          depth + 1,
        );
        if (!ptr) return 0;
        out.push(slot.value);
        ptr = skipCursorWhitespace(ptr, end);
        if (ptr >= end) return 0;
        const code = load<u16>(ptr);
        if (code == 93) {
          store<usize>(field, changetype<usize>(out));
          __link(dst, changetype<usize>(out), false);
          return ptr + 2;
        }
        if (code != 44) return 0;
        ptr = skipCursorWhitespace(ptr + 2, end);
      }
      return 0;
    }
    if (
      type instanceof JSON.Obj ||
      type instanceof JSON.Arr ||
      type instanceof JSON.Value
    ) {
      return readDynamic<T>(start, end, dst, offset, depth);
    }
    if (type instanceof JSON.Raw) {
      const next = skipCheckedValue(start, end, depth);
      if (!next) return 0;
      const value = JSON.Raw.from(JSON.Util.ptrToStr(start, next));
      store<usize>(field, changetype<usize>(value));
      __link(dst, changetype<usize>(value), false);
      return next;
    }
    if (type instanceof Date) {
      const slot = new CursorSlot<string>();
      const next = readCursorString(
        start,
        end,
        changetype<usize>(slot),
        offsetof<CursorSlot<string>>("value"),
      );
      if (!next) return 0;
      const value = new Date(Date.fromString(slot.value).getTime());
      store<usize>(field, changetype<usize>(value));
      __link(dst, changetype<usize>(value), false);
      return next;
    }
    if (type instanceof Set) {
      if (depth >= MAX_CURSOR_DEPTH || load<u16>(start) != 91) return 0;
      const out = new Set<indexof<T>>();
      let ptr = skipCursorWhitespace(start + 2, end);
      if (ptr < end && load<u16>(ptr) == 93) {
        store<usize>(field, changetype<usize>(out));
        __link(dst, changetype<usize>(out), false);
        return ptr + 2;
      }
      const slot = new CursorSlot<indexof<T>>();
      while (ptr < end) {
        ptr = readCursorValue<indexof<T>>(
          ptr,
          end,
          changetype<usize>(slot),
          offsetof<CursorSlot<indexof<T>>>("value"),
          depth + 1,
        );
        if (!ptr) return 0;
        out.add(slot.value);
        ptr = skipCursorWhitespace(ptr, end);
        if (ptr >= end) return 0;
        const code = load<u16>(ptr);
        if (code == 93) {
          store<usize>(field, changetype<usize>(out));
          __link(dst, changetype<usize>(out), false);
          return ptr + 2;
        }
        if (code != 44) return 0;
        ptr = skipCursorWhitespace(ptr + 2, end);
      }
      return 0;
    }
    if (type instanceof Map) {
      if (!isString<indexof<T>>()) return 0;
      if (depth >= MAX_CURSOR_DEPTH || load<u16>(start) != 123) return 0;
      const out = new Map<string, valueof<T>>();
      let ptr = skipCursorWhitespace(start + 2, end);
      if (ptr < end && load<u16>(ptr) == 125) {
        store<usize>(field, changetype<usize>(out));
        __link(dst, changetype<usize>(out), false);
        return ptr + 2;
      }
      const key = new CursorSlot<string>();
      const value = new CursorSlot<valueof<T>>();
      while (ptr < end) {
        ptr = readCursorString(
          ptr,
          end,
          changetype<usize>(key),
          offsetof<CursorSlot<string>>("value"),
        );
        if (!ptr) return 0;
        ptr = skipCursorWhitespace(ptr, end);
        if (ptr >= end || load<u16>(ptr) != 58) return 0;
        ptr = readCursorValue<valueof<T>>(
          skipCursorWhitespace(ptr + 2, end),
          end,
          changetype<usize>(value),
          offsetof<CursorSlot<valueof<T>>>("value"),
          depth + 1,
        );
        if (!ptr) return 0;
        out.set(key.value, value.value);
        ptr = skipCursorWhitespace(ptr, end);
        if (ptr >= end) return 0;
        const code = load<u16>(ptr);
        if (code == 125) {
          store<usize>(field, changetype<usize>(out));
          __link(dst, changetype<usize>(out), false);
          return ptr + 2;
        }
        if (code != 44) return 0;
        ptr = skipCursorWhitespace(ptr + 2, end);
      }
      return 0;
    }
    // @ts-expect-error: generated checked cursor method
    if (isDefined(type.__DESERIALIZE_CURSOR)) {
      if (depth >= MAX_CURSOR_DEPTH) return 0;
      const obj = changetype<nonnull<T>>(
        __new(offsetof<nonnull<T>>(), idof<nonnull<T>>()),
      );
      // @ts-expect-error: transform-generated defaults
      obj.__INITIALIZE();
      const next = obj.__DESERIALIZE_CURSOR(start, end, obj, depth);
      if (next) {
        store<T>(field, obj);
        __link(dst, changetype<usize>(obj), false);
      }
      return next;
    }
  }
  return 0;
}

function readCursorBox<T, V>(
  start: usize,
  end: usize,
  dst: usize,
  offset: usize,
  depth: i32,
  _box: T,
  _type: V,
): usize {
  const out = changetype<nonnull<T>>(
    __new(offsetof<nonnull<T>>(), idof<nonnull<T>>()),
  );
  const next = readCursorValue<V>(
    start,
    end,
    changetype<usize>(out),
    offsetof<nonnull<T>>("value"),
    depth,
  );
  if (!next) return 0;
  store<usize>(dst + offset, changetype<usize>(out));
  __link(dst, changetype<usize>(out), false);
  return next;
}

function readCursorTypedArray<T>(
  start: usize,
  end: usize,
  dst: usize,
  offset: usize,
  depth: i32,
): usize {
  if (depth >= MAX_CURSOR_DEPTH || load<u16>(start) != 91) return 0;
  const type = changetype<nonnull<T>>(0);
  const values = new Array<valueof<T>>();
  let next: usize = 0;
  if (JSON_MODE != JSONMode.NAIVE && isFloat<valueof<T>>()) {
    next = deserializeFloatArrayBody<Array<valueof<T>>>(
      start,
      end,
      values,
      true,
    );
  } else {
    let ptr = skipCursorWhitespace(start + 2, end);
    if (ptr < end && load<u16>(ptr) == 93) {
      next = ptr + 2;
    } else {
      // Eight untraced bytes hold any numeric element; no token allocations.
      const slot = new CursorSlot<u64>();
      while (ptr < end) {
        if (type instanceof Uint8ClampedArray) {
          ptr = readCursorNumber<f64>(ptr, end, changetype<usize>(slot));
          if (!ptr) return 0;
          values.push(
            <valueof<T>>(
              (<i32>(
                max<f64>(0, min<f64>(255, load<f64>(changetype<usize>(slot))))
              ))
            ),
          );
        } else {
          ptr = readCursorNumber<valueof<T>>(ptr, end, changetype<usize>(slot));
          if (!ptr) return 0;
          values.push(load<valueof<T>>(changetype<usize>(slot)));
        }
        ptr = skipCursorWhitespace(ptr, end);
        if (ptr >= end) return 0;
        const code = load<u16>(ptr);
        if (code == 93) {
          next = ptr + 2;
          break;
        }
        if (code != 44) return 0;
        ptr = skipCursorWhitespace(ptr + 2, end);
      }
    }
  }
  if (!next) return 0;
  // A temporary geometric buffer avoids a grammar/counting prepass. Only an
  // exactly sized owned typed buffer escapes; temporary capacity is dropped.
  const out = instantiate<nonnull<T>>(values.length);
  if (values.length)
    memory.copy(
      out.dataStart,
      values.dataStart,
      <usize>values.length * sizeof<valueof<T>>(),
    );
  store<usize>(dst + offset, changetype<usize>(out));
  __link(dst, changetype<usize>(out), false);
  return next;
}

function readDynamicSlot(
  start: usize,
  end: usize,
  dst: usize,
  depth: i32,
  source: string,
): usize {
  if (start >= end) return 0;
  const code = load<u16>(start);
  if (code == 34 || code == 123 || code == 91) {
    const next = skipCheckedValue(start, end, depth);
    if (!next) return 0;
    store<u64>(
      dst,
      JSON.Value.lazyBits(changetype<usize>(source), start, next),
    );
    return next;
  }
  if (code == 116 || code == 102 || code == 110) {
    const next = readCursorLiteral(start, end, code);
    if (!next) return 0;
    store<u64>(
      dst,
      code == 110 ? JSON.Value.nullBits() : JSON.Value.boolBits(code == 116),
    );
    return next;
  }
  const next = readCursorNumber<f64>(start, end, dst);
  if (next) store<u64>(dst, JSON.Value.f64Bits(load<f64>(dst)));
  return next;
}

function readDynamic<T>(
  start: usize,
  end: usize,
  dst: usize,
  offset: usize,
  depth: i32,
): usize {
  const type = changetype<nonnull<T>>(0);
  const source = getParseSrc();
  if (type instanceof JSON.Obj) {
    if (depth >= MAX_CURSOR_DEPTH || load<u16>(start) != 123) return 0;
    const out = new JSON.Obj();
    out._src = source;
    let ptr = skipCursorWhitespace(start + 2, end);
    if (ptr < end && load<u16>(ptr) == 125) {
      out._rawStart = start;
      out._rawEnd = ptr + 2;
      store<usize>(dst + offset, changetype<usize>(out));
      __link(dst, changetype<usize>(out), false);
      return ptr + 2;
    }
    if (!depth) out.reserveForParse((end - start) >> 1);
    const bits = new CursorSlot<u64>();
    while (ptr < end) {
      const keyStart = ptr;
      const key = scanCursorString(ptr, end);
      const keyEnd = <usize>(key >> 1);
      if (!keyEnd) return 0;
      ptr = skipCursorWhitespace(keyEnd, end);
      if (ptr >= end || load<u16>(ptr) != 58) return 0;
      ptr = readDynamicSlot(
        skipCursorWhitespace(ptr + 2, end),
        end,
        changetype<usize>(bits),
        depth + 1,
        source,
      );
      if (!ptr) return 0;
      if (key & 1) {
        const decoded = decodeCursorKey(keyStart, keyEnd);
        const begin = changetype<usize>(decoded);
        out.appendParsedSlot(
          begin,
          begin + ((<usize>decoded.length) << 1),
          bits.value,
        );
      } else {
        out.appendParsedSlot(keyStart + 2, keyEnd - 2, bits.value);
      }
      ptr = skipCursorWhitespace(ptr, end);
      if (ptr >= end) return 0;
      const code = load<u16>(ptr);
      if (code == 125) {
        out._rawStart = start;
        out._rawEnd = ptr + 2;
        store<usize>(dst + offset, changetype<usize>(out));
        __link(dst, changetype<usize>(out), false);
        return ptr + 2;
      }
      if (code != 44) return 0;
      ptr = skipCursorWhitespace(ptr + 2, end);
    }
    return 0;
  }
  if (type instanceof JSON.Arr) {
    if (depth >= MAX_CURSOR_DEPTH || load<u16>(start) != 91) return 0;
    const out = new JSON.Arr();
    out._src = source;
    let ptr = skipCursorWhitespace(start + 2, end);
    if (ptr < end && load<u16>(ptr) == 93) {
      store<usize>(dst + offset, changetype<usize>(out));
      __link(dst, changetype<usize>(out), false);
      return ptr + 2;
    }
    const bits = new CursorSlot<u64>();
    while (ptr < end) {
      ptr = readDynamicSlot(
        ptr,
        end,
        changetype<usize>(bits),
        depth + 1,
        source,
      );
      if (!ptr) return 0;
      out.pushRawSlot(bits.value);
      ptr = skipCursorWhitespace(ptr, end);
      if (ptr >= end) return 0;
      const code = load<u16>(ptr);
      if (code == 93) {
        store<usize>(dst + offset, changetype<usize>(out));
        __link(dst, changetype<usize>(out), false);
        return ptr + 2;
      }
      if (code != 44) return 0;
      ptr = skipCursorWhitespace(ptr + 2, end);
    }
    return 0;
  }
  const code = load<u16>(start);
  let value: JSON.Value;
  let next: usize;
  if (code == 123) {
    const slot = new CursorSlot<JSON.Obj>();
    next = readDynamic<JSON.Obj>(start, end, changetype<usize>(slot), 0, depth);
    if (!next) return 0;
    value = JSON.Value.from(slot.value);
  } else if (code == 91) {
    const slot = new CursorSlot<JSON.Arr>();
    next = readDynamic<JSON.Arr>(start, end, changetype<usize>(slot), 0, depth);
    if (!next) return 0;
    value = JSON.Value.from(slot.value);
  } else if (code == 34) {
    const slot = new CursorSlot<string>();
    next = readCursorString(start, end, changetype<usize>(slot));
    if (!next) return 0;
    value = JSON.Value.from(slot.value);
  } else {
    const bits = new CursorSlot<u64>();
    next = readDynamicSlot(start, end, changetype<usize>(bits), depth, source);
    if (!next) return 0;
    value = JSON.Value.fromBits(bits.value);
  }
  store<usize>(dst + offset, changetype<usize>(value));
  __link(dst, changetype<usize>(value), false);
  return next;
}
