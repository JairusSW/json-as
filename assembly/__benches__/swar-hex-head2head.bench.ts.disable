import { expect } from "../__tests__/lib";
import { u16_to_hex4_swar } from "../util/swar";
import { bench, blackbox } from "./lib/bench";

const CODES = memory.data<u16>([0x0000, 0x0001, 0x000f, 0x0010, 0x00ff, 0x0100, 0x07ff, 0x1234, 0xabcd, 0xd7ff, 0xd800, 0xdbff, 0xdc00, 0xdfff, 0xe000, 0xffff]);
const CODE_COUNT: usize = 16;

// @ts-expect-error: @inline is a valid decorator
@inline function hexNibbleOld(n: u16): u16 {
  return n < 10 ? 48 + n : 87 + n;
}

// @ts-expect-error: @inline is a valid decorator
@inline function oldPackHex4(code: u16): u64 {
  return (<u64>hexNibbleOld((code >> 12) & 0xf)) | ((<u64>hexNibbleOld((code >> 8) & 0xf)) << 16) | ((<u64>hexNibbleOld((code >> 4) & 0xf)) << 32) | ((<u64>hexNibbleOld(code & 0xf)) << 48);
}

function packAllOld(): u64 {
  let acc: u64 = 0;
  for (let i: usize = 0; i < CODE_COUNT; i++) {
    acc ^= oldPackHex4(load<u16>(CODES + (i << 1)));
  }
  return acc;
}

function packAllSWAR(): u64 {
  let acc: u64 = 0;
  for (let i: usize = 0; i < CODE_COUNT; i++) {
    acc ^= u16_to_hex4_swar(load<u16>(CODES + (i << 1)));
  }
  return acc;
}

for (let code: u32 = 0; code <= 0xffff; code++) {
  expect<u64>(u16_to_hex4_swar(<u16>code)).toBe(oldPackHex4(<u16>code));
}

const bytesPerOp: u64 = <u64>(CODE_COUNT << 1);

bench("Pack UTF-16 hex digits (old)", () => blackbox(packAllOld()), 10_000_000, bytesPerOp);
bench("Pack UTF-16 hex digits (swar)", () => blackbox(packAllSWAR()), 10_000_000, bytesPerOp);
