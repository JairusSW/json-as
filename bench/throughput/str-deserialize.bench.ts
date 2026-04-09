import { bench, blackbox, dumpToFile } from "../lib/bench";

function makeUtf8String(targetBytes: number): string {
  const BASE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890`~!@#$%^&*()-_=+[{]}\\|;:'\",<.>/?";
  const BYTES_PER_REPEAT = BASE.length;
  const repeats = Math.ceil(targetBytes / BYTES_PER_REPEAT);
  const str = BASE.repeat(repeats);
  return str.slice(0, targetBytes);
}

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

const smallSizes = [1 * 1024, 50 * 1024, 100 * 1024, 150 * 1024, 200 * 1024, 250 * 1024, 300 * 1024, 350 * 1024, 400 * 1024, 450 * 1024, 500 * 1024, 550 * 1024, 600 * 1024, 650 * 1024, 700 * 1024, 750 * 1024, 800 * 1024, 850 * 1024, 900 * 1024, 950 * 1024];
const smallLabels = ["1kb", "50kb", "100kb", "150kb", "200kb", "250kb", "300kb", "350kb", "400kb", "450kb", "500kb", "550kb", "600kb", "650kb", "700kb", "750kb", "800kb", "850kb", "900kb", "950kb"];
const smallBaseOps = 3000;

for (let i = 0; i < smallSizes.length; i++) {
  const sizeBytes = smallSizes[i];
  const label = smallLabels[i];
  const value = makeUtf8String(sizeBytes);
  const json = JSON.stringify(value);
  const bytes = utf8ByteLength(json);
  const ops = Math.min(500_000, Math.floor((smallBaseOps * 1024 * 1024) / sizeBytes));
  bench(`Deserialize String (${label})`, () => blackbox(JSON.parse(json)), ops, bytes);
  dumpToFile(`str-${label}`, "deserialize");
}

const sizesMB = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const jsonStrings: string[] = [];
const bytes: number[] = [];

for (const sizeMB of sizesMB) {
  const value = makeUtf8String(sizeMB * 1024 * 1024);
  const json = JSON.stringify(value);
  jsonStrings.push(json);
  bytes.push(utf8ByteLength(json));
}

const baseOps = 3000;

for (let i = 0; i < sizesMB.length; i++) {
  const sizeMB = sizesMB[i];
  const label = `${sizeMB}mb`;
  const ops = Math.floor(baseOps / sizeMB);
  bench(`Deserialize String (${label})`, () => blackbox(JSON.parse(jsonStrings[i])), ops, bytes[i]);
  dumpToFile(`str-${label}`, "deserialize");
}
