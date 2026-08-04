import { JSON } from "..";
import { v256r, v512r } from "as-simd/assembly/wide/wide";


@json
class WideStringFixture {
  text: string = "";
}

const PLAIN =
  "0123456789abcdefghijklmnopqrstuvwxyz" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ-_" +
  "0123456789abcdefghijklmnopqrstuvwxyz" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ-_";

const ESCAPED =
  "0123456789abcdefghijklmnopqrstuv" +
  '\\quoted"\n' +
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PLAIN_JSON = '"' + PLAIN + '"';
const PLAIN_2 = PLAIN + PLAIN;
const PLAIN_4 = PLAIN_2 + PLAIN_2;
const PLAIN_8 = PLAIN_4 + PLAIN_4;
const PLAIN_16 = PLAIN_8 + PLAIN_8;
const PLAIN_16_JSON = '"' + PLAIN_16 + '"';
let reusableSerialize = "";
let reusableSerializeLong = "";

const WIDE_PROBE = memory.data<u16>([
  7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 7,
]);

/**
 * End-to-end correctness signal used by scripts/test-wago-wide.mjs.
 * Returns zero on success so the host does not need AssemblyScript strings.
 */
export function verify(): i32 {
  if (JSON_SIMD_WIDTH == 512) {
    v512r.load(0, WIDE_PROBE);
    v512r.splat<u16>(1, 7);
    v512r.eq<u16>(2, 0, 1);
    if (v512r.bitmask<u16>(2) != 0x80000001) return 5;
  } else {
    v256r.load(0, WIDE_PROBE);
    v256r.splat<u16>(1, 7);
    v256r.eq<u16>(2, 0, 1);
    if (v256r.bitmask<u16>(2) != 1) return 5;
  }

  const plainJson = JSON.stringify<string>(PLAIN);
  if (JSON.parse<string>(plainJson) != PLAIN) return 1;

  const escapedJson = JSON.stringify<string>(ESCAPED);
  if (JSON.parse<string>(escapedJson) != ESCAPED) return 2;
  let reused = JSON.stringify<string>(PLAIN, "");
  if (reused != plainJson) return 6;
  reused = JSON.stringify<string>(ESCAPED, reused);
  if (reused != escapedJson) return 7;

  const objectJson = '{"text":' + escapedJson + "}";
  const value = JSON.parse<WideStringFixture>(objectJson);
  if (value.text != ESCAPED) return 3;
  if (JSON.parse<WideStringFixture>(JSON.stringify(value)).text != ESCAPED)
    return 4;

  return 0;
}

export function benchSerialize(iterations: i32): i32 {
  let checksum = 0;
  for (let i = 0; i < iterations; i++) {
    checksum += JSON.stringify<string>(PLAIN).length;
  }
  return checksum;
}

export function benchDeserialize(iterations: i32): i32 {
  let checksum = 0;
  for (let i = 0; i < iterations; i++) {
    checksum += JSON.parse<string>(PLAIN_JSON).length;
  }
  return checksum;
}

export function benchSerializeLong(iterations: i32): i32 {
  let checksum = 0;
  for (let i = 0; i < iterations; i++) {
    checksum += JSON.stringify<string>(PLAIN_16).length;
  }
  return checksum;
}

export function benchSerializeReuse(iterations: i32): i32 {
  let checksum = 0;
  for (let i = 0; i < iterations; i++) {
    reusableSerialize = JSON.stringify<string>(PLAIN, reusableSerialize);
    checksum += reusableSerialize.length;
  }
  return checksum;
}

export function benchSerializeReuseLong(iterations: i32): i32 {
  let checksum = 0;
  for (let i = 0; i < iterations; i++) {
    reusableSerializeLong = JSON.stringify<string>(
      PLAIN_16,
      reusableSerializeLong,
    );
    checksum += reusableSerializeLong.length;
  }
  return checksum;
}

export function benchDeserializeLong(iterations: i32): i32 {
  let checksum = 0;
  for (let i = 0; i < iterations; i++) {
    checksum += JSON.parse<string>(PLAIN_16_JSON).length;
  }
  return checksum;
}
