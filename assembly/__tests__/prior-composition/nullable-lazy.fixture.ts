import { JSON } from "../..";
import { PublicMaybeLazy } from "./private-model.fixture";

@json class Owner {
  value!: PublicMaybeLazy;
}
export function run(): string {
  return JSON.stringify(JSON.parse<Owner>("{}"));
}
