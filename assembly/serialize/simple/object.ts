import { bs } from "../../../lib/as-bs";
import { JSON } from "../..";
import { BRACE_LEFT, BRACE_RIGHT, COLON, COMMA } from "../../custom/chars";
import { serializeArbitrary } from "./arbitrary";
import { serializeString_SWAR } from "../swar/string";

export function serializeObject(src: JSON.Obj): void {
  const srcSize = src.size;
  const srcEnd = srcSize - 1;

  if (srcSize == 0) {
    bs.proposeSize(4);
    store<u32>(bs.offset, 8192123);
    bs.offset += 4;
    return;
  }

  const keys = src.keys();
  const values = src.values();

  bs.growSize(2);
  store<u16>(bs.offset, BRACE_LEFT);
  bs.offset += 2;

  for (let i = 0; i < srcEnd; i++) {
    serializeString_SWAR(unchecked(keys[i]));
    bs.growSize(2);
    store<u16>(bs.offset, COLON);
    bs.offset += 2;

    serializeArbitrary(unchecked(values[i]));
    bs.growSize(2);
    store<u16>(bs.offset, COMMA);
    bs.offset += 2;
  }

  serializeString_SWAR(unchecked(keys[srcEnd]));
  bs.growSize(2);
  store<u16>(bs.offset, COLON);
  bs.offset += 2;
  serializeArbitrary(unchecked(values[srcEnd]));

  bs.growSize(2);
  store<u16>(bs.offset, BRACE_RIGHT);
  bs.offset += 2;
}
