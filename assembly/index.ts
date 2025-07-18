/// <reference path="./index.d.ts" />

import { bs } from "../lib/as-bs";
import { serializeString } from "./serialize/simple/string";
import { serializeArray } from "./serialize/simple/array";
import { serializeMap } from "./serialize/simple/map";
import { serializeDate } from "./serialize/simple/date";
import { deserializeBoolean } from "./deserialize/simple/bool";
import { deserializeArray } from "./deserialize/simple/array";
import { deserializeFloat } from "./deserialize/simple/float";
import { deserializeMap } from "./deserialize/simple/map";
import { deserializeDate } from "./deserialize/simple/date";
import { deserializeInteger } from "./deserialize/simple/integer";
import { deserializeString } from "./deserialize/simple/string";
import { serializeArbitrary } from "./serialize/simple/arbitrary";

import { NULL_WORD, QUOTE } from "./custom/chars";
import { dtoa_buffered, itoa_buffered } from "util/number";
import { serializeBool } from "./serialize/simple/bool";
import { serializeInteger } from "./serialize/simple/integer";
import { serializeFloat } from "./serialize/simple/float";
import { serializeStruct } from "./serialize/simple/struct";
import { ptrToStr } from "./util/ptrToStr";
import { atoi, bytes } from "./util";
import { deserializeArbitrary } from "./deserialize/simple/arbitrary";
import { serializeObject } from "./serialize/simple/object";
import { deserializeObject } from "./deserialize/simple/object";
import { serializeRaw } from "./serialize/simple/raw";
import { deserializeRaw } from "./deserialize/simple/raw";
import { serializeString_SIMD } from "./serialize/simd/string";
// import { deserializeString_SIMD } from "./deserialize/simd/string";

/**
 * Offset of the 'storage' property in the JSON.Value class.
 */
// @ts-ignore: Decorator valid here
@inline const STORAGE = offsetof<JSON.Value>("storage");

/**
 * JSON Encoder/Decoder for AssemblyScript
 */
