import { JSON } from "..";
import { describe, expect } from "as-test";
class SeededRows extends Map<string, i32> {
  constructor() {
    super();
    this.set("seed", 99);
  }
}
describe("seeded map replacement composes through arrays", () => {
  expect(JSON.parse<SeededRows>('{"x":1}').size).toBe(1);
  expect(JSON.parse<SeededRows[]>('[{"x":1}]')[0].size).toBe(1);
  expect(JSON.parse<SeededRows[]>("[{}]")[0].size).toBe(0);
  expect(JSON.parse<StaticArray<SeededRows>>('[{"x":1}]')[0].size).toBe(1);
});
