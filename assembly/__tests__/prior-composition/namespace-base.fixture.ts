import { JSON } from "../..";
import * as model from "./base.fixture";

@json class Child extends model.Base {
  tail: i32 = 9;
}
export function run(): string {
  return JSON.stringify(JSON.parse<Child>('{"value":5,"tail":9}'));
}
