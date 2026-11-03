import { JSON } from "..";
import { describe, expect } from "as-test";

describe("primitive array maps compile through conversion fallback", () => {
  const map = new Map<string, i32[]>();
  map.set("items", [1, 2]);
  expect(JSON.stringify(JSON.Obj.from(map))).toBe('{"items":[1,2]}');
});
