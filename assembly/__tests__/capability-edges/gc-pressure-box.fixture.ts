import { JSON } from "../..";
class Values extends Array<JSON.Value> {}
function source(): JSON.Value[] {
  return [JSON.Value.from<i32>(1), JSON.Value.from<i32>(2)];
}
export function run(): string {
  __collect();
  const bits = JSON.Value.bitsFrom(source());
  const boxed = JSON.Value.fromBits(bits);
  return JSON.stringify(boxed.get<Values>());
}
