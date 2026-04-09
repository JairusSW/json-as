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

const str1kb = makeUtf8String(1 * 1024);
const str50kb = makeUtf8String(50 * 1024);
const str100kb = makeUtf8String(100 * 1024);
const str150kb = makeUtf8String(150 * 1024);
const str200kb = makeUtf8String(200 * 1024);
const str250kb = makeUtf8String(250 * 1024);
const str300kb = makeUtf8String(300 * 1024);
const str350kb = makeUtf8String(350 * 1024);
const str400kb = makeUtf8String(400 * 1024);
const str450kb = makeUtf8String(450 * 1024);
const str500kb = makeUtf8String(500 * 1024);
const str550kb = makeUtf8String(550 * 1024);
const str600kb = makeUtf8String(600 * 1024);
const str650kb = makeUtf8String(650 * 1024);
const str700kb = makeUtf8String(700 * 1024);
const str750kb = makeUtf8String(750 * 1024);
const str800kb = makeUtf8String(800 * 1024);
const str850kb = makeUtf8String(850 * 1024);
const str900kb = makeUtf8String(900 * 1024);
const str950kb = makeUtf8String(950 * 1024);

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

const json1kb = JSON.stringify(str1kb);
const json50kb = JSON.stringify(str50kb);
const json100kb = JSON.stringify(str100kb);
const json150kb = JSON.stringify(str150kb);
const json200kb = JSON.stringify(str200kb);
const json250kb = JSON.stringify(str250kb);
const json300kb = JSON.stringify(str300kb);
const json350kb = JSON.stringify(str350kb);
const json400kb = JSON.stringify(str400kb);
const json450kb = JSON.stringify(str450kb);
const json500kb = JSON.stringify(str500kb);
const json550kb = JSON.stringify(str550kb);
const json600kb = JSON.stringify(str600kb);
const json650kb = JSON.stringify(str650kb);
const json700kb = JSON.stringify(str700kb);
const json750kb = JSON.stringify(str750kb);
const json800kb = JSON.stringify(str800kb);
const json850kb = JSON.stringify(str850kb);
const json900kb = JSON.stringify(str900kb);
const json950kb = JSON.stringify(str950kb);

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

const bytes1kb = String.UTF8.byteLength(json1kb);
const bytes50kb = String.UTF8.byteLength(json50kb);
const bytes100kb = String.UTF8.byteLength(json100kb);
const bytes150kb = String.UTF8.byteLength(json150kb);
const bytes200kb = String.UTF8.byteLength(json200kb);
const bytes250kb = String.UTF8.byteLength(json250kb);
const bytes300kb = String.UTF8.byteLength(json300kb);
const bytes350kb = String.UTF8.byteLength(json350kb);
const bytes400kb = String.UTF8.byteLength(json400kb);
const bytes450kb = String.UTF8.byteLength(json450kb);
const bytes500kb = String.UTF8.byteLength(json500kb);
const bytes550kb = String.UTF8.byteLength(json550kb);
const bytes600kb = String.UTF8.byteLength(json600kb);
const bytes650kb = String.UTF8.byteLength(json650kb);
const bytes700kb = String.UTF8.byteLength(json700kb);
const bytes750kb = String.UTF8.byteLength(json750kb);
const bytes800kb = String.UTF8.byteLength(json800kb);
const bytes850kb = String.UTF8.byteLength(json850kb);
const bytes900kb = String.UTF8.byteLength(json900kb);
const bytes950kb = String.UTF8.byteLength(json950kb);

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
  "Serialize String (1kb)",
  () => {
    blackbox(JSON.stringify(str1kb));
  },
  500000,
  bytes1kb,
);
dumpToFile("str-1kb", "serialize");

bench(
  "Serialize String (50kb)",
  () => {
    blackbox(JSON.stringify(str50kb));
  },
  60000,
  bytes50kb,
);
dumpToFile("str-50kb", "serialize");

bench(
  "Serialize String (100kb)",
  () => {
    blackbox(JSON.stringify(str100kb));
  },
  30000,
  bytes100kb,
);
dumpToFile("str-100kb", "serialize");

bench(
  "Serialize String (150kb)",
  () => {
    blackbox(JSON.stringify(str150kb));
  },
  20000,
  bytes150kb,
);
dumpToFile("str-150kb", "serialize");

bench(
  "Serialize String (200kb)",
  () => {
    blackbox(JSON.stringify(str200kb));
  },
  15000,
  bytes200kb,
);
dumpToFile("str-200kb", "serialize");

bench(
  "Serialize String (250kb)",
  () => {
    blackbox(JSON.stringify(str250kb));
  },
  12000,
  bytes250kb,
);
dumpToFile("str-250kb", "serialize");

bench(
  "Serialize String (300kb)",
  () => {
    blackbox(JSON.stringify(str300kb));
  },
  10000,
  bytes300kb,
);
dumpToFile("str-300kb", "serialize");

bench(
  "Serialize String (350kb)",
  () => {
    blackbox(JSON.stringify(str350kb));
  },
  8571,
  bytes350kb,
);
dumpToFile("str-350kb", "serialize");

bench(
  "Serialize String (400kb)",
  () => {
    blackbox(JSON.stringify(str400kb));
  },
  7500,
  bytes400kb,
);
dumpToFile("str-400kb", "serialize");

bench(
  "Serialize String (450kb)",
  () => {
    blackbox(JSON.stringify(str450kb));
  },
  6667,
  bytes450kb,
);
dumpToFile("str-450kb", "serialize");

bench(
  "Serialize String (500kb)",
  () => {
    blackbox(JSON.stringify(str500kb));
  },
  6000,
  bytes500kb,
);
dumpToFile("str-500kb", "serialize");

bench(
  "Serialize String (550kb)",
  () => {
    blackbox(JSON.stringify(str550kb));
  },
  5454,
  bytes550kb,
);
dumpToFile("str-550kb", "serialize");

bench(
  "Serialize String (600kb)",
  () => {
    blackbox(JSON.stringify(str600kb));
  },
  5000,
  bytes600kb,
);
dumpToFile("str-600kb", "serialize");

bench(
  "Serialize String (650kb)",
  () => {
    blackbox(JSON.stringify(str650kb));
  },
  4615,
  bytes650kb,
);
dumpToFile("str-650kb", "serialize");

bench(
  "Serialize String (700kb)",
  () => {
    blackbox(JSON.stringify(str700kb));
  },
  4286,
  bytes700kb,
);
dumpToFile("str-700kb", "serialize");

bench(
  "Serialize String (750kb)",
  () => {
    blackbox(JSON.stringify(str750kb));
  },
  4000,
  bytes750kb,
);
dumpToFile("str-750kb", "serialize");

bench(
  "Serialize String (800kb)",
  () => {
    blackbox(JSON.stringify(str800kb));
  },
  3750,
  bytes800kb,
);
dumpToFile("str-800kb", "serialize");

bench(
  "Serialize String (850kb)",
  () => {
    blackbox(JSON.stringify(str850kb));
  },
  3529,
  bytes850kb,
);
dumpToFile("str-850kb", "serialize");

bench(
  "Serialize String (900kb)",
  () => {
    blackbox(JSON.stringify(str900kb));
  },
  3334,
  bytes900kb,
);
dumpToFile("str-900kb", "serialize");

bench(
  "Serialize String (950kb)",
  () => {
    blackbox(JSON.stringify(str950kb));
  },
  3158,
  bytes950kb,
);
dumpToFile("str-950kb", "serialize");

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
