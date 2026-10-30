import { bs } from "../../../lib/as-bs";
import { dtoa_buffered, ftoa_buffered } from "xjb-as";
import { NULL_WORD_U64 } from "../../custom/chars";

// Float serialization is backed by xjb-as (a Schubfach/xjb shortest-decimal
// writer with SWAR + WASM-SIMD digit kernels). The *_buffered writers emit
// UTF-16 straight into the `bs` buffer and return the number of characters
// written, so advancing the offset is `count << 1` bytes.

export function serializeFloat32Unsafe(data: f32): void {
  if ((reinterpret<u32>(data) & 0x7f800000) == 0x7f800000) {
    store<u64>(bs.offset, NULL_WORD_U64);
    bs.offset += 8;
    return;
  }
  bs.offset += ftoa_buffered(bs.offset, data) << 1;
}

export function serializeFloat64Unsafe(data: f64): void {
  if ((reinterpret<u64>(data) & 0x7ff0000000000000) == 0x7ff0000000000000) {
    store<u64>(bs.offset, NULL_WORD_U64);
    bs.offset += 8;
    return;
  }
  bs.offset += dtoa_buffered(bs.offset, data) << 1;
}

export function serializeFloat32(data: f32): void {
  if ((reinterpret<u32>(data) & 0x7f800000) == 0x7f800000) {
    bs.proposeSize(8);
    store<u64>(bs.offset, NULL_WORD_U64);
    bs.offset += 8;
    return;
  }
  bs.ensureSize(128);
  const bytes = ftoa_buffered(bs.offset, data) << 1;
  bs.stackSize += bytes;
  bs.offset += bytes;
}

export function serializeFloat64(data: f64): void {
  if ((reinterpret<u64>(data) & 0x7ff0000000000000) == 0x7ff0000000000000) {
    bs.proposeSize(8);
    store<u64>(bs.offset, NULL_WORD_U64);
    bs.offset += 8;
    return;
  }
  bs.ensureSize(128);
  const bytes = dtoa_buffered(bs.offset, data) << 1;
  bs.stackSize += bytes;
  bs.offset += bytes;
}
