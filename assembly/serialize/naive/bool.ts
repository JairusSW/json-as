import { bs } from "../../../lib/as-bs";
/**
 * Serialize a bool to type string
 * @param data data to serialize
 * @returns void
 */
export function serializeBoolUnsafe(data: bool): void {
  bs.offset = serializeBoolAt(bs.offset, data);
}


@inline export function serializeBoolAt(dst: usize, data: bool): usize {
  if (data === true) {
    store<u64>(dst, 28429475166421108);
    return dst + 8;
  } else {
    store<u64>(dst, 32370086184550502);
    store<u16>(dst, 101, 8);
    return dst + 10;
  }
}

export function serializeBool(data: bool): void {
  if (data === true) {
    bs.proposeSize(8);
    store<u64>(bs.offset, 28429475166421108);
    bs.offset += 8;
  } else {
    bs.proposeSize(10);
    store<u64>(bs.offset, 32370086184550502);
    store<u16>(bs.offset, 101, 8);
    bs.offset += 10;
  }
}
