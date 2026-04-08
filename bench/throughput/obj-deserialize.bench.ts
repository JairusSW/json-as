import { bench, blackbox, dumpToFile } from "../lib/bench";

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
  "Deserialize Small Object (1kb)",
  () => {
    let ops = opsForBytes(1 * 1024);
    while (ops > 0) {
      blackbox(JSON.parse(objStr));
      ops--;
    }
  },
  2_500_000,
  objStrBytes * opsForBytes(1 * 1024),
);
dumpToFile("small-obj", "deserialize");

bench(
  "Deserialize Medium Object (500kb)",
  () => {
    let ops = opsForBytes(500 * 1024);
    while (ops > 0) {
      blackbox(JSON.parse(objStr));
      ops--;
    }
  },
  5_000,
  objStrBytes * opsForBytes(500 * 1024),
);
dumpToFile("medium-obj", "deserialize");

bench(
  "Deserialize Large Object (1000kb)",
  () => {
    let ops = opsForBytes(1000 * 1024);
    while (ops > 0) {
      blackbox(JSON.parse(objStr));
      ops--;
    }
  },
  500,
  objStrBytes * opsForBytes(1000 * 1024),
);
dumpToFile("large-obj", "deserialize");

bench(
  "Deserialize XLarge Object (2mb)",
  () => {
    let ops = opsForBytes(2 * 1024 * 1024);
    while (ops > 0) {
      blackbox(JSON.parse(objStr));
      ops--;
    }
  },
  250,
  objStrBytes * opsForBytes(2 * 1024 * 1024),
);
dumpToFile("xlarge-obj", "deserialize");

bench(
  "Deserialize XXLarge Object (5mb)",
  () => {
    let ops = opsForBytes(5 * 1024 * 1024);
    while (ops > 0) {
      blackbox(JSON.parse(objStr));
      ops--;
    }
  },
  100,
  objStrBytes * opsForBytes(5 * 1024 * 1024),
);
dumpToFile("xxlarge-obj", "deserialize");

bench(
  "Deserialize Huge Object (10mb)",
  () => {
    let ops = opsForBytes(10 * 1024 * 1024);
    while (ops > 0) {
      blackbox(JSON.parse(objStr));
      ops--;
    }
  },
  50,
  objStrBytes * opsForBytes(10 * 1024 * 1024),
);
dumpToFile("huge-obj", "deserialize");
