import { bench, blackbox, dumpToFile } from "../lib/bench";
function makeUtf16String(targetBytes: number): string {
  const BASE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890`~!@#$%^&*()-_=+[{]}\\|;:'\",<.>/?";
  const BYTES_PER_REPEAT = BASE.length << 1;

  const repeats = Math.ceil(targetBytes / BYTES_PER_REPEAT);
  const str = BASE.repeat(repeats);
  return str.slice(0, targetBytes >> 1);
}

const strSmall = makeUtf16String(1 * 1024); // 1 KB
const strMedium = makeUtf16String(500 * 1024); // 500 KB
const strLarge = makeUtf16String(1000 * 1024); // 1000 KB

const strSmallStr = JSON.stringify(strSmall);
const strMediumStr = JSON.stringify(strMedium);
const strLargeStr = JSON.stringify(strLarge);

bench("Serialize Small String (1kb)", () => blackbox(JSON.stringify(strSmall)), 3_000_000, strSmallStr.length << 1);
dumpToFile("small-str", "serialize");

bench("Serialize Medium String (500kb)", () => blackbox(JSON.stringify(strMedium)), 8_500, strMediumStr.length << 1);
dumpToFile("medium-str", "serialize");

bench("Serialize Large String (1000kb)", () => blackbox(JSON.stringify(strLarge)), 3_000, strLargeStr.length << 1);
dumpToFile("large-str", "serialize");
