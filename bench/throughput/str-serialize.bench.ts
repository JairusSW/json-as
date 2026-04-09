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

const sizesMB = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const strings: string[] = [];
const jsonStrings: string[] = [];
const bytes: number[] = [];

for (const sizeMB of sizesMB) {
  const value = makeUtf8String(sizeMB * 1024 * 1024);
  const json = JSON.stringify(value);
  strings.push(value);
  jsonStrings.push(json);
  bytes.push(utf8ByteLength(json));
}

const baseOps = 3000;

for (let i = 0; i < sizesMB.length; i++) {
  const sizeMB = sizesMB[i];
  const label = `${sizeMB}mb`;
  const ops = Math.floor(baseOps / sizeMB);
  bench(`Serialize String (${label})`, () => blackbox(JSON.stringify(strings[i])), ops, bytes[i]);
  dumpToFile(`str-${label}`, "serialize");
}
