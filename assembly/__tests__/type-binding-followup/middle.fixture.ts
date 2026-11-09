import { JSON } from "../../index";
import { Middle } from "./omission-base";

@json
class Numbers extends Middle<i32> {
  tag: string = "numbers";
}

@json
class Texts extends Middle<string> {
  tag: string = "texts";
}
export function run(): string {
  const n = new Numbers();
  n.value = 7;
  const s = new Texts();
  s.value = "ok";
  return JSON.stringify(n) + "|" + JSON.stringify(s);
}
