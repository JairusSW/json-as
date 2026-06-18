/// <reference path="./index.d.ts" />

import { bs } from "../lib/as-bs";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import {
  serializeArray,
  serializeMap,
  serializeDate,
  serializeArbitrary,
  serializeSet,
  serializeStaticArray,
  serializeBool,
  serializeInteger,
  serializeFloat32,
  serializeFloat64,
  serializeStruct,
  serializeObject,
  serializeJsonArray,
  serializeRaw,
  serializeString,
  serializeArrayBufferUnsafe,
  serializeDynamic,
  serializeTypedArray,
} from "./serialize";
import {
  deserializeBoolean,
  deserializeArray,
  deserializeFloat,
  deserializeMap,
  deserializeDate,
  deserializeInteger,
  deserializeUnsigned,
  deserializeSet,
  deserializeStaticArray,
  deserializeArbitrary,
  deserializeObject,
  deserializeJsonArray,
  deserializeRaw,
  deserializeString,
  deserializeArrayBuffer,
  deserializeTypedArray,
  setParseSrc,
  getParseSrc,
} from "./deserialize";
import {
  BACK_SLASH,
  BRACE_LEFT,
  BRACE_RIGHT,
  BRACKET_LEFT,
  BRACKET_RIGHT,
  COMMA,
  NULL_WORD,
  QUOTE,
  NULL_WORD_U64,
  TRUE_WORD_U64,
  FALSE_WORD_U64,
} from "./custom/chars";
import { itoa_buffered } from "util/number";
import { dtoa_buffered, ftoa_buffered } from "xjb-as";
import { ptrToStr } from "./util/ptrToStr";
import { atoi, bytes, scanStringEnd } from "./util";
import { scanValueEnd_SIMD } from "./util/scanValueEndSimd";
import { scanValueEnd_SWAR } from "./util/scanValueEndSwar";

const VAL_QNAN: u64 = 0x7ffc000000000000; // boxed signature (quiet NaN)
const VAL_TAG_SHIFT: u8 = 45;
const VAL_PAYLOAD_MASK: u64 = 0x00001fffffffffff; // low 45 bits
const VAL_PTR_MASK: u64 = 0xffffffff; // wasm32 pointer
const VAL_BOX64: u64 = 0x8000000000000000; // sign bit: 64-bit int spilled to heap
const VAL_NULL: u64 = VAL_QNAN; // tag 0 (Null), payload 0
const VAL_I64_LIMIT: i64 = 17592186044416; // 2^44 - inline range is [-2^44, 2^44)
const VAL_U64_LIMIT: u64 = 35184372088832; // 2^45 - inline range is [0, 2^45)

// Lazy value-slot payload layout (45-bit box payload), see JSON.Value.lazyBits.
// Compact form (bit 44 = 0): a source-relative start offset (23 bits) + the
// value's length (21 bits), both in UTF-16 units. Offset-heavy on purpose:
// object/array fields are usually small while the document can be large, so
// offset overflow (a field late in a big doc) is the realistic trigger, not a
// single giant field - so the offset field gets the wider range. bit 44 flags
// the absolute (scan-on-demand) fallback for a source/value past those ranges.
//   bits [0..22] offset (<=~16MB src) · [23..43] length (<=~4MB val) · 44 abs
const LZ_OFF_BITS: u64 = 23;
const LZ_OFF_MASK: u64 = 0x7fffff; // (1 << 23) - 1
const LZ_LEN_MASK: u64 = 0x1fffff; // (1 << 21) - 1
const LZ_ABS_FLAG: u64 = 0x100000000000; // 1 << 44

// A materialized String box only uses the low 32 payload bits for its pointer,
// so two spare bits [32..33] cache the value's serialize-escape class. This lets
// re-serializing a dynamic string skip the per-char escape scan - a clean string
// emits via a single memcpy. `valPtr` masks bit 32+ off, so the pointer (and GC)
// are unaffected.
//   0 = unclassified · 1 = clean (no escaping -> memcpy) · 2 = needs escaping
const VAL_STR_CLASS_SHIFT: u64 = 32;
const VAL_STR_CLASS_MASK: u64 = 0x0000000300000000; // bits [32..33]
const STR_CLASS_UNKNOWN: u32 = 0;
const STR_CLASS_CLEAN: u32 = 1;
const STR_CLASS_ESCAPE: u32 = 2;

function valBoxed(w: u64): bool {
  return (w & VAL_QNAN) == VAL_QNAN;
}
function valTag(w: u64): u32 {
  return <u32>((w >> VAL_TAG_SHIFT) & 0x1f);
}
function valPayload(w: u64): u64 {
  return w & VAL_PAYLOAD_MASK;
}
function valPtr(w: u64): usize {
  return <usize>(w & VAL_PTR_MASK);
}
function valBox(tag: u32, payload: u64): u64 {
  return (
    VAL_QNAN | ((<u64>tag) << VAL_TAG_SHIFT) | (payload & VAL_PAYLOAD_MASK)
  );
}
function valLazy(w: u64): bool {
  return valBoxed(w) && valTag(w) == JSON.Types.Lazy;
}
function valIntTag<T>(): u32 {
  if (sizeof<T>() == 1) return isSigned<T>() ? JSON.Types.I8 : JSON.Types.U8;
  if (sizeof<T>() == 2) return isSigned<T>() ? JSON.Types.I16 : JSON.Types.U16;
  if (sizeof<T>() == 4) return isSigned<T>() ? JSON.Types.I32 : JSON.Types.U32;
  return isSigned<T>() ? JSON.Types.I64 : JSON.Types.U64;
}

function hashUtf16(ptr: usize, len: i32): u32 {
  let h: u32 = 2166136261;
  for (let i = 0; i < len; i++) {
    h ^= <u32>load<u16>(ptr + ((<usize>i) << 1));
    h *= 16777619;
  }
  h ^= <u32>len;
  h *= 16777619;
  return h;
}

// v128 path: compare 8 code units (16 bytes) per step, then a u64 step (4) and
// a scalar tail. Each load is bounded by `len`, so it never reads past either
// key. Only reachable (and thus only compiled) when the SIMD feature is on, so
// the intrinsics don't break the naive/swar builds.
function utf16Equals_SIMD(ptrA: usize, ptrB: usize, len: i32): bool {
  let i = 0;
  for (; i + 8 <= len; i += 8) {
    const off = (<usize>i) << 1;
    if (v128.any_true(v128.xor(v128.load(ptrA + off), v128.load(ptrB + off))))
      return false;
  }
  for (; i + 4 <= len; i += 4) {
    const off = (<usize>i) << 1;
    if (load<u64>(ptrA + off) != load<u64>(ptrB + off)) return false;
  }
  for (; i < len; i++) {
    const off = (<usize>i) << 1;
    if (load<u16>(ptrA + off) != load<u16>(ptrB + off)) return false;
  }
  return true;
}

function utf16Equals(ptrA: usize, ptrB: usize, len: i32): bool {
  if (ASC_FEATURE_SIMD) return utf16Equals_SIMD(ptrA, ptrB, len);
  // Scalar: 4 code units (one u64) per step, scalar tail. Bounded by `len`.
  let i = 0;
  for (; i + 4 <= len; i += 4) {
    const off = (<usize>i) << 1;
    if (load<u64>(ptrA + off) != load<u64>(ptrB + off)) return false;
  }
  for (; i < len; i++) {
    const off = (<usize>i) << 1;
    if (load<u16>(ptrA + off) != load<u16>(ptrB + off)) return false;
  }
  return true;
}

// Shared zero-length sentinel for JSON.Obj's key buffer, so an empty object
// allocates no key storage until its first key is inserted. Never mutated.
// @ts-expect-error: Decorator valid here
@lazy const EMPTY_KEYS: StaticArray<u16> = new StaticArray<u16>(0);

// Shared zero-length sentinel for JSON.Obj's key-position/index buffers.
// Never mutated.
// @ts-expect-error: Decorator valid here
@lazy const EMPTY_I32S: StaticArray<i32> = new StaticArray<i32>(0);

// Shared zero-length sentinel for JSON.Obj's value-slot buffer, so an empty
// object allocates no slot storage until its first value. Never mutated.
// @ts-expect-error: Decorator valid here
@lazy const EMPTY_VALS: StaticArray<u64> = new StaticArray<u64>(0);

// A JSON.Obj with at most this many keys resolves lookups by linear scan and
// never allocates/hashes a key index. Most JSON objects are small and dynamic
// access touches only a few keys, so the O(n) index build a hash table needs is
// pure overhead below this size. Above it, the hash index amortizes.
const OBJ_LINEAR_MAX: i32 = 6;

// Deferred-value record for a lazy JSON.Value (see JSON.Types.Lazy). `lz` packs
// the unparsed source slice as (sliceStart << 32) | sliceEnd - the same encoding
// the transform uses for @lazy struct fields. `src` is the GC anchor that keeps
// the source string (and therefore the slice pointers, which index into its
// UTF-16 buffer) alive until the value is materialized. Managed so `src` is
// traced automatically; a JSON.Value's __visit traces the LazyRef itself.
// @ts-expect-error: decorators allowed here
@final
class LazyRef {
  lz: u64 = 0;
  src: string = "";
}

export namespace JSON {
  /**
   * On-demand field marker. `JSON.Lazy<T>` is structurally just `T` (a no-op
   * type alias), so a field declared `JSON.Lazy<T>` is typed and accessed
   * exactly like `T`. The transform detects the annotation and defers that
   * field: its raw JSON slice is stored at parse time and parsed into `T` on
   * first access (a generated get accessor).
   */
  export type Lazy<T> = T;

  /**
   * Whether a lazy slot's value is JSON null - for `@omitnull` on lazy fields,
   * without forcing materialization. The slot encodes the state: `u64.MAX_VALUE`
   * = materialized (null iff the value pointer is 0), `0` = absent (null), any
   * other value = a not-yet-parsed slice range (null iff it is literally `null`).
   * @param valPtr pointer of the materialized value (0 when null)
   * @param lz    the packed slot
   */
  export function __lazyIsNull(valPtr: usize, lz: u64): bool {
    if (lz == u64.MAX_VALUE) return valPtr == 0;
    if (lz == 0) return true;
    const hi = <usize>(lz >>> 32);
    // raw slice of length 4 (8 bytes) equal to the UTF-16 word "null"
    return <usize>(<u32>lz) - hi == 8 && load<u64>(hi) == 0x006c006c0075006e;
  }

  /**
   * Memory management utilities for the JSON serialization buffer.
   */
  export namespace Memory {
    /**
     * Shrinks the internal serialization buffer to free memory.
     * Call this after processing large JSON documents to release unused memory.
     *
     * @example
     * ```typescript
     * const largeJson = JSON.stringify(hugeObject);
     * // ... process the JSON ...
     * JSON.Memory.shrink();  // Free the buffer memory
     * ```
     */
    export function shrink(): void {
      bs.shrink();
    }
  }
  /**
   * Serializes valid JSON data
   * ```js
   * JSON.stringify<T>(data)
   * ```
   * @param data T
   * @returns string
   */
  export function stringify<T>(data: T, out: string | null = null): string {
    if (isBoolean<T>()) {
      if (out) {
        if (<bool>data == true) {
          out = changetype<string>(__renew(changetype<usize>(out), 8));
          store<u64>(changetype<usize>(out), TRUE_WORD_U64);
        } else {
          out = changetype<string>(__renew(changetype<usize>(out), 10));
          store<u64>(changetype<usize>(out), FALSE_WORD_U64);
          store<u16>(changetype<usize>(out), 101, 8);
        }
        return out;
      }
      return data ? "true" : "false";
    } else if (
      isInteger<T>() &&
      !isSigned<T>() &&
      nameof<T>() == "usize" &&
      data == 0
    ) {
      if (out) {
        out = changetype<string>(__renew(changetype<usize>(out), 8));
        store<u64>(changetype<usize>(out), NULL_WORD_U64);
        return out;
      }
      return NULL_WORD;
    } else if (isInteger<T>(data)) {
      if (out) {
        out = changetype<string>(
          __renew(changetype<usize>(out), sizeof<T>() << 3),
        );

        const bytes = itoa_buffered(changetype<usize>(out), data) << 1;
        return (out = changetype<string>(
          __renew(changetype<usize>(out), bytes),
        ));
      }
      return data.toString();
    } else if (isFloat<T>(data)) {
      out = out
        ? changetype<string>(__renew(changetype<usize>(out), 128))
        : changetype<string>(__new(128, idof<string>()));
      const startPtr = changetype<usize>(out);
      const bytes =
        (sizeof<T>() == 4
          ? ftoa_buffered(startPtr, <f32>data)
          : dtoa_buffered(startPtr, <f64>data)) << 1;
      return changetype<string>(__renew(startPtr, bytes));
    } else if (isNullable<T>() && changetype<usize>(data) == <usize>0) {
      if (out) {
        out = changetype<string>(__renew(changetype<usize>(out), 8));
        store<u64>(changetype<usize>(out), NULL_WORD_U64);
        return out;
      }
      return NULL_WORD;
    } else if (isString<nonnull<T>>()) {
      serializeString(data as string);
      return out ? bs.outTo<string>(changetype<usize>(out)) : bs.out<string>();
      // @ts-expect-error: Defined by transform
    } else if (isDefined(data.__SERIALIZE_CUSTOM)) {
      // @ts-expect-error: Defined by transform
      data.__SERIALIZE_CUSTOM();
      return out ? bs.outTo<string>(changetype<usize>(out)) : bs.out<string>();
      // @ts-expect-error: Defined by transform
    } else if (isDefined(data.__SERIALIZE)) {
      // @ts-expect-error: Defined by transform
      data.__SERIALIZE(changetype<usize>(data));
      return out ? bs.outTo<string>(changetype<usize>(out)) : bs.out<string>();
    } else if (data instanceof Date) {
      out = out
        ? changetype<string>(__renew(changetype<usize>(out), 52))
        : changetype<string>(__new(52, idof<string>()));

      store<u16>(changetype<usize>(out), QUOTE);
      memory.copy(
        changetype<usize>(out) + 2,
        changetype<usize>(data.toISOString()),
        48,
      );
      store<u16>(changetype<usize>(out), QUOTE, 50);
      return changetype<string>(out);
    } else {
      serializeReference<T>(data);
      return out ? bs.outTo<string>(changetype<usize>(out)) : bs.out<string>();
    }
  }

