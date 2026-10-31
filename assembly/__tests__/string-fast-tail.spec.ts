import { JSON, JSONMode } from "..";
import { describe, expect } from "as-test";
import { bs } from "../../lib/as-bs";
import { serializeString } from "../serialize/index/string";

function checkString(src: string, expected: string): void {
  expect(JSON.stringify<string>(src)).toBe(expected);
  expect(JSON.stringify(JSON.Value.from(src))).toBe(expected);
  const obj = new JSON.Obj();
  obj.set<string>("value", src);
  expect(JSON.stringify(obj)).toBe('{"value":' + expected + "}");
  const arr = new JSON.Arr();
  arr.push<string>(src);
  expect(JSON.stringify(arr)).toBe("[" + expected + "]");
}

describe("String fast paths: BMP and escape units at every short-string position", () => {
  const units: i32[] = [
    0x00, 0x1f, 0x22, 0x5c, 0x7f, 0x80, 0xff, 0x100, 0x1ff, 0x4e2d, 0xd7ff,
    0xd800, 0xdbff, 0xdc00, 0xdfff, 0xe000, 0xfffe, 0xffff,
  ];
  const escaped: string[] = [
    "\\u0000",
    "\\u001f",
    '\\"',
    "\\\\",
    "\u007f",
    "\u0080",
    "\u00ff",
    "\u0100",
    "\u01ff",
    "中",
    "\ud7ff",
    "\\ud800",
    "\\udbff",
    "\\udc00",
    "\\udfff",
    "\ue000",
    "\ufffe",
    "\uffff",
  ];
  checkString("", '""');
  // Includes exact 4-/8-unit blocks and one unit on either side. Every position
  // is tested so a full final block and a scalar tail must both reject escapes.
  for (let length = 1; length <= 17; length++) {
    for (let position = 0; position < length; position++) {
      const prefix = "a".repeat(position);
      const suffix = "z".repeat(length - position - 1);
      for (let i = 0; i < units.length; i++) {
        checkString(
          prefix + String.fromCharCode(units[i]) + suffix,
          '"' + prefix + escaped[i] + suffix + '"',
        );
      }
    }
  }
});

describe("String fast paths: surrogate pairs across block and tail boundaries", () => {
  const pair = String.fromCharCode(0xd83d, 0xde00);
  for (let prefixLength = 0; prefixLength <= 17; prefixLength++) {
    for (let suffixLength = 0; suffixLength <= 2; suffixLength++) {
      const src = "a".repeat(prefixLength) + pair + "z".repeat(suffixLength);
      checkString(src, '"' + src + '"');
    }
  }
});

describe("String fast paths: BMP-leading blocks stop at escapes and surrogates", () => {
  const leaders: string[] = ["中", "Ā", "￿"];
  const units: string[] = ['"', "\\", "\n", "\ud800", "\udfff"];
  const escaped: string[] = ['\\"', "\\\\", "\\n", "\\ud800", "\\udfff"];
  for (let leader = 0; leader < leaders.length; leader++) {
    for (let position = 1; position <= 17; position++) {
      const prefix = leaders[leader] + "a".repeat(position - 1);
      const suffix = "z".repeat(17 - position);
      for (let unit = 0; unit < units.length; unit++) {
        checkString(
          prefix + units[unit] + suffix,
          '"' + prefix + escaped[unit] + suffix + '"',
        );
      }
    }
  }
});

describe("String slow paths: escaped prefixes and boundary surrogate pairs", () => {
  const units: string[] = ['"', "\\", "\n"];
  const escaped: string[] = ['\\"', "\\\\", "\\n"];
  const pairs: string[] = [
    String.fromCharCode(0xd800, 0xdc00),
    String.fromCharCode(0xd83d, 0xde00),
    String.fromCharCode(0xdbff, 0xdfff),
  ];
  for (let position = 0; position <= 17; position++) {
    for (let i = 0; i < units.length; i++) {
      for (let j = 0; j < pairs.length; j++) {
        const prefix = "a".repeat(position);
        const suffix = "z".repeat(17 - position);
        const src = prefix + units[i] + pairs[j] + units[i] + suffix;
        checkString(
          src,
          '"' + prefix + escaped[i] + pairs[j] + escaped[i] + suffix + '"',
        );
      }
    }
  }
});

function optimisticStorePreservesGuard(
  value: string,
  startOffset: usize,
): bool {
  // Keep a real 2 KiB allocation but present a 1 KiB logical capacity. This
  // makes any optimistic store beyond the reserved output visible without
  // writing outside the allocation owned by the test.
  bs.resize(2048);
  bs.bufferSize = 1024;
  memory.fill(bs.buffer + 1024, 0xa5, 64);
  const guardedBuffer = bs.buffer;

  bs.offset = bs.buffer + startOffset;
  bs.stackSize = startOffset;
  serializeString(value);

  const capacityGrew = bs.buffer != guardedBuffer || bs.bufferSize > 1024;
  let preserved = capacityGrew;
  if (!capacityGrew) {
    preserved = true;
    for (let i: usize = 0; i < 64; i++) {
      if (load<u8>(bs.buffer + 1024 + i) != 0xa5) preserved = false;
    }
  }
  if (!capacityGrew) bs.bufferSize = 2048;
  bs.reset();
  return preserved;
}

describe("String slow paths keep optimistic stores inside reserved capacity", () => {
  if (JSON_MODE == JSONMode.SIMD) {
    expect(optimisticStorePreservesGuard("aaaaaaa\u0001z", 992)).toBe(true);
    expect(optimisticStorePreservesGuard('aaaaaaa"z', 1000)).toBe(true);
    expect(optimisticStorePreservesGuard("aaaaaaa\ud800z", 992)).toBe(true);
  } else if (JSON_MODE == JSONMode.SWAR) {
    expect(optimisticStorePreservesGuard("aaa\u0001z", 1000)).toBe(true);
    expect(optimisticStorePreservesGuard('aaa"z', 1008)).toBe(true);
    expect(optimisticStorePreservesGuard("aaa\ud800z", 1000)).toBe(true);
  } else {
    expect(optimisticStorePreservesGuard("aaa\u0001z", 1000)).toBe(true);
  }
});

describe("String fallback keeps long copied prefixes when output grows", () => {
  const prefixes: string[] = [
    "a".repeat(2048),
    "中".repeat(2048),
    "a".repeat(2047),
  ];
  const units: string[] = ["\u0001", '"', "\ud800", "\ud83d\ude00"];
  const escaped: string[] = ["\\u0001", '\\"', "\\ud800", "\ud83d\ude00"];
  for (let i = 0; i < prefixes.length; i++) {
    for (let j = 0; j < units.length; j++) {
      const source = prefixes[i] + units[j] + "tail";
      const expected = '"' + prefixes[i] + escaped[j] + 'tail"';
      expect(JSON.stringify(source) == expected).toBe(true);
      const obj = new JSON.Obj();
      obj.set("prefix", "already written");
      obj.set("value", source);
      expect(
        JSON.stringify(obj) ==
          '{"prefix":"already written","value":' + expected + "}",
      ).toBe(true);
    }
  }
});
