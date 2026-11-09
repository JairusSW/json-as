import { JSON as J } from "../../index";

@json class Item {
  value: i32 = 7;

  @serializer("number") encode(self: Item): string {
    return J.stringify(J.parse<i32>(self.value.toString()));
  }
}

@json class Outer {
  before: i32 = 1;
  item: Item = new Item();
  after: i32 = 2;
}
export function run(): string {
  return J.stringify(new Outer());
}
