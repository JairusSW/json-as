import { JSON as Json } from "json-as";

@json class RawOwner {
  value: Json.Raw = Json.Raw.from("99");
}

@json class ValueOwner {
  value: Json.Value = Json.Value.from<i32>(99);
}
export function run(): string {
  const a = Json.parse<RawOwner>('{"value":7}', new RawOwner());
  const b = Json.parse<ValueOwner>('{"value":7}', new ValueOwner());
  return Json.stringify(a) + ":" + Json.stringify(b);
}
