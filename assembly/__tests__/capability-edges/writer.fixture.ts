import { JSON } from "../..";

@json class Inner {
  value: i32 = 0;

  @serializer("object") encode(self: Inner): string {
    return '{"value":' + self.value.toString() + "}";
  }
}

@json class Outer {
  inner: Inner = new Inner();
}
export function run(reuse: bool): string {
  assert(JSON.parse<Inner>('{"value":7}').value == 7);
  return JSON.stringify(
    JSON.parse<Outer>(
      '{"inner":{"value":7}}',
      reuse ? new Outer() : changetype<Outer>(0),
    ),
  );
}
