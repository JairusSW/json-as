import { JSON } from "..";
import { describe, expect } from "./lib";

describe("Should serialize floats", () => {
  expect(JSON.stringify<f64>(7.23)).toBe("7.23");

  expect(JSON.stringify<f64>(10e2)).toBe("1000.0");

  expect(JSON.stringify<f64>(123456e-5)).toBe("1.23456");

  expect(JSON.stringify<f64>(0.0)).toBe("0.0");

  expect(JSON.stringify<f64>(-7.23)).toBe("-7.23");

  expect(JSON.stringify<f64>(1e-6)).toBe("0.000001");

  expect(JSON.stringify<f64>(1e-7)).toBe("1e-7");

  expect(JSON.stringify<f64>(1e20)).toBe("100000000000000000000.0");

  expect(JSON.stringify<f64>(1e21)).toBe("1e+21");
});

describe("Should deserialize floats", () => {
  expect(JSON.parse<f64>("7.23").toString()).toBe("7.23");

  expect(JSON.parse<f64>("1000.0").toString()).toBe("1000.0");

  expect(JSON.parse<f64>("1.23456").toString()).toBe("1.23456");

  expect(JSON.parse<f64>("0.0").toString()).toBe("0.0");

  expect(JSON.parse<f64>("-7.23").toString()).toBe("-7.23");

  expect(JSON.parse<f64>("0.000001").toString()).toBe("0.000001");

  expect(JSON.parse<f64>("1e-7").toString()).toBe((1e-7).toString());

  expect(JSON.parse<f64>("100000000000000000000.0").toString()).toBe((1e20).toString());

  expect(JSON.parse<f64>("1e+21").toString()).toBe((1e21).toString());
});

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe('"regression"');
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe('["a","b","c"]');
});

describe("Should serialize additional float edge cases", () => {
  expect(JSON.stringify<f64>(-0.0000001)).toBe("-1e-7");
  expect(JSON.stringify<f64>(3.141592653589793)).toBe("3.141592653589793");
  expect(JSON.stringify<f64>(-123456789.25)).toBe("-123456789.25");
});

describe("Should deserialize additional float edge cases", () => {
  expect(JSON.parse<f64>("-1e-7").toString()).toBe((-1e-7).toString());
  expect(JSON.parse<f64>("3.141592653589793").toString()).toBe((3.141592653589793).toString());
  expect(JSON.parse<f64>("-123456789.25").toString()).toBe("-123456789.25");
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
