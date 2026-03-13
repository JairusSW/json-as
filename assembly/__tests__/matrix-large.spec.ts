import { JSON } from "..";
import { describe, expect } from "as-test";

describe("Should round-trip a dense signed integer matrix", () => {
  for (let i: i32 = -128; i <= 128; i++) {
    const text = i.toString();
    expect(JSON.stringify(JSON.parse<i32>(text))).toBe(text);
  }
});

describe("Should round-trip a dense unsigned integer matrix", () => {
  for (let i: u32 = 0; i <= 255; i++) {
    const text = i.toString();
    expect(JSON.stringify(JSON.parse<u32>(text))).toBe(text);
  }
});

describe("Should round-trip a dense float matrix", () => {
  for (let i: i32 = -64; i <= 64; i++) {
    const value = f64(i) + 0.5;
    const text = value.toString();
    expect(JSON.parse<f64>(text).toString()).toBe(value.toString());
  }
});

describe("Should round-trip a dense generated string matrix", () => {
  for (let i: i32 = 0; i < 96; i++) {
    const value = "case-" + i.toString() + "-line\\nbreak-\\t-quote-\"";
    const json = JSON.stringify<string>(value);
    expect(JSON.parse<string>(json)).toBe(value);
  }
});
