import { JSON } from "../..";

@json class Holder {
  value!: JSON.Lazy<JSON.Box<i32>>;
}

@json class Generic<T> {
  value!: JSON.Lazy<T>;
}
export function run(): string {
  assert(new Holder().value.value == 0);
  assert(JSON.parse<Generic<JSON.Box<i32>>>("{}").value.value == 0);
  assert(JSON.parse<Generic<JSON.Box<i32>>>('{"value":7}').value.value == 7);
  return JSON.stringify(JSON.parse<Holder>('{"value":7}'));
}
