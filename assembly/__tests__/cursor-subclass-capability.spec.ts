import { JSON } from "..";
import { describe, expect } from "as-test";


@json class NumberCodec {
  n: i32 = 0;


  @deserializer("number") decode(source: string): NumberCodec {
    const out = new NumberCodec();
    out.n = JSON.parse<i32>(source);
    return out;
  }
}


@json class MapOwner extends Map<string, i32> {
  value: NumberCodec = new NumberCodec();
}


@json class BytesOwner extends Uint8Array {
  value: NumberCodec = new NumberCodec();
  constructor() {
    super(0);
  }
}
describe("decorated builtin capability follows the complete schema", () => {
  expect(JSON.parse<MapOwner>('{"value":7}').value.n).toBe(7);
  expect(JSON.parse<BytesOwner>('{"value":7}').value.n).toBe(7);
});
