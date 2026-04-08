import { bench, blackbox, dumpToFile } from "../lib/bench";
function makeUtf8String(targetBytes: number): string {
  const BASE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890`~!@#$%^&*()-_=+[{]}\\|;:'\",<.>/?";
  const BYTES_PER_REPEAT = BASE.length;
  const repeats = Math.ceil(targetBytes / BYTES_PER_REPEAT);
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
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
      continue;
    }
    if (code < 0x800) {
      bytes += 2;
      continue;
    }
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
        continue;
      }
    }
    bytes += 3;
  }
  return bytes;
}
const strSmallBytes = utf8ByteLength(strSmallStr);
const strMediumBytes = utf8ByteLength(strMediumStr);
const strLargeBytes = utf8ByteLength(strLargeStr);
const strXLargeBytes = utf8ByteLength(strXLargeStr);
const strXXLargeBytes = utf8ByteLength(strXXLargeStr);
const strHugeBytes = utf8ByteLength(strHugeStr);

bench("Deserialize Small String (1kb)", () => blackbox(JSON.parse(strSmallStr)), 3_000_000, strSmallBytes);
dumpToFile("small-str", "deserialize");

bench("Deserialize Medium String (500kb)", () => blackbox(JSON.parse(strMediumStr)), 8_500, strMediumBytes);
dumpToFile("medium-str", "deserialize");

bench("Deserialize Large String (1000kb)", () => blackbox(JSON.parse(strLargeStr)), 3_000, strLargeBytes);
dumpToFile("large-str", "deserialize");

bench("Deserialize XLarge String (2mb)", () => blackbox(JSON.parse(strXLargeStr)), 1_500, strXLargeBytes);
dumpToFile("xlarge-str", "deserialize");

bench("Deserialize XXLarge String (5mb)", () => blackbox(JSON.parse(strXXLargeStr)), 600, strXXLargeBytes);
dumpToFile("xxlarge-str", "deserialize");

bench("Deserialize Huge String (10mb)", () => blackbox(JSON.parse(strHugeStr)), 300, strHugeBytes);
dumpToFile("huge-str", "deserialize");
