// Lazy variant — same payloads/sizes as the eager obj throughput bench,
// but the classes use @json({ lazy: "auto" }). Results dump to "obj-lazy-*"
// so charts can plot lazy vs eager side by side.
import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { bench, dumpToFile } from "../lib/bench";


@json({ lazy: "auto" }) // 1 KB
class ObjLarge {
  lorum: u32 = U32.MAX_VALUE;
  ipsum: boolean = true;
  dolor: Array<i32> = [1, 2, 3, 4, 5];
  sit: string =
    "abcdefghijklmnopdasfqrstfuvwYZ1234567890;~!@#$%^&*()_+=-{}][\\|;\":'<>,./?";
  consectetur: i32 = 123456;
  adipiscing: boolean = false;
  elit: Array<i32> = [6, 7, 8, 9, 10];
  sed: f64 = F64.MAX_VALUE;
  eiusmod: string = "abcdYZ12345890./?abcdYZ12345890./?abcdYZ12340./?";
  tempor: i32 = 999999;
  incididunt: boolean = true;
  ut: Array<i32> = [16, 17, 18, 19, 20];
  labore: f64 = 3.1415926535;
  et: string = "xyzXYZ09876!@#";
  dolore: i32 = -123456;
  magna: boolean = false;
  aliqua: Array<i32> = [21, 22, 23, 24, 25];
  argw: string = 'abcdYZ12345890sdfw"vie91kfESDFOK12i9i12dsf./?';
}


@json({ lazy: "auto" }) // tiny object for sub-1MB scaling
class ObjSmall {
  id: i32 = 42;
  ok: boolean = true;
  name: string = "tiny-object";
  tags: Array<i32> = [1, 2, 3];
}

const obj = new ObjLarge();
const smallObj = new ObjSmall();
const objStr = `{"lorum":4294967295,"ipsum":true,"dolor":[1,2,3,4,5],"sit":"abcdefghijklmnopdasfqrstfuvwYZ1234567890;~!@#$%^&*()_+=-{}][\\\\|;\\":'<>,./?","consectetur":123456,"adipiscing":false,"elit":[6,7,8,9,10],"sed":1.7976931348623157e+308,"eiusmod":"abcdYZ12345890./?abcdYZ12345890./?abcdYZ12340./?","tempor":999999,"incididunt":true,"ut":[16,17,18,19,20],"labore":3.1415926535,"et":"xyzXYZ09876!@#","dolore":-123456,"magna":false,"aliqua":[21,22,23,24,25],"argw":"abcdYZ12345890sdfw\\"vie91kfESDFOK12i9i12dsf./?"}`;
const objStrBytes = String.UTF8.byteLength(objStr);
const objStrEnd = changetype<usize>(objStr) + (objStr.length << 1);
const objSmallStr = JSON.stringify(smallObj);
const objSmallStrBytes = String.UTF8.byteLength(objSmallStr);
const objSmallStrEnd =
  changetype<usize>(objSmallStr) + (objSmallStr.length << 1);


@inline function deserializeInto<T>(
  srcStart: usize,
  srcEnd: usize,
  out: T,
): void {
  // @ts-ignore: supplied by transform
  if (isDefined(out.__DESERIALIZE_FAST)) {
    // @ts-ignore: supplied by transform
    out.__DESERIALIZE_FAST(srcStart, srcEnd, out);
    return;
  }
  // @ts-ignore: supplied by transform
  if (isDefined(out.__DESERIALIZE_SLOW)) {
    // @ts-ignore: supplied by transform
    out.__DESERIALIZE_SLOW(srcStart, srcEnd, out);
    return;
  }
  throw new Error("Missing __DESERIALIZE_FAST/__DESERIALIZE_SLOW");
}

function opsForBytes(targetBytes: i32): i32 {
  return (targetBytes + objStrBytes - 1) / objStrBytes;
}

function opsForSmallBytes(targetBytes: i32): i32 {
  return (targetBytes + objSmallStrBytes - 1) / objSmallStrBytes;
}

const smallBytes0 = 1 * 1024;
const smallBytes2 = 100 * 1024;
const smallBytes4 = 200 * 1024;
const smallBytes6 = 300 * 1024;
const smallBytes8 = 400 * 1024;
const smallBytes10 = 500 * 1024;
const smallBytes12 = 600 * 1024;
const smallBytes14 = 700 * 1024;
const smallBytes16 = 800 * 1024;
const smallBytes18 = 900 * 1024;

