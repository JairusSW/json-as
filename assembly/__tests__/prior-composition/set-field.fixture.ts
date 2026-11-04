import { JSON } from "../..";
class Numbers extends Set<i32> {}

@json class Owner {
  value: Numbers = new Numbers();
}
export function run(): string {
  return JSON.stringify(JSON.parse<Owner>('{"value":[1,2]}'));
}
