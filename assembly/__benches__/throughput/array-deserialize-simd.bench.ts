import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { deserializeIntegerArray } from "../../deserialize/swar/array/integer";
import { deserializeIntegerArray_SIMD } from "../../deserialize/simd/array/integer";
import { bench, blackbox } from "../lib/bench";

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
function parseIntArrayScalar(src: string, holder: ArrayHolder): Array<i32> {
  const srcStart = changetype<usize>(src);
  const srcEnd = srcStart + (src.length << 1);
  holder.data = deserializeIntegerArray<Array<i32>>(srcStart, srcEnd, changetype<usize>(holder.data));
  return blackbox(holder.data);
}

@inline
function parseIntArraySIMD(src: string, holder: ArrayHolder): Array<i32> {
  const srcStart = changetype<usize>(src);
  const srcEnd = srcStart + (src.length << 1);
  holder.data = deserializeIntegerArray_SIMD<Array<i32>>(srcStart, srcEnd, changetype<usize>(holder.data));
  return blackbox(holder.data);
}

const scalarHolder = new ArrayHolder();
const simdHolder = new ArrayHolder();

const arrSmallStr = makeIntArrayJSON(1 * 1024);
const arrMediumStr = makeIntArrayJSON(500 * 1024);
const arrLargeStr = makeIntArrayJSON(1000 * 1024);

expect(JSON.stringify(JSON.parse<Array<i32>>(arrSmallStr))).toBe(arrSmallStr);
expect(JSON.stringify(JSON.parse<Array<i32>>(arrMediumStr))).toBe(arrMediumStr);
expect(JSON.stringify(JSON.parse<Array<i32>>(arrLargeStr))).toBe(arrLargeStr);

bench("Deserialize Small Array Scalar (1kb)", () => blackbox(parseIntArrayScalar(arrSmallStr, scalarHolder)), 2_500_000, arrSmallStr.length << 1);
bench("Deserialize Small Array SIMD (1kb)", () => blackbox(parseIntArraySIMD(arrSmallStr, simdHolder)), 2_500_000, arrSmallStr.length << 1);

bench("Deserialize Medium Array Scalar (500kb)", () => blackbox(parseIntArrayScalar(arrMediumStr, scalarHolder)), 5_000, arrMediumStr.length << 1);
bench("Deserialize Medium Array SIMD (500kb)", () => blackbox(parseIntArraySIMD(arrMediumStr, simdHolder)), 5_000, arrMediumStr.length << 1);

bench("Deserialize Large Array Scalar (1000kb)", () => blackbox(parseIntArrayScalar(arrLargeStr, scalarHolder)), 2_500, arrLargeStr.length << 1);
bench("Deserialize Large Array SIMD (1000kb)", () => blackbox(parseIntArraySIMD(arrLargeStr, simdHolder)), 2_500, arrLargeStr.length << 1);
