import { JSON } from "../..";
import { Base, reset, count } from "./base.fixture";
const INITIAL_COUNT: i32 = 99;

@json class Child extends Base<i32> {
  tail: i32 = 9;
}
export function run(): string {
  reset();
  assert(JSON.parse<Child>("{}").value == 7);
  assert(count() == 1);
  assert(INITIAL_COUNT == 99);
  return JSON.stringify(JSON.parse<Child>('{"value":5,"tail":9}'));
}
