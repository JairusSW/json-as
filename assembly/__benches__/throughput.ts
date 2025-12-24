import { JSON } from "..";
import { bs } from "../../lib/as-bs";
import { bench, blackbox, dumpToFile } from "./lib/bench";

@json // 256b
class ObjSmall {
  lorum: i32 = I32.MAX_VALUE;
  ipsum: boolean = true;
  dolor: Array<i32> = [1];
  sit: string = "abcdefghijklmnopdasfqrstfuvwYZ1234567890`~!@#$%^&*()_+=-{}][\\|;\":'<>,./?";
}

@json // 512b
class ObjMedium {
  lorum: u32 = U32.MAX_VALUE;
  ipsum: boolean = true;
  dolor: Array<i32> = [1,2,3,4,5];
  sit: string = "abcdefghijklmnopdasfqrstfuvwYZ1234567890`~!@#$%^&*()_+=-{}][\\|;\":'<>,./?";
  consectetur: i32 = 123456;
  adipiscing: boolean = false;
  elit: Array<i32> = [6,7,8,9,10];
  sed: f64 = F64.MAX_VALUE;
  eiusmod: string = "abcdYZ12345890./?";
}

@json // 1 KB
class ObjLarge {
  lorum: u32 = U32.MAX_VALUE;
  ipsum: boolean = true;
  dolor: Array<i32> = [1,2,3,4,5,6,7,8,9,10];
  sit: string = "abcdefghijklmnopdasfqrstfuvwYZ1234567890`~!@#$%^&*()_+=-{}][\\|;\":'<>,./?";
  consectetur: i32 = 123456;
  adipiscing: boolean = false;
  elit: Array<i32> = [11,12,13,14,15];
  sed: f64 = F64.MAX_VALUE;
  eiusmod: string = "abcdYZ12345890sdfw\"12i9i12dsf./?";
  tempor: i32 = 999999;
  incididunt: boolean = true;
  ut: Array<i32> = [16,17,18,19,20];
  labore: f64 = 3.1415926535;
  et: string = "xyzXYZ09876!@#";
  dolore: i32 = -123456;
  magna: boolean = false;
  aliqua: Array<i32> = [21,22,23,24,25];
  argw: string = "abcdYZ12345890sdfw\"vie91kfESDFOK12i9i12dsf./?";
}

const objSmall = new ObjSmall();
const objMedium = new ObjMedium();
const objLarge = new ObjLarge();

const arrSmall = new Array<i32>(25_600).fill(0);
const arrMedium = new Array<i32>(128_000).fill(0);
const arrLarge = new Array<i32>(256_000).fill(0); 

const strSmall = "a".repeat(100 * 1024);
const strMedium = "a".repeat(500 * 1024);
const strLarge = "a".repeat(1024 * 1024);

const arrSmallStr = JSON.stringify(arrSmall);
const arrMediumStr = JSON.stringify(arrMedium);
const arrLargeStr = JSON.stringify(arrLarge);

const strSmallStr = JSON.stringify(strSmall);
const strMediumStr = JSON.stringify(strMedium);
const strLargeStr = JSON.stringify(strLarge);

const objSmallStr = JSON.stringify(objSmall);
const objMediumStr = JSON.stringify(objMedium);
const objLargeStr = JSON.stringify(objLarge);

const ITER = 1_000_000;

/* --- OBJECTS --- */
bench("Serialize Small Object", () => { // 1024b
    // @ts-ignore
    objMedium.__SERIALIZE(changetype<usize>(objMedium))
    // @ts-ignore
    objMedium.__SERIALIZE(changetype<usize>(objMedium))
    blackbox<string>(bs.out<string>());
}, ITER, (objMediumStr.length << 1) * 2);

dumpToFile("small-obj", "serialize");

// bench("Deserialize Small Object", () => {
//     blackbox(JSON.parse<typeof objSmall>(objSmallStr))
// }, ITER, objSmallStr.length << 1);
// dumpToFile("small-obj", "deserialize");

bench("Serialize Medium Object", () => {
    let ops = 1000;
    while (ops--) {
    // @ts-ignore
    objMedium.__SERIALIZE(changetype<usize>(objMedium))
    }
    blackbox<string>(bs.out<string>());
}, 100_000, (objMediumStr.length << 1) * 1000);
dumpToFile("medium-obj", "serialize");
// // bench("Deserialize Medium Object", () => blackbox(JSON.parse<typeof objMedium>(objMediumStr)), ITER, objMediumStr.length << 1);
// // dumpToFile("medium-obj", "deserialize");

// // bench("Serialize Large Object", () => blackbox(JSON.stringify(objLarge)), ITER, objLargeStr.length << 1);
// // dumpToFile("large-obj", "serialize");
// // bench("Deserialize Large Object", () => blackbox(JSON.parse<typeof objLarge>(objLargeStr)), ITER, objLargeStr.length << 1);
// // dumpToFile("large-obj", "deserialize");

// /* --- ARRAYS --- */
// bench("Serialize Small Array", () => blackbox(JSON.stringify(arrSmall)), ITER, arrSmallStr.length << 1);
// dumpToFile("small-arr", "serialize");
// bench("Deserialize Small Array", () => blackbox(JSON.parse<i32[]>(arrSmallStr)), ITER, arrSmallStr.length << 1);
// dumpToFile("small-arr", "deserialize");

// bench("Serialize Medium Array", () => blackbox(JSON.stringify(arrMedium)), ITER, arrMediumStr.length << 1);
// dumpToFile("medium-arr", "serialize");
// bench("Deserialize Medium Array", () => blackbox(JSON.parse<i32[]>(arrMediumStr)), ITER, arrMediumStr.length << 1);
// dumpToFile("medium-arr", "deserialize");

// bench("Serialize Large Array", () => blackbox(JSON.stringify(arrLarge)), ITER, arrLargeStr.length << 1);
// dumpToFile("large-arr", "serialize");
// bench("Deserialize Large Array", () => blackbox(JSON.parse<i32[]>(arrLargeStr)), ITER, arrLargeStr.length << 1);
// dumpToFile("large-arr", "deserialize");

// /* --- STRINGS --- */
// bench("Serialize Small String", () => blackbox(JSON.stringify(strSmall)), ITER, strSmallStr.length << 1);
// dumpToFile("small-str", "serialize");
// bench("Deserialize Small String", () => blackbox(JSON.parse<string>(strSmallStr)), ITER, strSmallStr.length << 1);
// dumpToFile("small-str", "deserialize");

// bench("Serialize Medium String", () => blackbox(JSON.stringify(strMedium)), ITER, strMediumStr.length << 1);
// dumpToFile("medium-str", "serialize");
// bench("Deserialize Medium String", () => blackbox(JSON.parse<string>(strMediumStr)), ITER, strMediumStr.length << 1);
// dumpToFile("medium-str", "deserialize");

// bench("Serialize Large String", () => blackbox(JSON.stringify(strLarge)), ITER, strLargeStr.length << 1);
// dumpToFile("large-str", "serialize");
// bench("Deserialize Large String", () => blackbox(JSON.parse<string>(strLargeStr)), ITER, strLargeStr.length << 1);
// dumpToFile("large-str", "deserialize");
