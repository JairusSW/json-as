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
  serializeFloat,
  serializeFloat32,
  serializeFloat64,
  serializeStruct,
  serializeObject,
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
  deserializeRaw,
  deserializeString,
  deserializeArrayBuffer,
  deserializeTypedArray,
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
import {
  dragonbox_f32_buffered,
  dragonbox_f64_buffered,
} from "./util/dragonbox";
import { ptrToStr } from "./util/ptrToStr";
import { atoi, bytes, scanStringEnd } from "./util";
import { scanValueEnd_SIMD } from "./util/scanValueEndSimd";
import { scanValueEnd_SWAR } from "./util/scanValueEndSwar";

// --- NaN-boxing encoding for JSON.Value ----------------------------------
// JSON.Value packs its type tag and payload into a single 8-byte word.
// Real f64 values are stored as their raw IEEE-754 bits; every other type is
// encoded inside a quiet-NaN ("boxed") word: a 5-bit tag (the JSON.Types id,
// or Struct for @json classes) plus a 45-bit payload holding a 32-bit pointer
// or a small scalar. 64-bit ints that don't fit the payload are spilled to a
// heap StaticArray<u64> referenced by the payload pointer and flagged in the
// sign bit. Only quiet-NaN doubles whose top two mantissa bits are both set
// collide with the box signature; hardware NaN is 0x7FF8.. so finite/Inf/NaN
// doubles all pass through untouched.
//
// The managed reference packed into the word is traced by JSON.Value.__visit;
// AssemblyScript only wires that hook for library-declared classes, so the
// json-as transform marks this source as a library source (see afterParse).
// @ts-expect-error: Decorator valid here
@inline const VAL_QNAN: u64 = 0x7ffc000000000000; // boxed signature (quiet NaN)
// @ts-expect-error: Decorator valid here
@inline const VAL_TAG_SHIFT: u8 = 45;
// @ts-expect-error: Decorator valid here
@inline const VAL_PAYLOAD_MASK: u64 = 0x00001fffffffffff; // low 45 bits
// @ts-expect-error: Decorator valid here
@inline const VAL_PTR_MASK: u64 = 0xffffffff; // wasm32 pointer
// @ts-expect-error: Decorator valid here
@inline const VAL_BOX64: u64 = 0x8000000000000000; // sign bit: 64-bit int spilled to heap
// @ts-expect-error: Decorator valid here
@inline const VAL_NULL: u64 = VAL_QNAN; // tag 0 (Null), payload 0
// @ts-expect-error: Decorator valid here
@inline const VAL_I64_LIMIT: i64 = 17592186044416; // 2^44 — inline range is [-2^44, 2^44)
// @ts-expect-error: Decorator valid here
@inline const VAL_U64_LIMIT: u64 = 35184372088832; // 2^45 — inline range is [0, 2^45)

// @ts-expect-error: Decorator valid here
@inline function valBoxed(w: u64): bool {
  return (w & VAL_QNAN) == VAL_QNAN;
}
// @ts-expect-error: Decorator valid here
@inline function valTag(w: u64): u32 {
  return <u32>((w >> VAL_TAG_SHIFT) & 0x1f);
}
// @ts-expect-error: Decorator valid here
@inline function valPayload(w: u64): u64 {
  return w & VAL_PAYLOAD_MASK;
}
// @ts-expect-error: Decorator valid here
@inline function valPtr(w: u64): usize {
  return <usize>(w & VAL_PTR_MASK);
}
// @ts-expect-error: Decorator valid here
@inline function valBox(tag: u32, payload: u64): u64 {
  return (
    VAL_QNAN | ((<u64>tag) << VAL_TAG_SHIFT) | (payload & VAL_PAYLOAD_MASK)
  );
}
// @ts-expect-error: Decorator valid here
@inline function valIntTag<T>(): u32 {
  if (sizeof<T>() == 1) return isSigned<T>() ? JSON.Types.I8 : JSON.Types.U8;
  if (sizeof<T>() == 2) return isSigned<T>() ? JSON.Types.I16 : JSON.Types.U16;
  if (sizeof<T>() == 4) return isSigned<T>() ? JSON.Types.I32 : JSON.Types.U32;
  return isSigned<T>() ? JSON.Types.I64 : JSON.Types.U64;
}

