import { JSON } from "../..";
import { DeferredEnum, en } from "./private-model.fixture";

@json class Owner {
  value: DeferredEnum = en();
}
export function run(): string {
  return JSON.stringify(JSON.parse<Owner>('{"value":1}'));
}
