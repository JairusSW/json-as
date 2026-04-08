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
const strSmall = makeUtf8String(1 * 1024); // 1 KB
const strMedium = makeUtf8String(500 * 1024); // 500 KB
const strLarge = makeUtf8String(1000 * 1024); // 1000 KB
const strXLarge = makeUtf8String(2 * 1024 * 1024); // 2 MB
const strXXLarge = makeUtf8String(5 * 1024 * 1024); // 5 MB
const strHuge = makeUtf8String(10 * 1024 * 1024); // 10 MB
const strSmallStr = JSON.stringify(strSmall);
const strMediumStr = JSON.stringify(strMedium);
const strLargeStr = JSON.stringify(strLarge);
const strXLargeStr = JSON.stringify(strXLarge);
const strXXLargeStr = JSON.stringify(strXXLarge);
const strHugeStr = JSON.stringify(strHuge);
const strSmallBytes = String.UTF8.byteLength(strSmallStr);
const strMediumBytes = String.UTF8.byteLength(strMediumStr);
const strLargeBytes = String.UTF8.byteLength(strLargeStr);
const strXLargeBytes = String.UTF8.byteLength(strXLargeStr);
const strXXLargeBytes = String.UTF8.byteLength(strXXLargeStr);
const strHugeBytes = String.UTF8.byteLength(strHugeStr);
expect(JSON.stringify(strSmall)).toBe(strSmallStr);
expect(JSON.stringify(strMedium)).toBe(strMediumStr);
expect(JSON.stringify(strLarge)).toBe(strLargeStr);
expect(JSON.stringify(strXLarge)).toBe(strXLargeStr);
expect(JSON.stringify(strXXLarge)).toBe(strXXLargeStr);
expect(JSON.stringify(strHuge)).toBe(strHugeStr);
expect(JSON.stringify(JSON.parse<string>(strSmallStr))).toBe(strSmallStr);
expect(JSON.stringify(JSON.parse<string>(strMediumStr))).toBe(strMediumStr);
expect(JSON.stringify(JSON.parse<string>(strLargeStr))).toBe(strLargeStr);
expect(JSON.stringify(JSON.parse<string>(strXLargeStr))).toBe(strXLargeStr);
expect(JSON.stringify(JSON.parse<string>(strXXLargeStr))).toBe(strXXLargeStr);
expect(JSON.stringify(JSON.parse<string>(strHugeStr))).toBe(strHugeStr);
bench(
  "Deserialize Small String (1kb)",
  () => {
    blackbox(JSON.parse<string>(strSmallStr));
  },
  3_000_000,
  strSmallBytes,
);
dumpToFile("small-str", "deserialize");
bench(
  "Deserialize Medium String (500kb)",
  () => {
    blackbox(JSON.parse<string>(strMediumStr));
  },
  8_500,
  strMediumBytes,
);
dumpToFile("medium-str", "deserialize");
bench(
  "Deserialize Large String (1000kb)",
  () => {
    blackbox(JSON.parse<string>(strLargeStr));
  },
  3_000,
  strLargeBytes,
);
dumpToFile("large-str", "deserialize");
bench(
  "Deserialize XLarge String (2mb)",
  () => {
    blackbox(JSON.parse<string>(strXLargeStr));
  },
  1_500,
  strXLargeBytes,
);
dumpToFile("xlarge-str", "deserialize");
bench(
  "Deserialize XXLarge String (5mb)",
  () => {
    blackbox(JSON.parse<string>(strXXLargeStr));
  },
  600,
  strXXLargeBytes,
);
dumpToFile("xxlarge-str", "deserialize");
bench(
  "Deserialize Huge String (10mb)",
  () => {
    blackbox(JSON.parse<string>(strHugeStr));
  },
  300,
  strHugeBytes,
);
dumpToFile("huge-str", "deserialize");
