import { JSON } from "..";
import { describe, expect } from "./lib";

describe("Should serialize null", () => {
  expect(JSON.stringify(null)).toBe("null");
});

describe("Should serialize nullable classes", () => {
  expect(JSON.stringify<Nullable | null>(null)).toBe("null");
});

class Nullable {}