  /**
   * Parses valid JSON strings into their original format
   * ```js
   * JSON.parse<T>(data)
   * ```
   * Pass an existing object as `out` to deserialize into it, reusing its
   * allocations (symmetric with `stringify<T>(data, out)`). On the fast path the
   * per-field reuse logic (nested structs reused as `dst`, strings `__renew`d in
   * place when sizes match, arrays keeping capacity) makes a steady-state
   * re-parse of the same shape allocate ~nothing after the first call.
   * @param data string
   * @param out optional existing object to reuse (structs/composites only)
   * @returns T
   */
  // A type-correct "zero" for any T: null pointer for references, 0/false for
  // value types. `changetype<T>(0)` alone fails for bool/f64 (size mismatch),
  // so branch on isReference at compile time.
  function __zero<T>(): T {
    // @ts-ignore: compile-time intrinsic
    if (isReference<T>() || isManaged<T>()) return changetype<T>(0);
    return <T>0;
  }

  export function parse<T>(data: string, out: T = __zero<T>()): T {
    // Anchor the source for any lazy JSON.Obj/JSON.Value built while parsing, so
    // their stored slice pointers (into `data`'s buffer) stay valid and resolve
    // against the right string. Save/restore makes nested parses (e.g. a custom
    // deserializer calling JSON.parse, or JSON.Obj.from) re-entrant-safe.
    const prevSrc = getParseSrc();
    setParseSrc(data);
    const result = parseInternal<T>(data, out);
    setParseSrc(prevSrc);
    return result;
  }

  function parseInternal<T>(data: string, out: T = __zero<T>()): T {
    let dataPtr = changetype<usize>(data);
    const dataEnd = dataPtr + bytes(data);
    // Entry point skips leading whitespace: every deserialize handler may then
    // assume srcStart points at the first non-whitespace char. Handlers must
    // NOT re-skip leading whitespace themselves. (Trailing whitespace is left
    // intact - scalars stop at the value end, composites self-trim, and
    // JSON.Raw intentionally preserves trailing bytes.)
    while (dataPtr < dataEnd && JSON.Util.isSpace(load<u16>(dataPtr)))
      dataPtr += 2;
    const dataSize = dataEnd - dataPtr;
    if (isBoolean<T>()) {
      return deserializeBoolean(dataPtr, dataPtr + dataSize) as T;
    } else if (isInteger<T>()) {
      return isSigned<T>()
        ? deserializeInteger<T>(dataPtr, dataPtr + dataSize)
        : deserializeUnsigned<T>(dataPtr, dataPtr + dataSize);
    } else if (isFloat<T>()) {
      return deserializeFloat<T>(dataPtr, dataPtr + dataSize);
    } else if (
      isNullable<T>() &&
      dataSize == 8 &&
      load<u64>(dataPtr) == NULL_WORD_U64
    ) {
      return null;
    } else if (isString<T>()) {
      return deserializeString(dataPtr, dataPtr + dataSize) as T;
    } else {
      let type: nonnull<T> = changetype<nonnull<T>>(0);
      // @ts-expect-error: Defined by transform
      if (isDefined(type.__DESERIALIZE_CUSTOM)) {
        const obj = changetype<nonnull<T>>(0);
        // @ts-expect-error
        return obj.__DESERIALIZE_CUSTOM(data);
        // @ts-expect-error: Defined by transform
      } else if (
        isDefined(type.__DESERIALIZE_SLOW) ||
        isDefined(type.__DESERIALIZE_FAST)
      ) {
        // Reuse the caller-supplied `out` graph when given; otherwise allocate.
        const reuse = changetype<usize>(out) != 0;
        const obj = reuse
          ? changetype<nonnull<T>>(changetype<usize>(out))
          : changetype<nonnull<T>>(
              __new(offsetof<nonnull<T>>(), idof<nonnull<T>>()),
            );
        // A freshly allocated object holds uninitialized fields (__new does not
        // zero). The fast path writes fields in place and may leave some
        // unwritten (@optional / skip-unknown), so it must run against defaults,
        // not garbage. A reused graph is already initialized - skip it.
        // @ts-expect-error: Defined by transform
        if (!reuse && isDefined(type.__INITIALIZE)) obj.__INITIALIZE();
        // @ts-expect-error: Defined by transform
        if (isDefined(type.__DESERIALIZE_FAST)) {
          // @ts-expect-error: Defined by transform
          const fastEnd = obj.__DESERIALIZE_FAST(
            dataPtr,
            dataPtr + dataSize,
            obj,
          );
          // A non-zero return means the fast path matched; accept it when only
          // trailing whitespace remains (pretty-printed input ends with a
          // newline, so the cursor stops just past `}` rather than at srcEnd).
          if (
            fastEnd != 0 &&
            JSON.Util.skipWhitespace(fastEnd, dataPtr + dataSize) ==
              dataPtr + dataSize
          ) {
            // @ts-expect-error: Defined by transform for @lazy-field structs -
            // pins the source so stored slice ranges stay valid.
            if (isDefined(obj.__SET_SRC)) obj.__SET_SRC(data);
            return obj;
          }
        }
        if (isDefined(type.__INITIALIZE)) obj.__INITIALIZE();
        // @ts-expect-error: Defined by transform
        if (isDefined(type.__DESERIALIZE_SLOW)) {
          // @ts-expect-error: Defined by transform
          obj.__DESERIALIZE_SLOW(dataPtr, dataPtr + dataSize, obj);
          // @ts-expect-error: Defined by transform for @lazy-field structs.
          if (isDefined(obj.__SET_SRC)) obj.__SET_SRC(data);
          return obj;
        }
        throw new Error(`No deserialize method defined for type ${type}`);
      }
      if (type instanceof StaticArray) {
        // @ts-expect-error
        return deserializeStaticArray<nonnull<T>>(
          dataPtr,
          dataPtr + dataSize,
          0,
        );
      } else if (type instanceof Array) {
        // Reuse the caller-supplied array when given (no allocation); the
        // element loop overwrites slots and trims length. Otherwise allocate.
        // @ts-expect-error
        return deserializeArray<nonnull<T>>(
          dataPtr,
          dataPtr + dataSize,
          changetype<usize>(out) != 0
            ? changetype<usize>(out)
            : changetype<usize>(instantiate<T>()),
        );
      } else if (
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
        return deserializeTypedArray<nonnull<T>>(
          dataPtr,
          dataPtr + dataSize,
          0,
        ) as T;
      } else if (type instanceof ArrayBuffer) {
        return deserializeArrayBuffer(dataPtr, dataPtr + dataSize, 0) as T;
      } else if (type instanceof Set) {
        // @ts-expect-error
        return deserializeSet<nonnull<T>>(dataPtr, dataPtr + dataSize, 0);
      } else if (type instanceof Map) {
        // Reuse the caller-supplied map when given (keys overwrite in place).
        // @ts-expect-error
        return deserializeMap<nonnull<T>>(
          dataPtr,
          dataPtr + dataSize,
          changetype<usize>(out),
        );
      } else if (type instanceof Date) {
        // @ts-expect-error
        return deserializeDate(dataPtr, dataPtr + dataSize);
      } else if (type instanceof JSON.Raw) {
        // @ts-expect-error: type
        return deserializeRaw(dataPtr, dataPtr + dataSize);
      } else if (type instanceof JSON.Value) {
        // Reuse the caller-supplied JSON.Value handle when given (`out`); the
        // deserializer writes the parsed bits into it. Otherwise allocate.
        // @ts-expect-error
        return deserializeArbitrary(
          dataPtr,
          dataPtr + dataSize,
          changetype<usize>(out),
        );
      } else if (type instanceof JSON.Obj) {
        // Reuse the caller-supplied JSON.Obj (cleared, buffers kept). Otherwise allocate.
        // @ts-expect-error
        return deserializeObject(
          dataPtr,
          dataPtr + dataSize,
          changetype<usize>(out),
        );
      } else if (type instanceof JSON.Arr) {
        // Reuse the caller-supplied JSON.Arr (cleared, buffers kept). Otherwise allocate.
        // @ts-expect-error
        return deserializeJsonArray(
          dataPtr,
          dataPtr + dataSize,
          changetype<usize>(out),
        );
      } else if (type instanceof JSON.Box) {
        // @ts-expect-error
        return new JSON.Box(parseBox(data, changetype<nonnull<T>>(0).value));
      } else {
        throw new Error(
          `Could not deserialize JSON to type '${nameof<T>()}'. ` +
            `If this is a custom class, ensure it has the @json decorator: @json class ${nameof<T>()} { ... }. ` +
            `Input: "${data.length > 50 ? data.slice(0, 50) + "..." : data}"`,
        );
      }
    }
  }

  /**
   * Type alias for JSON type identifiers.
   */
  export type Types = u16;

  /**
   * Enum-like namespace representing the different types supported by JSON.Value.
   *
   * Used internally to track the runtime type of values stored in JSON.Value instances.
   * Types 0-19 are reserved for built-in types; custom @json classes use idof<T>() + Struct.
   */
  export namespace Types {
    /** Represents a null value */
    export const Null: u16 = 0;
    export const Raw: u16 = 1;
    export const U8: u16 = 2;
    export const U16: u16 = 3;
    export const U32: u16 = 4;
    export const U64: u16 = 5;
    export const I8: u16 = 6;
    export const I16: u16 = 7;
    export const I32: u16 = 8;
    export const I64: u16 = 9;
    export const F32: u16 = 10;
    export const F64: u16 = 11;
    export const Bool: u16 = 12;
    // Managed
    export const String: u16 = 13;
    export const Object: u16 = 14;
    export const Array: u16 = 15;
    export const Map: u16 = 16;
    export const Struct: u16 = 17;
    export const TypedArray: u16 = 18;
    export const ArrayBuffer: u16 = 19;
    /**
     * Internal: a not-yet-materialized value holding a raw source slice
     * (see LazyRef). Never returned by `JSON.Value.type` - accessing the value
     * materializes it first, so callers only ever observe the concrete type.
     */
    export const Lazy: u16 = 20;
  }

  /**
   * Wrapper for pre-formatted JSON strings that should be inserted as-is.
   *
   * Use this when you have a string that is already valid JSON and you don't
   * want it to be re-serialized (which would escape quotes and add extra quotes).
   *
   * @example
   * ```typescript
   * const map = new Map<string, JSON.Raw>();
   * map.set("pos", new JSON.Raw('{"x":1.0,"y":2.0}'));
   * JSON.stringify(map);  // {"pos":{"x":1.0,"y":2.0}}
   * ```
   */
  export class Raw {
    /** The raw JSON string data */
    public data: string;

    /**
     * Creates a new Raw JSON wrapper.
     * @param data - A valid JSON string to be inserted as-is
     */
    constructor(data: string) {
      this.data = data;
    }

    /**
     * Updates the raw JSON data.
     * @param data - New JSON string
     */
    set(data: string): void {
      this.data = data;
    }

    /**
     * Returns the raw JSON string.
     * @returns The raw JSON data
     */
    toString(): string {
      return this.data;
    }

    /**
     * Creates a new Raw instance from a string.
     * @param data - A valid JSON string
     * @returns A new Raw instance
     */
    static from(data: string): JSON.Raw {
      return new JSON.Raw(data);
    }
  }