// Shared zero-length sentinel for JSON.Obj's key buffer, so an empty object
// allocates no key storage until its first key is inserted. Never mutated.
// @ts-expect-error: Decorator valid here
@lazy const EMPTY_KEYS: StaticArray<u16> = new StaticArray<u16>(0);

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
   * Whether a lazy slot's value is JSON null — for `@omitnull` on lazy fields,
   * without forcing materialization. The slot encodes the state: `u64.MAX_VALUE`
   * = materialized (null iff the value pointer is 0), `0` = absent (null), any
   * other value = a not-yet-parsed slice range (null iff it is literally `null`).
   * @param valPtr pointer of the materialized value (0 when null)
   * @param lz    the packed slot
   */
  // @ts-expect-error: inline
  @inline export function __lazyIsNull(valPtr: usize, lz: u64): bool {
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
  // @ts-expect-error: inline
  @inline export function stringify<T>(
    data: T,
    out: string | null = null,
  ): string {
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
        ? changetype<string>(__renew(changetype<usize>(out), 64))
        : changetype<string>(__new(64, idof<string>()));
      const bytes =
        (sizeof<T>() == 4
          ? dragonbox_f32_buffered(changetype<usize>(out), <f32>data)
          : dragonbox_f64_buffered(changetype<usize>(out), <f64>data)) << 1;
      return changetype<string>(__renew(changetype<usize>(out), bytes));
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
      inline.always(data.__SERIALIZE(changetype<usize>(data)));
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
  // @ts-ignore: inline
  @inline function __zero<T>(): T {
    // @ts-ignore: compile-time intrinsic
    if (isReference<T>() || isManaged<T>()) return changetype<T>(0);
    return <T>0;
  }

  // @ts-expect-error: inline
  @inline export function parse<T>(data: string, out: T = __zero<T>()): T {
    let dataPtr = changetype<usize>(data);
    const dataEnd = dataPtr + bytes(data);
    // Entry point skips leading whitespace: every deserialize handler may then
    // assume srcStart points at the first non-whitespace char. Handlers must
    // NOT re-skip leading whitespace themselves. (Trailing whitespace is left
    // intact — scalars stop at the value end, composites self-trim, and
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
        const obj = changetype<usize>(out)
          ? changetype<nonnull<T>>(changetype<usize>(out))
          : changetype<nonnull<T>>(
              __new(offsetof<nonnull<T>>(), idof<nonnull<T>>()),
            );
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
            // @ts-expect-error: Defined by transform for @lazy-field structs —
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
        return inline.always(
          deserializeStaticArray<nonnull<T>>(dataPtr, dataPtr + dataSize, 0),
        );
      } else if (type instanceof Array) {
        // @ts-expect-error
        return inline.always(
          deserializeArray<nonnull<T>>(
            dataPtr,
            dataPtr + dataSize,
            changetype<usize>(instantiate<T>()),
          ),
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
        return inline.always(
          deserializeSet<nonnull<T>>(dataPtr, dataPtr + dataSize, 0),
        );
      } else if (type instanceof Map) {
        // @ts-expect-error
        return inline.always(
          deserializeMap<nonnull<T>>(dataPtr, dataPtr + dataSize, 0),
        );
      } else if (type instanceof Date) {
        // @ts-expect-error
        return deserializeDate(dataPtr, dataPtr + dataSize);
      } else if (type instanceof JSON.Raw) {
        // @ts-expect-error: type
        return deserializeRaw(dataPtr, dataPtr + dataSize);
      } else if (type instanceof JSON.Value) {
        // @ts-expect-error
        return inline.always(
          deserializeArbitrary(dataPtr, dataPtr + dataSize, 0),
        );
      } else if (type instanceof JSON.Obj) {
        // @ts-expect-error
        return inline.always(deserializeObject(dataPtr, dataPtr + dataSize, 0));
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
    // @ts-expect-error
    @inline export const Null: u16 = 0;
    // @ts-expect-error
    @inline export const Raw: u16 = 1;
    // @ts-expect-error
    @inline export const U8: u16 = 2;
    // @ts-expect-error
    @inline export const U16: u16 = 3;
    // @ts-expect-error
    @inline export const U32: u16 = 4;
    // @ts-expect-error
    @inline export const U64: u16 = 5;
    // @ts-expect-error
    @inline export const I8: u16 = 6;
    // @ts-expect-error
    @inline export const I16: u16 = 7;
    // @ts-expect-error
    @inline export const I32: u16 = 8;
    // @ts-expect-error
    @inline export const I64: u16 = 9;
    // @ts-expect-error
    @inline export const F32: u16 = 10;
    // @ts-expect-error
    @inline export const F64: u16 = 11;
    // @ts-expect-error
    @inline export const Bool: u16 = 12;
    // Managed
    // @ts-expect-error
    @inline export const String: u16 = 13;
    // @ts-expect-error
    @inline export const Object: u16 = 14;
    // @ts-expect-error
    @inline export const Array: u16 = 15;
    // @ts-expect-error
    @inline export const Map: u16 = 16;
    // @ts-expect-error
    @inline export const Struct: u16 = 17;
    // @ts-expect-error
    @inline export const TypedArray: u16 = 18;
    // @ts-expect-error
    @inline export const ArrayBuffer: u16 = 19;
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
    @inline static from(data: string): JSON.Raw {
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
  @final
  export class Value {
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
    @inline static empty(): JSON.Value {
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
    @inline static from<T>(value: T): JSON.Value {
      if (value instanceof JSON.Value) return value;
      const out = changetype<JSON.Value>(
        __new(offsetof<JSON.Value>(), idof<JSON.Value>()),
      );
      out.set<T>(value);
      return out;
    }

    /**
     * Gets the type of a given value as a JSON.Types enum.
     * @param value - any
     * @returns JSON.Types
     */
    @inline getType<T>(value: T): JSON.Types {
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
      return JSON.Types.Null;
    }
    /**
     * Sets the value of the JSON.Value instance.
     * @param value - The value to be set.
     */
    @inline set<T>(value: T): void {
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
        // @ts-expect-error
      } else if (isArray<T>() && idof<valueof<T>>() == idof<JSON.Value>()) {
        this.bits = valBox(JSON.Types.Array, <u64>changetype<usize>(value));
      }
    }

    /** Encodes a 64-bit integer, spilling to the heap when it exceeds the payload. */
    @inline private setWide<T>(value: T): void {
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
    @inline get<T>(): T {
      const w = this.bits;
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
     * Gets the value of the JSON.Value instance.
     * Alias for .get<T>()
     * @returns The encapsulated value.
     */
    @inline as<T>(): T {
      return this.get<T>();
    }

    /**
     * Gets the value of the JSON.Value instance as a Box<T>.
     * Alias for .get<T>()
     * @returns The encapsulated value.
     */
    @inline asBox<T>(): Box<T> | null {
      if (this.type === JSON.Types.Null) return null;
      return changetype<Box<T>>(JSON.Box.fromValue<T>(this));
    }

    /**
     * Converts the JSON.Value to a string representation.
     * @returns The string representation of the JSON.Value.
     */
    toString(): string {
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
          const arr = this.get<JSON.Value[]>();
          if (!arr.length) return "[]";
          let out = "[";
          const end = arr.length - 1;
          for (let i = 0; i < end; i++) {
            const element = unchecked(arr[i]);
            out += element.toString() + ",";
          }

          const element = unchecked(arr[end]);
          out += element.toString() + "]";

          return out.toString();
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
  export class Obj {
    // Keys are packed into one growable buffer, each prefixed by a u16 length
    // (UTF-16 code units), instead of allocating a heap string per key. Values
    // are a parallel array. A key -> position index is built lazily on the
    // first keyed access (never during parsing). Per-object allocation count
    // matches the previous Map-based storage, while deserialization avoids the
    // per-key string allocation and hashing entirely.
    _kbuf: StaticArray<u16> = EMPTY_KEYS;
    _kused: i32 = 0;
    _vals: JSON.Value[] = [];
    private _index: Map<string, i32> | null = null;

    constructor() {}

    /**
     * Gets the number of key-value pairs in the object.
     */
    @inline get size(): i32 {
      return this._vals.length;
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

    /** Appends a length-prefixed key (from a source memory range). */
    private pushKeyBytes(keyStart: usize, keyEnd: usize): void {
      const len = <i32>((keyEnd - keyStart) >> 1);
      const pos = this._kused;
      this.ensureKeyCap(pos + 1 + len);
      const buf = changetype<usize>(this._kbuf);
      store<u16>(buf + ((<usize>pos) << 1), <u16>len);
      if (len)
        memory.copy(
          buf + ((<usize>(pos + 1)) << 1),
          keyStart,
          (<usize>len) << 1,
        );
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

    /**
     * Appends a key (from a source memory range) and value without a
     * duplicate-key check. Used by the deserializer — no per-key string
     * allocation, no hashing.
     */
    @inline appendRaw<T>(keyStart: usize, keyEnd: usize, value: T): void {
      this.pushKeyBytes(keyStart, keyEnd);
      this._vals.push(JSON.Value.from<T>(value));
      const idx = this._index;
      if (idx !== null) {
        const len = <i32>((keyEnd - keyStart) >> 1);
        const k = changetype<string>(__new((<usize>len) << 1, idof<string>()));
        if (len) memory.copy(changetype<usize>(k), keyStart, (<usize>len) << 1);
        idx.set(k, this._vals.length - 1);
      }
    }

    /** Builds (once) and returns the lazy key -> position index. */
    private buildIndex(): Map<string, i32> {
      let idx = this._index;
      if (idx === null) {
        idx = new Map<string, i32>();
        const buf = changetype<usize>(this._kbuf);
        const used = this._kused;
        let pos = 0;
        let i = 0;
        while (pos < used) {
          const len = <i32>load<u16>(buf + ((<usize>pos) << 1));
          idx.set(this.makeKey(pos + 1, len), i++);
          pos += 1 + len;
        }
        this._index = idx;
      }
      return idx;
    }

    /**
     * Sets a key-value pair in the object, overwriting any existing value.
     * @param key - The string key
     * @param value - The value (will be wrapped in JSON.Value)
     */
    @inline set<T>(key: string, value: T): void {
      const idx = this.buildIndex();
      if (idx.has(key)) {
        unchecked((this._vals[idx.get(key)] = JSON.Value.from<T>(value)));
      } else {
        this.pushKeyBytes(
          changetype<usize>(key),
          changetype<usize>(key) + ((<usize>key.length) << 1),
        );
        this._vals.push(JSON.Value.from<T>(value));
        idx.set(key, this._vals.length - 1);
      }
    }

    /**
     * Gets a value by key.
     * @param key - The key to look up
     * @returns The JSON.Value or null if not found
     */
    @inline get(key: string): JSON.Value | null {
      const idx = this.buildIndex();
      return idx.has(key) ? unchecked(this._vals[idx.get(key)]) : null;
    }

    /**
     * Checks if a key exists in the object.
     * @param key - The key to check
     * @returns true if the key exists
     */
    @inline has(key: string): bool {
      return this.buildIndex().has(key);
    }

    /**
     * Deletes a key-value pair from the object.
     * @param key - The key to delete
     * @returns true if the key was found and deleted
     */
    delete(key: string): bool {
      const idx = this.buildIndex();
      if (!idx.has(key)) return false;
      const removed = idx.get(key);
      const keys = this.keys();
      const vals = this._vals;
      this._kbuf = EMPTY_KEYS;
      this._kused = 0;
      const newVals = new Array<JSON.Value>();
      for (let j = 0; j < keys.length; j++) {
        if (j == removed) continue;
        const k = unchecked(keys[j]);
        this.pushKeyBytes(
          changetype<usize>(k),
          changetype<usize>(k) + ((<usize>k.length) << 1),
        );
        newVals.push(unchecked(vals[j]));
      }
      this._vals = newVals;
      this._index = null;
      return true;
    }

    /**
     * Gets all keys in the object.
     * @returns Array of string keys (in insertion order)
     */
    @inline keys(): string[] {
      const out = new Array<string>(this._vals.length);
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
    @inline values(): JSON.Value[] {
      return this._vals.slice();
    }

    /**
     * Serializes the object to a JSON string.
     * @returns JSON string representation
     */
    @inline toString(): string {
      return JSON.stringify(this);
    }

    /**
     * Creates a JSON.Obj from another value.
     * @param value - The value to convert
     * @returns A new JSON.Obj instance
     */
    @inline static from<T>(value: T): JSON.Obj {
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
    @inline set(value: T): Box<T> {
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
    @inline static fromValue<T>(value: JSON.Value): Box<T> | null {
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
    @inline static from<T>(value: T): Box<T> {
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
      inline.always(serializeDate(changetype<nonnull<T>>(data)));
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
    // left intact — composites self-trim and JSON.Raw preserves it.)
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
    } else if (isString<T>()) {
      if (srcEnd - srcStart < 4)
        throw new Error(
          "Cannot parse data as string because it was formatted incorrectly!",
        );

      return deserializeString(srcStart, srcEnd) as T;
    } else if (
      isNullable<T>() &&
      srcEnd - srcStart == 8 &&
      load<u64>(srcStart) == NULL_WORD_U64
    ) {
      return null;
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
        return deserializeStaticArray<T>(srcStart, srcEnd, dst);
      } else if (type instanceof Array) {
        // @ts-expect-error: type
        return deserializeArray<T>(srcStart, srcEnd, dst);
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
    // @ts-expect-error: decorator
    @inline export function isSpace(code: u16): boolean {
      return code == 0x20 || code - 9 <= 4;
    }
    /** Advance past JSON whitespace (space, tab, LF, VT, FF, CR). */
    // @ts-expect-error: decorator
    @inline export function skipWhitespace(
      srcStart: usize,
      srcEnd: usize,
    ): usize {
      while (srcStart < srcEnd && isSpace(load<u16>(srcStart))) srcStart += 2;
      return srcStart;
    }
    // @ts-expect-error: decorator
    @inline function scanQuotedValueEnd(srcStart: usize, srcEnd: usize): usize {
      const endQuote = scanStringEnd(srcStart, srcEnd);
      return endQuote >= srcEnd ? 0 : endQuote + 2;
    }
    // @ts-expect-error: decorator
    @inline function scanCompositeValueEnd(
      srcStart: usize,
      srcEnd: usize,
    ): usize {
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
    // @ts-expect-error: decorator
    @inline function scanScalarValueEnd(srcStart: usize, srcEnd: usize): usize {
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
    // @ts-expect-error: decorator
    @inline export function scanValueEnd<T = JSON.Value>(
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
    // @ts-expect-error: decorator
    @inline export function ptrToStr(start: usize, end: usize): string {
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
    // @ts-expect-error: inline
    @inline export function stringify<T>(
      data: T,
      out: string | null = null,
    ): string {
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
    // @ts-expect-error: inline
    @inline export function parse<T>(data: string): T {
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
// @ts-expect-error: @inline is a valid decorator
@inline function serializeReference<T>(data: T): void {
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

// @ts-expect-error: decorator
@inline function parseBox<T>(data: string, ty: T): T {
  return JSON.parse<T>(data);
}
// @ts-expect-error: inline
@inline function deserializeBox<T>(
  srcStart: usize,
  srcEnd: usize,
  dst: usize,
  ty: T,
): T {
  return JSON.__deserialize<T>(srcStart, srcEnd, dst);
}

// @ts-expect-error: inline
@inline export function toRaw(data: string): JSON.Raw {
  return new JSON.Raw(data);
}
// @ts-expect-error: inline
@inline export function fromRaw(data: JSON.Raw): string {
  return data.data;
}

// @ts-expect-error: inline
@inline export function toBox<T>(data: T): JSON.Box<T> {
  return new JSON.Box<T>(data);
}
