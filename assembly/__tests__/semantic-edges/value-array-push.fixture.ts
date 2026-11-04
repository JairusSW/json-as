import { JSON } from "../..";
let calls: i32 = 0;
class Values extends Array<JSON.Value> {
  push(_value: JSON.Value): i32 {
    calls++;
    return super.push(JSON.Value.from<i32>(99));
  }
}
export function run(): string {
  const out = JSON.parse<Values>("[1,2]");
  assert(calls == 0);
  return JSON.stringify(out);
}
