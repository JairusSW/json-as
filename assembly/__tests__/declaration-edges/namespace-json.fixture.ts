import { JSON as J } from "../../index";
namespace JSON {
  export function stringify(value: i32): string {
    return value.toString();
  }
}

@json class Item {
  value: i32 = 7;

  @serializer("number") encode(self: Item): string {
    return JSON.stringify(self.value);
  }
}
export function run(): string {
  return J.stringify(new Item());
}
