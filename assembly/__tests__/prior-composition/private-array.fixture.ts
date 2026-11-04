import { JSON } from "../..";
import { PublicArray, make } from "./private-model.fixture";

@json class Owner {
  value: PublicArray = make();
}
export function run(): string {
  return JSON.stringify(JSON.parse<Owner>('{"value":[{"value":9}]}'));
}
