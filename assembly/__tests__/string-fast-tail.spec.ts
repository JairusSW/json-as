import { JSON } from "..";
import { describe, expect } from "as-test";

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
