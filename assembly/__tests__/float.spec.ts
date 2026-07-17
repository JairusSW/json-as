import { JSON } from "..";
import { describe, expect } from "as-test";
import { eiselLemire22, eiselLemireMinus14 } from "../util/eisel-lemire";


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
  // Serialization follows ECMAScript Number::toString (matches
  // JSON.stringify(JSON.parse(x))): whole values render without a ".0" suffix.
  expect(JSON.stringify<f64>(7.23)).toBe("7.23");

  expect(JSON.stringify<f64>(10e2)).toBe("1000");

  expect(JSON.stringify<f64>(123456e-5)).toBe("1.23456");

  expect(JSON.stringify<f64>(0.0)).toBe("0");

  expect(JSON.stringify<f64>(-7.23)).toBe("-7.23");

  expect(JSON.stringify<f64>(1e-6)).toBe("0.000001");

  expect(JSON.stringify<f64>(1e-7)).toBe("1e-7");

  expect(JSON.stringify<f64>(1e20)).toBe("100000000000000000000");

  expect(JSON.stringify<f64>(1e21)).toBe("1e+21");

  // f32 round-trips exercise the serializeFloat32 / xjb path.
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
  expect(JSON.stringify<f64>(1000.0)).toBe("1000");
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

describe("Eisel-Lemire medium-exponent conversion is bit-identical", () => {
  // FNV-1a hashes of the raw IEEE-754 results for 256 deterministic mantissas
  // per exponent, generated independently with V8's correctly-rounded decimal
  // parser. This covers the branch above 2^53 without relying on AS's legacy
  // `scientific()` conversion (which is itself occasionally one ULP off).
  const expected: u64[] = [
    0x7488c1b45bc974a5, 0x062461a248ac1323, 0x7c4a28fa32e7a16a,
    0x7996a8b0e1aec7d0, 0x91746b3370d54425, 0x4b1da780e1544a98,
    0xa95c33f4f92d3577, 0x7d483b197cd7df5d, 0xd284fd2ff4ca1e0f,
    0x9ee7f049ca8491df, 0xf8b2542275ceda5c, 0x0dc154ea6930e163,
    0xd035e00dfd90c25e, 0xdbf7ebbe025c7b0e, 0x422c453f328aed00,
    0x8f6893c18541d638, 0xd71a2ce63040b130, 0xf0a73187adc792c2,
    0x8f33718fcd52c119, 0x7d0203a3f4f0274c, 0xd39e05f126f64d0a,
    0x1007c5ff39056a08, 0x28f85148d1b72053, 0x73fb74de2fa9e84e,
    0xc454d689536e57ee, 0x514108b4d4d81964, 0x92771f914b5263fe,
    0x17bff9d392bc2e3e, 0x99d61380189e144d, 0x904b1dedd0cf79f7,
    0xb6a5904ebca20b9f, 0x4dc5bd621fa587b8, 0x6170889f333d3b54,
    0xdaad87a0739b7bc3, 0xdfa12d3ec5610a91, 0x40b1519813f89bc1,
    0xc71c1a8945fea9af, 0xb815cae4f69d80c4, 0x958d15fbec3628d6,
    0x7f2730ba99d0ab83, 0xfd4ed76dd9899520, 0xce8fe75803d07314,
    0xb79f695096d3f833, 0xdcad5c89b0fcb198, 0xa355ee4ac7de21a5,
  ];
  let state: u64 = 0x9e3779b97f4a7c15;
  for (let power = -22; power <= 22; power++) {
    let hash: u64 = 14695981039346656037;
    for (let i = 0; i < 256; i++) {
      state = state * 6364136223846793005 + 1442695040888963407;
      const significand = state | ((<u64>1) << 53);
      hash =
        (hash ^ reinterpret<u64>(eiselLemire22(significand, power))) *
        1099511628211;
    }
    expect<u64>(hash).toBe(unchecked(expected[power + 22]));
  }
});

describe("SWAR/SIMD float parsers use bit-identical medium-exponent conversion", () => {
  expect<u64>(reinterpret<u64>(JSON.parse<f64>("9007199254740993e-7"))).toBe(
    0x41cad7f29abcaf49,
  );

  const field = JSON.parse<FloatFieldBox>(
    '{"value64":9007199254740993e7,"value32":0}',
  );
  expect<u64>(reinterpret<u64>(field.value64)).toBe(0x44b312d000000001);
});

