import { JSON } from "../../index.ts";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile } from "../lib/bench";


function makeUint8Array(size: i32): Uint8Array {
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    out[i] = <u8>((i * 17 + 31) & 0xff);
  }
  return out;
}


function makeArrayBuffer(size: i32): ArrayBuffer {
  const out = new ArrayBuffer(size);
  const view = Uint8Array.wrap(out);
  for (let i = 0; i < size; i++) {
    view[i] = <u8>((i * 23 + 7) & 0xff);
  }
  return out;
}


const intArraySmall: Array<i32> = [1, 2, 3, 4, 5, 6, 7, 8];
const intArraySmallJson = "[1,2,3,4,5,6,7,8]";
const intArraySmallBytes = String.UTF8.byteLength(intArraySmallJson);

const intArrayMedium: Array<i32> = [
  11, 12, 13, 14, 15, 16, 17, 18,
  19, 20, 21, 22, 23, 24, 25, 26,
  27, 28, 29, 30, 31, 32, 33, 34,
];
const intArrayMediumJson = "[11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34]";
const intArrayMediumBytes = String.UTF8.byteLength(intArrayMediumJson);

const staticArraySmall: StaticArray<i32> = [1, 2, 3, 4, 5, 6, 7, 8];
const staticArraySmallJson = "[1,2,3,4,5,6,7,8]";
const staticArraySmallBytes = String.UTF8.byteLength(staticArraySmallJson);

const staticArrayMedium: StaticArray<i32> = [
  11, 12, 13, 14, 15, 16, 17, 18,
  19, 20, 21, 22, 23, 24, 25, 26,
  27, 28, 29, 30, 31, 32, 33, 34,
];
const staticArrayMediumJson = "[11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34]";
const staticArrayMediumBytes = String.UTF8.byteLength(staticArrayMediumJson);

const boolSet = new Set<bool>();
boolSet.add(true);
boolSet.add(false);
const boolSetJson = "[true,false]";
const boolSetBytes = String.UTF8.byteLength(boolSetJson);

const intSet = new Set<i32>();
for (let i = 0; i < 24; i++) intSet.add(i);
const intSetJson = "[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]";
const intSetBytes = String.UTF8.byteLength(intSetJson);

const bytes16 = makeUint8Array(16);
const bytes16Json = JSON.stringify(bytes16);
const bytes16Bytes = String.UTF8.byteLength(bytes16Json);

const bytes256 = makeUint8Array(256);
const bytes256Json = JSON.stringify(bytes256);
const bytes256Bytes = String.UTF8.byteLength(bytes256Json);

const buffer16 = makeArrayBuffer(16);
const buffer16Json = JSON.stringify(buffer16);
const buffer16Bytes = String.UTF8.byteLength(buffer16Json);

const buffer256 = makeArrayBuffer(256);
const buffer256Json = JSON.stringify(buffer256);
const buffer256Bytes = String.UTF8.byteLength(buffer256Json);

expect(JSON.stringify(intArraySmall)).toBe(intArraySmallJson);
expect(JSON.stringify(intArrayMedium)).toBe(intArrayMediumJson);
expect(JSON.stringify(staticArraySmall)).toBe(staticArraySmallJson);
expect(JSON.stringify(staticArrayMedium)).toBe(staticArrayMediumJson);
expect(JSON.stringify(boolSet)).toBe(boolSetJson);
expect(JSON.stringify(intSet)).toBe(intSetJson);
expect(JSON.stringify(bytes16)).toBe(bytes16Json);
expect(JSON.stringify(bytes256)).toBe(bytes256Json);
expect(JSON.stringify(buffer16)).toBe(buffer16Json);
expect(JSON.stringify(buffer256)).toBe(buffer256Json);

bench(
  "Serialize Int Array (8)",
  () => {
    blackbox(JSON.stringify(intArraySmall));
  },
  5_000_000,
  intArraySmallBytes,
);
dumpToFile("collections-int-arr-8", "serialize");

bench(
  "Serialize Int Array (24)",
  () => {
    blackbox(JSON.stringify(intArrayMedium));
  },
  2_500_000,
  intArrayMediumBytes,
);
dumpToFile("collections-int-arr-24", "serialize");

bench(
  "Serialize StaticArray (8)",
  () => {
    blackbox(JSON.stringify(staticArraySmall));
  },
  5_000_000,
  staticArraySmallBytes,
);
dumpToFile("collections-static-arr-8", "serialize");

bench(
  "Serialize StaticArray (24)",
  () => {
    blackbox(JSON.stringify(staticArrayMedium));
  },
  2_500_000,
  staticArrayMediumBytes,
);
dumpToFile("collections-static-arr-24", "serialize");

bench(
  "Serialize Bool Set (2)",
  () => {
    blackbox(JSON.stringify(boolSet));
  },
  10_000_000,
  boolSetBytes,
);
dumpToFile("collections-bool-set-2", "serialize");

bench(
  "Serialize Int Set (24)",
  () => {
    blackbox(JSON.stringify(intSet));
  },
  2_500_000,
  intSetBytes,
);
dumpToFile("collections-int-set-24", "serialize");

bench(
  "Serialize Uint8Array (16)",
  () => {
    blackbox(JSON.stringify(bytes16));
  },
  5_000_000,
  bytes16Bytes,
);
dumpToFile("collections-u8-16", "serialize");

bench(
  "Serialize Uint8Array (256)",
  () => {
    blackbox(JSON.stringify(bytes256));
  },
  500_000,
  bytes256Bytes,
);
dumpToFile("collections-u8-256", "serialize");

bench(
  "Serialize ArrayBuffer (16)",
  () => {
    blackbox(JSON.stringify(buffer16));
  },
  5_000_000,
  buffer16Bytes,
);
dumpToFile("collections-ab-16", "serialize");

bench(
  "Serialize ArrayBuffer (256)",
  () => {
    blackbox(JSON.stringify(buffer256));
  },
  500_000,
  buffer256Bytes,
);
dumpToFile("collections-ab-256", "serialize");
