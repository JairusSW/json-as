import { bs } from "../../../lib/as-bs";
import { JSON } from "../..";
import { BRACE_LEFT, BRACE_RIGHT, COLON, COMMA } from "../../custom/chars";

export function serializeMap<T extends Map<any, any>>(src: T): void {
  const srcSize = src.size;
  const srcEnd = srcSize - 1;

  if (srcSize == 0) {
    bs.proposeSize(4);
    store<u32>(bs.offset, 8192123);
    bs.offset += 4;
    return;
  }

  let keys = src.keys();
  let values = src.values();

  bs.proposeSize(4);

  store<u16>(bs.offset, BRACE_LEFT);
  bs.offset += 2;

  for (let i = 0; i < srcEnd; i++) {
    // @ts-ignore: Valid
    if (!isString<indexof<T>>()) {
      bs.growSize(6);
      store<u16>(bs.offset, 34);
      bs.offset += 2;
      JSON.__serialize(unchecked(keys[i]));
      store<u16>(bs.offset, 34);
      store<u16>(bs.offset, COLON, 2);
      bs.offset += 4;
    } else {
      JSON.__serialize(unchecked(keys[i]));
      bs.growSize(2);
      store<u16>(bs.offset, COLON);
      bs.offset += 2;
    }
    JSON.__serialize(unchecked(values[i]));
    bs.growSize(2);
    store<u16>(bs.offset, COMMA);
    bs.offset += 2;
  }

  // @ts-ignore: Valid
  if (!isString<indexof<T>>()) {
    bs.growSize(6);
    store<u16>(bs.offset, 34);
    bs.offset += 2;
    JSON.__serialize(unchecked(keys[srcEnd]));
    store<u16>(bs.offset, 34);
    store<u16>(bs.offset, COLON, 2);
    bs.offset += 4;
  } else {
    JSON.__serialize(unchecked(keys[srcEnd]));
    bs.growSize(2);
    store<u16>(bs.offset, COLON);
    bs.offset += 2;
  }

  JSON.__serialize(unchecked(values[srcEnd]));
  // bs.growSize(2);
  store<u16>(bs.offset, BRACE_RIGHT);
  bs.offset += 2;
}
