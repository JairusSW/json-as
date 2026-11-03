import { JSON } from "..";
import { describe, expect } from "as-test";

describe("wide unsigned getType compiles", () => {
  expect(JSON.Value.empty().getType<u64>(42)).toBe(JSON.Types.U64);
  expect(JSON.Value.empty().getType<usize>(0)).toBe(JSON.Types.Null);
});
