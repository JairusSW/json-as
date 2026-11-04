import { JSON } from "../..";
import { Base } from "./default-model.fixture";

@json class Child extends Base {
  tail: i32 = 9;
}
export function run(): string {
  return JSON.stringify(JSON.parse<Child>('{"value":7,"tail":9}'));
}
