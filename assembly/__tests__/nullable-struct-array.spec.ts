import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class ReviewNullableItem {
  n: i32 = 0;
}


@json
class ReviewNullableHolder {
  items: (ReviewNullableItem | null)[] = [];
}

describe("Review: nullable generated struct elements", () => {
  const values = JSON.parse<(ReviewNullableItem | null)[]>(
    '[null,{"n":1},null]',
  );
  expect(values.length).toBe(3);
  expect(values[0] === null).toBe(true);
  expect(values[1]!.n).toBe(1);
  expect(values[2] === null).toBe(true);
  JSON.parse<(ReviewNullableItem | null)[]>('[{"n":2},null,{"n":3}]', values);
  expect(values[0]!.n).toBe(2);
  expect(values[1] === null).toBe(true);
  expect(values[2]!.n).toBe(3);
  const holder = JSON.parse<ReviewNullableHolder>('{"items":[null,{"n":1}]}');
  expect(holder.items[0] === null).toBe(true);
  expect(holder.items[1]!.n).toBe(1);
});
