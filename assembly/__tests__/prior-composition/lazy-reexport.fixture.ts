import { JSON } from "../..";
import { PublicLazy, calls, make } from "./lazy-barrel.fixture";

@json class Owner {
  value: PublicLazy = make();
}
export function run(): string {
  const out = JSON.parse<Owner>('{"value":{"value":7}}');
  const before = calls;
  const value = out.value.value;
  return before.toString() + ":" + calls.toString() + ":" + value.toString();
}
