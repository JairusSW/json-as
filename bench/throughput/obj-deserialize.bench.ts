import { bench, blackbox, dumpToFile } from "../lib/bench";

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

const objStr = `{"lorum":4294967295,"ipsum":true,"dolor":[1,2,3,4,5],"sit":"abcdefghijklmnopdasfqrstfuvwYZ1234567890;~!@#$%^&*()_+=-{}][\\\\|;\\":'<>,./?","consectetur":123456,"adipiscing":false,"elit":[6,7,8,9,10],"sed":1.7976931348623157e+308,"eiusmod":"abcdYZ12345890./?abcdYZ12345890./?abcdYZ12340./?","tempor":999999,"incididunt":true,"ut":[16,17,18,19,20],"labore":3.1415926535,"et":"xyzXYZ09876!@#","dolore":-123456,"magna":false,"aliqua":[21,22,23,24,25],"argw":"abcdYZ12345890sdfw\\"vie91kfESDFOK12i9i12dsf./?"}`;
const objStrBytes = utf8ByteLength(objStr);

function opsForBytes(targetBytes: number): number {
  return Math.ceil(targetBytes / objStrBytes);
}

const smallObjStr = JSON.stringify({
  id: 42,
  ok: true,
  name: "tiny-object",
  tags: [1, 2, 3],
});
const smallObjStrBytes = utf8ByteLength(smallObjStr);

function opsForSmallBytes(targetBytes: number): number {
  return Math.ceil(targetBytes / smallObjStrBytes);
}

const smallSizes = [1 * 1024, 50 * 1024, 100 * 1024, 150 * 1024, 200 * 1024, 250 * 1024, 300 * 1024, 350 * 1024, 400 * 1024, 450 * 1024, 500 * 1024, 550 * 1024, 600 * 1024, 650 * 1024, 700 * 1024, 750 * 1024, 800 * 1024, 850 * 1024, 900 * 1024, 950 * 1024, 1024 * 1024];
const smallLabels = ["1kb", "50kb", "100kb", "150kb", "200kb", "250kb", "300kb", "350kb", "400kb", "450kb", "500kb", "550kb", "600kb", "650kb", "700kb", "750kb", "800kb", "850kb", "900kb", "950kb", "1mb-small"];
const smallBaseOps = 500;

for (let i = 0; i < smallSizes.length; i++) {
  const sizeBytes = smallSizes[i];
  const label = smallLabels[i];
  const ops = Math.min(200_000, Math.floor((smallBaseOps * 1024 * 1024) / sizeBytes));
  bench(
    `Deserialize Object (${label})`,
    () => {
      let count = opsForSmallBytes(sizeBytes);
      while (count > 0) {
        blackbox(JSON.parse(smallObjStr));
        count--;
      }
    },
    ops,
    smallObjStrBytes * opsForSmallBytes(sizeBytes),
  );
  dumpToFile(`obj-${label}`, "deserialize");
}

const sizesMB = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const baseOps = 500;

for (const sizeMB of sizesMB) {
  const label = `${sizeMB}mb`;
  const targetBytes = sizeMB * 1024 * 1024;
  const ops = Math.floor(baseOps / sizeMB);
  bench(
    `Deserialize Object (${label})`,
    () => {
      let count = opsForBytes(targetBytes);
      while (count > 0) {
        blackbox(JSON.parse(objStr));
        count--;
      }
    },
    ops,
    objStrBytes * opsForBytes(targetBytes),
  );
  dumpToFile(`obj-${label}`, "deserialize");
}
