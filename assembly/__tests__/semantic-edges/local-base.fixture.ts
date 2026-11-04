import { JSON } from "../..";
class Base {
  value: i32 = 7;
}

@json class Child extends Base {
  tail: i32 = 9;
}
export function run(): string {
  assert(new Child().value == 7);
  return JSON.stringify(JSON.parse<Child>('{"value":5,"tail":9}'));
}
