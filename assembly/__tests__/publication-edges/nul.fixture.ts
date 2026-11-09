import { JSON } from "../../index";

@json class Record {
  value: string = "a\u0000b";
  digit: string = "left\u00001right";
}
export function run(): string {
  const native = new Record();
  const parsed = JSON.parse<Record>("{}");
  return (
    parsed.value.length.toString() +
    "|" +
    parsed.digit.length.toString() +
    "|" +
    JSON.stringify(parsed.value) +
    "|" +
    JSON.stringify(parsed.digit)
  );
}
