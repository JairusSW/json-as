import { bs } from "../../../lib/as-bs";
/**
 * Serialize a bool to type string
 * @param data data to serialize
 * @returns void
 */
@inline
export function serializeBoolUnsafe(data: bool): void {
  if (data === true) {
    store<u64>(bs.offset, 28429475166421108);
    bs.offset += 8;
  } else {
    store<u64>(bs.offset, 32370086184550502);
    store<u64>(bs.offset, 101, 8);
    bs.offset += 10;
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
    store<u64>(bs.offset, 101, 8);
    bs.offset += 10;
  }
}