  /**
   * Dynamic value container that can hold any JSON-compatible type at runtime.
   *
   * Use JSON.Value when dealing with JSON data whose structure is unknown at compile time,
   * or when you need to store values of different types in a single container.
   *
   * @example
   * ```typescript
   * // Parse unknown JSON structure
   * const arr = JSON.parse<JSON.Value[]>('["string", 42, true]');
   * console.log(arr[0].get<string>());  // "string"
   * console.log(arr[1].get<i32>().toString());  // 42
   *
   * // Create dynamic values
   * const val = JSON.Value.from<i32>(42);
   * val.set<string>("now a string");
   * ```
   */
  // @ts-expect-error: decorators allowed here
  @final export class Value {
    /** Map of struct type IDs to their serialization function indices */
    @lazy static METHODS: Map<u32, u32> = new Map<u32, u32>();

    /** NaN-boxed word holding both the type tag and the value (8 bytes). */
    private bits: u64;

    private constructor() {
      unreachable();
    }

    /**
     * The runtime type identifier (see JSON.Types), decoded from the boxed word.
     * Struct values report `idof<T>() + JSON.Types.Struct`, recovered from the
     * stored object's runtime header.
     */
    get type(): u16 {
      this.materialize();
      const w = this.bits;
      if (!valBoxed(w)) return JSON.Types.F64;
      const tag = valTag(w);
      if (tag == JSON.Types.Struct) {
        const rtId = changetype<OBJECT>(valPtr(w) - TOTAL_OVERHEAD).rtId;
        return <u16>rtId + JSON.Types.Struct;
      }
      return <u16>tag;
    }

    /**
     * Creates an JSON.Value instance with no set value.
     * @returns An instance of JSON.Value.
     */
    static empty(): JSON.Value {
      const out = changetype<JSON.Value>(
        __new(offsetof<JSON.Value>(), idof<JSON.Value>()),
      );
      out.bits = VAL_NULL;
      return out;
    }

    /**
     * Creates an JSON.Value instance from a given value.
     * @param value - The value to be encapsulated.
     * @returns An instance of JSON.Value.
     */
    static from<T>(value: T): JSON.Value {
      if (value instanceof JSON.Value) return value;
      const out = changetype<JSON.Value>(
        __new(offsetof<JSON.Value>(), idof<JSON.Value>()),
      );
      out.set<T>(value);
      return out;
    }

    /**
     * Creates a lazy JSON.Value wrapping the unparsed source slice
     * `[sliceStart, sliceEnd)` (UTF-16 byte pointers into `src`). The slice is
     * parsed into a concrete value on first access (see `materialize`); until
     * then it serializes by passing those bytes through verbatim. `src` anchors
     * the source string so the slice pointers stay valid. Internal - produced by
     * the dynamic deserializers, never called by user code.
     */
    static fromSlice(
      sliceStart: usize,
      sliceEnd: usize,
      src: string,
    ): JSON.Value {
      const ref = new LazyRef();
      ref.lz = ((<u64>sliceStart) << 32) | (<u64>(<u32>sliceEnd));
      ref.src = src;
      const out = changetype<JSON.Value>(
        __new(offsetof<JSON.Value>(), idof<JSON.Value>()),
      );
      out.bits = valBox(JSON.Types.Lazy, <u64>changetype<usize>(ref));
      return out;
    }

    /**
     * Copy `src`'s NaN-boxed bits into the already-allocated value at `dst`,
     * applying the itcms write barrier for any managed payload (mirrors
     * `__visit`'s tracing rule: tags >= String carry a pointer, as do
     * heap-spilled 64-bit ints). Lets `JSON.parse<JSON.Value>(data, out)` reuse
     * the caller's handle without materializing `src`.
     */
    @unsafe static __adoptInto(dst: usize, src: JSON.Value): JSON.Value {
      const target = changetype<JSON.Value>(dst);
      const bits = src.bits;
      target.bits = bits;
      if (valBoxed(bits)) {
        const tag = valTag(bits);
        if (
          tag >= JSON.Types.String ||
          ((tag == JSON.Types.U64 || tag == JSON.Types.I64) &&
            (bits & VAL_BOX64) != 0)
        ) {
          __link(dst, valPtr(bits), false);
        }
      }
      return target;
    }

    /**
     * Parses a deferred (lazy) value into a concrete one in place, replacing the
     * boxed slice with the real boxed value (cached for subsequent reads). The
     * deferred shapes are strings, objects and arrays; a string materializes to
     * a `string`, while a composite's own nested deferred children stay lazy -
     * one level is peeled per access. A no-op for already-materialized values.
     * Never allocates during GC (not called from `__visit`).
     */
    private materialize(): void {
      const w = this.bits;
      if (!valLazy(w)) return;
      const ref = changetype<LazyRef>(valPtr(w));
      const lz = ref.lz;
      this.bits = JSON.Value.parseSliceBits(
        <usize>(lz >>> 32),
        <usize>(<u32>lz),
        ref.src,
      );
    }

    /**
     * Parses the raw slice `[start, end)` (the allocating shapes only: string,
     * object, array) into a concrete value and returns its NaN-boxed bits. A
     * composite's own nested string/composite children stay lazy - one level is
     * peeled. Shared by `JSON.Value.materialize` (standalone lazy values) and
     * `JSON.Obj`'s value-slot materialization.
     */
    static parseSliceBits(start: usize, end: usize, src: string): u64 {
      const first = load<u16>(start);
      if (first == 0x22 /* '"' */) {
        // A string anchors no children, so no source pinning is needed.
        return valBox(
          JSON.Types.String,
          <u64>changetype<usize>(deserializeString(start, end)),
        );
      }
      // Pin the same source for the one level we peel so its children defer too.
      const prev = getParseSrc();
      setParseSrc(src);
      let bits: u64;
      if (first == 0x7b /* '{' */) {
        bits = valBox(
          JSON.Types.Object,
          <u64>changetype<usize>(deserializeObject(start, end, 0)),
        );
      } else {
        bits = valBox(
          JSON.Types.Array,
          <u64>changetype<usize>(deserializeJsonArray(start, end, 0)),
        );
      }
      setParseSrc(prev);
      return bits;
    }

    /**
     * Internal: the packed slice `(start << 32) | end` if this value is still a
     * deferred slice, else 0. Lets the serializer pass raw bytes through without
     * forcing materialization. `start` is a non-zero pointer, so a real slice is
     * never 0.
     */
    __lazySlice(): u64 {
      const w = this.bits;
      if (!valLazy(w)) return 0;
      return changetype<LazyRef>(valPtr(w)).lz;
    }

    /**
     * The cached serialize-escape class of a materialized String value: 0 = not
     * yet classified, 1 = clean (no chars need escaping, so it serializes via a
     * single memcpy), 2 = needs escaping. Stored in two spare payload bits so the
     * scan is paid once and reused. Only meaningful for String-tagged values.
     */
    __strClass(): u32 {
      return <u32>((this.bits >> VAL_STR_CLASS_SHIFT) & 3);
    }
    /** Records the serialize-escape class on this String value (see __strClass). */
    __setStrClass(c: u32): void {
      this.bits =
        (this.bits & ~VAL_STR_CLASS_MASK) | ((<u64>c) << VAL_STR_CLASS_SHIFT);
    }
    /**
     * Raw boxed bits. Lets the JSON.Obj/JSON.Arr serializers read back a class
     * the serializer cached on a transient value (see `serializeArbitrary`) and
     * persist it into their flat u64 slot, so re-serializing reuses it.
     */
    __bits(): u64 {
      return this.bits;
    }

    // --- value-slot helpers (JSON.Obj stores values as flat NaN-boxed u64 ---
    // slots instead of heap JSON.Value objects; these build/inspect/decode the
    // raw bits without allocating, while keeping the box layout encapsulated).

    /**
     * Bits for a deferred slot. The 45-bit payload has two forms (bit 44 selects):
     *
     *   compact (bit 44 = 0): the value's start *offset* and *length*, both in
     *     UTF-16 units relative to the source base - `(length << 22) | offset`.
     *     Gives the exact end with no scan for any value inside a source up to
     *     2^22 units (8 MB) whose own length is also < 8 MB. This is the common
     *     case, and storing a relative offset (vs an absolute pointer) is also
     *     GC-relocation-safe.
     *
     *   absolute (bit 44 = 1): the absolute start pointer in the low 32 bits;
     *     the end is scanned on demand. Fallback for a source or value past the
     *     8 MB field range - rare, and correct (it scans from the value start;
     *     scanning a composite cannot safely resume mid-value).
     */
    static lazyBits(srcBase: usize, start: usize, end: usize): u64 {
      const offset = <u64>((start - srcBase) >> 1);
      const length = <u64>((end - start) >> 1);
      let payload: u64;
      if (offset <= LZ_OFF_MASK && length <= LZ_LEN_MASK) {
        payload = (length << LZ_OFF_BITS) | offset;
      } else {
        payload = LZ_ABS_FLAG | ((<u64>start) & VAL_PTR_MASK);
      }
      return valBox(JSON.Types.Lazy, payload);
    }
    /** The value-end pointer of a lazy slot - from the packed length, or scanned. */
    static slotEnd(w: u64, srcBase: usize, srcEnd: usize): usize {
      const p = valPayload(w);
      if (p & LZ_ABS_FLAG) {
        return JSON.Util.scanValueEnd<JSON.Value>(
          <usize>(p & VAL_PTR_MASK),
          srcEnd,
        );
      }
      const start = srcBase + ((<usize>(p & LZ_OFF_MASK)) << 1);
      const length = <usize>((p >> LZ_OFF_BITS) & LZ_LEN_MASK);
      return start + (length << 1);
    }
    /** Bits for a JSON null. */
    static nullBits(): u64 {
      return VAL_NULL;
    }
    /** Bits for a boolean. */
    static boolBits(b: bool): u64 {
      return valBox(JSON.Types.Bool, b ? 1 : 0);
    }
    /** Bits for an f64 (raw IEEE-754, NaN canonicalized off the box signature). */
    static f64Bits(v: f64): u64 {
      return isNaN(v) ? 0x7ff8000000000000 : reinterpret<u64>(v);
    }
    /** Whether a slot is still a deferred (start-pointer) slice. */
    static slotIsLazy(w: u64): bool {
      return valLazy(w);
    }
    /** The start pointer held by a lazy slot (compact offset or absolute). */
    static slotPtr(w: u64, srcBase: usize): usize {
      const p = valPayload(w);
      if (p & LZ_ABS_FLAG) return <usize>(p & VAL_PTR_MASK);
      return srcBase + ((<usize>(p & LZ_OFF_MASK)) << 1);
    }
    /** Wraps raw bits in a JSON.Value (eager scalar / materialized reference). */
    static fromBits(w: u64): JSON.Value {
      const out = changetype<JSON.Value>(
        __new(offsetof<JSON.Value>(), idof<JSON.Value>()),
      );
      out.bits = w;
      return out;
    }
    /** Concrete NaN-boxed bits for a value of type T (materializing if lazy). */
    static bitsFrom<T>(value: T): u64 {
      const v = JSON.Value.from<T>(value);
      v.materialize();
      return v.bits;
    }
    /** Decodes NaN-boxed bits into T (the body of the instance `get<T>`). */
    static decodeBits<T>(w: u64): T {
      if (isFloat<T>()) {
        if (sizeof<T>() == 4) return <T>reinterpret<f32>(<u32>valPayload(w));
        return <T>reinterpret<f64>(w);
      } else if (isInteger<T>()) {
        if (sizeof<T>() == 8) {
          if (w & VAL_BOX64) return load<T>(valPtr(w));
          if (isSigned<T>()) return <T>((<i64>(valPayload(w) << 19)) >> 19);
          return <T>valPayload(w);
        }
        return <T>valPayload(w);
      } else if (isBoolean<T>()) {
        return <T>valPayload(w);
      } else if (isReference<T>()) {
        return changetype<T>(valPtr(w));
      }
      return unreachable();
    }

