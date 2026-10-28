import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class ReviewQuotedItem {
  text: string = "";
}

describe("Review: static struct arrays scan complete quoted values", () => {
  const text = '[{"text":"}"},{"text":"{"}]';
  const values = JSON.parse<StaticArray<ReviewQuotedItem>>(text);
  expect(values.length).toBe(2);
  expect(values[0].text).toBe("}");
  expect(values[1].text).toBe("{");
  expect(JSON.stringify(values)).toBe(text);
});