export namespace JSON {
  export namespace Memory {
    export function shrink(): void {
      bs.resize(64);
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
  // @ts-ignore: inline
  @inline export function stringify<T>(data: T, out: string | null = null): string {
    if (isBoolean<T>()) {
      if (out) {
        if (<bool>data == true) {
          out = changetype<string>(__renew(changetype<usize>(out), 8));
          store<u64>(changetype<usize>(out), 28429475166421108);
        } else {
          out = changetype<string>(__renew(changetype<usize>(out), 10));
          store<u64>(changetype<usize>(out), 32370086184550502);
          store<u16>(changetype<usize>(out), 101, 8);
        }
        return out;
      }
      return data ? "true" : "false";
    } else if (isInteger<T>() && !isSigned<T>() && nameof<T>() == "usize" && data == 0) {
      if (out) {
        out = changetype<string>(__renew(changetype<usize>(out), 8));
        store<u64>(changetype<usize>(out), 30399761348886638);
        return out;
      }
      return NULL_WORD;
    } else if (isInteger<T>(data)) {
      if (out) {
        out = changetype<string>(__renew(changetype<usize>(out), sizeof<T>() << 3));

        // @ts-ignore
        const bytes = itoa_buffered(changetype<usize>(out), data) << 1;
        return (out = changetype<string>(__renew(changetype<usize>(out), bytes)));
      }
      return data.toString();
    } else if (isFloat<T>(data)) {
      if (out) {
        out = changetype<string>(__renew(changetype<usize>(out), 64));

        // @ts-ignore
        const bytes = dtoa_buffered(changetype<usize>(out), data) << 1;
        return (out = changetype<string>(__renew(changetype<usize>(out), bytes)));
      }
      return data.toString();
      // @ts-ignore: Function is generated by transform
    } else if (isNullable<T>() && changetype<usize>(data) == <usize>0) {
      if (out) {
        out = changetype<string>(__renew(changetype<usize>(out), 8));
        store<u64>(changetype<usize>(out), 30399761348886638);
        return out;
      }
      return NULL_WORD;
      // @ts-ignore
    } else if (isString<nonnull<T>>()) {
      // if (out) {
      //   out = changetype<string>(__renew(changetype<usize>(out), bytes(data) + 4));
      //   // const oldSize = bs.byteLength;
      //   const oldBuf = bs.buffer;
      //   const newSize = bytes(data) + 4;
      //   const newBuf = __new(newSize, idof<string>());
      //   bs.setBuffer(newBuf);
      //   serializeString(changetype<string>(data));
      //   bs.setBuffer(oldBuf);
      //   return changetype<string>(newBuf);
      // }
      if (ASC_FEATURE_SIMD) {
        serializeString_SIMD(data as string);
      } else {
        serializeString(data as string);
      }
      return bs.out<string>();
      // @ts-ignore: Supplied by transform
    } else if (isDefined(data.__SERIALIZE)) {
      // @ts-ignore
      inline.always(data.__SERIALIZE(changetype<usize>(data)));
      return bs.out<string>();
      // @ts-ignore: Supplied by transform
    } else if (data instanceof Date) {
      out = out ? changetype<string>(__renew(changetype<usize>(out), 52)) : changetype<string>(__new(52, idof<string>()));

      store<u16>(changetype<usize>(out), QUOTE);
      memory.copy(changetype<usize>(out) + 2, changetype<usize>(data.toISOString()), 48);
      store<u16>(changetype<usize>(out), QUOTE, 50);
      return changetype<string>(out);
    } else if (data instanceof Array || data instanceof StaticArray) {
      // @ts-ignore
      inline.always(serializeArray(changetype<nonnull<T>>(data)));
      return bs.out<string>();
    } else if (data instanceof Map) {
      // @ts-ignore
      inline.always(serializeMap(changetype<nonnull<T>>(data)));
      return bs.out<string>();
    } else if (data instanceof JSON.Raw) {
      serializeRaw(data);
      return bs.out<string>();
    } else if (data instanceof JSON.Value) {
      inline.always(serializeArbitrary(data));
      return bs.out<string>();
    } else if (data instanceof JSON.Obj) {
      inline.always(serializeObject(data));
      return bs.out<string>();
    } else if (data instanceof JSON.Box) {
      return JSON.stringify(data.value);
    } else {
      throw new Error(`Could not serialize data of type ${nameof<T>()}. Make sure to add the correct decorators to classes.`);
    }
  }

  /**
   * Parses valid JSON strings into their original format
   * ```js
   * JSON.parse<T>(data)
   * ```
   * @param data string
   * @returns T
   */
  // @ts-ignore: inline
  @inline export function parse<T>(data: string): T {
    const dataSize = bytes(data);
    const dataPtr = changetype<usize>(data);
    if (isBoolean<T>()) {
      return deserializeBoolean(dataPtr, dataPtr + dataSize) as T;
    } else if (isInteger<T>()) {
      return deserializeInteger<T>(dataPtr, dataPtr + dataSize);
    } else if (isFloat<T>()) {
      return deserializeFloat<T>(dataPtr, dataPtr + dataSize);
    } else if (isNullable<T>() && dataSize == 8 && load<u64>(dataPtr) == 30399761348886638) {
      // @ts-ignore
      return null;
    } else if (isString<T>()) {
      if (dataSize < 4) throw new Error("Cannot parse data as string because it was formatted incorrectly!");
      // if (ASC_FEATURE_SIMD) {
      //   // @ts-ignore
      //   return changetype<string>(deserializeString_SIMD(dataPtr, dataPtr + dataSize, __new(dataSize - 4, idof<string>())));
      // } else {
      // @ts-ignore
      return deserializeString(dataPtr, dataPtr + dataSize, __new(dataSize - 4, idof<string>()));
      // }
    } else if (isArray<T>()) {
      // @ts-ignore
      return inline.always(deserializeArray<nonnull<T>>(dataPtr, dataPtr + dataSize, changetype<usize>(instantiate<T>())));
    } else {
      let type: nonnull<T> = changetype<nonnull<T>>(0);
      // @ts-ignore: Defined by transform
      if (isDefined(type.__DESERIALIZE)) {
        const out = changetype<nonnull<T>>(__new(offsetof<nonnull<T>>(), idof<nonnull<T>>()));
        // @ts-ignore: Defined by transform
        if (isDefined(type.__INITIALIZE)) out.__INITIALIZE();
        // @ts-ignore
        return out.__DESERIALIZE(dataPtr, dataPtr + dataSize, out);
      } else if (type instanceof Map) {
        // @ts-ignore
        return inline.always(deserializeMap<nonnull<T>>(dataPtr, dataPtr + dataSize, 0));
      } else if (type instanceof Date) {
        // @ts-ignore
        return deserializeDate(dataPtr, dataPtr + dataSize);
      } else if (type instanceof JSON.Raw) {
        // @ts-ignore: type
        return deserializeRaw(dataPtr, dataPtr + dataSize);
      } else if (type instanceof JSON.Value) {
        // should cut out whitespace here
        // @ts-ignore
        return inline.always(deserializeArbitrary(dataPtr, dataPtr + dataSize, 0));
      } else if (type instanceof JSON.Obj) {
        // @ts-ignore
        return inline.always(deserializeObject(dataPtr, dataPtr + dataSize, 0));
      } else if (type instanceof JSON.Box) {
        // @ts-ignore
        return new JSON.Box(parseBox(data, changetype<nonnull<T>>(0).value));
      } else {
        throw new Error(`Could not deserialize data ${data} to type ${nameof<T>()}. Make sure to add the correct decorators to classes.`);
      }
    }
  }

  /**
   * Enum representing the different types supported by JSON.
   */
  export enum Types {
    Raw = 0,
    U8 = 1,
    U16 = 2,
    U32 = 3,
    U64 = 4,
    F32 = 5,
    F64 = 6,
    Null = 7,
    Bool = 8,
    String = 9,
    Object = 10,
    Array = 12,
    Struct = 13,
  }

  export class Raw {
    public data: string;
    constructor(data: string) {
      this.data = data;
    }
    set(data: string): void {
      this.data = data;
    }
    toString(): string {
      return this.data;
    }
    // @ts-ignore: inline
    @inline static from(data: string): JSON.Raw {
      return new JSON.Raw(data);
    }
  }

  export class Value {
    static METHODS: Map<u32, u32> = new Map<u32, u32>();
    public type: i32;

    private storage: u64;

    private constructor() {
      unreachable();
    }

    /**
     * Creates an JSON.Value instance with no set value.
     * @returns An instance of JSON.Value.
     */
    @inline static empty(): JSON.Value {
      return changetype<JSON.Value>(__new(offsetof<JSON.Value>(), idof<JSON.Value>()));
    }

    /**
     * Creates an JSON.Value instance from a given value.
     * @param value - The value to be encapsulated.
     * @returns An instance of JSON.Value.
     */
    @inline static from<T>(value: T): JSON.Value {
      if (value instanceof JSON.Value) {
        return value;
      }
      const out = changetype<JSON.Value>(__new(offsetof<JSON.Value>(), idof<JSON.Value>()));
      out.set<T>(value);
      return out;
    }

    /**
     * Sets the value of the JSON.Value instance.
     * @param value - The value to be set.
     */
    @inline set<T>(value: T): void {
      if (isBoolean<T>()) {
        this.type = JSON.Types.Bool;
        store<T>(changetype<usize>(this), value, STORAGE);
      } else if (isInteger<T>() && !isSigned<T>() && changetype<usize>(value) == 0 && nameof<T>() == "usize") {
        this.type = JSON.Types.Null;
        store<usize>(changetype<usize>(this), 0, STORAGE);
      } else if (value instanceof u8 || value instanceof i8) {
        this.type = JSON.Types.U8;
        store<T>(changetype<usize>(this), value, STORAGE);
      } else if (value instanceof u16 || value instanceof i16) {
        this.type = JSON.Types.U16;
        store<T>(changetype<usize>(this), value, STORAGE);
      } else if (value instanceof u32 || value instanceof i32) {
        this.type = JSON.Types.U32;
        store<T>(changetype<usize>(this), value, STORAGE);
      } else if (value instanceof u64 || value instanceof i64) {
        this.type = JSON.Types.U64;
        store<T>(changetype<usize>(this), value, STORAGE);
      } else if (value instanceof f32) {
        this.type = JSON.Types.F32;
        store<T>(changetype<usize>(this), value, STORAGE);
      } else if (value instanceof f64) {
        this.type = JSON.Types.F64;
        store<T>(changetype<usize>(this), value, STORAGE);
      } else if (isString<T>()) {
        this.type = JSON.Types.String;
        store<T>(changetype<usize>(this), value, STORAGE);
      } else if (value instanceof JSON.Raw) {
        this.type = JSON.Types.Raw;
        store<T>(changetype<usize>(this), value, STORAGE);
      } else if (value instanceof Map) {
        if (idof<T>() !== idof<Map<string, JSON.Value>>()) {
          abort("Maps must be of type Map<string, JSON.Value>!");
        }
        this.type = JSON.Types.Struct;
        store<T>(changetype<usize>(this), value, STORAGE);
        // @ts-ignore: supplied by transform
      } else if (isDefined(value.__SERIALIZE)) {
        this.type = idof<T>() + JSON.Types.Struct;
        // @ts-ignore
        if (!JSON.Value.METHODS.has(idof<T>())) JSON.Value.METHODS.set(idof<T>(), value.__SERIALIZE.index);
        // @ts-ignore
        store<usize>(changetype<usize>(this), changetype<usize>(value), STORAGE);
      } else if (value instanceof JSON.Obj) {
        this.type = JSON.Types.Object;
        store<T>(changetype<usize>(this), value, STORAGE);
        // @ts-ignore
      } else if (isArray<T>() && idof<valueof<T>>() == idof<JSON.Value>()) {
        // @ts-ignore: T satisfies constraints of any[]
        this.type = JSON.Types.Array;
        store<T>(changetype<usize>(this), value, STORAGE);
      }
    }

    /**
     * Gets the value of the JSON.Value instance.
     * @returns The encapsulated value.
     */
    @inline get<T>(): T {
      return load<T>(changetype<usize>(this), STORAGE);
    }

    /**
     * Gets the value of the JSON.Value instance.
     * Alias for .get<T>()
     * @returns The encapsulated value.
     */
    @inline as<T>(): T {
      return load<T>(changetype<usize>(this), STORAGE);
    }

    /**
     * Converts the JSON.Value to a string representation.
     * @returns The string representation of the JSON.Value.
     */
    toString(): string {
      switch (this.type) {
        case JSON.Types.U8:
          return this.get<u8>().toString();
        case JSON.Types.U16:
          return this.get<u16>().toString();
        case JSON.Types.U32:
          return this.get<u32>().toString();
        case JSON.Types.U64:
          return this.get<u64>().toString();
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
  }

  export class Obj {
    // When accessing stackSize, subtract 2
    // @ts-ignore: type
    private stackSize: u32 = 6;
    // @ts-ignore: type
    private storage: Map<string, JSON.Value> = new Map<string, JSON.Value>();

    constructor() { }

    // @ts-ignore: decorator
    @inline get size(): i32 {
      return this.storage.size;
    }

    // @ts-ignore: decorator
    @inline set<T>(key: string, value: T): void {
      if (!this.storage.has(key)) this.stackSize += bytes(key) + 8;
      this.storage.set(key, JSON.Value.from<T>(value));
    }

    // @ts-ignore: decorator
    @inline get(key: string): JSON.Value | null {
      if (!this.storage.has(key)) return null;
      return this.storage.get(key);
    }

    // @ts-ignore: decorator
    @inline has(key: string): bool {
      return this.storage.has(key);
    }

    // @ts-ignore: decorator
    @inline delete(key: string): bool {
      return this.storage.delete(key);
    }

    // @ts-ignore: decorator
    @inline keys(): string[] {
      return this.storage.keys();
    }

    // @ts-ignore: decorator
    @inline values(): JSON.Value[] {
      return this.storage.values();
    }

    // @ts-ignore: decorator
    @inline toString(): string {
      return JSON.stringify(this);
    }

    // @ts-ignore: decorator
    @inline static from<T>(value: T): JSON.Obj {
      if (value instanceof JSON.Obj) return value;
      const out = changetype<JSON.Obj>(__new(offsetof<JSON.Obj>(), idof<JSON.Obj>()));

      if (value instanceof Map) {
      }
      return out;
    }
  }
  /**
   * Box for primitive types
   */
  export class Box<T> {
    constructor(public value: T) {
      if (!isInteger<T>() && !isFloat<T>()) ERROR("JSON.Box should only hold primitive types!");
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
      // @ts-ignore: type
      if (isDefined(this.value.toString)) return this.value.toString();
      return "null";
    }
  }

  /**
   * Serializes JSON data but writes directly to the buffer.
   * Should only be used if you know what you are doing.
   * @param src - T
   * @returns void
   */
  export function __serialize<T>(src: T): void {
    if (isBoolean<T>()) {
      serializeBool(src as bool);
    } else if (isInteger<T>() && nameof<T>() == "usize" && src == 0) {
      bs.proposeSize(8);
      store<u64>(bs.offset, 30399761348886638);
      bs.offset += 8;
    } else if (isInteger<T>()) {
      // @ts-ignore
      serializeInteger<T>(src);
    } else if (isFloat<T>(src)) {
      // @ts-ignore
      serializeFloat<T>(src);
      // @ts-ignore: Function is generated by transform
    } else if (isNullable<T>() && changetype<usize>(src) == <usize>0) {
      bs.proposeSize(8);
      store<u64>(bs.offset, 30399761348886638);
      bs.offset += 8;
    } else if (isString<nonnull<T>>()) {
      if (ASC_FEATURE_SIMD) {
        serializeString_SIMD(src as string);
      } else {
        serializeString(src as string);
      }
      // @ts-ignore: Supplied by transform
    } else if (isDefined(src.__SERIALIZE_CUSTOM)) {
      // @ts-ignore
      return src.__SERIALIZE_CUSTOM();
      // @ts-ignore: Supplied by transform
    } else if (isDefined(src.__SERIALIZE)) {
      // @ts-ignore
      serializeStruct(changetype<nonnull<T>>(src));
    } else if (src instanceof Date) {
      // @ts-ignore
      inline.always(serializeDate(changetype<nonnull<T>>(src)));
    } else if (src instanceof Array || src instanceof StaticArray) {
      // @ts-ignore
      serializeArray(changetype<nonnull<T>>(src));
    } else if (src instanceof Map) {
      // @ts-ignore
      serializeMap(changetype<nonnull<T>>(src));
    } else if (src instanceof JSON.Raw) {
      serializeRaw(src);
    } else if (src instanceof JSON.Value) {
      serializeArbitrary(src);
    } else if (src instanceof JSON.Obj) {
      serializeObject(src);
    } else if (src instanceof JSON.Box) {
      __serialize(src.value);
    } else {
      throw new Error(`Could not serialize provided data. Make sure to add the correct decorators to classes.`);
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
  export function __deserialize<T>(srcStart: usize, srcEnd: usize, dst: usize = 0): T {
    if (isBoolean<T>()) {
      // @ts-ignore: type
      return deserializeBoolean(srcStart, srcEnd);
    } else if (isInteger<T>()) {
      return atoi<T>(srcStart, srcEnd);
    } else if (isFloat<T>()) {
      return deserializeFloat<T>(srcStart, srcEnd);
    } else if (isString<T>()) {
      if (srcEnd - srcStart < 4) throw new Error("Cannot parse data as string because it was formatted incorrectly!");
      // @ts-ignore: type
      return deserializeString(srcStart, srcEnd, dst);
    } else if (isNullable<T>() && srcEnd - srcStart == 8 && load<u64>(srcStart) == 30399761348886638) {
      // @ts-ignore
      return null;
    } else if (isArray<T>()) {
      // @ts-ignore: type
      return deserializeArray<T>(srcStart, srcEnd, dst);
    } else {
      let type: nonnull<T> = changetype<nonnull<T>>(0);
      // @ts-ignore: Defined by transform
      if (isDefined(type.__DESERIALIZE)) {
        const out = changetype<nonnull<T>>(dst || __new(offsetof<nonnull<T>>(), idof<nonnull<T>>()));
        // @ts-ignore: Defined by transform
        if (isNullable<T>() && isDefined(type.__INITIALIZE)) out.__INITIALIZE();
        // @ts-ignore: Defined by transform
        return out.__DESERIALIZE(srcStart, srcEnd, out);
      } else if (type instanceof Map) {
        // @ts-ignore: type
        return deserializeMap<T>(srcStart, srcEnd, dst);
      } else if (type instanceof Date) {
        // @ts-ignore: type
        return deserializeDate(srcStart, srcEnd);
      } else if (type instanceof JSON.Raw) {
        // @ts-ignore: type
        return deserializeRaw(srcStart, srcEnd);
      } else if (type instanceof JSON.Value) {
        // @ts-ignore: type
        return deserializeArbitrary(srcStart, srcEnd, 0);
      } else if (type instanceof JSON.Obj) {
        // @ts-ignore: type
        return deserializeObject(srcStart, srcEnd, 0);
      } else if (type instanceof JSON.Box) {
        // @ts-ignore: type
        return new JSON.Box(deserializeBox(srcStart, srcEnd, dst, changetype<nonnull<T>>(0).value));
      }
    }
    throw new Error(`Could not deserialize data '${ptrToStr(srcStart, srcEnd).slice(0, 100)}' to type. Make sure to add the correct decorators to classes.`);
  }
  export namespace Util {
    // @ts-ignore: decorator
    @inline export function isSpace(code: u16): boolean {
      return code == 0x20 || code - 9 <= 4;
    }
    // @ts-ignore: decorator
    @inline export function ptrToStr(start: usize, end: usize): string {
      const size = end - start;
      const out = __new(size, idof<string>());
      memory.copy(out, start, size);
      return changetype<string>(out);
    }
  }
  /**
   * Methods for use when using JSON methods inside another JSON method or custom serializer/deserializer.
   */
  export namespace internal {
    /**
     * Serializes JSON data. Don't use this directly, use `JSON.stringify` instead.
     * @param data - T
     * @param out - string | null
     * @returns - string
     */
    // @ts-ignore: inline
    @inline export function stringify<T>(data: T, out: string | null = null): string {
      if (isBoolean<T>()) {
        if (out) {
          if (<bool>data == true) {
            out = changetype<string>(__renew(changetype<usize>(out), 8));
            store<u64>(changetype<usize>(out), 28429475166421108);
          } else {
            out = changetype<string>(__renew(changetype<usize>(out), 10));
            store<u64>(changetype<usize>(out), 32370086184550502);
            store<u16>(changetype<usize>(out), 101, 8);
          }
          return out;
        }
        return data ? "true" : "false";
      } else if (isInteger<T>() && !isSigned<T>() && nameof<T>() == "usize" && data == 0) {
        if (out) {
          out = changetype<string>(__renew(changetype<usize>(out), 8));
          store<u64>(changetype<usize>(out), 30399761348886638);
          return out;
        }
        return NULL_WORD;
      } else if (isInteger<T>(data)) {
        if (out) {
          out = changetype<string>(__renew(changetype<usize>(out), sizeof<T>() << 3));

          // @ts-ignore
          const bytes = itoa_buffered(changetype<usize>(out), data) << 1;
          return (out = changetype<string>(__renew(changetype<usize>(out), bytes)));
        }
        return data.toString();
      } else if (isFloat<T>(data)) {
        if (out) {
          out = changetype<string>(__renew(changetype<usize>(out), 64));

          // @ts-ignore
          const bytes = dtoa_buffered(changetype<usize>(out), data) << 1;
          return (out = changetype<string>(__renew(changetype<usize>(out), bytes)));
        }
        return data.toString();
        // @ts-ignore: Function is generated by transform
      } else if (isNullable<T>() && changetype<usize>(data) == <usize>0) {
        if (out) {
          out = changetype<string>(__renew(changetype<usize>(out), 8));
          store<u64>(changetype<usize>(out), 30399761348886638);
          return out;
        }
        return NULL_WORD;
        // @ts-ignore
      } else if (isString<nonnull<T>>()) {
        // if (out) {
        //   out = changetype<string>(__renew(changetype<usize>(out), bytes(data) + 4));
        //   // const oldSize = bs.byteLength;
        //   const oldBuf = bs.buffer;
        //   const newSize = bytes(data) + 4;
        //   const newBuf = __new(newSize, idof<string>());
        //   bs.setBuffer(newBuf);
        //   serializeString(changetype<string>(data));
        //   bs.setBuffer(oldBuf);
        //   return changetype<string>(newBuf);
        // }
        if (ASC_FEATURE_SIMD) {
          serializeString_SIMD(data as string);
        } else {
          bs.saveState();
          serializeString(data as string);
        }
        return bs.cpyOut<string>();
        // @ts-ignore: Supplied by transform
      } else if (isDefined(data.__SERIALIZE)) {
        bs.saveState();
        // @ts-ignore
        inline.always(data.__SERIALIZE(changetype<usize>(data)));
        return bs.cpyOut<string>();
        // @ts-ignore: Supplied by transform
      } else if (data instanceof Date) {
        out = out ? changetype<string>(__renew(changetype<usize>(out), 52)) : changetype<string>(__new(52, idof<string>()));

        store<u16>(changetype<usize>(out), QUOTE);
        memory.copy(changetype<usize>(out) + 2, changetype<usize>(data.toISOString()), 48);
        store<u16>(changetype<usize>(out), QUOTE, 50);
        return changetype<string>(out);
      } else if (data instanceof Array || data instanceof StaticArray) {
        bs.saveState();
        // @ts-ignore
        inline.always(serializeArray(changetype<nonnull<T>>(data)));
        return bs.cpyOut<string>();
      } else if (data instanceof Map) {
        bs.saveState();
        // @ts-ignore
        inline.always(serializeMap(changetype<nonnull<T>>(data)));
        return bs.cpyOut<string>();
      } else if (data instanceof JSON.Raw) {
        bs.saveState();
        serializeRaw(data);
        return bs.cpyOut<string>();
      } else if (data instanceof JSON.Value) {
        bs.saveState();
        inline.always(serializeArbitrary(data));
        return bs.cpyOut<string>();
      } else if (data instanceof JSON.Obj) {
        bs.saveState();
        inline.always(serializeObject(data));
        return bs.cpyOut<string>();
      } else if (data instanceof JSON.Box) {
        return JSON.internal.stringify(data.value);
      } else {
        throw new Error(`Could not serialize data of type ${nameof<T>()}. Make sure to add the correct decorators to classes.`);
      }
    }
  }
}

// @ts-ignore: decorator
@inline function parseBox<T>(data: string, ty: T): T {
  return JSON.parse<T>(data);
}
// @ts-ignore: inline
@inline function deserializeBox<T>(srcStart: usize, srcEnd: usize, dst: usize, ty: T): T {
  return JSON.__deserialize<T>(srcStart, srcEnd, dst);
}

// @ts-ignore: inline
@inline export function toRaw(data: string): JSON.Raw {
  return new JSON.Raw(data);
}
// @ts-ignore: inline
@inline export function fromRaw(data: JSON.Raw): string {
  return data.data;
}

// @ts-ignore: inline
@inline export function toBox<T>(data: T): JSON.Box<T> {
  return new JSON.Box<T>(data);
}