const bytes1 = 1 * 1024 * 1024;
const bytes2 = 2 * 1024 * 1024;
const bytes3 = 3 * 1024 * 1024;
const bytes4 = 4 * 1024 * 1024;
const bytes5 = 5 * 1024 * 1024;
const bytes6 = 6 * 1024 * 1024;
const bytes7 = 7 * 1024 * 1024;
const bytes8 = 8 * 1024 * 1024;
const bytes9 = 9 * 1024 * 1024;
const bytes10 = 10 * 1024 * 1024;

expect(JSON.stringify(obj)).toBe(objStr);
expect(JSON.stringify(JSON.parse<ObjLarge>(objStr))).toBe(objStr);
expect(JSON.stringify(smallObj)).toBe(objSmallStr);

bench(
  "Deserialize Object (1kb)",
  () => {
    let count = opsForSmallBytes(smallBytes0);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjSmall>(
        changetype<usize>(objSmallStr),
        objSmallStrEnd,
        smallObj,
      );
      count--;
    }
  },
  200000,
  objSmallStrBytes * opsForSmallBytes(smallBytes0),
);
dumpToFile("obj-lazy-1kb", "deserialize");

bench(
  "Deserialize Object (100kb)",
  () => {
    let count = opsForSmallBytes(smallBytes2);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjSmall>(
        changetype<usize>(objSmallStr),
        objSmallStrEnd,
        smallObj,
      );
      count--;
    }
  },
  30000,
  objSmallStrBytes * opsForSmallBytes(smallBytes2),
);
dumpToFile("obj-lazy-100kb", "deserialize");

bench(
  "Deserialize Object (200kb)",
  () => {
    let count = opsForSmallBytes(smallBytes4);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjSmall>(
        changetype<usize>(objSmallStr),
        objSmallStrEnd,
        smallObj,
      );
      count--;
    }
  },
  15000,
  objSmallStrBytes * opsForSmallBytes(smallBytes4),
);
dumpToFile("obj-lazy-200kb", "deserialize");

bench(
  "Deserialize Object (300kb)",
  () => {
    let count = opsForSmallBytes(smallBytes6);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjSmall>(
        changetype<usize>(objSmallStr),
        objSmallStrEnd,
        smallObj,
      );
      count--;
    }
  },
  10000,
  objSmallStrBytes * opsForSmallBytes(smallBytes6),
);
dumpToFile("obj-lazy-300kb", "deserialize");

bench(
  "Deserialize Object (400kb)",
  () => {
    let count = opsForSmallBytes(smallBytes8);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjSmall>(
        changetype<usize>(objSmallStr),
        objSmallStrEnd,
        smallObj,
      );
      count--;
    }
  },
  7500,
  objSmallStrBytes * opsForSmallBytes(smallBytes8),
);
dumpToFile("obj-lazy-400kb", "deserialize");

bench(
  "Deserialize Object (500kb)",
  () => {
    let count = opsForSmallBytes(smallBytes10);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjSmall>(
        changetype<usize>(objSmallStr),
        objSmallStrEnd,
        smallObj,
      );
      count--;
    }
  },
  6000,
  objSmallStrBytes * opsForSmallBytes(smallBytes10),
);
dumpToFile("obj-lazy-500kb", "deserialize");

bench(
  "Deserialize Object (600kb)",
  () => {
    let count = opsForSmallBytes(smallBytes12);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjSmall>(
        changetype<usize>(objSmallStr),
        objSmallStrEnd,
        smallObj,
      );
      count--;
    }
  },
  5000,
  objSmallStrBytes * opsForSmallBytes(smallBytes12),
);
dumpToFile("obj-lazy-600kb", "deserialize");

bench(
  "Deserialize Object (700kb)",
  () => {
    let count = opsForSmallBytes(smallBytes14);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjSmall>(
        changetype<usize>(objSmallStr),
        objSmallStrEnd,
        smallObj,
      );
      count--;
    }
  },
  4286,
  objSmallStrBytes * opsForSmallBytes(smallBytes14),
);
dumpToFile("obj-lazy-700kb", "deserialize");

