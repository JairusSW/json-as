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
