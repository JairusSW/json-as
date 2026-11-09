import { JSON } from "../../index";
import { Named } from "./default-barrel.fixture";

@json class Child extends Named {
  tail: i32 = 9;
}
export function run(): string {
  return JSON.stringify(new Child());
}
