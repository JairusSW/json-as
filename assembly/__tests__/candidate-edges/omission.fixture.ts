import { JSON } from "../../index";
import { Base } from "./base";
function omitted(_self: Base): bool {
  return false;
}
const OMIT: bool = false;


@json
class Child extends Base {
  tail: i32 = 9;
}
export function run(): string {
  return JSON.stringify(new Child());
}

import { ArrowBase } from "./base";

@json
class ArrowChild extends ArrowBase {
  tail: i32 = 9;
}
export function arrows(): string {
  return JSON.stringify(new ArrowChild());
}
