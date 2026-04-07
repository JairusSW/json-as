import { bs } from "../../../lib/as-bs";
import { COMMA, BRACKET_RIGHT, BRACKET_LEFT } from "../../custom/chars";
import { JSON } from "../..";
import { serializeFloat32, serializeFloat64 } from "./float";

@inline
function serializeArrayElement<T>(value: T): void {
  if (isFloat<T>()) {
    if (sizeof<T>() == 4) serializeFloat32(<f32>value);
    else serializeFloat64(<f64>value);
    return;
  }
  JSON.__serialize<T>(value);
}

export function serializeArray<T extends any[]>(src: T): void {
  bs.proposeSize(4);
  const end = src.length - 1;
  let i = 0;
  if (end == -1) {
    store<u32>(bs.offset, 6094939);
    bs.offset += 4;
    return;
  }
  // {} = 4
  // xi, = n << 1

  store<u16>(bs.offset, BRACKET_LEFT);
  bs.offset += 2;

  while (i < end) {
    const block = unchecked(src[i++]);
    serializeArrayElement<valueof<T>>(block);
    bs.growSize(2);
    store<u16>(bs.offset, COMMA);
    bs.offset += 2;
  }

  const lastBlock = unchecked(src[end]);
  serializeArrayElement<valueof<T>>(lastBlock);
  // bs.growSize(2);
  store<u16>(bs.offset, BRACKET_RIGHT);
  bs.offset += 2;
}
