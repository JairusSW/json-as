import { JSON } from "../..";
class Values extends Array<JSON.Value> {}
function source(): JSON.Value[] {
  return [JSON.Value.from<i32>(1), JSON.Value.from<i32>(2)];
}
export function run(): string {
  const array = new JSON.Arr();
  array.length = 1;
  array.set(0, source());
  const out = array.getAs<Values>(0);
  return JSON.stringify(out);
}
