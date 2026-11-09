import { JSON } from "../..";
import { GrowingObject, makeObjectJson } from "./object-workload";

export function verify(target: i32): i32 {
  const input = makeObjectJson(target);
  const value = JSON.parse<GrowingObject>(input);
  if (JSON.stringify(value) != input) unreachable();
  return value.records.length;
}
