import { JSON } from "../../index";
function one(): i32 {
  type Local = i32;
  const value: Local = 7;
  return value;
}
function two(): i32 {
  type Local = string;
  const value: Local = "ok";
  return value.length;
}

@json class Row {
  value: i32 = one() + two();
}
export function run(): string {
  return JSON.stringify(new Row());
}
