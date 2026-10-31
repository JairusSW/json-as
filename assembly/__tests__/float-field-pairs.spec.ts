import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class DoubleField {
  values: f64[] = [];
}


@json
class FloatField {
  values: f32[] = [];
}

// Independent IEEE-754 bit patterns computed by the JavaScript numeric parser.
const tokens: string[] = [
  "-0",
  "5e-324",
  "2.2250738585072014e-308",
  "1.7976931348623157e308",
  "16777217",
  "1e-50",
  "-65.61361699999998",
  "48.147217000000126",
  "50.72276300000004",
  "47.26527400000003",
  "49.42555200000004",
  "53.11249499999997",
  "54.07555400000001",
  "56.22360200000014",
  "60.48804500000006",
  "63.46693399999998",
  "-67.71389799999986",
  "-83.59889199999998",
  "-108.36193800000001",
  "-74.8830569999999",
  "-135.591095",
  "-98.577225",
  "-132.98361199999994",
  "-124.58473199999992",
  "-106.420837",
  "67.07222000000013",
  "69.61914100000001",
  "68.15498400000001",
  "63.56415600000008",
  "53.15332000000012",
  "62.169159000000036",
  "59.04410600000011",
  "56.267494",
  "53.43332700000002",
  "-64.77139299999999",
  "-66.55999799999995",
  "-122.86054999999993",
  "-126.88027999999986",
  "-139.14306599999998",
  "-110.73166700000002",
  "-106.96611000000001",
  "-116.57417299999997",
  "-78.89361600000001",
  "71.783051",
  "71.89387500000004",
  "71.06248499999998",
  "69.19581599999998",
  "67.19802900000013",
  "65.41442900000004",
  "63.771102999999925",
  "64.08692900000005",
  "72.99859600000013",
  "-94.78028899999998",
  "-100.36110699999995",
  "-104.48277299999995",
  "-100.95249899999999",
  "-115.53751399999993",
  "-90.75750699999998",
  "-89.05583200000001",
  "-120.43028300000003",
  "-110.77500899999995",
  "78.51971400000002",
  "78.13638300000014",
  "82.89915500000006",
  "79.684708",
  "77.34275800000012",
  "77.836929",
  "79.9227600000001",
  "81.84248399999996",
  "83.10942100000011",
];
const doubles: u64[] = [
  0x8000000000000000, 0x1, 0x10000000000000, 0x7fefffffffffffff,
  0x4170000010000000, 0x358dee7a4ad4b81f, 0xc0506745803cd140,
  0x404812d801b43538, 0x40495c837f7be128, 0x4047a1f47f993d58,
  0x4048b6787ce95fb0, 0x404a8e663c74fb50, 0x404b09abc0e38a80,
  0x404c1c9efd86a910, 0x404e3e784230fd00, 0x404fbbc47e49b1f8,
  0xc050edb0813cab78, 0xc054e6543f1c7580, 0xc05b1729fe004b80,
  0xc052b8840181e038, 0xc060f2ea400fba88, 0xc058a4f141205bc0,
  0xc0609f79bfdf7e7e, 0xc05f256c3fc43b28, 0xc05a9aeefe4ffc98,
  0x4050c49f40a28788, 0x405167a00192a738, 0x405109eb4202d9d0,
  0x404fc8364388ebd8, 0x404a939ffd60e960, 0x404f15a7008a6980,
  0x404d85a543f1c768, 0x404c223d3e4ef028, 0x404ab7774256bca8,
  0xc050315e80bed740, 0xc050a3d701d9f4d0, 0xc05eb713404ea4a4,
  0xc05fb85681ecd4a0, 0xc0616493ff25e56c, 0xc05baed3a1d32400,
  0xc05abdd4bf0995ac, 0xc05d24bf401c4fc0, 0xc053b9310129cbac,
  0x4051f21d81f10668, 0x4051f9353f7ced94, 0x4051c3ffc115df64,
  0x40514c883fd50224, 0x4050ccac81d3aa40, 0x40505a86013660e8,
  0x404fe2b380cb6c70, 0x405005903ea704c0, 0x40523fe8ff327ab0,
  0xc057b1f041461b6c, 0xc059171c6088d6d0, 0xc05a1ee5c0b99910,
  0xc0593cf5be5d9e40, 0xc05ce266a11ec914, 0xc056b07afea3df6c,
  0xc0564392c0618480, 0xc05e1b89c1b54198, 0xc05bb199bf5946c0,
  0x4053a142fe825180, 0x405388ba7fc32ec8, 0x4054b98bc169c240,
  0x4053ebd24180d3d0, 0x405355efbf401c58, 0x405375903ea704bc,
  0x4053fb0e7ff583ac, 0x405475eb4202d9cc, 0x4054c700c0f01fc0,
];
const floats: u32[] = [
  0x80000000, 0x0, 0x0, 0x7f800000, 0x4b800000, 0x0, 0xc2833a2c, 0x424096c0,
  0x424ae41c, 0x423d0fa4, 0x4245b3c4, 0x42547332, 0x42584d5e, 0x4260e4f8,
  0x4271f3c2, 0x427dde24, 0xc2876d84, 0xc2a732a2, 0xc2d8b950, 0xc295c420,
  0xc3079752, 0xc2c5278a, 0xc304fbce, 0xc2f92b62, 0xc2d4d778, 0x428624fa,
  0x428b3d00, 0x42884f5a, 0x427e41b2, 0x42549d00, 0x4278ad38, 0x426c2d2a,
  0x426111ea, 0x4255bbba, 0xc2818af4, 0xc2851eb8, 0xc2f5b89a, 0xc2fdc2b4,
  0xc30b24a0, 0xc2dd769d, 0xc2d5eea6, 0xc2e925fa, 0xc29dc988, 0x428f90ec,
  0x428fc9aa, 0x428e1ffe, 0x428a6442, 0x42866564, 0x4282d430, 0x427f159c,
  0x42802c82, 0x4291ff48, 0xc2bd8f82, 0xc2c8b8e3, 0xc2d0f72e, 0xc2c9e7ae,
  0xc2e71335, 0xc2b583d8, 0xc2b21c96, 0xc2f0dc4e, 0xc2dd8cce, 0x429d0a18,
  0x429c45d4, 0x42a5cc5e, 0x429f5e92, 0x429aaf7e, 0x429bac82, 0x429fd874,
  0x42a3af5a, 0x42a63806,
];

