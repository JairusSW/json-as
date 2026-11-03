import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { JSON } from "../..";
export {
  serializeArrayBufferUnsafe,
  serializeTypedArray,
} from "../naive/typedarray";
import {
  serializeArrayBufferUnsafe,
  serializeTypedArray,
} from "../naive/typedarray";

// AssemblyScript's Object is the runtime base class needed for ancestry checks.
// eslint-disable-next-line @typescript-eslint/no-wrapper-object-types
type RuntimeObject = Object;

export function serializeDynamic(type: u16, data: usize): void {
  if (type == JSON.Types.ArrayBuffer) {
    serializeArrayBufferUnsafe(
      data,
      changetype<OBJECT>(data - TOTAL_OVERHEAD).rtSize,
    );
  } else if (type == JSON.Types.TypedArray) {
    const id = changetype<OBJECT>(data - TOTAL_OVERHEAD).rtId;
    if (id == idof<Int8Array>()) {
      serializeTypedArray<Int8Array>(changetype<Int8Array>(data));
    } else if (id == idof<Uint8Array>()) {
      serializeTypedArray<Uint8Array>(changetype<Uint8Array>(data));
    } else if (id == idof<Uint8ClampedArray>()) {
      serializeTypedArray<Uint8ClampedArray>(
        changetype<Uint8ClampedArray>(data),
      );
    } else if (id == idof<Int16Array>()) {
      serializeTypedArray<Int16Array>(changetype<Int16Array>(data));
    } else if (id == idof<Uint16Array>()) {
      serializeTypedArray<Uint16Array>(changetype<Uint16Array>(data));
    } else if (id == idof<Int32Array>()) {
      serializeTypedArray<Int32Array>(changetype<Int32Array>(data));
    } else if (id == idof<Uint32Array>()) {
      serializeTypedArray<Uint32Array>(changetype<Uint32Array>(data));
    } else if (id == idof<Int64Array>()) {
      serializeTypedArray<Int64Array>(changetype<Int64Array>(data));
    } else if (id == idof<Uint64Array>()) {
      serializeTypedArray<Uint64Array>(changetype<Uint64Array>(data));
    } else if (id == idof<Float32Array>()) {
      serializeTypedArray<Float32Array>(changetype<Float32Array>(data));
    } else if (id == idof<Float64Array>()) {
      serializeTypedArray<Float64Array>(changetype<Float64Array>(data));
    } else if (changetype<RuntimeObject>(data) instanceof Int8Array) {
      serializeTypedArray<Int8Array>(changetype<Int8Array>(data));
    } else if (changetype<RuntimeObject>(data) instanceof Uint8Array) {
      serializeTypedArray<Uint8Array>(changetype<Uint8Array>(data));
    } else if (changetype<RuntimeObject>(data) instanceof Uint8ClampedArray) {
      serializeTypedArray<Uint8ClampedArray>(
        changetype<Uint8ClampedArray>(data),
      );
    } else if (changetype<RuntimeObject>(data) instanceof Int16Array) {
      serializeTypedArray<Int16Array>(changetype<Int16Array>(data));
    } else if (changetype<RuntimeObject>(data) instanceof Uint16Array) {
      serializeTypedArray<Uint16Array>(changetype<Uint16Array>(data));
    } else if (changetype<RuntimeObject>(data) instanceof Int32Array) {
      serializeTypedArray<Int32Array>(changetype<Int32Array>(data));
    } else if (changetype<RuntimeObject>(data) instanceof Uint32Array) {
      serializeTypedArray<Uint32Array>(changetype<Uint32Array>(data));
    } else if (changetype<RuntimeObject>(data) instanceof Int64Array) {
      serializeTypedArray<Int64Array>(changetype<Int64Array>(data));
    } else if (changetype<RuntimeObject>(data) instanceof Uint64Array) {
      serializeTypedArray<Uint64Array>(changetype<Uint64Array>(data));
    } else if (changetype<RuntimeObject>(data) instanceof Float32Array) {
      serializeTypedArray<Float32Array>(changetype<Float32Array>(data));
    } else if (changetype<RuntimeObject>(data) instanceof Float64Array) {
      serializeTypedArray<Float64Array>(changetype<Float64Array>(data));
    } else {
      throw new Error("Unsupported typed array in JSON.Value");
    }
  }
}
