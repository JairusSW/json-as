import { JSON } from "../..";
import { Base } from "./private-model.fixture";

@json class Child extends Base {
  tail: i32 = 9;
}
export function run(): string {
  return JSON.stringify(JSON.parse<Child>('{"value":{"value":5},"tail":9}'));
}