describe("Fixed -14 Eisel-Lemire conversion is bit-identical", () => {
  let state: u64 = 0x6a09e667f3bcc909;
  for (let i = 0; i < 1024; i++) {
    state = state * 6364136223846793005 + 1442695040888963407;
    const significand = state | ((<u64>1) << 53);
    expect<u64>(reinterpret<u64>(eiselLemireMinus14(significand))).toBe(
      reinterpret<u64>(eiselLemire22(significand, -14)),
    );
  }
});

describe("Should support more exponent forms", () => {
  expect(JSON.stringify(JSON.parse<f64>("3.14E5"))).toBe("314000");
  expect(JSON.stringify(JSON.parse<f64>("3.14e5"))).toBe("314000");
  expect(JSON.stringify(JSON.parse<f64>("3.15E-5"))).toBe("0.0000315");
  expect(JSON.parse<f64>("3.14e-5").toString()).toBe("0.0000314");
  expect(JSON.stringify(JSON.parse<f64>("-9.81E+2"))).toBe("-981");
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
  // f32 arrays go through the same dispatcher as f64 - this exercises the
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

// ─── helpers ──────────────────────────────────────────────────────────────────

@json
class Vec2CovGapFloat {
  x: f64 = 0;
  y: f64 = 0;
}


@json
class F32Holder {
  v: f32 = 0.0;
}


@json
class FloatArr {
  values: f64[] = [];
}

// ─── Serialize: @json class with f32 field ────────────────────────────────────

describe("Serialize: @json class with f32 field", () => {
  const h = new F32Holder();
  h.v = 1.5;
  expect(JSON.stringify(h)).toBe('{"v":1.5}');
  expect(JSON.parse<F32Holder>('{"v":3.14}').v.toString()).toBe(
    (<f32>3.14).toString(),
  );
});

// ─── swar/float.ts: deserializeFloatField_SWAR exponent paths ─────────────────

describe("SWAR: f64 struct field with positive exponent covers exponent block", () => {
  const v = JSON.parse<Vec2CovGapFloat>('{"x":1.5e2,"y":3.0e0}');
  expect(v.x).toBe(150.0);
  expect(v.y).toBe(3.0);
});

describe("SWAR: f64 struct field with plus-sign exponent covers ASCII_PLUS branch", () => {
  const v = JSON.parse<Vec2CovGapFloat>('{"x":2.0e+1,"y":5.0e+0}');
  expect(v.x).toBe(20.0);
  expect(v.y).toBe(5.0);
});

describe("SWAR: f64 struct field with negative exponent covers ASCII_MINUS branch", () => {
  const v = JSON.parse<Vec2CovGapFloat>('{"x":1.5e-2,"y":2.0e-1}');
  expect(v.x).toBeCloseTo(0.015);
  expect(v.y).toBeCloseTo(0.2);
});

describe("SWAR: f64 struct field with large exponent covers scientific fallback path", () => {
  const v = JSON.parse<Vec2CovGapFloat>('{"x":1e100,"y":2e-100}');
  expect(isFinite(v.x)).toBe(true);
  expect(v.x).toBeCloseTo(1e100);
});

describe("SWAR: f64 struct field with >19 mantissa digits covers fallbackField", () => {
  const v = JSON.parse<Vec2CovGapFloat>('{"x":1.23456789012345678901,"y":0.0}');
  expect(v.x).toBeCloseTo(1.2345678901234568);
  expect(v.y).toBe(0.0);
});

// ─── swar/float.ts: deserializeFloat_SWAR exponent loop non-digit break ──────

describe("SWAR: standalone f64 with trailing space after exponent covers d>9 break", () => {
  expect(JSON.parse<f64>("1e5 ").toString()).toBe((1e5).toString());
});

describe("SWAR: standalone f64 with 5-digit exponent covers expDigits>4 standalone path", () => {
  expect(!isFinite(JSON.parse<f64>("1e55555"))).toBe(true);
});

// ─── swar/float.ts: fallbackField f32 path ────────────────────────────────────

describe("SWAR: f32 struct field with >19 mantissa digits covers fallbackField f32 branch", () => {
  const h = JSON.parse<F32Holder>('{"v":1.23456789012345678901}');
  expect(h.v).toBeCloseTo(<f32>1.2345678901234568);
});

// ─── swar/float.ts: deserializeFloatField_SWAR 5-digit exponent path ──────────

describe("SWAR: f64 struct field with 5-digit exponent covers expDigits>4 in struct", () => {
  const v = JSON.parse<Vec2CovGapFloat>('{"x":1e55555,"y":0.0}');
  expect(!isFinite(v.x)).toBe(true);
  expect(v.y).toBe(0.0);
});

// ─── f64[] as @json field → deserializeFloatArrayBody ────────────────────────

describe("SWAR: f64[] as @json class field round-trips", () => {
  const f = JSON.parse<FloatArr>('{"values":[1.5,-2.5,0]}');
  expect(f.values.length).toBe(3);
  expect(f.values[0]).toBe(1.5);
});

describe("SWAR: f64[] empty array as @json class field", () => {
  const f = JSON.parse<FloatArr>('{"values":[]}');
  expect(f.values.length).toBe(0);
});

describe("SWAR: f64[] with large exponent triggers scientific() path", () => {
  const f = JSON.parse<FloatArr>('{"values":[1e25,5e-25]}');
  expect(f.values.length).toBe(2);
  expect(f.values[0]).toBe(1e25);
});

describe("SWAR: f64[] reparse with fewer elements (resize)", () => {
  const f = JSON.parse<FloatArr>('{"values":[1.1,2.2,3.3]}');
  expect(f.values.length).toBe(3);
  const f2 = JSON.parse<FloatArr>('{"values":[9.9]}', f);
  expect(f2.values.length).toBe(1);
  expect(f2.values[0]).toBe(9.9);
});

// swar/array/float.ts: fallbackStore via >19-digit mantissa
describe("SWAR: f64[] with >19 mantissa digits triggers fallbackStore", () => {
  const f = JSON.parse<f64[]>("[1.12345678901234567890]");
  expect(f.length).toBe(1);
});

// swar/array/float.ts: parseFloatElementSWAR exponent paths
describe("SWAR: f64[] with e+ notation covers parseFloatElementSWAR positive-exponent path", () => {
  const a = JSON.parse<f64[]>("[1e5,2e+3,3e-1]");
  expect(a.length).toBe(3);
  expect(a[0]).toBe(100000.0);
  expect(a[1]).toBe(2000.0);
  expect<f64>(a[2]).toBeCloseTo(0.3);
});

describe("SWAR: f32[] with >19 mantissa digits covers fallbackStore f32 path", () => {
  const a = JSON.parse<f32[]>("[1.12345678901234567890]");
  expect(a.length).toBe(1);
  expect<f32>(a[0]).toBeCloseTo(1.1234568);
});

describe("SWAR: f64[] with 5-digit exponent covers parseFloatElementSWAR expDigits>4 fallback", () => {
  const a = JSON.parse<f64[]>("[1e55555]");
  expect(a.length).toBe(1);
  expect(!isFinite(a[0])).toBe(true);
});

// swar/float.ts + simd/float.ts: expDigits == 0 return expStart
// A struct float field like "1e," has a bare exponent with no following digits.
// In SWAR/SIMD mode the field parser reaches the `if (expDigits == 0)` guard and
// returns expStart (the fallback picks up `1` as the value).
describe("SWAR/SIMD: float field with bare exponent (no digits) covers expDigits==0 return path", () => {
  const v = JSON.parse<Vec2CovGapFloat>('{"x":1e,"y":0}');
  expect(v.y).toBe(0.0);
});

// simd/float.ts: 16-digit SIMD mantissa stride loop
// deserializeFloat_SIMD enters the `while (p+30 < srcEnd && intDigits+fracDigits<=3)`
// loop only when the fractional part has ≥16 digits ahead. A 35-digit mantissa
// satisfies both guards and drives the loop body.
describe("SIMD: very long float covers 16-digit SIMD mantissa stride loop (lines 79-84)", () => {
  const v = JSON.parse<f64>("1.12345678901234567890123456789012345");
  expect(v > 1.0).toBe(true);
  expect(v < 2.0).toBe(true);
});

// simd/float.ts:81: parse16Digits boundary break
// For "1.23456789012345e6": intDigits=1, fracDigits=0, so
// (intDigits+fracDigits<=3) is TRUE and (p+30 < srcEnd) is TRUE (32 bytes
// remain). parse16Digits_SIMD reads 16 chars "23456789012345e6"; the 'e' at
// position 14 is not a digit → parsed==U64.MAX_VALUE → line 81 break → fallback.
describe("SIMD: 16-digit parse boundary break covers simd/float.ts:81", () => {
  const v = JSON.parse<f64>("1.23456789012345e6");
  expect(v).toBe(1234567.89012345);
});
