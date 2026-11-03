import { JSON } from "..";
import { describe, expect } from "as-test";


@json class Token {
  n: i32 = 0;


  @deserializer("number") decode(source: string): this {
    const out = new Token();
    out.n = JSON.parse<i32>(source);
    return changetype<this>(out);
  }
}
namespace Model {

  @json export class Token {
    value: string = "local";


    @deserializer("string") decode(source: string): this {
      const out = new Token();
      out.value = JSON.parse<string>(source);
      return changetype<this>(out);
    }
  }


  @json export class Record {
    token: Token = new Token();
  }


  @json export class Qualified {
    token: Model.Token = new Token();
  }
}
describe("lexical namespace selects the matching codec", () => {
  expect(JSON.parse<Model.Record>('{"token":"updated"}').token.value).toBe(
    "updated",
  );
  expect(JSON.parse<Model.Qualified>('{"token":"updated"}').token.value).toBe(
    "updated",
  );
});
