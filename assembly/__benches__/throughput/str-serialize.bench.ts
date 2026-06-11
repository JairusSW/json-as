import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile } from "../lib/bench";

function makeUtf8String(targetBytes: i32): string {
  const BASE =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890`~!@#$%^&*()-_=+[{]}\\|;:'\",<.>/?";
  const BYTES_PER_REPEAT = BASE.length;
  const repeats = i32(Math.ceil(targetBytes / BYTES_PER_REPEAT));
  const str = BASE.repeat(repeats);
  return str.slice(0, targetBytes);
}

const str1kb = makeUtf8String(1 * 1024);
const str100kb = makeUtf8String(100 * 1024);
const str200kb = makeUtf8String(200 * 1024);
const str300kb = makeUtf8String(300 * 1024);
const str400kb = makeUtf8String(400 * 1024);
const str500kb = makeUtf8String(500 * 1024);
const str600kb = makeUtf8String(600 * 1024);
const str700kb = makeUtf8String(700 * 1024);
const str800kb = makeUtf8String(800 * 1024);
const str900kb = makeUtf8String(900 * 1024);

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
const json100kb = JSON.stringify(str100kb);
const json200kb = JSON.stringify(str200kb);
const json300kb = JSON.stringify(str300kb);
const json400kb = JSON.stringify(str400kb);
const json500kb = JSON.stringify(str500kb);
const json600kb = JSON.stringify(str600kb);
const json700kb = JSON.stringify(str700kb);
const json800kb = JSON.stringify(str800kb);
const json900kb = JSON.stringify(str900kb);

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
const bytes100kb = String.UTF8.byteLength(json100kb);
const bytes200kb = String.UTF8.byteLength(json200kb);
const bytes300kb = String.UTF8.byteLength(json300kb);
const bytes400kb = String.UTF8.byteLength(json400kb);
const bytes500kb = String.UTF8.byteLength(json500kb);
const bytes600kb = String.UTF8.byteLength(json600kb);
const bytes700kb = String.UTF8.byteLength(json700kb);
const bytes800kb = String.UTF8.byteLength(json800kb);
const bytes900kb = String.UTF8.byteLength(json900kb);

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
  "Serialize String (100kb)",
  () => {
    blackbox(JSON.stringify(str100kb));
  },
  30000,
  bytes100kb,
);
dumpToFile("str-100kb", "serialize");

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
  "Serialize String (300kb)",
  () => {
    blackbox(JSON.stringify(str300kb));
  },
  10000,
  bytes300kb,
);
dumpToFile("str-300kb", "serialize");

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
  "Serialize String (500kb)",
  () => {
    blackbox(JSON.stringify(str500kb));
  },
  6000,
  bytes500kb,
);
dumpToFile("str-500kb", "serialize");

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
  "Serialize String (700kb)",
  () => {
    blackbox(JSON.stringify(str700kb));
  },
  4286,
  bytes700kb,
);
dumpToFile("str-700kb", "serialize");

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
  "Serialize String (900kb)",
  () => {
    blackbox(JSON.stringify(str900kb));
  },
  3334,
  bytes900kb,
);
dumpToFile("str-900kb", "serialize");

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

// --- JSON.Value (dynamic) variant: re-serialize each string through the
// schema-less JSON.Value path (parsed AND materialized once up front via
// .get<string>(), then stringified - so serialize re-emits the decoded value
// rather than passing through the untouched source bytes) ---
const val_str1kb = JSON.parse<JSON.Value>(json1kb);
blackbox(val_str1kb.get<string>());
const val_str100kb = JSON.parse<JSON.Value>(json100kb);
blackbox(val_str100kb.get<string>());
const val_str200kb = JSON.parse<JSON.Value>(json200kb);
blackbox(val_str200kb.get<string>());
const val_str300kb = JSON.parse<JSON.Value>(json300kb);
blackbox(val_str300kb.get<string>());
const val_str400kb = JSON.parse<JSON.Value>(json400kb);
blackbox(val_str400kb.get<string>());
const val_str500kb = JSON.parse<JSON.Value>(json500kb);
blackbox(val_str500kb.get<string>());
const val_str600kb = JSON.parse<JSON.Value>(json600kb);
blackbox(val_str600kb.get<string>());
const val_str700kb = JSON.parse<JSON.Value>(json700kb);
blackbox(val_str700kb.get<string>());
const val_str800kb = JSON.parse<JSON.Value>(json800kb);
blackbox(val_str800kb.get<string>());
const val_str900kb = JSON.parse<JSON.Value>(json900kb);
blackbox(val_str900kb.get<string>());
const val_str1 = JSON.parse<JSON.Value>(json1);
blackbox(val_str1.get<string>());
const val_str2 = JSON.parse<JSON.Value>(json2);
blackbox(val_str2.get<string>());
const val_str3 = JSON.parse<JSON.Value>(json3);
blackbox(val_str3.get<string>());
const val_str4 = JSON.parse<JSON.Value>(json4);
blackbox(val_str4.get<string>());
const val_str5 = JSON.parse<JSON.Value>(json5);
blackbox(val_str5.get<string>());
const val_str6 = JSON.parse<JSON.Value>(json6);
blackbox(val_str6.get<string>());
const val_str7 = JSON.parse<JSON.Value>(json7);
blackbox(val_str7.get<string>());
const val_str8 = JSON.parse<JSON.Value>(json8);
blackbox(val_str8.get<string>());
const val_str9 = JSON.parse<JSON.Value>(json9);
blackbox(val_str9.get<string>());
const val_str10 = JSON.parse<JSON.Value>(json10);
blackbox(val_str10.get<string>());

bench(
  "Serialize String JSON.Value (1kb)",
  () => {
    blackbox(JSON.stringify(val_str1kb));
  },
  500000,
  bytes1kb,
);
dumpToFile("str-1kb-value", "serialize");

bench(
  "Serialize String JSON.Value (100kb)",
  () => {
    blackbox(JSON.stringify(val_str100kb));
  },
  30000,
  bytes100kb,
);
dumpToFile("str-100kb-value", "serialize");

bench(
  "Serialize String JSON.Value (200kb)",
  () => {
    blackbox(JSON.stringify(val_str200kb));
  },
  15000,
  bytes200kb,
);
dumpToFile("str-200kb-value", "serialize");

bench(
  "Serialize String JSON.Value (300kb)",
  () => {
    blackbox(JSON.stringify(val_str300kb));
  },
  10000,
  bytes300kb,
);
dumpToFile("str-300kb-value", "serialize");

bench(
  "Serialize String JSON.Value (400kb)",
  () => {
    blackbox(JSON.stringify(val_str400kb));
  },
  7500,
  bytes400kb,
);
dumpToFile("str-400kb-value", "serialize");

bench(
  "Serialize String JSON.Value (500kb)",
  () => {
    blackbox(JSON.stringify(val_str500kb));
  },
  6000,
  bytes500kb,
);
dumpToFile("str-500kb-value", "serialize");

bench(
  "Serialize String JSON.Value (600kb)",
  () => {
    blackbox(JSON.stringify(val_str600kb));
  },
  5000,
  bytes600kb,
);
dumpToFile("str-600kb-value", "serialize");

bench(
  "Serialize String JSON.Value (700kb)",
  () => {
    blackbox(JSON.stringify(val_str700kb));
  },
  4286,
  bytes700kb,
);
dumpToFile("str-700kb-value", "serialize");

bench(
  "Serialize String JSON.Value (800kb)",
  () => {
    blackbox(JSON.stringify(val_str800kb));
  },
  3750,
  bytes800kb,
);
dumpToFile("str-800kb-value", "serialize");

bench(
  "Serialize String JSON.Value (900kb)",
  () => {
    blackbox(JSON.stringify(val_str900kb));
  },
  3334,
  bytes900kb,
);
dumpToFile("str-900kb-value", "serialize");

bench(
  "Serialize String JSON.Value (1mb)",
  () => {
    blackbox(JSON.stringify(val_str1));
  },
  3000,
  bytes1,
);
dumpToFile("str-1mb-value", "serialize");

bench(
  "Serialize String JSON.Value (2mb)",
  () => {
    blackbox(JSON.stringify(val_str2));
  },
  1500,
  bytes2,
);
dumpToFile("str-2mb-value", "serialize");

bench(
  "Serialize String JSON.Value (3mb)",
  () => {
    blackbox(JSON.stringify(val_str3));
  },
  1000,
  bytes3,
);
dumpToFile("str-3mb-value", "serialize");

bench(
  "Serialize String JSON.Value (4mb)",
  () => {
    blackbox(JSON.stringify(val_str4));
  },
  750,
  bytes4,
);
dumpToFile("str-4mb-value", "serialize");

bench(
  "Serialize String JSON.Value (5mb)",
  () => {
    blackbox(JSON.stringify(val_str5));
  },
  600,
  bytes5,
);
dumpToFile("str-5mb-value", "serialize");

bench(
  "Serialize String JSON.Value (6mb)",
  () => {
    blackbox(JSON.stringify(val_str6));
  },
  500,
  bytes6,
);
dumpToFile("str-6mb-value", "serialize");

bench(
  "Serialize String JSON.Value (7mb)",
  () => {
    blackbox(JSON.stringify(val_str7));
  },
  428,
  bytes7,
);
dumpToFile("str-7mb-value", "serialize");

bench(
  "Serialize String JSON.Value (8mb)",
  () => {
    blackbox(JSON.stringify(val_str8));
  },
  375,
  bytes8,
);
dumpToFile("str-8mb-value", "serialize");

bench(
  "Serialize String JSON.Value (9mb)",
  () => {
    blackbox(JSON.stringify(val_str9));
  },
  333,
  bytes9,
);
dumpToFile("str-9mb-value", "serialize");

bench(
  "Serialize String JSON.Value (10mb)",
  () => {
    blackbox(JSON.stringify(val_str10));
  },
  300,
  bytes10,
);
dumpToFile("str-10mb-value", "serialize");
