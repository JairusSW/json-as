// Shared by the AssemblyScript and JavaScript throughput harnesses.
// One growing JSON document; never a batch of independent parse calls.
export const RECORD_JSON =
  '{"lorum":4294967295,"ipsum":true,"dolor":[1,2,3,4,5],"sit":"abcdefghijklmnopdasfqrstfuvwYZ1234567890;~!@#$%^&*()_+=-{}][\\\\|;\\":\'<>,./?","consectetur":123456,"adipiscing":false,"elit":[6,7,8,9,10],"sed":1.7976931348623157e+308,"eiusmod":"abcdYZ12345890./?abcdYZ12345890./?abcdYZ12340./?","tempor":999999,"incididunt":true,"ut":[16,17,18,19,20],"labore":3.1415926535,"et":"xyzXYZ09876!@#","dolore":-123456,"magna":false,"aliqua":[21,22,23,24,25],"argw":"abcdYZ12345890sdfw\\"vie91kfESDFOK12i9i12dsf./?","padding":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}';
export const OBJECT_SIZES = [
  1024, 102400, 204800, 307200, 409600, 512000, 614400, 716800, 819200, 921600,
  1048576, 2097152, 3145728, 4194304, 5242880, 6291456, 7340032, 8388608,
  9437184, 10485760,
];
export const OBJECT_LABELS = [
  "1kb",
  "100kb",
  "200kb",
  "300kb",
  "400kb",
  "500kb",
  "600kb",
  "700kb",
  "800kb",
  "900kb",
  "1mb",
  "2mb",
  "3mb",
  "4mb",
  "5mb",
  "6mb",
  "7mb",
  "8mb",
  "9mb",
  "10mb",
];

export function makeObjectJson(targetBytes: number): string {
  const records: string[] = [];
  let bytes = '{"records":['.length + "]}".length;
  while (bytes < targetBytes) {
    records.push(RECORD_JSON);
    bytes += RECORD_JSON.length + (records.length > 1 ? 1 : 0);
  }
  return '{"records":[' + records.join(",") + "]}";
}
