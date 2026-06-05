// Lazy variant — same payloads/sizes as the eager obj throughput bench,
// but the classes use @json({ lazy: "auto" }). Results dump to "obj-lazy-*"
// so charts can plot lazy vs eager side by side.
import { JSON } from "../..";
import { bs } from "../../../lib/as-bs";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile } from "../lib/bench";


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

// Materialize seed objects, capture their canonical JSON, then parse it back
// into lazy objects. Those lazy objects hold raw byte-ranges pointing into the
// source strings (kept alive by the consts below + __SET_SRC), so __SERIALIZE
// copies the untouched fields through verbatim — the lazy serialize fast path.
const objSeed = new ObjLarge();
const smallSeed = new ObjSmall();
const objStr = `{"lorum":4294967295,"ipsum":true,"dolor":[1,2,3,4,5],"sit":"abcdefghijklmnopdasfqrstfuvwYZ1234567890;~!@#$%^&*()_+=-{}][\\\\|;\\":'<>,./?","consectetur":123456,"adipiscing":false,"elit":[6,7,8,9,10],"sed":1.7976931348623157e+308,"eiusmod":"abcdYZ12345890./?abcdYZ12345890./?abcdYZ12340./?","tempor":999999,"incididunt":true,"ut":[16,17,18,19,20],"labore":3.1415926535,"et":"xyzXYZ09876!@#","dolore":-123456,"magna":false,"aliqua":[21,22,23,24,25],"argw":"abcdYZ12345890sdfw\\"vie91kfESDFOK12i9i12dsf./?"}`;
const objStrBytes = String.UTF8.byteLength(objStr);
const objSmallStr = JSON.stringify(smallSeed);
const objSmallStrBytes = String.UTF8.byteLength(objSmallStr);
const obj = JSON.parse<ObjLarge>(objStr);
const smallObj = JSON.parse<ObjSmall>(objSmallStr);

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

expect(JSON.stringify(objSeed)).toBe(objStr);
// passthrough round-trip: serializing the lazily-parsed objects reproduces the
// exact source bytes.
expect(JSON.stringify(obj)).toBe(objStr);
expect(JSON.stringify(smallObj)).toBe(objSmallStr);

