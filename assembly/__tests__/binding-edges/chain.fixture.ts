import { JSON } from "../..";
import { Middle as Base } from "./middle.fixture";

@json class Leaf extends Base {
  leaf: i32 = 3;
}
export function run(): string {
  return JSON.stringify(new Leaf());
}
