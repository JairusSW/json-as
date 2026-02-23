import { bs } from "../../../lib/as-bs";
import { JSON } from "../..";
import { bytes } from "../../util";

/**
 * Serialize raw data to itself
 * @param data data to serialize
 * @returns void
 */
// @ts-ignore: inline
@inline export function serializeRaw(data: JSON.Raw): void {
  const dataSize = bytes(data.data);
  bs.proposeSize(dataSize);
  memory.copy(changetype<usize>(bs.offset), changetype<usize>(data.data), dataSize);
  bs.offset += dataSize;
}
