import { JSON } from ".";

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

@json // ~1 KB
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


console.log((JSON.stringify(new ObjLarge()).length << 1).toString());