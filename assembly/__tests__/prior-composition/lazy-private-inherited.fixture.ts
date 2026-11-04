import { JSON } from "../..";
import { Base } from "./lazy-private-model.fixture";

@json class Child extends Base {
  tail: i32 = 9;
}
export function run(): string {
  const out = JSON.parse<Child>('{"value":{"value":5},"tail":9}');
  assert(out.value.value == 5);
  return JSON.stringify(out);
}
