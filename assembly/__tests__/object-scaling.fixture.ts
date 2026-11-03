import { JSON } from "..";
let value = new JSON.Obj();
let output = "";
export function setup(n: i32, nested: bool): void {
  value = new JSON.Obj();
  for (let i = 0; i < n; i++) value.set<i32>("k" + i.toString(), i);
  if (nested) value.set("k0", new JSON.Obj());
  output = JSON.stringify(value);
}
export function run(): i32 {
  output = JSON.stringify(value);
  return output.length;
}

export function result(): string {
  return output;
}
