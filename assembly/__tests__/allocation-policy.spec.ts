import { JSON } from "..";
import { sc } from "../../lib/as-bs";
import { describe, expect } from "as-test";
import { TOTAL_OVERHEAD } from "rt/common";
describe("disabled cache has no arena storage", () => {
  if (!sc.CACHE_ENABLED) expect(sc.arena.byteLength).toBe(0);
});
describe("changing medium outputs retain bounded capacity", () => {
  JSON.stringify("a".repeat(32_768));
  const value = JSON.stringify("b".repeat(35_000));
  const capacity = load<u32>(changetype<usize>(value) - TOTAL_OVERHEAD) & ~3;
  expect(capacity <= <u32>value.length * 4).toBe(true);
});
describe("root array capacity follows element counts rather than token lengths", () => {
  const values = JSON.parse<string[]>('["' + "a".repeat(12_288) + '"]');
  expect(
    load<i32>(changetype<usize>(values), offsetof<string[]>("byteLength")) <=
      256,
  ).toBe(true);
  const numbers = JSON.parse<f64[]>(
    "[" + "1.1234567890123456,".repeat(99) + "1.1234567890123456]",
  );
  expect(
    load<i32>(changetype<usize>(numbers), offsetof<f64[]>("byteLength")) <=
      2048,
  ).toBe(true);
});
