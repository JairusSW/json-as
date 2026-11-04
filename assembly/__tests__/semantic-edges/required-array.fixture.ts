import { JSON } from "../..";

@json class Custom extends Array<JSON.Value> {
  marker: i32;
  constructor(marker: i32) {
    super();
    this.marker = marker;
  }

  @serializer("string") encode(_self: Custom): string {
    return '"custom"';
  }
}
export function run(): string {
  const original = new Custom(7);
  const boxed = JSON.Value.from(original);
  assert(changetype<usize>(boxed.get<Custom>()) == changetype<usize>(original));
  assert(changetype<usize>(boxed.as<Custom>()) == changetype<usize>(original));
  const obj = new JSON.Obj();
  obj.set("x", original);
  assert(
    changetype<usize>(obj.getAs<Custom>("x")) == changetype<usize>(original),
  );
  const arr = new JSON.Arr();
  arr.push(original);
  assert(
    changetype<usize>(arr.getAs<Custom>(0)) == changetype<usize>(original),
  );
  return boxed.get<Custom>().marker.toString();
}
