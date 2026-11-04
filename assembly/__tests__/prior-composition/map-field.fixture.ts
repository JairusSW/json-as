import { JSON } from "../..";
class Numbers extends Map<string, i32> {}

@json class Owner {
  value: Numbers = new Numbers();
}
export function run(): string {
  return JSON.stringify(JSON.parse<Owner>('{"value":{"x":1}}'));
}
