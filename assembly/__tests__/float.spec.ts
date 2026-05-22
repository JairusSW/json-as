import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class FloatFieldBox {
  value64: f64 = 0.0;
  value32: f32 = 0.0;
}


@json
class FloatArrayFieldBox {
  values: f64[] = [7.0];
}

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

  // f32 round-trips exercise serializeFloat32 / dragonbox_f32 path.
  expect(JSON.stringify<f32>(1.25)).toBe("1.25");
  expect(JSON.stringify<f32>(-3.5)).toBe("-3.5");
});

describe("Should deserialize floats", () => {
  expect(JSON.parse<f64>("7.23").toString()).toBe("7.23");

  expect(JSON.parse<f64>("1000.0").toString()).toBe("1000.0");

  expect(JSON.parse<f64>("1.23456").toString()).toBe("1.23456");

  expect(JSON.parse<f64>("0.0").toString()).toBe("0.0");

  expect(JSON.parse<f64>("-7.23").toString()).toBe("-7.23");

  expect(JSON.parse<f64>("0.000001").toString()).toBe("0.000001");

  expect(JSON.parse<f64>("1e-7").toString()).toBe((1e-7).toString());

  expect(JSON.parse<f64>("100000000000000000000.0").toString()).toBe(
    (1e20).toString(),
  );

  expect(JSON.parse<f64>("1e+21").toString()).toBe((1e21).toString());
});

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe(
    '"regression"',
  );
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe(
    '["a","b","c"]',
  );
});

describe("Should serialize additional float edge cases", () => {
  expect(JSON.stringify<f64>(-0.0000001)).toBe("-1e-7");
  expect(JSON.stringify<f64>(0.125)).toBe("0.125");
  expect(JSON.stringify<f64>(-0.125)).toBe("-0.125");
  expect(JSON.stringify<f64>(3.141592653589793)).toBe("3.141592653589793");
  expect(JSON.stringify<f64>(1000.0)).toBe("1000.0");
  expect(JSON.stringify<f64>(-123456789.25)).toBe("-123456789.25");
});

describe("Should deserialize additional float edge cases", () => {
  expect(JSON.parse<f64>("-1e-7").toString()).toBe((-1e-7).toString());
  expect(JSON.parse<f64>("3.141592653589793").toString()).toBe(
    (3.141592653589793).toString(),
  );
  expect(JSON.parse<f64>("-123456789.25").toString()).toBe("-123456789.25");
  expect(JSON.parse<f64>("42").toString()).toBe("42.0");
  expect(JSON.parse<f64>(" 42 ").toString()).toBe("42.0");
  expect(JSON.parse<f64>("1e0").toString()).toBe("1.0");
});

describe("Should support more exponent forms", () => {
  expect(JSON.stringify(JSON.parse<f64>("3.14E5"))).toBe("314000.0");
  expect(JSON.stringify(JSON.parse<f64>("3.14e5"))).toBe("314000.0");
  expect(JSON.stringify(JSON.parse<f64>("3.15E-5"))).toBe("0.0000315");
  expect(JSON.parse<f64>("3.14e-5").toString()).toBe("0.0000314");
  expect(JSON.stringify(JSON.parse<f64>("-9.81E+2"))).toBe("-981.0");
  expect(JSON.parse<f64>("6.022e23").toString()).toBe("6.022e+23");
});

