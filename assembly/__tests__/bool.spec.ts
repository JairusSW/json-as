import { JSON } from "..";
import { describe, expect } from "./lib";

describe("Should serialize booleans", () => {
  expect(JSON.stringify<bool>(true)).toBe("true");
  expect(JSON.stringify<bool>(false)).toBe("false");
});

describe("Should deserialize booleans", () => {
  expect(JSON.parse<boolean>("true").toString()).toBe("true");
  expect(JSON.parse<boolean>("false").toString()).toBe("false");
});
