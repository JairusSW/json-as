import { bs } from "../../../lib/as-bs";
import { QUOTE } from "../../custom/chars";
import { bytes } from "../../util/bytes";

export function serializeDate(src: Date): void {
  const data = src.toISOString();
  const dataSize = bytes(data);
  bs.proposeSize(dataSize + 4);
  store<u16>(bs.offset, QUOTE);
  memory.copy(bs.offset + 2, changetype<usize>(data), dataSize);
  store<u16>(bs.offset + dataSize, QUOTE, 2);
  bs.offset += dataSize + 4;
}