bench(
  "Serialize Object (1kb)",
  () => {
    let count = opsForSmallBytes(smallBytes0);
    while (count > 0) {
      // @ts-ignore
      smallObj.__SERIALIZE(changetype<usize>(smallObj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  200000,
  objSmallStrBytes * opsForSmallBytes(smallBytes0),
);
dumpToFile("obj-lazy-1kb", "serialize");

bench(
  "Serialize Object (100kb)",
  () => {
    let count = opsForSmallBytes(smallBytes2);
    while (count > 0) {
      // @ts-ignore
      smallObj.__SERIALIZE(changetype<usize>(smallObj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  30000,
  objSmallStrBytes * opsForSmallBytes(smallBytes2),
);
dumpToFile("obj-lazy-100kb", "serialize");

bench(
  "Serialize Object (200kb)",
  () => {
    let count = opsForSmallBytes(smallBytes4);
    while (count > 0) {
      // @ts-ignore
      smallObj.__SERIALIZE(changetype<usize>(smallObj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  15000,
  objSmallStrBytes * opsForSmallBytes(smallBytes4),
);
dumpToFile("obj-lazy-200kb", "serialize");

bench(
  "Serialize Object (300kb)",
  () => {
    let count = opsForSmallBytes(smallBytes6);
    while (count > 0) {
      // @ts-ignore
      smallObj.__SERIALIZE(changetype<usize>(smallObj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  10000,
  objSmallStrBytes * opsForSmallBytes(smallBytes6),
);
dumpToFile("obj-lazy-300kb", "serialize");

bench(
  "Serialize Object (400kb)",
  () => {
    let count = opsForSmallBytes(smallBytes8);
    while (count > 0) {
      // @ts-ignore
      smallObj.__SERIALIZE(changetype<usize>(smallObj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  7500,
  objSmallStrBytes * opsForSmallBytes(smallBytes8),
);
dumpToFile("obj-lazy-400kb", "serialize");

bench(
  "Serialize Object (500kb)",
  () => {
    let count = opsForSmallBytes(smallBytes10);
    while (count > 0) {
      // @ts-ignore
      smallObj.__SERIALIZE(changetype<usize>(smallObj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  6000,
  objSmallStrBytes * opsForSmallBytes(smallBytes10),
);
dumpToFile("obj-lazy-500kb", "serialize");

bench(
  "Serialize Object (600kb)",
  () => {
    let count = opsForSmallBytes(smallBytes12);
    while (count > 0) {
      // @ts-ignore
      smallObj.__SERIALIZE(changetype<usize>(smallObj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  5000,
  objSmallStrBytes * opsForSmallBytes(smallBytes12),
);
dumpToFile("obj-lazy-600kb", "serialize");

bench(
  "Serialize Object (700kb)",
  () => {
    let count = opsForSmallBytes(smallBytes14);
    while (count > 0) {
      // @ts-ignore
      smallObj.__SERIALIZE(changetype<usize>(smallObj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  4286,
  objSmallStrBytes * opsForSmallBytes(smallBytes14),
);
dumpToFile("obj-lazy-700kb", "serialize");

bench(
  "Serialize Object (800kb)",
  () => {
    let count = opsForSmallBytes(smallBytes16);
    while (count > 0) {
      // @ts-ignore
      smallObj.__SERIALIZE(changetype<usize>(smallObj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  3750,
  objSmallStrBytes * opsForSmallBytes(smallBytes16),
);
dumpToFile("obj-lazy-800kb", "serialize");

bench(
  "Serialize Object (900kb)",
  () => {
    let count = opsForSmallBytes(smallBytes18);
    while (count > 0) {
      // @ts-ignore
      smallObj.__SERIALIZE(changetype<usize>(smallObj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  3334,
  objSmallStrBytes * opsForSmallBytes(smallBytes18),
);
dumpToFile("obj-lazy-900kb", "serialize");

bench(
  "Serialize Object (1mb)",
  () => {
    let count = opsForBytes(bytes1);
    while (count > 0) {
      // @ts-ignore
      obj.__SERIALIZE(changetype<usize>(obj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  500,
  objStrBytes * opsForBytes(bytes1),
);
dumpToFile("obj-lazy-1mb", "serialize");

bench(
  "Serialize Object (2mb)",
  () => {
    let count = opsForBytes(bytes2);
    while (count > 0) {
      // @ts-ignore
      obj.__SERIALIZE(changetype<usize>(obj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  250,
  objStrBytes * opsForBytes(bytes2),
);
dumpToFile("obj-lazy-2mb", "serialize");

bench(
  "Serialize Object (3mb)",
  () => {
    let count = opsForBytes(bytes3);
    while (count > 0) {
      // @ts-ignore
      obj.__SERIALIZE(changetype<usize>(obj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  166,
  objStrBytes * opsForBytes(bytes3),
);
dumpToFile("obj-lazy-3mb", "serialize");

bench(
  "Serialize Object (4mb)",
  () => {
    let count = opsForBytes(bytes4);
    while (count > 0) {
      // @ts-ignore
      obj.__SERIALIZE(changetype<usize>(obj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  125,
  objStrBytes * opsForBytes(bytes4),
);
dumpToFile("obj-lazy-4mb", "serialize");

bench(
  "Serialize Object (5mb)",
  () => {
    let count = opsForBytes(bytes5);
    while (count > 0) {
      // @ts-ignore
      obj.__SERIALIZE(changetype<usize>(obj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  100,
  objStrBytes * opsForBytes(bytes5),
);
dumpToFile("obj-lazy-5mb", "serialize");

bench(
  "Serialize Object (6mb)",
  () => {
    let count = opsForBytes(bytes6);
    while (count > 0) {
      // @ts-ignore
      obj.__SERIALIZE(changetype<usize>(obj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  83,
  objStrBytes * opsForBytes(bytes6),
);
dumpToFile("obj-lazy-6mb", "serialize");

bench(
  "Serialize Object (7mb)",
  () => {
    let count = opsForBytes(bytes7);
    while (count > 0) {
      // @ts-ignore
      obj.__SERIALIZE(changetype<usize>(obj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  71,
  objStrBytes * opsForBytes(bytes7),
);
dumpToFile("obj-lazy-7mb", "serialize");

bench(
  "Serialize Object (8mb)",
  () => {
    let count = opsForBytes(bytes8);
    while (count > 0) {
      // @ts-ignore
      obj.__SERIALIZE(changetype<usize>(obj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  62,
  objStrBytes * opsForBytes(bytes8),
);
dumpToFile("obj-lazy-8mb", "serialize");

bench(
  "Serialize Object (9mb)",
  () => {
    let count = opsForBytes(bytes9);
    while (count > 0) {
      // @ts-ignore
      obj.__SERIALIZE(changetype<usize>(obj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  55,
  objStrBytes * opsForBytes(bytes9),
);
dumpToFile("obj-lazy-9mb", "serialize");

bench(
  "Serialize Object (10mb)",
  () => {
    let count = opsForBytes(bytes10);
    while (count > 0) {
      // @ts-ignore
      obj.__SERIALIZE(changetype<usize>(obj));
      count--;
    }
    blackbox(bs.out<string>());
  },
  50,
  objStrBytes * opsForBytes(bytes10),
);
dumpToFile("obj-lazy-10mb", "serialize");
