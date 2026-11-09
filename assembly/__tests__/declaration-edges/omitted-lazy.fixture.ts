import { JSON } from "../../index";

@json class Base {
  value: JSON.Lazy<i32> = 1;
}

@json class Child extends Base {

  @omit value: JSON.Lazy<i32> = 2;
  tail: i32 = 3;
}
export function run(): string {
  const out = JSON.parse<Child>('{"tail":9}');
  return (
    JSON.stringify(new Child()) +
    "|" +
    out.value.toString() +
    ":" +
    out.tail.toString()
  );
}
