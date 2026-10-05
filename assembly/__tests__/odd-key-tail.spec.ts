import { JSON } from "..";
import { describe, expect } from "as-test";


@json class Keys5 {
  kkkka: i32 = 0;
  kkkkb: i32 = 0;
  kkkkc: i32 = 0;
}
describe("Compare the final UTF-16 unit of 5-unit keys", () => {
  const parsed = JSON.parse<Keys5>('{"kkkkc":3,"kkkkb":2,"kkkka":1}');
  expect(parsed.kkkka).toBe(1);
  expect(parsed.kkkkb).toBe(2);
  expect(parsed.kkkkc).toBe(3);
  const reused = JSON.parse<Keys5>('{"kkkkb":4,"kkkkc":5,"kkkka":6}', parsed);
  expect(reused.kkkka).toBe(6);
  expect(reused.kkkkb).toBe(4);
  expect(reused.kkkkc).toBe(5);
});


@json class Keys7 {
  kkkkkka: i32 = 0;
  kkkkkkb: i32 = 0;
  kkkkkkc: i32 = 0;
}
describe("Compare the final UTF-16 unit of 7-unit keys", () => {
  const parsed = JSON.parse<Keys7>('{"kkkkkkc":3,"kkkkkkb":2,"kkkkkka":1}');
  expect(parsed.kkkkkka).toBe(1);
  expect(parsed.kkkkkkb).toBe(2);
  expect(parsed.kkkkkkc).toBe(3);
  const reused = JSON.parse<Keys7>(
    '{"kkkkkkb":4,"kkkkkkc":5,"kkkkkka":6}',
    parsed,
  );
  expect(reused.kkkkkka).toBe(6);
  expect(reused.kkkkkkb).toBe(4);
  expect(reused.kkkkkkc).toBe(5);
});


@json class Keys9 {
  kkkkkkkka: i32 = 0;
  kkkkkkkkb: i32 = 0;
  kkkkkkkkc: i32 = 0;
}
describe("Compare the final UTF-16 unit of 9-unit keys", () => {
  const parsed = JSON.parse<Keys9>(
    '{"kkkkkkkkc":3,"kkkkkkkkb":2,"kkkkkkkka":1}',
  );
  expect(parsed.kkkkkkkka).toBe(1);
  expect(parsed.kkkkkkkkb).toBe(2);
  expect(parsed.kkkkkkkkc).toBe(3);
  const reused = JSON.parse<Keys9>(
    '{"kkkkkkkkb":4,"kkkkkkkkc":5,"kkkkkkkka":6}',
    parsed,
  );
  expect(reused.kkkkkkkka).toBe(6);
  expect(reused.kkkkkkkkb).toBe(4);
  expect(reused.kkkkkkkkc).toBe(5);
});


@json class Keys11 {
  kkkkkkkkkka: i32 = 0;
  kkkkkkkkkkb: i32 = 0;
  kkkkkkkkkkc: i32 = 0;
}
describe("Compare the final UTF-16 unit of 11-unit keys", () => {
  const parsed = JSON.parse<Keys11>(
    '{"kkkkkkkkkkc":3,"kkkkkkkkkkb":2,"kkkkkkkkkka":1}',
  );
  expect(parsed.kkkkkkkkkka).toBe(1);
  expect(parsed.kkkkkkkkkkb).toBe(2);
  expect(parsed.kkkkkkkkkkc).toBe(3);
  const reused = JSON.parse<Keys11>(
    '{"kkkkkkkkkkb":4,"kkkkkkkkkkc":5,"kkkkkkkkkka":6}',
    parsed,
  );
  expect(reused.kkkkkkkkkka).toBe(6);
  expect(reused.kkkkkkkkkkb).toBe(4);
  expect(reused.kkkkkkkkkkc).toBe(5);
});