bench(
  "Deserialize Object (800kb)",
  () => {
    let count = opsForSmallBytes(smallBytes16);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjSmall>(
        changetype<usize>(objSmallStr),
        objSmallStrEnd,
        smallObj,
      );
      count--;
    }
  },
  3750,
  objSmallStrBytes * opsForSmallBytes(smallBytes16),
);
dumpToFile("obj-lazy-800kb", "deserialize");

bench(
  "Deserialize Object (900kb)",
  () => {
    let count = opsForSmallBytes(smallBytes18);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjSmall>(
        changetype<usize>(objSmallStr),
        objSmallStrEnd,
        smallObj,
      );
      count--;
    }
  },
  3334,
  objSmallStrBytes * opsForSmallBytes(smallBytes18),
);
dumpToFile("obj-lazy-900kb", "deserialize");

bench(
  "Deserialize Object (1mb)",
  () => {
    let count = opsForBytes(bytes1);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjLarge>(changetype<usize>(objStr), objStrEnd, obj);
      count--;
    }
  },
  500,
  objStrBytes * opsForBytes(bytes1),
);
dumpToFile("obj-lazy-1mb", "deserialize");

bench(
  "Deserialize Object (2mb)",
  () => {
    let count = opsForBytes(bytes2);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjLarge>(changetype<usize>(objStr), objStrEnd, obj);
      count--;
    }
  },
  250,
  objStrBytes * opsForBytes(bytes2),
);
dumpToFile("obj-lazy-2mb", "deserialize");

bench(
  "Deserialize Object (3mb)",
  () => {
    let count = opsForBytes(bytes3);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjLarge>(changetype<usize>(objStr), objStrEnd, obj);
      count--;
    }
  },
  166,
  objStrBytes * opsForBytes(bytes3),
);
dumpToFile("obj-lazy-3mb", "deserialize");

bench(
  "Deserialize Object (4mb)",
  () => {
    let count = opsForBytes(bytes4);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjLarge>(changetype<usize>(objStr), objStrEnd, obj);
      count--;
    }
  },
  125,
  objStrBytes * opsForBytes(bytes4),
);
dumpToFile("obj-lazy-4mb", "deserialize");

bench(
  "Deserialize Object (5mb)",
  () => {
    let count = opsForBytes(bytes5);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjLarge>(changetype<usize>(objStr), objStrEnd, obj);
      count--;
    }
  },
  100,
  objStrBytes * opsForBytes(bytes5),
);
dumpToFile("obj-lazy-5mb", "deserialize");

bench(
  "Deserialize Object (6mb)",
  () => {
    let count = opsForBytes(bytes6);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjLarge>(changetype<usize>(objStr), objStrEnd, obj);
      count--;
    }
  },
  83,
  objStrBytes * opsForBytes(bytes6),
);
dumpToFile("obj-lazy-6mb", "deserialize");

bench(
  "Deserialize Object (7mb)",
  () => {
    let count = opsForBytes(bytes7);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjLarge>(changetype<usize>(objStr), objStrEnd, obj);
      count--;
    }
  },
  71,
  objStrBytes * opsForBytes(bytes7),
);
dumpToFile("obj-lazy-7mb", "deserialize");

bench(
  "Deserialize Object (8mb)",
  () => {
    let count = opsForBytes(bytes8);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjLarge>(changetype<usize>(objStr), objStrEnd, obj);
      count--;
    }
  },
  62,
  objStrBytes * opsForBytes(bytes8),
);
dumpToFile("obj-lazy-8mb", "deserialize");

bench(
  "Deserialize Object (9mb)",
  () => {
    let count = opsForBytes(bytes9);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjLarge>(changetype<usize>(objStr), objStrEnd, obj);
      count--;
    }
  },
  55,
  objStrBytes * opsForBytes(bytes9),
);
dumpToFile("obj-lazy-9mb", "deserialize");

bench(
  "Deserialize Object (10mb)",
  () => {
    let count = opsForBytes(bytes10);
    while (count > 0) {
      // @ts-ignore
      deserializeInto<ObjLarge>(changetype<usize>(objStr), objStrEnd, obj);
      count--;
    }
  },
  50,
  objStrBytes * opsForBytes(bytes10),
);
dumpToFile("obj-lazy-10mb", "deserialize");
