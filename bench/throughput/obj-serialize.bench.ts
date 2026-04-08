import { bench, blackbox, dumpToFile } from "../lib/bench";

class ObjLarge {
  lorum: number = 4294967296;
  ipsum: boolean = true;
  dolor: Array<number> = [1, 2, 3, 4, 5];
  sit: string = "abcdefghijklmnopdasfqrstfuvwYZ1234567890;~!@#$%^&*()_+=-{}][\\|;\":'<>,./?";
  consectetur: number = 123456;
  adipiscing: boolean = false;
  elit: Array<number> = [6, 7, 8, 9, 10];
  sed: number = Number.MAX_VALUE;
  eiusmod: string = "abcdYZ12345890./?abcdYZ12345890./?abcdYZ12340./?";
  tempor: number = 999999;
  incididunt: boolean = true;
  ut: Array<number> = [16, 17, 18, 19, 20];
  labore: number = 3.1415926535;
  et: string = "xyzXYZ09876!@#";
  dolore: number = -123456;
  magna: boolean = false;
  aliqua: Array<number> = [21, 22, 23, 24, 25];
  argw: string = 'abcdYZ12345890sdfw"vie91kfESDFOK12i9i12dsf./?';
}

const obj = new ObjLarge();
const objStr = `{"lorum":4294967295,"ipsum":true,"dolor":[1,2,3,4,5],"sit":"abcdefghijklmnopdasfqrstfuvwYZ1234567890;~!@#$%^&*()_+=-{}][\\\\|;\\":'<>,./?","consectetur":123456,"adipiscing":false,"elit":[6,7,8,9,10],"sed":1.7976931348623157e+308,"eiusmod":"abcdYZ12345890./?abcdYZ12345890./?abcdYZ12340./?","tempor":999999,"incididunt":true,"ut":[16,17,18,19,20],"labore":3.1415926535,"et":"xyzXYZ09876!@#","dolore":-123456,"magna":false,"aliqua":[21,22,23,24,25],"argw":"abcdYZ12345890sdfw\\"vie91kfESDFOK12i9i12dsf./?"}`;
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
const objStrBytes = utf8ByteLength(objStr);

function opsForBytes(targetBytes: number): number {
  return Math.ceil(targetBytes / objStrBytes);
}

bench(
  "Serialize Small Object (1kb)",
  () => {
    let ops = opsForBytes(1 * 1024);
    while (ops > 0) {
      blackbox(JSON.stringify(obj));
      ops--;
    }
  },
  2_500_000,
  objStrBytes * opsForBytes(1 * 1024),
);
dumpToFile("small-obj", "serialize");

bench(
  "Serialize Medium Object (500kb)",
  () => {
    let ops = opsForBytes(500 * 1024);
    while (ops > 0) {
      blackbox(JSON.stringify(obj));
      ops--;
    }
  },
  5_000,
  objStrBytes * opsForBytes(500 * 1024),
);
dumpToFile("medium-obj", "serialize");

bench(
  "Serialize Large Object (1000kb)",
  () => {
    let ops = opsForBytes(1000 * 1024);
    while (ops > 0) {
      blackbox(JSON.stringify(obj));
      ops--;
    }
  },
  500,
  objStrBytes * opsForBytes(1000 * 1024),
);
dumpToFile("large-obj", "serialize");

bench(
  "Serialize XLarge Object (2mb)",
  () => {
    let ops = opsForBytes(2 * 1024 * 1024);
    while (ops > 0) {
      blackbox(JSON.stringify(obj));
      ops--;
    }
  },
  250,
  objStrBytes * opsForBytes(2 * 1024 * 1024),
);
dumpToFile("xlarge-obj", "serialize");

bench(
  "Serialize XXLarge Object (5mb)",
  () => {
    let ops = opsForBytes(5 * 1024 * 1024);
    while (ops > 0) {
      blackbox(JSON.stringify(obj));
      ops--;
    }
  },
  100,
  objStrBytes * opsForBytes(5 * 1024 * 1024),
);
dumpToFile("xxlarge-obj", "serialize");

bench(
  "Serialize Huge Object (10mb)",
  () => {
    let ops = opsForBytes(10 * 1024 * 1024);
    while (ops > 0) {
      blackbox(JSON.stringify(obj));
      ops--;
    }
  },
  50,
  objStrBytes * opsForBytes(10 * 1024 * 1024),
);
dumpToFile("huge-obj", "serialize");
