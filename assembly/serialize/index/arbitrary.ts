import { JSON } from "../..";
import { bs } from "../../../lib/as-bs";
import { bytes } from "../../util/bytes";
import { QUOTE } from "../../custom/chars";
import { serializeBool } from "./bool";
import { serializeFloat32, serializeFloat64 } from "./float";
import { serializeInteger } from "./integer";
import { serializeJsonArray } from "./jsonarray";
import { serializeMap } from "./map";
import { serializeObject } from "./object";
import { serializeRaw } from "../naive/raw";
import { serializeString } from "./string";
import { serializeDynamic } from "./typedarray";

// True if any code unit would need JSON-escaping on serialize: a quote,
// backslash, control char (< 0x20), or a surrogate (handled conservatively -
// even valid pairs route to the full path, since they can't be bulk-copied as a
// plain run). A clean string is none of these, so it emits as a verbatim memcpy.
// @ts-ignore: decorator
@inline function stringNeedsEscape(src: string): bool {
  let ptr = changetype<usize>(src);
  const end = ptr + <usize>bytes(src);
  while (ptr < end) {
    const code = load<u16>(ptr);
    if (
      code == 0x22 ||
      code == 0x5c ||
      code < 0x20 ||
      (code >= 0xd800 && code <= 0xdfff)
    )
      return true;
    ptr += 2;
  }
  return false;
}

// Fast path for a string already known to need no escaping: quote + a single
// bulk copy of the UTF-16 bytes + quote. Skips the per-char escape scan that
// serializeString would otherwise do (and its trailing second pass).
function serializeStringClean(src: string): void {
  const size = <usize>bytes(src);
  bs.proposeSize(size + 4);
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
  memory.copy(bs.offset, changetype<usize>(src), size);
  bs.offset += size;
  store<u16>(bs.offset, QUOTE);
  bs.offset += 2;
}

export function serializeArbitrary(src: JSON.Value): void {
  // Verbatim passthrough: an untouched (still-deferred) value emits its original
  // source bytes directly - no materialization, no re-encoding. Peek the slice
  // without reading `src.type` (which would force materialization).
  const lz = src.__lazySlice();
  if (lz != 0) {
    const start = <usize>(lz >>> 32);
    const size = <usize>(<u32>lz) - start;
    bs.proposeSize(size);
    memory.copy(bs.offset, start, size);
    bs.offset += size;
    return;
  }
  switch (src.type) {
    case JSON.Types.Null:
      bs.proposeSize(8);
      store<u64>(bs.offset, 30399761348886638);
      bs.offset += 8;
      break;
    case JSON.Types.Raw:
      // A materialized JSON.Raw value (e.g. set into a JSON.Obj/Arr) emits its
      // pre-formatted bytes as-is - without this it fell into the struct default.
      serializeRaw(src.get<JSON.Raw>());
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
      serializeFloat32(src.get<f32>());
      break;
    case JSON.Types.F64:
      serializeFloat64(src.get<f64>());
      break;
    case JSON.Types.String: {
      const str = src.get<string>();
      // Reuse the cached escape class; classify once on first serialize. Clean
      // strings (the common case) then emit as a single memcpy on every reuse.
      let cls = src.__strClass();
      if (cls == 0) {
        cls = stringNeedsEscape(str) ? 2 : 1;
        src.__setStrClass(cls);
      }
      if (cls == 1) serializeStringClean(str);
      else serializeString(str);
      break;
    }
    case JSON.Types.Bool:
      serializeBool(src.get<bool>());
      break;
    case JSON.Types.Array:
      serializeJsonArray(src.get<JSON.Arr>());
      break;
    case JSON.Types.Object:
      serializeObject(src.get<JSON.Obj>());
      break;
    case JSON.Types.Map:
      serializeMap(src.get<Map<string, JSON.Value>>());
      break;
    case JSON.Types.TypedArray:
    case JSON.Types.ArrayBuffer:
      serializeDynamic(src.type, src.get<usize>());
      break;
    default: {
      const fn = JSON.Value.METHODS.get(src.type - JSON.Types.Struct);
      const ptr = src.get<usize>();
      call_indirect<void>(fn, 0, ptr);
      break;
    }
  }
}
