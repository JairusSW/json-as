import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile } from "../lib/bench";
function makeUtf16String(targetBytes: i32): string {
  const BASE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890`~!@#$%^&*()-_=+[{]}\\|;:'\",<.>/?";
  const BYTES_PER_REPEAT = BASE.length << 1;

  const repeats = i32(Math.ceil(targetBytes / BYTES_PER_REPEAT));
  const str = BASE.repeat(repeats);
  return str.slice(0, targetBytes >> 1);
}

const strSmall = makeUtf16String(1 * 1024); // 1 KB
const strMedium = makeUtf16String(500 * 1024); // 500 KB
const strLarge = makeUtf16String(1000 * 1024); // 1000 KB

const strSmallStr = JSON.stringify(strSmall);
const strMediumStr = JSON.stringify(strMedium);
const strLargeStr = JSON.stringify(strLarge);

expect(JSON.stringify(strSmall)).toBe(strSmallStr);
expect(JSON.stringify(strMedium)).toBe(strMediumStr);
expect(JSON.stringify(strLarge)).toBe(strLargeStr);

// expect(JSON.stringify(JSON.parse<string>(strSmallStr))).toBe(strSmallStr);
// expect(JSON.stringify(JSON.parse<string>(strMediumStr))).toBe(strMediumStr);
// expect(JSON.stringify(JSON.parse<string>(strMediumStr))).toBe(strMediumStr);

bench("Deserialize Small String (1kb)", () => blackbox(JSON.parse<string>(strSmallStr)), 3_000_000, strSmallStr.length << 1);
dumpToFile("small-str", "deserialize");

bench("Deserialize Medium String (500kb)", () => blackbox(JSON.parse<string>(strMediumStr)), 8_500, strMediumStr.length << 1);
dumpToFile("medium-str", "deserialize");

bench("Deserialize Large String (1000kb)", () => blackbox(JSON.parse<string>(strLargeStr)), 3_000, strLargeStr.length << 1);
dumpToFile("large-str", "deserialize");
