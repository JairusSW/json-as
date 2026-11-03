import { JSON } from "..";
let values = new JSON.Arr();
let output = "";
export function setup(length: i32): void {
  values = new JSON.Arr();
  for (let i = 0; i < length; i++) values.push<string>("value-" + i.toString());
}
export function run(): string {
  output = values.join("|");
  return output;
}
