import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile } from "../lib/bench";

function makeUtf8String(targetBytes: i32): string {
  const BASE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890`~!@#$%^&*()-_=+[{]}\\|;:'\",<.>/?";
  const BYTES_PER_REPEAT = BASE.length;
  const repeats = i32(Math.ceil(targetBytes / BYTES_PER_REPEAT));
  const str = BASE.repeat(repeats);
  return str.slice(0, targetBytes);
}

const str1 = makeUtf8String(1 * 1024 * 1024);
const str2 = makeUtf8String(2 * 1024 * 1024);
const str3 = makeUtf8String(3 * 1024 * 1024);
const str4 = makeUtf8String(4 * 1024 * 1024);
const str5 = makeUtf8String(5 * 1024 * 1024);
const str6 = makeUtf8String(6 * 1024 * 1024);
const str7 = makeUtf8String(7 * 1024 * 1024);
const str8 = makeUtf8String(8 * 1024 * 1024);
const str9 = makeUtf8String(9 * 1024 * 1024);
const str10 = makeUtf8String(10 * 1024 * 1024);

const json1 = JSON.stringify(str1);
const json2 = JSON.stringify(str2);
const json3 = JSON.stringify(str3);
const json4 = JSON.stringify(str4);
const json5 = JSON.stringify(str5);
const json6 = JSON.stringify(str6);
const json7 = JSON.stringify(str7);
const json8 = JSON.stringify(str8);
const json9 = JSON.stringify(str9);
const json10 = JSON.stringify(str10);

const bytes1 = String.UTF8.byteLength(json1);
const bytes2 = String.UTF8.byteLength(json2);
const bytes3 = String.UTF8.byteLength(json3);
const bytes4 = String.UTF8.byteLength(json4);
const bytes5 = String.UTF8.byteLength(json5);
const bytes6 = String.UTF8.byteLength(json6);
const bytes7 = String.UTF8.byteLength(json7);
const bytes8 = String.UTF8.byteLength(json8);
const bytes9 = String.UTF8.byteLength(json9);
const bytes10 = String.UTF8.byteLength(json10);

expect(JSON.stringify(str1)).toBe(json1);
expect(JSON.stringify(str2)).toBe(json2);
expect(JSON.stringify(str3)).toBe(json3);
expect(JSON.stringify(str4)).toBe(json4);
expect(JSON.stringify(str5)).toBe(json5);
expect(JSON.stringify(str6)).toBe(json6);
expect(JSON.stringify(str7)).toBe(json7);
expect(JSON.stringify(str8)).toBe(json8);
expect(JSON.stringify(str9)).toBe(json9);
expect(JSON.stringify(str10)).toBe(json10);
expect(JSON.stringify(JSON.parse<string>(json1))).toBe(json1);
expect(JSON.stringify(JSON.parse<string>(json2))).toBe(json2);
expect(JSON.stringify(JSON.parse<string>(json3))).toBe(json3);
expect(JSON.stringify(JSON.parse<string>(json4))).toBe(json4);
expect(JSON.stringify(JSON.parse<string>(json5))).toBe(json5);
expect(JSON.stringify(JSON.parse<string>(json6))).toBe(json6);
expect(JSON.stringify(JSON.parse<string>(json7))).toBe(json7);
expect(JSON.stringify(JSON.parse<string>(json8))).toBe(json8);
expect(JSON.stringify(JSON.parse<string>(json9))).toBe(json9);
expect(JSON.stringify(JSON.parse<string>(json10))).toBe(json10);

bench(
  "Serialize String (1mb)",
  () => {
    blackbox(JSON.stringify(str1));
  },
  3000,
  bytes1,
);
dumpToFile("str-1mb", "serialize");

bench(
  "Serialize String (2mb)",
  () => {
    blackbox(JSON.stringify(str2));
  },
  1500,
  bytes2,
);
dumpToFile("str-2mb", "serialize");

bench(
  "Serialize String (3mb)",
  () => {
    blackbox(JSON.stringify(str3));
  },
  1000,
  bytes3,
);
dumpToFile("str-3mb", "serialize");

bench(
  "Serialize String (4mb)",
  () => {
    blackbox(JSON.stringify(str4));
  },
  750,
  bytes4,
);
dumpToFile("str-4mb", "serialize");

bench(
  "Serialize String (5mb)",
  () => {
    blackbox(JSON.stringify(str5));
  },
  600,
  bytes5,
);
dumpToFile("str-5mb", "serialize");

bench(
  "Serialize String (6mb)",
  () => {
    blackbox(JSON.stringify(str6));
  },
  500,
  bytes6,
);
dumpToFile("str-6mb", "serialize");

bench(
  "Serialize String (7mb)",
  () => {
    blackbox(JSON.stringify(str7));
  },
  428,
  bytes7,
);
dumpToFile("str-7mb", "serialize");

bench(
  "Serialize String (8mb)",
  () => {
    blackbox(JSON.stringify(str8));
  },
  375,
  bytes8,
);
dumpToFile("str-8mb", "serialize");

bench(
  "Serialize String (9mb)",
  () => {
    blackbox(JSON.stringify(str9));
  },
  333,
  bytes9,
);
dumpToFile("str-9mb", "serialize");

bench(
  "Serialize String (10mb)",
  () => {
    blackbox(JSON.stringify(str10));
  },
  300,
  bytes10,
);
dumpToFile("str-10mb", "serialize");
