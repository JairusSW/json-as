import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { deserializeIntegerArray, deserializeIntegerArray_SWAR } from "../../deserialize/swar/array/integer";
import { bench, blackbox, dumpToFile } from "../lib/bench";

class ArrayHolder {
  data: Array<i32> = [];
}

function makeIntArrayJSON(targetBytes: i32): string {
  const values = new Array<i32>();
  let next = 1;
  let bytes = 2;

  while (bytes < targetBytes) {
    values.push(next);
    bytes += next.toString().length << 1;
    next++;
    if (bytes < targetBytes) bytes += 2;
  }

  return "[" + values.join(",") + "]";
}


@inline
function parseIntArray(src: string, holder: ArrayHolder): Array<i32> {
  const srcStart = changetype<usize>(src);
  const srcEnd = srcStart + (src.length << 1);
  holder.data = deserializeIntegerArray<Array<i32>>(srcStart, srcEnd, changetype<usize>(holder.data));
  return blackbox(holder.data);
}


@inline
function parseIntArraySWAR(src: string, holder: ArrayHolder): Array<i32> {
  const srcStart = changetype<usize>(src);
  const srcEnd = srcStart + (src.length << 1);
  holder.data = deserializeIntegerArray_SWAR<Array<i32>>(srcStart, srcEnd, changetype<usize>(holder.data));
  return blackbox(holder.data);
}

const holder = new ArrayHolder();
const holderSWAR = new ArrayHolder();

const arrSmallStr = makeIntArrayJSON(1 * 1024);
const arrMediumStr = makeIntArrayJSON(500 * 1024);
const arrLargeStr = makeIntArrayJSON(1000 * 1024);

expect(JSON.stringify(JSON.parse<Array<i32>>(arrSmallStr))).toBe(arrSmallStr);
expect(JSON.stringify(JSON.parse<Array<i32>>(arrMediumStr))).toBe(arrMediumStr);
expect(JSON.stringify(JSON.parse<Array<i32>>(arrLargeStr))).toBe(arrLargeStr);

bench("Deserialize Small Array (1kb)", () => blackbox(parseIntArray(arrSmallStr, holder)), 2_500_000, arrSmallStr.length << 1);
bench("Deserialize Small Array SWAR (1kb)", () => blackbox(parseIntArraySWAR(arrSmallStr, holderSWAR)), 2_500_000, arrSmallStr.length << 1);
dumpToFile("small-arr", "deserialize");

bench("Deserialize Medium Array (500kb)", () => blackbox(parseIntArray(arrMediumStr, holder)), 5_000, arrMediumStr.length << 1);
bench("Deserialize Medium Array SWAR (500kb)", () => blackbox(parseIntArraySWAR(arrMediumStr, holderSWAR)), 5_000, arrMediumStr.length << 1);
dumpToFile("medium-arr", "deserialize");

bench("Deserialize Large Array (1000kb)", () => blackbox(parseIntArray(arrLargeStr, holder)), 2_500, arrLargeStr.length << 1);
bench("Deserialize Large Array SWAR (1000kb)", () => blackbox(parseIntArraySWAR(arrLargeStr, holderSWAR)), 2_500, arrLargeStr.length << 1);
dumpToFile("large-arr", "deserialize");
