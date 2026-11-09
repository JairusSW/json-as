import { JSON } from "../../index";
class Encoder {
  stringify(value: i32): string {
    return value.toString();
  }
}

@json class Item {
  value: i32 = 7;

  @serializer("number") encode(self: Item): string {
    const JSON = new Encoder();
    return JSON.stringify(self.value);
  }
}
export function run(): string {
  return JSON.stringify(new Item());
}
