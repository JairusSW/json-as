import { JSON } from "../..";
export {
  OBJECT_SIZES,
  OBJECT_LABELS,
  RECORD_JSON,
  makeObjectJson,
} from "../../../bench/throughput/object-workload";


@json
class ObjectRow {
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
  padding: string = "";
}


@json
export class GrowingObject {
  records: ObjectRow[] = [];
}
