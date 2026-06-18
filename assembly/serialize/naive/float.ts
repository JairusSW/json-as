import { bs } from "../../../lib/as-bs";
import { dtoa_buffered, ftoa_buffered } from "xjb-as";

// Float serialization is backed by xjb-as (a Schubfach/xjb shortest-decimal
// writer with SWAR + WASM-SIMD digit kernels). The *_buffered writers emit
// UTF-16 straight into the `bs` buffer and return the number of characters
// written, so advancing the offset is `count << 1` bytes.

export function serializeFloat32Unsafe(data: f32): void {
  bs.offset += ftoa_buffered(bs.offset, data) << 1;
}

export function serializeFloat64Unsafe(data: f64): void {
  bs.offset += dtoa_buffered(bs.offset, data) << 1;
}

export function serializeFloat32(data: f32): void {
  bs.ensureSize(128);
  const bytes = ftoa_buffered(bs.offset, data) << 1;
  bs.stackSize += bytes;
  bs.offset += bytes;
}

export function serializeFloat64(data: f64): void {
  bs.ensureSize(128);
  const bytes = dtoa_buffered(bs.offset, data) << 1;
  bs.stackSize += bytes;
  bs.offset += bytes;
}
