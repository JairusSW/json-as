import { JSON } from "../../index";


@json
export class Uint8Array {
  value: i32 = 3;
}


@json
class Holder {
  child: Uint8Array = new Uint8Array();
}
export function run(kind: i32): i32 {
  if (kind == 0) return JSON.parse<Uint8Array>('{"value":7}').value;
  if (kind == 1)
    return JSON.parse<Uint8Array>('{"value":7}', new Uint8Array()).value;
  if (kind == 2) return JSON.parse<Holder>('{"child":{"value":7}}').child.value;
  return JSON.parse<Holder>('{"child":{"value":7}}', new Holder()).child.value;
}
export function roundtrip(): string {
  return JSON.stringify(JSON.parse<Holder>('{"child":{"value":7}}'));
}
