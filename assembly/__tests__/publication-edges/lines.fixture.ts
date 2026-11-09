import { JSON } from "../../index";

@json class Record {
  value: string = "left\u2028right";
  other: string = "left\u2029right";
}
export function run(): string {
  const native = new Record();
  const parsed = JSON.parse<Record>("{}");
  assert(parsed.value === native.value);
  assert(parsed.other === native.other);
  return parsed.value.length.toString() + "|" + parsed.other.length.toString();
}