describe("Fresh and reused numeric field pairs preserve exact floating-point bits", () => {
  const reused64 = new DoubleField();
  const reused32 = new FloatField();
  for (let i = 0; i < tokens.length; i++) {
    const j = (i + 1) % tokens.length;
    const source = '{"values":[' + tokens[i] + "," + tokens[j] + "]}";
    const fresh64 = JSON.parse<DoubleField>(source);
    const fresh32 = JSON.parse<FloatField>(source);
    reused64.values.length = 0;
    reused32.values.length = 0;
    JSON.parse<DoubleField>(source, reused64);
    JSON.parse<FloatField>(source, reused32);
    expect(fresh64.values.length).toBe(2);
    expect(fresh32.values.length).toBe(2);
    expect(reused64.values.length).toBe(2);
    expect(reused32.values.length).toBe(2);
    expect(reinterpret<u64>(fresh64.values[0])).toBe(doubles[i]);
    expect(reinterpret<u64>(fresh64.values[1])).toBe(doubles[j]);
    expect(reinterpret<u64>(reused64.values[0])).toBe(doubles[i]);
    expect(reinterpret<u64>(reused64.values[1])).toBe(doubles[j]);
    expect(reinterpret<u32>(fresh32.values[0])).toBe(floats[i]);
    expect(reinterpret<u32>(fresh32.values[1])).toBe(floats[j]);
    expect(reinterpret<u32>(reused32.values[0])).toBe(floats[i]);
    expect(reinterpret<u32>(reused32.values[1])).toBe(floats[j]);
  }
});

describe("Numeric fields grow and shrink beyond the pair fast path", () => {
  const reused = new DoubleField();
  const counts: i32[] = [0, 1, 2, 3, 32, 2, 1, 0];
  for (let j = 0; j < counts.length; j++) {
    const count = counts[j];
    const items = new Array<string>(count);
    for (let i = 0; i < count; i++) items[i] = (i + 0.25).toString();
    const source = '{"values":[' + items.join(",") + "]}";
    const fresh = JSON.parse<DoubleField>(source);
    JSON.parse<DoubleField>(source, reused);
    expect(fresh.values.length).toBe(count);
    expect(reused.values.length).toBe(count);
    for (let i = 0; i < count; i++) {
      expect(fresh.values[i]).toBe(i + 0.25);
      expect(reused.values[i]).toBe(i + 0.25);
    }
  }
});
