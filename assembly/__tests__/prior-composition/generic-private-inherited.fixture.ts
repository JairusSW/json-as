import { JSON } from "../..";
import { Base } from "./generic-private-model.fixture";

@json class Child extends Base<i32> {
  tail: i32 = 9;
}
export function run(): string {
  return JSON.stringify(JSON.parse<Child>('{"value":{"value":5},"tail":9}'));
}