    /**
     * Gets the type of a given value as a JSON.Types enum.
     * @param value - any
     * @returns JSON.Types
     */
    getType<T>(value: T): JSON.Types {
      if (isNullable<T>() && changetype<usize>(value) === 0)
        return JSON.Types.Null;
      if (isBoolean<T>()) return JSON.Types.Bool;
      if (
        isInteger<T>() &&
        !isSigned<T>() &&
        changetype<usize>(value) == 0 &&
        nameof<T>() == "usize"
      )
        return JSON.Types.Null;
      if (isString<T>()) return JSON.Types.String;
      // @ts-expect-error: can assume that T is ArrayLike based on previous condition
      if (isArray<T>() && idof<valueof<T>>() == idof<JSON.Value>())
        return JSON.Types.Array;
      if (value instanceof JSON.Box) return this.getType(value.value);
      if (value instanceof i8) return JSON.Types.I8;
      if (value instanceof i16) return JSON.Types.I16;
      if (value instanceof i32) return JSON.Types.I32;
      if (value instanceof i64) return JSON.Types.I64;
      if (value instanceof u8) return JSON.Types.U8;
      if (value instanceof u16) return JSON.Types.U16;
      if (value instanceof u32) return JSON.Types.U32;
      if (value instanceof u64) return JSON.Types.U64;
      if (value instanceof f32) return JSON.Types.F32;
      if (value instanceof f64) return JSON.Types.F64;
      // @ts-expect-error: supplied by transform
      if (isDefined(value.__SERIALIZE) && isManaged<T>(value))
        return u16(idof<T>()) + JSON.Types.Struct;
      if (
        value instanceof Int8Array ||
        value instanceof Uint8Array ||
        value instanceof Uint8ClampedArray ||
        value instanceof Int16Array ||
        value instanceof Uint16Array ||
        value instanceof Int32Array ||
        value instanceof Uint32Array ||
        value instanceof Int64Array ||
        value instanceof Uint64Array ||
        value instanceof Float32Array ||
        value instanceof Float64Array
      )
        return JSON.Types.TypedArray;
      if (value instanceof ArrayBuffer) return JSON.Types.ArrayBuffer;
      if (value instanceof Map) return JSON.Types.Map;
      if (value instanceof JSON.Raw) return JSON.Types.Raw;
      if (value instanceof JSON.Obj) return JSON.Types.Object;
      if (value instanceof JSON.Arr) return JSON.Types.Array;
      return JSON.Types.Null;
    }
    /**
     * Sets the value of the JSON.Value instance.
     * @param value - The value to be set.
     */
    set<T>(value: T): void {
      if (value instanceof JSON.Box) {
        this.set(value.value);
      } else if (isBoolean<T>()) {
        this.bits = valBox(JSON.Types.Bool, value ? 1 : 0);
      } else if (isInteger<T>() && nameof<T>() == "usize") {
        // A `usize` of 0 is the null sentinel (see deserializeArbitrary);
        // any other usize is an ordinary 32-bit unsigned integer.
        this.bits = value ? valBox(valIntTag<T>(), <u64>value) : VAL_NULL;
      } else if (isFloat<T>()) {
        if (sizeof<T>() == 4) {
          this.bits = valBox(JSON.Types.F32, <u64>reinterpret<u32>(<f32>value));
        } else {
          const f = <f64>value;
          // Canonicalize NaN so it never collides with the box signature.
          this.bits = isNaN(f) ? 0x7ff8000000000000 : reinterpret<u64>(f);
        }
      } else if (isInteger<T>()) {
        if (sizeof<T>() == 8) this.setWide<T>(value);
        else this.bits = valBox(valIntTag<T>(), <u64>value);
      } else if (isNullable<T>() && changetype<usize>(value) === 0) {
        this.bits = VAL_NULL;
      } else if (isString<T>()) {
        this.bits = valBox(JSON.Types.String, <u64>changetype<usize>(value));
      } else if (value instanceof JSON.Raw) {
        this.bits = valBox(JSON.Types.Raw, <u64>changetype<usize>(value));
        // @ts-expect-error: supplied by transform
      } else if (isDefined(value.__SERIALIZE) && isManaged<T>(value)) {
        // @ts-expect-error
        if (!JSON.Value.METHODS.has(idof<T>()))
          JSON.Value.METHODS.set(idof<T>(), value.__SERIALIZE.index);
        this.bits = valBox(JSON.Types.Struct, <u64>changetype<usize>(value));
      } else if (
        value instanceof Int8Array ||
        value instanceof Uint8Array ||
        value instanceof Uint8ClampedArray ||
        value instanceof Int16Array ||
        value instanceof Uint16Array ||
        value instanceof Int32Array ||
        value instanceof Uint32Array ||
        value instanceof Int64Array ||
        value instanceof Uint64Array ||
        value instanceof Float32Array ||
        value instanceof Float64Array
      ) {
        this.bits = valBox(
          JSON.Types.TypedArray,
          <u64>changetype<usize>(value),
        );
      } else if (value instanceof ArrayBuffer) {
        this.bits = valBox(
          JSON.Types.ArrayBuffer,
          <u64>changetype<usize>(value),
        );
      } else if (value instanceof Map) {
        if (idof<T>() !== idof<Map<string, JSON.Value>>()) {
          abort("Maps must be of type Map<string, JSON.Value>!");
        }
        this.bits = valBox(JSON.Types.Map, <u64>changetype<usize>(value));
      } else if (value instanceof JSON.Obj) {
        this.bits = valBox(JSON.Types.Object, <u64>changetype<usize>(value));
      } else if (value instanceof JSON.Arr) {
        this.bits = valBox(JSON.Types.Array, <u64>changetype<usize>(value));
        // @ts-expect-error
      } else if (isArray<T>() && idof<valueof<T>>() == idof<JSON.Value>()) {
        // A JSON.Value[] is converted to the buffer-backed JSON.Arr form, so
        // the Array tag always boxes a JSON.Arr.
        this.bits = valBox(
          JSON.Types.Array,
          <u64>changetype<usize>(JSON.Arr.from<T>(value)),
        );
      }
    }

    /** Encodes a 64-bit integer, spilling to the heap when it exceeds the payload. */
    private setWide<T>(value: T): void {
      if (isSigned<T>()) {
        const v = <i64>value;
        if (v >= -VAL_I64_LIMIT && v < VAL_I64_LIMIT) {
          this.bits = valBox(JSON.Types.I64, <u64>v);
        } else {
          const box = new StaticArray<u64>(1);
          unchecked((box[0] = <u64>v));
          this.bits =
            valBox(JSON.Types.I64, <u64>changetype<usize>(box)) | VAL_BOX64;
        }
      } else {
        const v = <u64>value;
        if (v < VAL_U64_LIMIT) {
          this.bits = valBox(JSON.Types.U64, v);
        } else {
          const box = new StaticArray<u64>(1);
          unchecked((box[0] = v));
          this.bits =
            valBox(JSON.Types.U64, <u64>changetype<usize>(box)) | VAL_BOX64;
        }
      }
    }

    /**
     * Gets the value of the JSON.Value instance.
     * @returns The encapsulated value.
     */
    get<T>(): T {
      this.materialize();
      return JSON.Value.decodeBits<T>(this.bits);
    }

    /**
     * Gets the value of the JSON.Value instance.
     * Alias for .get<T>()
     * @returns The encapsulated value.
     */
    as<T>(): T {
      return this.get<T>();
    }

    /**
     * Gets the value of the JSON.Value instance as a Box<T>.
     * Alias for .get<T>()
     * @returns The encapsulated value.
     */
    asBox<T>(): Box<T> | null {
      this.materialize();
      if (this.type === JSON.Types.Null) return null;
      return changetype<Box<T>>(JSON.Box.fromValue<T>(this));
    }

    /**
     * Converts the JSON.Value to a string representation.
     * @returns The string representation of the JSON.Value.
     */
    toString(): string {
      this.materialize();
      switch (this.type) {
        case JSON.Types.Null:
          return "null";
        case JSON.Types.U8:
          return this.get<u8>().toString();
        case JSON.Types.U16:
          return this.get<u16>().toString();
        case JSON.Types.U32:
          return this.get<u32>().toString();
        case JSON.Types.U64:
          return this.get<u64>().toString();
        case JSON.Types.I8:
          return this.get<i8>().toString();
        case JSON.Types.I16:
          return this.get<i16>().toString();
        case JSON.Types.I32:
          return this.get<i32>().toString();
        case JSON.Types.I64:
          return this.get<i64>().toString();
        case JSON.Types.F32:
          return this.get<f32>().toString();
        case JSON.Types.F64:
          return this.get<f64>().toString();
        case JSON.Types.String:
          return '"' + this.get<string>() + '"';
        case JSON.Types.Bool:
          return this.get<boolean>() ? "true" : "false";
        case JSON.Types.Raw: {
          return this.get<JSON.Raw>().toString();
        }
        case JSON.Types.Array: {
          return JSON.stringify(this.get<JSON.Arr>());
        }
        case JSON.Types.TypedArray:
        case JSON.Types.ArrayBuffer: {
          serializeDynamic(this.type, this.get<usize>());
          return bs.out<string>();
        }
        case JSON.Types.Object: {
          return JSON.stringify(this.get<JSON.Obj>());
        }
        default: {
          const fn = JSON.Value.METHODS.get(this.type - JSON.Types.Struct);
          const value = this.get<usize>();
          call_indirect<void>(fn, 0, value);
          return bs.out<string>();
        }
      }
    }


    @unsafe private __visit(cookie: u32): void {
      const w = this.bits;
      if (!valBoxed(w)) return; // raw f64 holds no reference
      const tag = valTag(w);
      // A deferred value carries a LazyRef pointer; tracing it keeps the LazyRef
      // (and, transitively, its `src` anchor) alive. Must precede the
      // `tag >= String` branch since Lazy(20) would otherwise fall into it.
      // Trace-only - never materialize here (no allocation during GC).
      if (tag == JSON.Types.Lazy) {
        __visit(valPtr(w), cookie);
        return;
      }
      // String(13)..ArrayBuffer(19) and Struct all carry a managed pointer;
      // Raw(1) is intentionally not traced (matches prior behavior).
      if (tag >= JSON.Types.String) {
        __visit(valPtr(w), cookie);
      } else if (
        (tag == JSON.Types.U64 || tag == JSON.Types.I64) &&
        w & VAL_BOX64
      ) {
        __visit(valPtr(w), cookie); // heap-spilled 64-bit int
      }
    }
  }

  /**
   * Dynamic JSON object with string keys and JSON.Value values.
   *
   * Use JSON.Obj when parsing JSON objects with unknown structure, or when building
   * dynamic JSON objects at runtime.
   *
   * @example
   * ```typescript
   * // Parse unknown object
   * const obj = JSON.parse<JSON.Obj>('{"name":"Alice","age":30}');
   * console.log(obj.get("name")!.get<string>());  // "Alice"
   *
   * // Build dynamic object
   * const obj = new JSON.Obj();
   * obj.set("key", "value");
   * obj.set("count", 42);
   * console.log(JSON.stringify(obj));  // {"key":"value","count":42}
   * ```
   */
  @final export class Obj {
    _kbuf: StaticArray<u16> = EMPTY_KEYS;
    _kused: i32 = 0;
    _kpos: StaticArray<i32> = EMPTY_I32S;
    _vals: StaticArray<u64> = EMPTY_VALS;
    _vused: i32 = 0;
    /** Source string the lazy slot pointers index into; anchors it for GC. */
    _src: string = "";
    private _index: StaticArray<i32> | null = null;
    private _indexMask: i32 = 0;

    constructor() {}

    /**
     * Gets the number of key-value pairs in the object.
     */
    get size(): i32 {
      return this._vused;
    }

    /** Grows the key buffer to hold at least `need` code units. */
    private ensureKeyCap(need: i32): void {
      const cap = this._kbuf.length;
      if (cap >= need) return;
      let n = cap ? cap : 16;
      while (n < need) n <<= 1;
      const nb = new StaticArray<u16>(n);
      if (this._kused)
        memory.copy(
          changetype<usize>(nb),
          changetype<usize>(this._kbuf),
          (<usize>this._kused) << 1,
        );
      this._kbuf = nb;
    }

    /** Grows the key-position buffer to hold at least `need` entries. */
    private ensureKeyPosCap(need: i32): void {
      const cap = this._kpos.length;
      if (cap >= need) return;
      let n = cap ? cap : 8;
      while (n < need) n <<= 1;
      const nb = new StaticArray<i32>(n);
      if (this._vused)
        memory.copy(
          changetype<usize>(nb),
          changetype<usize>(this._kpos),
          (<usize>this._vused) << 2,
        );
      this._kpos = nb;
    }

    /** Appends a length-prefixed key (from a source memory range). */
    private pushKeyBytes(keyStart: usize, keyEnd: usize, slotIndex: i32): void {
      const len = <i32>((keyEnd - keyStart) >> 1);
      const pos = this._kused;
      this.ensureKeyCap(pos + 1 + len);
      this.ensureKeyPosCap(slotIndex + 1);
      const buf = changetype<usize>(this._kbuf);
      store<u16>(buf + ((<usize>pos) << 1), <u16>len);
      if (len)
        memory.copy(
          buf + ((<usize>(pos + 1)) << 1),
          keyStart,
          (<usize>len) << 1,
        );
      unchecked((this._kpos[slotIndex] = pos));
      this._kused = pos + 1 + len;
    }

