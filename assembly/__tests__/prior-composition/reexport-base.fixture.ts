import { JSON } from "../..";
import { RenamedBase as Parent } from "./base-barrel.fixture";

@json class Child extends Parent {
  tail: i32 = 9;
}
export function run(): string {
  return JSON.stringify(JSON.parse<Child>('{"value":5,"tail":9}'));
}
