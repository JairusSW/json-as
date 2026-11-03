import { JSON } from "..";
import { describe, expect } from "as-test";


@json class CustomMap extends Map<string, i32> {
  text: string = "";


  @deserializer("string") decode(source: string): CustomMap {
    const out = new CustomMap();
    out.text = JSON.parse<string>(source);
    return out;
  }
}
describe("static array element overrides precede builtins", () => {
  expect(JSON.parse<StaticArray<CustomMap>>('["hello"]')[0].text).toBe("hello");
});
