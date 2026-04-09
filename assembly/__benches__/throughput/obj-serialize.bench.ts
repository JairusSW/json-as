import { JSON } from "../..";
import { bs } from "../../../lib/as-bs";
import { expect } from "../../__tests__/lib";
import { bench, blackbox, dumpToFile } from "../lib/bench";


@json // 1 KB
class ObjLarge {
  lorum: u32 = U32.MAX_VALUE;
  ipsum: boolean = true;
  dolor: Array<i32> = [1, 2, 3, 4, 5];
  sit: string = "abcdefghijklmnopdasfqrstfuvwYZ1234567890;~!@#$%^&*()_+=-{}][\\|;\":'<>,./?";
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

const obj = new ObjLarge();
const objStr = `{"lorum":4294967295,"ipsum":true,"dolor":[1,2,3,4,5],"sit":"abcdefghijklmnopdasfqrstfuvwYZ1234567890;~!@#$%^&*()_+=-{}][\\\\|;\\":'<>,./?","consectetur":123456,"adipiscing":false,"elit":[6,7,8,9,10],"sed":1.7976931348623157e+308,"eiusmod":"abcdYZ12345890./?abcdYZ12345890./?abcdYZ12340./?","tempor":999999,"incididunt":true,"ut":[16,17,18,19,20],"labore":3.1415926535,"et":"xyzXYZ09876!@#","dolore":-123456,"magna":false,"aliqua":[21,22,23,24,25],"argw":"abcdYZ12345890sdfw\\"vie91kfESDFOK12i9i12dsf./?"}`;
const objStrBytes = String.UTF8.byteLength(objStr);

function opsForBytes(targetBytes: i32): i32 {
  return (targetBytes + objStrBytes - 1) / objStrBytes;
}

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
dumpToFile("obj-1mb", "serialize");

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
dumpToFile("obj-2mb", "serialize");

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
dumpToFile("obj-3mb", "serialize");

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
dumpToFile("obj-4mb", "serialize");

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
dumpToFile("obj-5mb", "serialize");

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
dumpToFile("obj-6mb", "serialize");

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
dumpToFile("obj-7mb", "serialize");

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
dumpToFile("obj-8mb", "serialize");

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
dumpToFile("obj-9mb", "serialize");

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
dumpToFile("obj-10mb", "serialize");
