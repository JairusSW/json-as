import { bs } from "../../../lib/as-bs";
import { JSON } from "../..";
import { BRACE_LEFT, BRACE_RIGHT, COLON, COMMA } from "../../custom/chars";
import { serializeString } from "../index/string";
import { serializeRaw } from "./raw";

function serializeRawMapFast<T extends Map<any, any>>(
  keys: Array<indexof<T>>,
  values: Array<valueof<T>>,
): void {
  const len = keys.length;
  bs.proposeSize(4 + <u32>len * 4);
  store<u16>(bs.offset, BRACE_LEFT);
  bs.offset += 2;

  const keyData = keys.dataStart;
  const valueData = values.dataStart;
  for (let i = 0; i < len; i++) {
    const key = changetype<string>(load<usize>(keyData + ((<usize>i) << 2)));
    const value = changetype<JSON.Raw>(
      load<usize>(valueData + ((<usize>i) << 2)),
    );
    serializeString(key);
    store<u16>(bs.offset, COLON);
    bs.offset += 2;
    serializeRaw(value);
    store<u16>(bs.offset, COMMA);
    bs.offset += 2;
  }
  store<u16>(bs.offset - 2, BRACE_RIGHT);
}

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
  const keyIsString = isString<indexof<T>>();

  if (keyIsString && isReference<valueof<T>>()) {
    const valueType = changetype<nonnull<valueof<T>>>(0);
    // @ts-ignore: instanceof on the reference value type
    if (valueType instanceof JSON.Raw) {
      serializeRawMapFast<T>(keys, values);
      return;
    }
  }

  bs.proposeSize(4 + <u32>(srcSize - 1) * 2 + <u32>srcSize * 2);

  store<u16>(bs.offset, BRACE_LEFT);
  bs.offset += 2;

  for (let i = 0; i < srcEnd; i++) {
    if (keyIsString) {
      JSON.__serialize(unchecked(keys[i]));
    } else {
      JSON.__serialize<string>(
        JSON.internal.stringify<indexof<T>>(unchecked(keys[i])),
      );
    }
    store<u16>(bs.offset, COLON);
    bs.offset += 2;
    JSON.__serialize(unchecked(values[i]));
    store<u16>(bs.offset, COMMA);
    bs.offset += 2;
  }

  if (keyIsString) {
    JSON.__serialize(unchecked(keys[srcEnd]));
  } else {
    JSON.__serialize<string>(
      JSON.internal.stringify<indexof<T>>(unchecked(keys[srcEnd])),
    );
  }
  store<u16>(bs.offset, COLON);
  bs.offset += 2;

  JSON.__serialize(unchecked(values[srcEnd]));
  store<u16>(bs.offset, BRACE_RIGHT);
  bs.offset += 2;
}
