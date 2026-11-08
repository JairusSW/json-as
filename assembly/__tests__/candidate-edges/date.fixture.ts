import { JSON } from "../../index";


@json
export class Date {
  value: i32 = 3;
}


@json
class Holder {
  x: Date = new Date();
}
export function run(root: bool): i32 {
  return root
    ? JSON.parse<Date>('{"value":7}').value
    : JSON.parse<Holder>('{"x":{"value":7}}').x.value;
}
