import { JSON } from "..";


@json class TinyOwnership {
  n: i32 = 0;
}
const out = new TinyOwnership();
export function run(kind: i32): i32 {
  if (kind == 0) return JSON.parse<i32>("123");
  if (kind == 1) return <i32>JSON.parse<bool>("true");
  if (kind == 2) return JSON.parse<TinyOwnership>('{"n":7}', out).n;
  return JSON.parse<TinyOwnership>('{"n":7}').n;
}