    /** Materializes a key string from `len` code units starting at slot `at`. */
    private makeKey(at: i32, len: i32): string {
      const out = changetype<string>(__new((<usize>len) << 1, idof<string>()));
      if (len)
        memory.copy(
          changetype<usize>(out),
          changetype<usize>(this._kbuf) + ((<usize>at) << 1),
          (<usize>len) << 1,
        );
      return out;
    }

    /** Grows the value-slot buffer to hold at least `need` slots. */
    private ensureValCap(need: i32): void {
      const cap = this._vals.length;
      if (cap >= need) return;
      let n = cap ? cap : 8;
      while (n < need) n <<= 1;
      const nb = new StaticArray<u64>(n);
      if (this._vused)
        memory.copy(
          changetype<usize>(nb),
          changetype<usize>(this._vals),
          (<usize>this._vused) << 3,
        );
      this._vals = nb;
    }

    /** Writes a slot and, if it carries a managed pointer, links it for the GC. */
    private storeSlot(i: i32, bits: u64): void {
      unchecked((this._vals[i] = bits));
      if (valBoxed(bits)) {
        const tag = valTag(bits);
        // Lazy slots hold an interior `_src` pointer (anchored by the _src
        // field), not an owned object - never link those.
        if (
          tag != JSON.Types.Lazy &&
          (tag >= JSON.Types.String ||
            ((tag == JSON.Types.U64 || tag == JSON.Types.I64) &&
              bits & VAL_BOX64))
        ) {
          __link(changetype<usize>(this), valPtr(bits), false);
        }
      }
    }

    /** Appends a value slot (raw NaN-boxed bits). */
    private pushValSlot(bits: u64): void {
      const pos = this._vused;
      this.ensureValCap(pos + 1);
      this._vused = pos + 1;
      this.storeSlot(pos, bits);
    }

    /** End pointer of the source buffer (upper bound for scanning a lazy slot). */
    private srcEnd(): usize {
      return changetype<usize>(this._src) + ((<usize>this._src.length) << 1);
    }

    /** Compares a lookup key against the stored key bytes for slot `i`. */
    private keyEquals(i: i32, key: string): bool {
      const pos = unchecked(this._kpos[i]);
      const buf = changetype<usize>(this._kbuf) + ((<usize>pos) << 1);
      const len = <i32>load<u16>(buf);
      if (len != <i32>key.length) return false;
      return utf16Equals(changetype<usize>(key), buf + 2, len);
    }

    /** Compares two stored key slots without materializing strings. */
    private slotEqualsSlot(a: i32, b: i32): bool {
      const posa = unchecked(this._kpos[a]);
      const bufA = changetype<usize>(this._kbuf) + ((<usize>posa) << 1);
      const lenA = <i32>load<u16>(bufA);
      const posb = unchecked(this._kpos[b]);
      const bufB = changetype<usize>(this._kbuf) + ((<usize>posb) << 1);
      const lenB = <i32>load<u16>(bufB);
      if (lenA != lenB) return false;
      return utf16Equals(bufA + 2, bufB + 2, lenA);
    }

    /** Hashes the stored key for slot `i`. */
    private keyHashAt(i: i32): u32 {
      const pos = unchecked(this._kpos[i]);
      const buf = changetype<usize>(this._kbuf) + ((<usize>pos) << 1);
      const len = <i32>load<u16>(buf);
      return hashUtf16(buf + 2, len);
    }

    /** Resolves a key to its slot index, or -1 if absent. */
    private indexOf(key: string): i32 {
      const n = this._vused;
      const keyLen = <i32>key.length;
      // Small objects: scan linearly and never build a hash index. The keys are
      // packed contiguously in _kbuf and the length prefix rejects mismatches
      // before any byte compare. Scan from the end so a duplicate key resolves
      // to its LAST occurrence - JSON last-value-wins, matching buildIndex()
      // (which overwrites the slot on a collision) for objects above the
      // threshold; a forward scan would return the first and disagree.
      if (n <= OBJ_LINEAR_MAX) {
        const kbuf = changetype<usize>(this._kbuf);
        const keyPtr = changetype<usize>(key);
        const kpos = this._kpos;
        for (let i = n - 1; i >= 0; i--) {
          const buf = kbuf + ((<usize>unchecked(kpos[i])) << 1);
          if (
            <i32>load<u16>(buf) == keyLen &&
            utf16Equals(keyPtr, buf + 2, keyLen)
          )
            return i;
        }
        return -1;
      }
      const idx = this.buildIndex();
      const mask = this._indexMask;
      if (mask == 0) {
        const entry = unchecked(idx[0]);
        return entry != 0 && this.keyEquals(entry - 1, key) ? entry - 1 : -1;
      }
      let slot = <i32>(
        (hashUtf16(changetype<usize>(key), <i32>key.length) & (<u32>mask))
      );
      const start = slot;
      while (true) {
        const entry = unchecked(idx[slot]);
        if (entry == 0) return -1;
        const i = entry - 1;
        if (this.keyEquals(i, key)) return i;
        slot = (slot + 1) & mask;
        // A correctly-maintained table stays below full load, so an empty slot
        // is found first. This wrap check is a safety net against spinning
        // forever should that invariant ever be violated.
        if (slot == start) return -1;
      }
    }

    /** Parses a lazy slot in place, caching the concrete box, and returns it. */
    private materializeSlot(i: i32): u64 {
      const slot = unchecked(this._vals[i]);
      if (!JSON.Value.slotIsLazy(slot)) return slot;
      const base = changetype<usize>(this._src);
      const start = JSON.Value.slotPtr(slot, base);
      const end = JSON.Value.slotEnd(slot, base, this.srcEnd());
      const bits = JSON.Value.parseSliceBits(start, end, this._src);
      this.storeSlot(i, bits);
      return bits;
    }

    /**
     * Appends a key (from a source memory range) and a precomputed NaN-boxed
     * value slot without a duplicate-key check. Used by the deserializer - no
     * per-key string allocation, no per-value object, no hashing.
     */
    appendRawSlot(keyStart: usize, keyEnd: usize, bits: u64): void {
      const slotIndex = this._vused;
      this.pushKeyBytes(keyStart, keyEnd, slotIndex);
      this.pushValSlot(bits);
      this.insertIndex(slotIndex);
    }

    /**
     * Appends a key and value (any T) without a duplicate-key check. Eagerly
     * boxes the value into a slot.
     */
    appendRaw<T>(keyStart: usize, keyEnd: usize, value: T): void {
      this.appendRawSlot(keyStart, keyEnd, JSON.Value.bitsFrom<T>(value));
    }

    /** Inserts a single slot into an already-built index. */
    private insertIndex(slotIndex: i32): void {
      const idx = this._index;
      if (idx === null) return;
      const mask = this._indexMask;
      let slot = <i32>(this.keyHashAt(slotIndex) & (<u32>mask));
      const start = slot;
      while (unchecked(idx[slot]) != 0) {
        const entry = unchecked(idx[slot]) - 1;
        if (this.slotEqualsSlot(entry, slotIndex)) {
          unchecked((idx[slot] = slotIndex + 1));
          return;
        }
        slot = (slot + 1) & mask;
        if (slot == start) {
          this._index = null;
          return;
        }
      }
      unchecked((idx[slot] = slotIndex + 1));
      // buildIndex() sizes the table at >2x the entry count (load < 0.5), but it
      // only runs lazily; appends since then go through here without resizing.
      // Once we cross half load, drop the index so the next access rebuilds it at
      // double capacity — this keeps an empty slot available for every probe.
      // Without it a small (e.g. cap-2) table fills and indexOf() spins forever.
      if ((slotIndex + 1) << 1 > mask + 1) this._index = null;
    }

    /** Builds (once) and returns the lazy key -> position index. */
    private buildIndex(): StaticArray<i32> {
      let idx = this._index;
      if (idx === null) {
        const used = this._vused;
        let cap = 2;
        while (cap <= used << 1) cap <<= 1;
        idx = new StaticArray<i32>(cap);
        const mask = cap - 1;
        for (let i = 0; i < used; i++) {
          const keyPos = unchecked(this._kpos[i]);
          const buf = changetype<usize>(this._kbuf) + ((<usize>keyPos) << 1);
          const len = <i32>load<u16>(buf);
          let slot = <i32>(hashUtf16(buf + 2, len) & (<u32>mask));
          while (unchecked(idx[slot]) != 0) {
            const entry = unchecked(idx[slot]) - 1;
            if (this.slotEqualsSlot(entry, i)) {
              unchecked((idx[slot] = i + 1));
              break;
            }
            slot = (slot + 1) & mask;
          }
          if (unchecked(idx[slot]) == 0) unchecked((idx[slot] = i + 1));
        }
        this._index = idx;
        this._indexMask = mask;
      }
      return idx;
    }

    /**
     * Sets a key-value pair in the object, overwriting any existing value.
     * @param key - The string key
     * @param value - The value (will be wrapped in JSON.Value)
     */
    set<T>(key: string, value: T): void {
      const bits = JSON.Value.bitsFrom<T>(value);
      const i = this.indexOf(key);
      if (i >= 0) {
        this.storeSlot(i, bits);
      } else {
        const slotIndex = this._vused;
        this.pushKeyBytes(
          changetype<usize>(key),
          changetype<usize>(key) + ((<usize>key.length) << 1),
          slotIndex,
        );
        this.pushValSlot(bits);
        this.insertIndex(slotIndex);
      }
    }

    /**
     * Gets a value by key as a JSON.Value (dynamic access).
     * @param key - The key to look up
     * @returns The JSON.Value or null if not found
     */
    get(key: string): JSON.Value | null {
      const i = this.indexOf(key);
      if (i < 0) return null;
      const slot = unchecked(this._vals[i]);
      if (JSON.Value.slotIsLazy(slot)) {
        // Hand back a self-contained lazy value (its own slice + anchor) so it
        // can materialize independently of this object.
        const base = changetype<usize>(this._src);
        const start = JSON.Value.slotPtr(slot, base);
        const end = JSON.Value.slotEnd(slot, base, this.srcEnd());
        return JSON.Value.fromSlice(start, end, this._src);
      }
      return JSON.Value.fromBits(slot);
    }

    /**
     * Gets a value by key directly as `T`, with no intermediate JSON.Value
     * allocation. A deferred slot is parsed (and cached) on first access; an
     * absent key returns the type's default (null / 0 / false).
     *
     * Named `getAs` rather than `get<T>` because AssemblyScript has no method
     * overloading - `get(key)` (dynamic) and a typed `get` can't share a name.
     * @param key - The key to look up
     */
    getAs<T>(key: string): T {
      const i = this.indexOf(key);
      if (i < 0) return __zero<T>();
      let slot = unchecked(this._vals[i]);
      if (JSON.Value.slotIsLazy(slot)) slot = this.materializeSlot(i);
      return JSON.Value.decodeBits<T>(slot);
    }

    /**
     * Checks if a key exists in the object.
     * @param key - The key to check
     * @returns true if the key exists
     */
    has(key: string): bool {
      return this.indexOf(key) >= 0;
    }

    /**
     * Deletes a key-value pair from the object.
     * @param key - The key to delete
     * @returns true if the key was found and deleted
     */
    delete(key: string): bool {
      const removed = this.indexOf(key);
      if (removed < 0) return false;
      const keys = this.keys();
      const oldVals = this._vals;
      const n = this._vused;
      this._kbuf = EMPTY_KEYS;
      this._kused = 0;
      this._kpos = EMPTY_I32S;
      this._vals = EMPTY_VALS;
      this._vused = 0;
      for (let j = 0; j < n; j++) {
        if (j == removed) continue;
        const k = unchecked(keys[j]);
        this.pushKeyBytes(
          changetype<usize>(k),
          changetype<usize>(k) + ((<usize>k.length) << 1),
          this._vused,
        );
        this.pushValSlot(unchecked(oldVals[j]));
      }
      this._index = null;
      this._indexMask = 0;
      return true;
    }

    /**
     * Removes all entries. Backing key/value buffer capacity is kept so a
     * subsequent parse or insert reuses it without re-allocating - this is what
     * makes `JSON.parse<JSON.Obj>(data, out)` allocation-light. `__visit` only
     * traces `[0, _vused)`, so resetting the used counters drops the old slots
     * from GC tracing safely.
     */
    clear(): void {
      this._kused = 0;
      this._kpos = EMPTY_I32S;
      this._vused = 0;
      this._src = "";
      this._index = null;
      this._indexMask = 0;
    }

    /**
     * Gets all keys in the object.
     * @returns Array of string keys (in insertion order)
     */
    keys(): string[] {
      const out = new Array<string>(this._vused);
      const buf = changetype<usize>(this._kbuf);
      const used = this._kused;
      let pos = 0;
      let i = 0;
      while (pos < used) {
        const len = <i32>load<u16>(buf + ((<usize>pos) << 1));
        unchecked((out[i++] = this.makeKey(pos + 1, len)));
        pos += 1 + len;
      }
      return out;
    }

