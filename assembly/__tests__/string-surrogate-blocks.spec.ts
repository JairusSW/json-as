import { JSON } from "..";
import { describe, expect } from "as-test";
import { bs } from "../../lib/as-bs";
import { serializeString_NAIVE } from "../serialize/naive/string";

function scalar(src: string): string {
  serializeString_NAIVE(src);
  return bs.out<string>();
}

describe("Vector string blocks agree with scalar output for every UTF-16 lane", () => {
  const pattern = "a😀b😀c😀d😀e";
  const probe = changetype<string>(__new(pattern.length << 1, idof<string>()));
  const ptr = changetype<usize>(probe);
  let mismatches = 0;
  for (let lane: usize = 0; lane < 8; lane++) {
    memory.copy(ptr, changetype<usize>(pattern), pattern.length << 1);
    for (let code: u32 = 0; code <= 0xffff; code++) {
      store<u16>(ptr + (lane << 1), <u16>code);
      if (JSON.stringify(probe) != scalar(probe)) mismatches++;
    }
  }
  expect(mismatches).toBe(0);
});

describe("Surrogate pairs crossing vector blocks preserve bounds and escapes", () => {
  const tails = [
    "😀",
    "\ud800",
    "\udc00",
    '😀"',
    "\ud800x",
    "😀\udfff",
    "\ud800\ud800",
    "é\u00ff\u4eff",
  ];
  for (let prefix = 0; prefix < 24; prefix++) {
    for (let i = 0; i < tails.length; i++) {
      const value = "a".repeat(prefix) + tails[i];
      expect(JSON.stringify(value)).toBe(scalar(value));
    }
  }
});
