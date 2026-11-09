import { JSON } from "../../index";
import { Base } from "./omission-base";

@json
class Texts extends Base<string> {
  tag: string = "texts";
}

@json
class Numbers extends Base<i32> {
  tag: string = "numbers";
}
export function run(): string {
  const n = new Numbers();
  n.value = 7;
  const s = new Texts();
  s.value = "ok";
  return JSON.stringify(n) + "|" + JSON.stringify(s);
}