    /**
     * Gets all values in the object.
     * @returns Array of JSON.Value instances (in insertion order)
     */
    values(): JSON.Value[] {
      const n = this._vused;
      const out = new Array<JSON.Value>(n);
      const base = changetype<usize>(this._src);
      const srcEnd = this.srcEnd();
      for (let i = 0; i < n; i++) {
        const slot = unchecked(this._vals[i]);
        if (JSON.Value.slotIsLazy(slot)) {
          const start = JSON.Value.slotPtr(slot, base);
          const end = JSON.Value.slotEnd(slot, base, srcEnd);
          unchecked((out[i] = JSON.Value.fromSlice(start, end, this._src)));
        } else {
          unchecked((out[i] = JSON.Value.fromBits(slot)));
        }
      }
      return out;
    }

    /**
     * Serializes the object to a JSON string.
     * @returns JSON string representation
     */
    toString(): string {
      return JSON.stringify(this);
    }

    /**
     * Creates a JSON.Obj from another value.
     * @param value - The value to convert
     * @returns A new JSON.Obj instance
     */
    static from<T>(value: T): JSON.Obj {
      if (value instanceof JSON.Obj) return value;
      if (value instanceof Map) {
        const out = new JSON.Obj();
        if (!isString<indexof<T>>()) {
          throw new Error("JSON.Obj.from only supports maps with string keys");
        }

        const keys = value.keys();
        const values = value.values();
        for (let i = 0; i < keys.length; i++) {
          out.set(unchecked(keys[i]), unchecked(values[i]));
        }
        return out;
      }

      const parsed = JSON.parse<JSON.Value>(JSON.stringify(value));
      if (parsed.type != JSON.Types.Object) {
        throw new Error(
          "JSON.Obj.from expects a value that serializes to a JSON object",
        );
      }
      return parsed.get<JSON.Obj>();
    }


    @unsafe private __visit(cookie: u32): void {
      __visit(changetype<usize>(this._kbuf), cookie);
      __visit(changetype<usize>(this._kpos), cookie);
      __visit(changetype<usize>(this._vals), cookie);
      __visit(changetype<usize>(this._src), cookie);
      __visit(changetype<usize>(this._index), cookie); // null-safe in rt
      const vals = this._vals;
      const n = this._vused;
      for (let i = 0; i < n; i++) {
        const w = unchecked(vals[i]);
        if (!valBoxed(w)) continue; // raw f64, no reference
        const tag = valTag(w);
        if (tag == JSON.Types.Lazy) continue; // interior _src pointer
        if (tag >= JSON.Types.String) {
          __visit(valPtr(w), cookie);
        } else if (
          (tag == JSON.Types.U64 || tag == JSON.Types.I64) &&
          w & VAL_BOX64
        ) {
          __visit(valPtr(w), cookie); // heap-spilled 64-bit int
        }
      }
    }
  }

  /**
   * Dynamic JSON array with JSON.Value elements, backed by the same flat
   * NaN-boxed u64 slot buffer as JSON.Obj (no per-element JSON.Value objects).
   * Deferred string/array/object elements are parsed on first access; untouched
   * elements serialize straight from their source bytes.
   *
   * Index with `arr.at(i)` (returns a JSON.Value) or read typed via `getAs<T>(i)`.
   *
   * @example
   * ```typescript
   * const arr = JSON.parse<JSON.Arr>('[1,"two",[3,4]]');
   * arr.at(0).get<f64>();           // 1
   * arr.getAs<string>(1);           // "two"
   * arr.getAs<JSON.Arr>(2).at(0);   // 3
   * ```
   */
  @final export class Arr {
    // Same flat slot model as JSON.Obj, without the key buffer. See JSON.Obj for
    // the slot encoding, the custom `__visit`, and the `__link` write barrier.
    _vals: StaticArray<u64> = EMPTY_VALS;
    _vused: i32 = 0;
    /** Source string the lazy slot pointers index into; anchors it for GC. */
    _src: string = "";

    constructor() {}

    /** Number of elements. */
    get length(): i32 {
      return this._vused;
    }

    /**
     * Removes all elements, keeping the value-slot buffer capacity so a
     * subsequent parse or push reuses it - powers `JSON.parse<JSON.Arr>(data,
     * out)`. `__visit` only traces `[0, _vused)`, so this is GC-safe.
     */
    clear(): void {
      this._vused = 0;
      this._src = "";
    }

    /** Grows the value-slot buffer to hold at least `need` slots. */
    private ensureValCap(need: i32): void {
      const cap = this._vals.length;
      if (cap >= need) return;
      let n = cap ? cap : 8;
      while (n < need) n <<= 1;
      const nb = new StaticArray<u64>(n);
      if (this._vused)
        memory.copy(
          changetype<usize>(nb),
          changetype<usize>(this._vals),
          (<usize>this._vused) << 3,
        );
      this._vals = nb;
    }

    /** Writes a slot and, if it carries a managed pointer, links it for the GC. */
    private storeSlot(i: i32, bits: u64): void {
      unchecked((this._vals[i] = bits));
      if (valBoxed(bits)) {
        const tag = valTag(bits);
        if (
          tag != JSON.Types.Lazy &&
          (tag >= JSON.Types.String ||
            ((tag == JSON.Types.U64 || tag == JSON.Types.I64) &&
              bits & VAL_BOX64))
        ) {
          __link(changetype<usize>(this), valPtr(bits), false);
        }
      }
    }

    /** Appends a value slot (raw NaN-boxed bits). Deserializer entry point. */
    pushRawSlot(bits: u64): void {
      const pos = this._vused;
      this.ensureValCap(pos + 1);
      this._vused = pos + 1;
      this.storeSlot(pos, bits);
    }

    /** End pointer of the source buffer (upper bound for scanning a lazy slot). */
    private srcEnd(): usize {
      return changetype<usize>(this._src) + ((<usize>this._src.length) << 1);
    }

    /** Parses a lazy slot in place, caching the concrete box, and returns it. */
    private materializeSlot(i: i32): u64 {
      const slot = unchecked(this._vals[i]);
      if (!JSON.Value.slotIsLazy(slot)) return slot;
      const base = changetype<usize>(this._src);
      const start = JSON.Value.slotPtr(slot, base);
      const end = JSON.Value.slotEnd(slot, base, this.srcEnd());
      const bits = JSON.Value.parseSliceBits(start, end, this._src);
      this.storeSlot(i, bits);
      return bits;
    }

    /** Element access as a JSON.Value: `arr.at(i)`. */
    at(index: i32): JSON.Value {
      if (<u32>index >= <u32>this._vused) throw new Error("Index out of range");
      const slot = unchecked(this._vals[index]);
      if (JSON.Value.slotIsLazy(slot)) {
        const base = changetype<usize>(this._src);
        const start = JSON.Value.slotPtr(slot, base);
        const end = JSON.Value.slotEnd(slot, base, this.srcEnd());
        return JSON.Value.fromSlice(start, end, this._src);
      }
      return JSON.Value.fromBits(slot);
    }

    /**
     * Reads element `i` directly as `T`, with no intermediate JSON.Value
     * allocation. A deferred slot is parsed (and cached) on first access.
     * @param i - element index
     */
    getAs<T>(i: i32): T {
      let slot = unchecked(this._vals[i]);
      if (JSON.Value.slotIsLazy(slot)) slot = this.materializeSlot(i);
      return JSON.Value.decodeBits<T>(slot);
    }

    /** Appends a value (any T), eagerly boxed into a slot. */
    push<T>(value: T): void {
      this.pushRawSlot(JSON.Value.bitsFrom<T>(value));
    }

    /** Overwrites element `i`. */
    set<T>(i: i32, value: T): void {
      this.storeSlot(i, JSON.Value.bitsFrom<T>(value));
    }

    /**
     * Bounds-checked element access via `arr[i]` - returns a `JSON.Value`
     * (allocating), mirroring `at(i)`. For an allocation-free typed read use
     * `getAs<T>(i)`.
     */
    @operator("[]") private __get(index: i32): JSON.Value {
      return this.at(index);
    }

    /** Element assignment via `arr[i] = value` (any `JSON.Value`). */
    @operator("[]=") private __set(index: i32, value: JSON.Value): void {
      this.set<JSON.Value>(index, value);
    }

    /** Serializes the array to a JSON string. */
    toString(): string {
      return JSON.stringify(this);
    }

    /** Creates a JSON.Arr from a JSON.Value[] (or returns an existing one). */
    static from<T>(value: T): JSON.Arr {
      if (value instanceof JSON.Arr) return value;
      // @ts-expect-error: handled by the isArray guard below
      if (isArray<T>() && idof<valueof<T>>() == idof<JSON.Value>()) {
        const out = new JSON.Arr();
        // @ts-expect-error: T is JSON.Value[] here
        const arr = changetype<JSON.Value[]>(value);
        for (let i = 0; i < arr.length; i++) {
          out.pushRawSlot(JSON.Value.bitsFrom<JSON.Value>(unchecked(arr[i])));
        }
        return out;
      }
      throw new Error("JSON.Arr.from expects a JSON.Value[]");
    }

    // ---- Array-like API: slot-optimized ports of the AssemblyScript stdlib ----
    // Slot-shuffling ops (reverse/fill/copyWithin/pop/shift/unshift/slice/splice)
    // move the raw u64 slots directly - no per-element JSON.Value - and keep any
    // managed pointers linked to the same owner. New single-source results share
    // `_src`, so copied deferred ranges stay lazy. Callbacks get a JSON.Value view
    // of each element via `at(i)`.

    /** Concrete, source-independent bits for slot `i` (resolves a deferred slot
     *  without caching it back into this array - used by cross-source ops). */
    private resolvedBits(i: i32): u64 {
      const slot = unchecked(this._vals[i]);
      if (!JSON.Value.slotIsLazy(slot)) return slot;
      const base = changetype<usize>(this._src);
      const start = JSON.Value.slotPtr(slot, base);
      const end = JSON.Value.slotEnd(slot, base, this.srcEnd());
      return JSON.Value.parseSliceBits(start, end, this._src);
    }

    /** Appends `count` raw slots from `this[from..]` into a fresh `dst`, sharing
     *  `_src` so copied deferred ranges still resolve. */
    private copyInto(dst: JSON.Arr, from: i32, count: i32): void {
      if (count <= 0) return;
      dst._src = this._src;
      const at = dst._vused;
      dst.ensureValCap(at + count);
      for (let k = 0; k < count; k++)
        dst.storeSlot(at + k, unchecked(this._vals[from + k]));
      dst._vused = at + count;
    }

    /** Truncates (drops the tail) or extends (pads with `null`) the array. */
    set length(newLength: i32) {
      if (newLength < 0) throw new Error("Invalid array length");
      const used = this._vused;
      if (newLength <= used) {
        this._vused = newLength;
        return;
      }
      this.ensureValCap(newLength);
      for (let i = used; i < newLength; i++)
        unchecked((this._vals[i] = JSON.Value.nullBits()));
      this._vused = newLength;
    }

    /** Removes and returns the last element. */
    pop(): JSON.Value {
      const n = this._vused;
      if (n == 0) throw new Error("pop from empty JSON.Arr");
      const v = this.at(n - 1);
      this._vused = n - 1;
      return v;
    }

    /** Removes and returns the first element, shifting the rest down. */
    shift(): JSON.Value {
      const n = this._vused;
      if (n == 0) throw new Error("shift from empty JSON.Arr");
      const v = this.at(0);
      const base = changetype<usize>(this._vals);
      memory.copy(base, base + 8, (<usize>(n - 1)) << 3);
      this._vused = n - 1;
      return v;
    }

    /** Prepends `value`, shifting existing elements up. Returns the new length. */
    unshift<T>(value: T): i32 {
      const n = this._vused;
      this.ensureValCap(n + 1);
      const base = changetype<usize>(this._vals);
      if (n) memory.copy(base + 8, base, (<usize>n) << 3);
      this._vused = n + 1;
      this.storeSlot(0, JSON.Value.bitsFrom<T>(value));
      return n + 1;
    }

    /** Reverses the elements in place (slot swap). */
    reverse(): JSON.Arr {
      const vals = this._vals;
      let lo = 0;
      let hi = this._vused - 1;
      while (lo < hi) {
        const t = unchecked(vals[lo]);
        unchecked((vals[lo] = unchecked(vals[hi])));
        unchecked((vals[hi] = t));
        lo++;
        hi--;
      }
      return this;
    }

    /** Fills `[start, end)` with `value`. */
    fill<T>(value: T, start: i32 = 0, end: i32 = i32.MAX_VALUE): JSON.Arr {
      const n = this._vused;
      let s = start < 0 ? max(n + start, 0) : min(start, n);
      const e = end < 0 ? max(n + end, 0) : min(end, n);
      const bits = JSON.Value.bitsFrom<T>(value);
      for (; s < e; s++) this.storeSlot(s, bits);
      return this;
    }

