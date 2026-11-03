import { JSON } from "..";
import { describe, expect } from "as-test";


@json class CustomMap extends Map<string, i32> {

  @deserializer("string") decode(source: string): CustomMap {
    const out = new CustomMap();
    out.set("value", JSON.parse<string>(source).length);
    return out;
  }
}


@json class CustomBytes extends Uint8Array {
  value: i32 = 7;
  constructor() {
    super(0);
  }
}


@json class BytesOwner {
  child: CustomBytes = new CustomBytes();
}
describe("custom built-in subclasses compose inside arrays", () => {
  expect(JSON.parse<CustomMap>('"hello"').get("value")).toBe(5);
  expect(JSON.parse<CustomMap[]>('["hello"]')[0].get("value")).toBe(5);
});
describe("ordinary typed arrays compose in default mode", () => {
  const result = JSON.parse<Uint8Array[]>("[[1,2,3]]");
  expect(result.length).toBe(1);
  expect(result[0][2]).toBe(3);
});
describe("decorated typed arrays compose inside checked objects", () => {
  expect(JSON.parse<CustomBytes>('{"value":9}').value).toBe(9);
  expect(JSON.parse<BytesOwner>('{"child":{"value":9}}').child.value).toBe(9);
});


@json class PlainTypedArrayOwner {
  items: Uint8Array[] = [];
}


@json class CustomMapOwner {
  value: CustomMap = new CustomMap();
  items: CustomMap[] = [];
}
describe("representations agree in fields, arrays, and map values", () => {
  expect(
    JSON.parse<PlainTypedArrayOwner>('{"items":[[1,2,3]]}').items[0][2],
  ).toBe(3);
  const custom = JSON.parse<CustomMapOwner>('{"value":"hi","items":["hello"]}');
  expect(custom.value.get("value")).toBe(2);
  expect(custom.items[0].get("value")).toBe(5);
  expect(
    JSON.parse<Map<string, CustomMap>>('{"x":"hello"}').get("x").get("value"),
  ).toBe(5);
  expect(JSON.parse<Map<string, Uint8Array>>('{"x":[1,2,3]}').get("x")[2]).toBe(
    3,
  );
  expect(
    JSON.parse<Map<string, CustomBytes>>('{"x":{"value":9}}').get("x").value,
  ).toBe(9);
});
