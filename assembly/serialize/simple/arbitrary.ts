import { JSON } from "../..";
import { bs } from "../../../lib/as-bs";
import { serializeArray } from "./array";
import { serializeBool } from "./bool";
import { serializeFloat } from "./float";
import { serializeInteger } from "./integer";
import { serializeMap } from "./map";
import { serializeObject } from "./object";
import { serializeString } from "./string";

export function serializeArbitrary(src: JSON.Value): void {
  switch (src.type) {
    case JSON.Types.Null:
      bs.proposeSize(8);
      store<u64>(bs.offset, 30399761348886638);
      bs.offset += 8;
      break;
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
    case JSON.Types.I8:
      serializeInteger<i8>(src.get<i8>());
      break;
    case JSON.Types.I16:
      serializeInteger<i16>(src.get<i16>());
      break;
    case JSON.Types.I32:
      serializeInteger<i32>(src.get<i32>());
      break;
    case JSON.Types.I64:
      serializeInteger<i64>(src.get<i64>());
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
    case JSON.Types.Map: {
      serializeMap(src.get<Map<string, JSON.Value>>());
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
