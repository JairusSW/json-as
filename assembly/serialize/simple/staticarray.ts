import { bs } from "../../../lib/as-bs";
import { COMMA, BRACKET_RIGHT, BRACKET_LEFT } from "../../custom/chars";
import { JSON } from "../..";

export function serializeStaticArray<T extends StaticArray<any>>(src: T): void {
  const len = src.length;
  const end = len - 1;
  let i = 0;
  if (end == -1) {
    bs.proposeSize(4);
    store<u32>(bs.offset, 6094939); // []
    bs.offset += 4;
    return;
  }
  bs.proposeSize(4 + <u32>(len - 1) * 2);

  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;

  while (i < end) {
    const block = unchecked(src[i++]);
    JSON.__serialize<valueof<T>>(block);
    store<u16>(bs.offset, COMMA);
    bs.offset += 2;
  }

  const lastBlock = unchecked(src[end]);
  JSON.__serialize<valueof<T>>(lastBlock);
  store<u16>(bs.offset, BRACKET_RIGHT);
  bs.offset += 2;
}