    /** Copies the slot block `[start, end)` to `target`, in place. */
    copyWithin(target: i32, start: i32, end: i32 = i32.MAX_VALUE): JSON.Arr {
      const n = this._vused;
      const t = target < 0 ? max(n + target, 0) : min(target, n);
      const s = start < 0 ? max(n + start, 0) : min(start, n);
      const e = end < 0 ? max(n + end, 0) : min(end, n);
      const count = min(e - s, n - t);
      if (count > 0) {
        const base = changetype<usize>(this._vals);
        memory.copy(
          base + ((<usize>t) << 3),
          base + ((<usize>s) << 3),
          (<usize>count) << 3,
        );
      }
      return this;
    }

    /** Returns a new JSON.Arr with the elements in `[start, end)` (lazy-preserving). */
    slice(start: i32 = 0, end: i32 = i32.MAX_VALUE): JSON.Arr {
      const n = this._vused;
      const s = start < 0 ? max(n + start, 0) : min(start, n);
      const e = end < 0 ? max(n + end, 0) : min(end, n);
      const out = new JSON.Arr();
      this.copyInto(out, s, e - s);
      return out;
    }

    /** Removes `deleteCount` elements at `start`; returns them as a new JSON.Arr. */
    splice(start: i32, deleteCount: i32 = i32.MAX_VALUE): JSON.Arr {
      const n = this._vused;
      const s = start < 0 ? max(n + start, 0) : min(start, n);
      const d = max(min(deleteCount, n - s), 0);
      const removed = new JSON.Arr();
      this.copyInto(removed, s, d);
      const tail = n - (s + d);
      if (tail > 0) {
        const base = changetype<usize>(this._vals);
        memory.copy(
          base + ((<usize>s) << 3),
          base + ((<usize>(s + d)) << 3),
          (<usize>tail) << 3,
        );
      }
      this._vused = n - d;
      return removed;
    }

    /** Returns a new JSON.Arr = this followed by `other` (resolves deferred slots
     *  since the two sources can't share one `_src`). */
    concat(other: JSON.Arr): JSON.Arr {
      const out = new JSON.Arr();
      const a = this._vused;
      const b = other._vused;
      out.ensureValCap(a + b);
      for (let i = 0; i < a; i++) out.pushRawSlot(this.resolvedBits(i));
      for (let i = 0; i < b; i++) out.pushRawSlot(other.resolvedBits(i));
      return out;
    }

    /** First index of `value` (typed compare via getAs<T>), or -1. */
    indexOf<T>(value: T, fromIndex: i32 = 0): i32 {
      const n = this._vused;
      let i = fromIndex < 0 ? max(n + fromIndex, 0) : fromIndex;
      for (; i < n; i++) if (this.getAs<T>(i) == value) return i;
      return -1;
    }

    /** Last index of `value`, searching backwards, or -1. */
    lastIndexOf<T>(value: T, fromIndex: i32 = i32.MAX_VALUE): i32 {
      const n = this._vused;
      let i = fromIndex < 0 ? n + fromIndex : min(fromIndex, n - 1);
      for (; i >= 0; i--) if (this.getAs<T>(i) == value) return i;
      return -1;
    }

    /** Whether `value` is present. */
    includes<T>(value: T, fromIndex: i32 = 0): bool {
      return this.indexOf<T>(value, fromIndex) >= 0;
    }

    /** Calls `fn` for each element. */
    forEach(
      fn: (value: JSON.Value, index: i32, array: JSON.Arr) => void,
    ): void {
      for (let i = 0, n = this._vused; i < n; i++) fn(this.at(i), i, this);
    }

    /** New JSON.Arr of `fn`'s results. */
    map(
      fn: (value: JSON.Value, index: i32, array: JSON.Arr) => JSON.Value,
    ): JSON.Arr {
      const n = this._vused;
      const out = new JSON.Arr();
      out.ensureValCap(n);
      for (let i = 0; i < n; i++) out.push<JSON.Value>(fn(this.at(i), i, this));
      return out;
    }

    /** New JSON.Arr of elements passing `fn` (lazy-preserving). */
    filter(
      fn: (value: JSON.Value, index: i32, array: JSON.Arr) => bool,
    ): JSON.Arr {
      const out = new JSON.Arr();
      for (let i = 0, n = this._vused; i < n; i++)
        if (fn(this.at(i), i, this)) this.copyInto(out, i, 1);
      return out;
    }

    /** First element passing `fn`, or `null`. */
    find(
      fn: (value: JSON.Value, index: i32, array: JSON.Arr) => bool,
    ): JSON.Value | null {
      for (let i = 0, n = this._vused; i < n; i++) {
        const v = this.at(i);
        if (fn(v, i, this)) return v;
      }
      return null;
    }

    /** Index of the first element passing `fn`, or -1. */
    findIndex(
      fn: (value: JSON.Value, index: i32, array: JSON.Arr) => bool,
    ): i32 {
      for (let i = 0, n = this._vused; i < n; i++)
        if (fn(this.at(i), i, this)) return i;
      return -1;
    }

    /** Last element passing `fn`, or `null`. */
    findLast(
      fn: (value: JSON.Value, index: i32, array: JSON.Arr) => bool,
    ): JSON.Value | null {
      for (let i = this._vused - 1; i >= 0; i--) {
        const v = this.at(i);
        if (fn(v, i, this)) return v;
      }
      return null;
    }

    /** Index of the last element passing `fn`, or -1. */
    findLastIndex(
      fn: (value: JSON.Value, index: i32, array: JSON.Arr) => bool,
    ): i32 {
      for (let i = this._vused - 1; i >= 0; i--)
        if (fn(this.at(i), i, this)) return i;
      return -1;
    }

    /** Whether every element passes `fn`. */
    every(fn: (value: JSON.Value, index: i32, array: JSON.Arr) => bool): bool {
      for (let i = 0, n = this._vused; i < n; i++)
        if (!fn(this.at(i), i, this)) return false;
      return true;
    }

    /** Whether any element passes `fn`. */
    some(fn: (value: JSON.Value, index: i32, array: JSON.Arr) => bool): bool {
      for (let i = 0, n = this._vused; i < n; i++)
        if (fn(this.at(i), i, this)) return true;
      return false;
    }

    /** Left fold. */
    reduce<U>(
      fn: (acc: U, value: JSON.Value, index: i32, array: JSON.Arr) => U,
      initialValue: U,
    ): U {
      let acc = initialValue;
      for (let i = 0, n = this._vused; i < n; i++)
        acc = fn(acc, this.at(i), i, this);
      return acc;
    }

    /** Right fold. */
    reduceRight<U>(
      fn: (acc: U, value: JSON.Value, index: i32, array: JSON.Arr) => U,
      initialValue: U,
    ): U {
      let acc = initialValue;
      for (let i = this._vused - 1; i >= 0; i--)
        acc = fn(acc, this.at(i), i, this);
      return acc;
    }

    /** Sorts in place by `comparator(a, b)` (materializes for comparison). */
    sort(comparator: (a: JSON.Value, b: JSON.Value) => i32): JSON.Arr {
      const n = this._vused;
      if (n < 2) return this;
      const view = new Array<JSON.Value>(n);
      for (let i = 0; i < n; i++) unchecked((view[i] = this.at(i)));
      view.sort(comparator);
      for (let i = 0; i < n; i++)
        this.storeSlot(i, JSON.Value.bitsFrom<JSON.Value>(unchecked(view[i])));
      return this;
    }

    /** JS-parity element string: strings unquoted, null -> "", everything else
     *  via ES-exact JSON (numbers drop a trailing `.0`). */
    private elemStr(i: i32): string {
      const v = this.at(i);
      const t = v.type;
      if (t == JSON.Types.String) return v.get<string>();
      if (t == JSON.Types.Null) return "";
      return JSON.stringify(v);
    }

    /** Joins the elements with `separator` (JS `Array#join` semantics). */
    join(separator: string = ","): string {
      const n = this._vused;
      if (n == 0) return "";
      let out = this.elemStr(0);
      for (let i = 1; i < n; i++) out += separator + this.elemStr(i);
      return out;
    }

    // See JSON.Obj.__visit - same custom GC visitor for the slot buffer.
    @unsafe private __visit(cookie: u32): void {
      __visit(changetype<usize>(this._vals), cookie);
      __visit(changetype<usize>(this._src), cookie);
      const vals = this._vals;
      const n = this._vused;
      for (let i = 0; i < n; i++) {
        const w = unchecked(vals[i]);
        if (!valBoxed(w)) continue;
        const tag = valTag(w);
        if (tag == JSON.Types.Lazy) continue;
        if (tag >= JSON.Types.String) {
          __visit(valPtr(w), cookie);
        } else if (
          (tag == JSON.Types.U64 || tag == JSON.Types.I64) &&
          w & VAL_BOX64
        ) {
          __visit(valPtr(w), cookie);
        }
      }
    }
  }
  /**
   * Box for primitive types
   */
  export class Box<T> {
    constructor(public value: T) {
      if (!isInteger<T>() && !isFloat<T>() && !isBoolean<T>())
        ERROR("JSON.Box should only hold primitive types!");
    }
    /**
     * Set the internal value of Box to new value
     * @param value T
     * @returns this
     */
    set(value: T): Box<T> {
      this.value = value;
      return this;
    }
    /**
     * Creates a Box<T> | null from a JSON.Value
     * This means that it can create a nullable primitive from a JSON.Value
     * ```js
     * const value = JSON.parse<i32>("null"); // -> Box<i32> | null
     * const boxed = JSON.Box.fromValue<i32>(value); // -> Box<i32> | null
     * // null
     * ```
     * @param from T
     * @returns Box<T> | null
     */
    static fromValue<T>(value: JSON.Value): Box<T> | null {
      if (!(value instanceof JSON.Value))
        throw new Error("value must be of type JSON.Value");
      if (value.type === JSON.Types.Null) return null;
      const v =
        value.type === JSON.Types.F64 ? value.get<f64>() : value.get<T>();
      // @ts-expect-error
      return new Box(isInteger<T>() || isFloat<T>() ? <T>v : v);
    }
    /**
     * Creates a reference to a primitive type
     * This means that it can create a nullable primitive
     * ```js
     * JSON.stringify<Box<i32> | null>(null);
     * // null
     * ```
     * @param from T
     * @returns Box<T>
     */
    static from<T>(value: T): Box<T> {
      return new Box(value);
    }
    toString(): string {
      if (isNullable<this>() && changetype<usize>(this) == null) return "null";
      // @ts-expect-error: type
      if (isDefined(this.value.toString)) return this.value.toString();
      return "null";
    }
  }

  /**
   * Serializes JSON data but writes directly to the buffer.
   * Should only be used if you know what you are doing.
   * @param data - T
   * @returns void
   */
  function __serialize<T>(data: T): void {
    if (isBoolean<T>()) {
      serializeBool(data as bool);
    } else if (isInteger<T>() && nameof<T>() == "usize" && data == 0) {
      bs.proposeSize(8);
      store<u64>(bs.offset, NULL_WORD_U64);
      bs.offset += 8;
    } else if (isInteger<T>()) {
      // @ts-expect-error
      serializeInteger<T>(data);
    } else if (isFloat<T>(data)) {
      // @ts-expect-error
      if (sizeof<T>() == 4) serializeFloat32(<f32>data);
      // @ts-expect-error
      else serializeFloat64(<f64>data);
    } else if (isNullable<T>() && changetype<usize>(data) == <usize>0) {
      bs.proposeSize(8);
      store<u64>(bs.offset, NULL_WORD_U64);
      bs.offset += 8;
    } else if (isString<nonnull<T>>()) {
      serializeString(data as string);
      // @ts-expect-error: Defined by transform
    } else if (isDefined(data.__SERIALIZE_CUSTOM)) {
      // @ts-expect-error
      return data.__SERIALIZE_CUSTOM();
      // @ts-expect-error: Defined by transform
    } else if (isDefined(data.__SERIALIZE)) {
      // @ts-expect-error: type
      serializeStruct(changetype<nonnull<T>>(data));
    } else if (data instanceof Date) {
      // @ts-expect-error
      serializeDate(changetype<nonnull<T>>(data));
    } else {
      serializeReference<T>(data);
    }
  }

