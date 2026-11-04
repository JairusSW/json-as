import { JSON } from "../..";
import { PublicState } from "./private-model.fixture";

@json class Owner {
  value: PublicState = 0;
}
export function run(): string {
  return JSON.stringify(JSON.parse<Owner>('{"value":1}'));
}
