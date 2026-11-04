import { JSON } from "../..";
import { DeferredArray, array } from "./private-model.fixture";

@json class Owner {
  value: DeferredArray = array();
}
export function run(): string {
  return JSON.stringify(JSON.parse<Owner>('{"value":[{"value":9}]}'));
}
