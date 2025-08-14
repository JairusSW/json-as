import { JSON } from "../..";
import { serializeArray } from "./array";
import { serializeBool } from "./bool";
import { serializeFloat } from "./float";
import { serializeInteger } from "./integer";
import { serializeObject } from "./object";
import { serializeString } from "./string";

export function serializeArbitrary(src: JSON.Value): void {
  switch (src.type) {
    case JSON.Types.U8:
      serializeInteger<u8>(src.get<u8>());
      break;
    case JSON.Types.U16:
      serializeInteger<u16>(src.get<u16>());
      break;
    case JSON.Types.U32:
      serializeInteger<u32>(src.get<u32>());
      break;
    case JSON.Types.U64:
      serializeInteger<u64>(src.get<u64>());
      break;
    case JSON.Types.F32:
      serializeFloat<f32>(src.get<f32>());
      break;
    case JSON.Types.F64:
      serializeFloat<f64>(src.get<f64>());
      break;
    case JSON.Types.String:
      serializeString(src.get<string>());
      break;
    case JSON.Types.Bool:
      serializeBool(src.get<bool>());
      break;
    case JSON.Types.Array: {
      serializeArray(src.get<JSON.Value[]>());
      break;
    }
    case JSON.Types.Object: {
      serializeObject(src.get<JSON.Obj>());
      break;
    }
    default: {
      const fn = JSON.Value.METHODS.get(src.type - JSON.Types.Struct);
      const ptr = src.get<usize>();
      call_indirect<void>(fn, 0, ptr);
      break;
    }
  }
}
