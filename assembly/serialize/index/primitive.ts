import { JSON } from "../..";
import { bs } from "../../../lib/as-bs";
import { serializeBool } from "./bool";
import { serializeFloat32, serializeFloat64 } from "./float";
import { serializeInteger } from "./integer";

// Emit concrete primitive slots without allocating a transient JSON.Value.
// References and deferred values are untouched and use the existing dispatcher.
export function serializePrimitiveSlot(slot: u64): bool {
  switch (JSON.Value.slotTag(slot)) {
    case JSON.Types.Null:
      bs.proposeSize(8);
      store<u64>(bs.offset, 30399761348886638);
      bs.offset += 8;
      return true;
    case JSON.Types.Bool:
      serializeBool(JSON.Value.decodeBits<bool>(slot));
      return true;
    case JSON.Types.U8:
      serializeInteger<u8>(JSON.Value.decodeBits<u8>(slot));
      return true;
    case JSON.Types.U16:
      serializeInteger<u16>(JSON.Value.decodeBits<u16>(slot));
      return true;
    case JSON.Types.U32:
      serializeInteger<u32>(JSON.Value.decodeBits<u32>(slot));
      return true;
    case JSON.Types.U64:
      serializeInteger<u64>(JSON.Value.decodeBits<u64>(slot));
      return true;
    case JSON.Types.I8:
      serializeInteger<i8>(JSON.Value.decodeBits<i8>(slot));
      return true;
    case JSON.Types.I16:
      serializeInteger<i16>(JSON.Value.decodeBits<i16>(slot));
      return true;
    case JSON.Types.I32:
      serializeInteger<i32>(JSON.Value.decodeBits<i32>(slot));
      return true;
    case JSON.Types.I64:
      serializeInteger<i64>(JSON.Value.decodeBits<i64>(slot));
      return true;
    case JSON.Types.F32:
      serializeFloat32(JSON.Value.decodeBits<f32>(slot));
      return true;
    case JSON.Types.F64:
      serializeFloat64(JSON.Value.decodeBits<f64>(slot));
      return true;
    default:
      return false;
  }
}
