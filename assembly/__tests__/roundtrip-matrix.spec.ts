import { JSON } from "..";
import { describe, expect } from "as-test";
import { Vec3 } from "./types";


@json
class MatrixEnvelope {
  id: i32 = 0;
  label: string = "";
  flags: bool[] = [];
  values: f64[] = [];
  pos: Vec3 | null = null;
}

describe("Should round-trip a broad integer matrix", () => {
  expect(JSON.stringify(JSON.parse<i64>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<i64>("1"))).toBe("1");
  expect(JSON.stringify(JSON.parse<i64>("-1"))).toBe("-1");
  expect(JSON.stringify(JSON.parse<i64>("12"))).toBe("12");
  expect(JSON.stringify(JSON.parse<i64>("-12"))).toBe("-12");
  expect(JSON.stringify(JSON.parse<i64>("345"))).toBe("345");
  expect(JSON.stringify(JSON.parse<i64>("-345"))).toBe("-345");
  expect(JSON.stringify(JSON.parse<i64>("6789"))).toBe("6789");
  expect(JSON.stringify(JSON.parse<i64>("-6789"))).toBe("-6789");
  expect(JSON.stringify(JSON.parse<i64>("123456789"))).toBe("123456789");
  expect(JSON.stringify(JSON.parse<i64>("-123456789"))).toBe("-123456789");
  expect(JSON.stringify(JSON.parse<u64>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<u64>("1"))).toBe("1");
  expect(JSON.stringify(JSON.parse<u64>("12"))).toBe("12");
  expect(JSON.stringify(JSON.parse<u64>("345"))).toBe("345");
  expect(JSON.stringify(JSON.parse<u64>("6789"))).toBe("6789");
  expect(JSON.stringify(JSON.parse<u64>("123456789"))).toBe("123456789");
});

describe("Should round-trip a broad float matrix", () => {
  expect(JSON.stringify(JSON.parse<f64>("0.0"))).toBe("0.0");
  expect(JSON.stringify(JSON.parse<f64>("1.5"))).toBe("1.5");
  expect(JSON.stringify(JSON.parse<f64>("-1.5"))).toBe("-1.5");
  expect(JSON.stringify(JSON.parse<f64>("12.125"))).toBe("12.125");
  expect(JSON.stringify(JSON.parse<f64>("-12.125"))).toBe("-12.125");
  expect(JSON.stringify(JSON.parse<f64>("3.14e5"))).toBe("314000.0");
  expect(JSON.stringify(JSON.parse<f64>("3.14E5"))).toBe("314000.0");
  expect(JSON.parse<f64>("3.14e-5").toString()).toBe("0.000031400000000000004");
  expect(JSON.stringify(JSON.parse<f64>("-9.81E+2"))).toBe("-981.0");
  expect(JSON.parse<f64>("6.022e23").toString()).toBe("6.0219999999999999e+23");
});

describe("Should round-trip escaped strings and nested structs", () => {
  expect(JSON.stringify(JSON.parse<string>('"simple"'))).toBe('"simple"');
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
  expect(JSON.stringify(JSON.parse<string>('"tab\\there"'))).toBe('"tab\\there"');
  expect(JSON.stringify(JSON.parse<string>('"quote \\" here"'))).toBe('"quote \\" here"');
  expect(JSON.stringify(JSON.parse<string>('"unicode \\u03a9"'))).toBe('"unicode Ω"');

  const parsed = JSON.parse<MatrixEnvelope>('{"id":7,"label":"demo","flags":[true,false,true],"values":[1.5,2.5,3.5],"pos":{"x":4.5,"y":5.5,"z":6.5}}');
  expect(parsed.id.toString()).toBe("7");
  expect(parsed.label).toBe("demo");
  expect(parsed.flags.length.toString()).toBe("3");
  expect(parsed.flags[0].toString()).toBe("true");
  expect(parsed.values[1].toString()).toBe("2.5");
  expect((parsed.pos as Vec3).y.toString()).toBe("5.5");
  expect(JSON.stringify(parsed)).toBe('{"id":7,"label":"demo","flags":[true,false,true],"values":[1.5,2.5,3.5],"pos":{"x":4.5,"y":5.5,"z":6.5}}');
});
