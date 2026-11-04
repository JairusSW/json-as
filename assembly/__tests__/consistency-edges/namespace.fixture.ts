import { JSON } from "../..";
namespace Model {
  type Numbers = Array<i32>;
  enum Kind {
    Off,
    On,
  }

  @json class Item {
    n: i32 = 3;
  }
  type ObjectAlias = Item;

  @json export class Base {
    value: Numbers = [1, 2];
    kind: Kind = Kind.On;
    item: ObjectAlias = new Item();
  }
}

@json class Child extends Model.Base {
  tail: i32 = 9;
}
export function run(): string {
  return JSON.stringify(new Child());
}
