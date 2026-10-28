import { describe, expect } from "as-test";
import { resizeStaticArray } from "../util/resizeStaticArray";

describe("StaticArray reference regrowth clears slots before decoding allocates", () => {
  let values = resizeStaticArray<StaticArray<string>>(0, 33);
  for (let i = 0; i < values.length; i++)
    values[i] = "allocated-" + i.toString();
  values = resizeStaticArray<StaticArray<string>>(changetype<usize>(values), 0);
  __collect();
  values = resizeStaticArray<StaticArray<string>>(
    changetype<usize>(values),
    17,
  );
  for (let i = 0; i < values.length; i++) {
    expect(
      load<usize>(
        changetype<usize>(values) + ((<usize>i) << alignof<string>()),
      ),
    ).toBe(0);
  }
  // This collection occurs before any newly exposed slot is populated.
  __collect();
  for (let i = 0; i < values.length; i++) values[i] = "new-" + i.toString();
  __collect();
  expect(values[16]).toBe("new-16");
});
