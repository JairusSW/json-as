import { bs } from "../../../lib/as-bs";
import { dragonbox_f32_buffered, dragonbox_f64_buffered } from "../../util/dragonbox";

@inline
export function serializeFloat32(data: f32): void {
  bs.ensureSize(64);
  const size = dragonbox_f32_buffered(bs.offset, data) << 1;
  bs.stackSize += size;
  bs.offset += size;
}

@inline
export function serializeFloat64(data: f64): void {
  bs.ensureSize(64);
  const size = dragonbox_f64_buffered(bs.offset, data) << 1;
  bs.stackSize += size;
  bs.offset += size;
}

// @ts-ignore: inline
@inline export function serializeFloat<T extends number>(data: T): void {
  if (sizeof<T>() == 4) serializeFloat32(<f32>data);
  else serializeFloat64(<f64>data);
}
