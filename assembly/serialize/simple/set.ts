import { bs } from "../../../lib/as-bs";
import { COMMA, BRACKET_RIGHT, BRACKET_LEFT } from "../../custom/chars";
import { JSON } from "../..";

export function serializeSet<T extends Set<any>>(src: T): void {
  const srcSize = src.size;
  if (srcSize == 0) {
    bs.proposeSize(4);
    store<u32>(bs.offset, 6094939); // []
    bs.offset += 4;
    return;
  }
  bs.proposeSize(4 + <u32>(srcSize - 1) * 2);

  const values = src.values();
  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;

  const end = srcSize - 1;
  for (let i = 0; i < end; i++) {
    const block = unchecked(values[i]);
    // @ts-ignore: type
    JSON.__serialize<indexof<T>>(block);
    store<u16>(bs.offset, COMMA);
    bs.offset += 2;
  }

  const lastBlock = unchecked(values[end]);
  // @ts-ignore: type
  JSON.__serialize<indexof<T>>(lastBlock);
  store<u16>(bs.offset, BRACKET_RIGHT);
  bs.offset += 2;
}