describe("Should parse the pow10 lookup table across the f64 range", () => {
  // Each entry below targets a different bucket in `pow10Fast` (the SWAR
  // float deserializer's exponent table) and the tiered exponent in
  // `deserializeFloat`. Going through JSON.parse hits whichever mode is
  // active.
  expect(JSON.parse<f64>("1e4").toString()).toBe((1e4).toString());
  expect(JSON.parse<f64>("1e8").toString()).toBe((1e8).toString());
  expect(JSON.parse<f64>("1e10").toString()).toBe((1e10).toString());
  expect(JSON.parse<f64>("1e11").toString()).toBe((1e11).toString());
  expect(JSON.parse<f64>("1e12").toString()).toBe((1e12).toString());
  expect(JSON.parse<f64>("1e13").toString()).toBe((1e13).toString());
  expect(JSON.parse<f64>("1e14").toString()).toBe((1e14).toString());
  expect(JSON.parse<f64>("1e16").toString()).toBe((1e16).toString());
  expect(JSON.parse<f64>("1e17").toString()).toBe((1e17).toString());
  expect(JSON.parse<f64>("1e18").toString()).toBe((1e18).toString());
  expect(JSON.parse<f64>("1e32").toString()).toBe((1e32).toString());
  expect(JSON.parse<f64>("1e64").toString()).toBe((1e64).toString());
  expect(JSON.parse<f64>("1e128").toString()).toBe((1e128).toString());
  expect(isNaN(JSON.parse<f64>("1e256"))).toBe(false);

  expect(JSON.parse<f64>("3.125e+2").toString()).toBe("312.5");
  expect(JSON.parse<f64>("3.125e-2").toString()).toBe("0.03125");

  // NaN through both f32 and f64 paths.
  expect(JSON.parse<f32>("NaN").toString()).toBe("NaN");
  expect(JSON.parse<f64>("NaN").toString()).toBe("NaN");
});

describe("Should populate f64/f32 struct fields with default-offset stores", () => {
  // Drives the float field helpers through the transform-generated
  // __DESERIALIZE_FAST: the first field uses the default `dstOffset = 0`
  // store; `value32` carries a non-zero offset so the f32 store branch
  // fires.
  const box = JSON.parse<FloatFieldBox>(
    '{"value64":-9500.0,"value32":0.00125}',
  );
  expect(box.value64).toBe(-9500.0);
  expect(box.value32).toBe(<f32>0.00125);

  const wide = JSON.parse<FloatFieldBox>(
    '{"value64":35000000000.0,"value32":3.5}',
  );
  expect(wide.value64).toBe(35000000000.0);
  expect(wide.value32).toBe(<f32>3.5);
});

describe("Should handle float whitespace and nested containers", () => {
  expect(JSON.stringify(JSON.parse<f64[]>("[1.5,-2.25,3.125]"))).toBe(
    "[1.5,-2.25,3.125]",
  );
  expect(JSON.stringify(JSON.parse<f64[]>("[ 1.5 , -2.25 , 3.125 ]"))).toBe(
    "[1.5,-2.25,3.125]",
  );
  expect(JSON.stringify(JSON.parse<f64[][]>("[[1.5],[-2.25,3.125],[]]"))).toBe(
    "[[1.5],[-2.25,3.125],[]]",
  );
});

describe("Should round-trip float array fields via @json struct envelopes", () => {
  const populated = JSON.parse<FloatArrayFieldBox>('{"values":[4.5,6.75]}');
  expect(populated.values.length).toBe(2);
  expect(populated.values[0]).toBe(4.5);
  expect(populated.values[1]).toBe(6.75);

  const spaced = JSON.parse<FloatArrayFieldBox>(
    '{"values":[ 1.25 , -9.5e+3 ]}',
  );
  expect(spaced.values.length).toBe(2);
  expect(spaced.values[0]).toBe(1.25);
  expect(spaced.values[1]).toBe(-9500.0);
});

describe("Should round-trip f32 arrays through JSON.parse", () => {
  // f32 arrays go through the same dispatcher as f64 — this exercises the
  // `sizeof<E>() == sizeof<f32>()` branch in the SWAR float parser and the
  // f32 store path through every mode.
  expect(JSON.stringify(JSON.parse<f32[]>("[0.5,1.25,-3.75]"))).toBe(
    "[0.5,1.25,-3.75]",
  );
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe(
    "[[1],[2,3],[]]",
  );
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe(
    '"line\\nbreak"',
  );
});
