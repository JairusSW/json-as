import { JSON } from "../..";
import { Model } from "./namespace-private-model.fixture";

@json class Child extends Model.Base {
  tail: i32 = 9;
}
export function run(): string {
  return JSON.stringify(JSON.parse<Child>('{"value":{"value":5},"tail":9}'));
}