  /**
   * Deserializes JSON data directly from the buffer.
   * Should only be used if you know what you are doing.
   * @param srcStart - usize
   * @param srcEnd - usize
   * @param dst - usize
   * @returns void
   */
  function __deserialize<T>(srcStart: usize, srcEnd: usize, dst: usize = 0): T {
    // Skip leading whitespace once here so every handler below may assume
    // srcStart is at the first non-whitespace char. (Trailing whitespace is
    // left intact - composites self-trim and JSON.Raw preserves it.)
    while (srcStart < srcEnd && JSON.Util.isSpace(load<u16>(srcStart)))
      srcStart += 2;
    if (isBoolean<T>()) {
      // @ts-expect-error: type
      return deserializeBoolean(srcStart, srcEnd);
    } else if (isInteger<T>()) {
      return isSigned<T>()
        ? deserializeInteger<T>(srcStart, srcEnd)
        : deserializeUnsigned<T>(srcStart, srcEnd);
    } else if (isFloat<T>()) {
      return deserializeFloat<T>(srcStart, srcEnd);
    } else if (
      isNullable<T>() &&
      srcEnd - srcStart == 8 &&
      load<u64>(srcStart) == NULL_WORD_U64
    ) {
      // A `null` literal must be matched before the string branch: a nullable
      // string (`string | null`) reports `isString<T>() == true`, so without
      // this `null` would be (mis)handled as a quoted string and abort. Mirrors
      // the same-ordered check in `parseInternal`. Reached by lazy-field
      // materialization, which routes every slot value through `__deserialize`.
      return null;
    } else if (isString<T>()) {
      if (srcEnd - srcStart < 4)
        throw new Error(
          "Cannot parse data as string because it was formatted incorrectly!",
        );

      return deserializeString(srcStart, srcEnd) as T;
    } else {
      let type: nonnull<T> = changetype<nonnull<T>>(0);
      // @ts-expect-error: Defined by transform
      if (isDefined(type.__DESERIALIZE_CUSTOM)) {
        const out = changetype<nonnull<T>>(0);
        // @ts-expect-error: Defined by transform
        return out.__DESERIALIZE_CUSTOM(ptrToStr(srcStart, srcEnd));
        // @ts-expect-error: Defined by transform
      } else if (
        isDefined(type.__DESERIALIZE_SLOW) ||
        isDefined(type.__DESERIALIZE_FAST)
      ) {
        const out = changetype<nonnull<T>>(
          dst || __new(offsetof<nonnull<T>>(), idof<nonnull<T>>()),
        );
        // @ts-expect-error: Defined by transform
        if (isDefined(type.__DESERIALIZE_FAST)) {
          // @ts-expect-error: Defined by transform
          const fastEnd = out.__DESERIALIZE_FAST(srcStart, srcEnd, out);
          // Accept the fast path when only trailing whitespace remains.
          if (
            fastEnd != 0 &&
            JSON.Util.skipWhitespace(fastEnd, srcEnd) == srcEnd
          )
            return out;
        }
        // @ts-expect-error: Defined by transform
        if (isDefined(type.__INITIALIZE)) out.__INITIALIZE();
        // @ts-expect-error: Defined by transform
        if (isDefined(type.__DESERIALIZE_SLOW)) {
          // @ts-expect-error: Defined by transform
          out.__DESERIALIZE_SLOW(srcStart, srcEnd, out);
          return out;
        }
        throw new Error(`No deserialize method defined for type ${type}`);
      }
      if (type instanceof StaticArray) {
        // @ts-expect-error: type
        return deserializeStaticArray<nonnull<T>>(srcStart, srcEnd, dst) as T;
      } else if (type instanceof Array) {
        // @ts-expect-error: type
        return deserializeArray<nonnull<T>>(srcStart, srcEnd, dst) as T;
      } else if (
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
        return deserializeTypedArray<nonnull<T>>(srcStart, srcEnd, dst) as T;
      } else if (type instanceof ArrayBuffer) {
        return deserializeArrayBuffer(srcStart, srcEnd, dst) as T;
      } else if (type instanceof Set) {
        // @ts-expect-error: type
        return deserializeSet<T>(srcStart, srcEnd, dst);
      } else if (type instanceof Map) {
        // @ts-expect-error: type
        return deserializeMap<T>(srcStart, srcEnd, dst);
      } else if (type instanceof Date) {
        // @ts-expect-error: type
        return deserializeDate(srcStart, srcEnd);
      } else if (type instanceof JSON.Raw) {
        // @ts-expect-error: type
        return deserializeRaw(srcStart, srcEnd);
      } else if (type instanceof JSON.Value) {
        // @ts-expect-error: type
        return deserializeArbitrary(srcStart, srcEnd, 0);
      } else if (type instanceof JSON.Obj) {
        // @ts-expect-error: type
        return deserializeObject(srcStart, srcEnd, 0);
      } else if (type instanceof JSON.Arr) {
        // @ts-expect-error: type
        return deserializeJsonArray(srcStart, srcEnd, 0);
      } else if (type instanceof JSON.Box) {
        // @ts-expect-error: type
        return new JSON.Box(
          deserializeBox(
            srcStart,
            srcEnd,
            dst,
            changetype<nonnull<T>>(0).value,
          ),
        );
      }
    }
    const snippet = ptrToStr(srcStart, srcEnd);
    throw new Error(
      `Could not deserialize JSON to type '${nameof<T>()}'. ` +
        `If this is a custom class, ensure it has the @json decorator: @json class ${nameof<T>()} { ... }. ` +
        `Input: "${snippet.length > 50 ? snippet.slice(0, 50) + "..." : snippet}"`,
    );
  }
  export namespace Util {
    export function isSpace(code: u16): boolean {
      return code == 0x20 || code - 9 <= 4;
    }
    /** Advance past JSON whitespace (space, tab, LF, VT, FF, CR). */
    export function skipWhitespace(srcStart: usize, srcEnd: usize): usize {
      while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
      return srcStart;
    }
    function scanQuotedValueEnd(srcStart: usize, srcEnd: usize): usize {
      const endQuote = scanStringEnd(srcStart, srcEnd);
      return endQuote >= srcEnd ? 0 : endQuote + 2;
    }
    function scanCompositeValueEnd(srcStart: usize, srcEnd: usize): usize {
      let depth: i32 = 1;
      let ptr = srcStart + 2;
      while (ptr < srcEnd) {
        const code = load<u16>(ptr);
        if (code == QUOTE) {
          ptr = scanQuotedValueEnd(ptr, srcEnd);
          if (!ptr) return 0;
          continue;
        }
        if (code == BRACE_LEFT || code == BRACKET_LEFT) {
          depth++;
        } else if (code == BRACE_RIGHT || code == BRACKET_RIGHT) {
          if (--depth == 0) return ptr + 2;
        }
        ptr += 2;
      }
      return 0;
    }
    function scanScalarValueEnd(srcStart: usize, srcEnd: usize): usize {
      while (srcStart < srcEnd) {
        const code = load<u16>(srcStart);
        if (
          code == COMMA ||
          code == BRACKET_RIGHT ||
          code == BRACE_RIGHT ||
          isSpace(code)
        )
          return srcStart;
        srcStart += 2;
      }

      return srcStart;
    }
    export function scanValueEnd<T = JSON.Value>(
      srcStart: usize,
      srcEnd: usize,
    ): usize {
      if (srcStart >= srcEnd) return 0;
      let ptr = skipWhitespace(srcStart, srcEnd);
      if (ptr >= srcEnd) return 0;

      if (ASC_FEATURE_SIMD) return scanValueEnd_SIMD<T>(ptr, srcEnd);
      if (JSON_MODE == JSONMode.SWAR) return scanValueEnd_SWAR<T>(ptr, srcEnd);

      const first = load<u16>(ptr);
      if (isString<nonnull<T>>() && first == QUOTE)
        return scanQuotedValueEnd(ptr, srcEnd);
      if (isArray<nonnull<T>>() && first == BRACKET_LEFT)
        return scanCompositeValueEnd(ptr, srcEnd);
      if (
        (isManaged<nonnull<T>>() || isReference<nonnull<T>>()) &&
        first == BRACE_LEFT
      )
        return scanCompositeValueEnd(ptr, srcEnd);

      if (first == QUOTE) return scanQuotedValueEnd(ptr, srcEnd);
      if (first == BRACE_LEFT || first == BRACKET_LEFT)
        return scanCompositeValueEnd(ptr, srcEnd);
      return scanScalarValueEnd(ptr, srcEnd);
    }
    export function ptrToStr(start: usize, end: usize): string {
      const size = end - start;
      const out = __new(size, idof<string>());
      memory.copy(out, start, size);
      return changetype<string>(out);
    }
  }
  /**
   * Methods for use when using JSON methods inside another JSON method or custom serializer/deserializer
   * Transform will automatically convert JSON.x calls to JSON.internal.x when in a custom (de)serializer
   */
  namespace internal {
    /**
     * Serializes JSON data. Don't use this directly, use `JSON.stringify` instead.
     * @param data - T
     * @param out - string | null
     * @returns - string
     */
    export function stringify<T>(data: T, out: string | null = null): string {
      bs.saveState();
      JSON.__serialize<T>(data);
      const result = bs.cpyOut<string>();
      if (out) {
        const len = bytes(result);
        out = changetype<string>(__renew(changetype<usize>(out), len));
        memory.copy(changetype<usize>(out), changetype<usize>(result), len);
        return out;
      }
      return result;
    }

    /**
     * Parses JSON data without mutating the caller's active serialization buffer state.
     * Don't use this directly, use `JSON.parse` instead.
     * @param data - string
     * @returns - T
     */
    export function parse<T>(data: string): T {
      bs.saveState();
      const result = JSON.parse<T>(data);
      bs.loadState();
      return result;
    }
  }
}

/**
 * Shared reference-type serialization chain used by both {@link JSON.stringify}
 * and {@link JSON.__serialize}. Writes directly to the active buffer. Primitive
 * and `Date` fast paths are handled by the callers (which have buffer-reuse
 * optimizations); everything else routes here so the dispatch chain lives once.
 */
function serializeReference<T>(data: T): void {
  if (data instanceof Array) {
    // @ts-expect-error
    serializeArray(changetype<nonnull<T>>(data));
  } else if (data instanceof StaticArray) {
    // @ts-expect-error
    serializeStaticArray(changetype<nonnull<T>>(data));
  } else if (data instanceof Int8Array) {
    serializeTypedArray<Int8Array>(data);
  } else if (data instanceof Uint8Array) {
    serializeTypedArray<Uint8Array>(data);
  } else if (data instanceof Uint8ClampedArray) {
    serializeTypedArray<Uint8ClampedArray>(data);
  } else if (data instanceof Int16Array) {
    serializeTypedArray<Int16Array>(data);
  } else if (data instanceof Uint16Array) {
    serializeTypedArray<Uint16Array>(data);
  } else if (data instanceof Int32Array) {
    serializeTypedArray<Int32Array>(data);
  } else if (data instanceof Uint32Array) {
    serializeTypedArray<Uint32Array>(data);
  } else if (data instanceof Int64Array) {
    serializeTypedArray<Int64Array>(data);
  } else if (data instanceof Uint64Array) {
    serializeTypedArray<Uint64Array>(data);
  } else if (data instanceof Float32Array) {
    serializeTypedArray<Float32Array>(data);
  } else if (data instanceof Float64Array) {
    serializeTypedArray<Float64Array>(data);
  } else if (data instanceof ArrayBuffer) {
    const dataStart = changetype<usize>(data);
    serializeArrayBufferUnsafe(
      dataStart,
      changetype<OBJECT>(dataStart - TOTAL_OVERHEAD).rtSize,
    );
  } else if (data instanceof Set) {
    // @ts-expect-error
    serializeSet(changetype<nonnull<T>>(data));
  } else if (data instanceof Map) {
    // @ts-expect-error
    serializeMap(changetype<nonnull<T>>(data));
  } else if (data instanceof JSON.Raw) {
    serializeRaw(data);
  } else if (data instanceof JSON.Value) {
    serializeArbitrary(data);
  } else if (data instanceof JSON.Obj) {
    serializeObject(data);
  } else if (data instanceof JSON.Arr) {
    serializeJsonArray(data);
  } else if (data instanceof JSON.Box) {
    JSON.__serialize(data.value);
  } else {
    throw new Error(
      `Could not serialize data of type '${nameof<T>()}'. ` +
        `If this is a custom class, add the @json decorator: @json class ${nameof<T>()} { ... }. ` +
        `Supported types: primitives, string, Array, StaticArray, TypedArray, ArrayBuffer, Map, Date, and @json decorated classes.`,
    );
  }
}

export enum JSONMode {
  SWAR = 0,
  SIMD = 1,
  NAIVE = 2,
}

function parseBox<T>(data: string, ty: T): T {
  return JSON.parse<T>(data);
}

function deserializeBox<T>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
  ty: T,
): T {
  return JSON.__deserialize<T>(srcStart, srcEnd, dst);
}

export function toRaw(data: string): JSON.Raw {
  return new JSON.Raw(data);
}
export function fromRaw(data: JSON.Raw): string {
  return data.data;
}

export function toBox<T>(data: T): JSON.Box<T> {
  return new JSON.Box<T>(data);
}
