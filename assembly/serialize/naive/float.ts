import { bs } from "../../../lib/as-bs";
import { writeFloatUnsafe, writeDoubleUnsafe } from "../../util/zmij";

// Float serialization is backed by Żmij (a Schubfach/xjb shortest-decimal
// writer with SWAR + WASM-SIMD digit kernels). The writers emit UTF-16
// straight into the `bs` buffer and return a pointer past the last char.

@inline
export function serializeFloat32Unsafe(data: f32): void {
  bs.offset = writeFloatUnsafe(bs.offset, data);
}


@inline
export function serializeFloat64Unsafe(data: f64): void {
  bs.offset = writeDoubleUnsafe(bs.offset, data);
}


@inline
export function serializeFloat32(data: f32): void {
  bs.ensureSize(128);
  const start = bs.offset;
  const end = writeFloatUnsafe(start, data);
  bs.stackSize += end - start;
  bs.offset = end;
}


@inline
export function serializeFloat64(data: f64): void {
  bs.ensureSize(128);
  const start = bs.offset;
  const end = writeDoubleUnsafe(start, data);
  bs.stackSize += end - start;
  bs.offset = end;
}

// @ts-ignore: inline
@inline export function serializeFloat<T extends number>(data: T): void {
  if (sizeof<T>() == 4) serializeFloat32(<f32>data);
  else serializeFloat64(<f64>data);
}
