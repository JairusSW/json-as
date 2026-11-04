import { JSON } from "../..";
import { Middle } from "./ancestor-model.fixture";

@json class Leaf extends Middle {
  leaf: i32 = 4;
}
export function run(): string {
  assert(JSON.stringify(new Leaf()) == '{"wire":"seed","middle":3,"leaf":4}');
  const out = JSON.parse<Leaf>('{"wire":"updated","middle":8,"leaf":9}');
  assert(out.value == "updated");
  return JSON.stringify(out);
}
