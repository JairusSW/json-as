import { JSON } from "../..";
import { DeferredGeneric, generic } from "./private-model.fixture";

@json class Owner {
  value: DeferredGeneric<i32> = generic();
}
export function run(): string {
  return JSON.stringify(JSON.parse<Owner>('{"value":{"value":9}}'));
}
