import { JSON } from "..";


@json class ScalarChild {
  value: i32 = 1;
}
const scalar = new JSON.Obj();
const mapChild = new JSON.Obj();
const structChild = new JSON.Obj();
export function setup(length: i32): void {
  for (let i = 0; i < length; i++) {
    const key = "k" + i.toString();
    scalar.set<i32>(key, i);
    mapChild.set<i32>(key, i);
    structChild.set<i32>(key, i);
  }
  mapChild.set<Map<string, JSON.Value>>("child", new Map<string, JSON.Value>());
  structChild.set<ScalarChild>("child", new ScalarChild());
}
export function run(kind: i32): string {
  return JSON.stringify(
    kind == 0 ? scalar : kind == 1 ? mapChild : structChild,
  );
}
