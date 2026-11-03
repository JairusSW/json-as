import { JSON } from "..";
import { describe, expect } from "as-test";
namespace NumberAlias {
  export type Value = i32;


  @json export class Model {
    value: Value = 0;
  }
}
namespace StringAlias {
  export type Value = string;


  @json export class Model {
    value: Value = "";
  }
}
describe("namespace aliases retain distinct identity", () => {
  expect(JSON.parse<NumberAlias.Model>('{"value":7}').value).toBe(7);
  expect(JSON.parse<StringAlias.Model>('{"value":"x"}').value).toBe("x");
});
