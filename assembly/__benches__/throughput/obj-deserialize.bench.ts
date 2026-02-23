import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { bench, dumpToFile } from "../lib/bench";


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
const objStrEnd = changetype<usize>(objStr) + (objStr.length << 1);

expect(JSON.stringify(obj)).toBe(objStr);
expect(JSON.stringify(JSON.parse<ObjLarge>(objStr))).toBe(objStr);

bench(
  "Deserialize Small Object (1kb)",
  () => {
    // @ts-ignore
    obj.__DESERIALIZE<ObjLarge>(changetype<usize>(objStr), objStrEnd, obj);
  },
  2_500_000,
  objStr.length << 1,
);
dumpToFile("small-obj", "deserialize");

bench(
  "Deserialize Medium Object (500kb)",
  () => {
    let ops = 500;
    while (ops > 0) {
      // @ts-ignore
      obj.__DESERIALIZE<ObjLarge>(changetype<usize>(objStr), objStrEnd, obj);
      ops--;
    }
  },
  5_000,
  (objStr.length << 1) * 500,
);
dumpToFile("medium-obj", "deserialize");

bench(
  "Deserialize Large Object (1000kb)",
  () => {
    let ops = 1000;
    while (ops > 0) {
      // @ts-ignore
      obj.__DESERIALIZE<ObjLarge>(changetype<usize>(objStr), objStrEnd, obj);
      ops--;
    }
  },
  500,
  (objStr.length << 1) * 1000,
);
dumpToFile("large-obj", "deserialize");
