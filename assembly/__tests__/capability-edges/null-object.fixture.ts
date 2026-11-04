import { JSON } from "../..";
export function run(): string {
  const map = new Map<string | null, i32>();
  map.set(null, 7);
  return JSON.stringify(JSON.Obj.from(map));
}
