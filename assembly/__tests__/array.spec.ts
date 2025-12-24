import { JSON } from "..";
import { describe, expect } from "./lib";

describe("Should serialize integer arrays", () => {
  expect(JSON.stringify<u32[]>([0, 100, 101])).toBe("[0,100,101]");

  expect(JSON.stringify<u64[]>([0, 100, 101])).toBe("[0,100,101]");

  expect(JSON.stringify<i32[]>([0, 100, 101, -100, -101])).toBe("[0,100,101,-100,-101]");

  expect(JSON.stringify<i64[]>([0, 100, 101, -100, -101])).toBe("[0,100,101,-100,-101]");
});

describe("Should serialize float arrays", () => {
  expect(JSON.stringify<f64[]>([7.23, 10e2, 10e2, 123456e-5, 123456e-5, 0.0, 7.23])).toBe("[7.23,1000.0,1000.0,1.23456,1.23456,0.0,7.23]");

  expect(JSON.stringify<f64[]>([1e21, 1e22, 1e-7, 1e-8, 1e-9])).toBe("[1e+21,1e+22,1e-7,1e-8,1e-9]");
});

describe("Should serialize boolean arrays", () => {
  expect(JSON.stringify<bool[]>([true, false])).toBe("[true,false]");

  expect(JSON.stringify<boolean[]>([true, false])).toBe("[true,false]");
});

describe("Should serialize string arrays", () => {
  expect(JSON.stringify<string[]>(['string "with random spa\nces and \nnewlines\n\n\n'])).toBe('["string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"]');
});

describe("Should serialize nested integer arrays", () => {
  expect(JSON.stringify<i64[][]>([[100, 101], [-100, -101], [0]])).toBe("[[100,101],[-100,-101],[0]]");
});

describe("Should serialize nested float arrays", () => {
  expect(JSON.stringify<f64[][]>([[7.23], [10e2], [10e2], [123456e-5], [123456e-5], [0.0], [7.23]])).toBe("[[7.23],[1000.0],[1000.0],[1.23456],[1.23456],[0.0],[7.23]]");
});

describe("Should serialize nested boolean arrays", () => {
  expect(JSON.stringify<bool[][]>([[true], [false]])).toBe("[[true],[false]]");

  expect(JSON.stringify<boolean[][]>([[true], [false]])).toBe("[[true],[false]]");
});

describe("Should serialize object arrays", () => {
  expect(
    JSON.stringify<Vec3[]>([
      {
        x: 3.4,
        y: 1.2,
        z: 8.3,
      },
      {
        x: 3.4,
        y: -2.1,
        z: 9.3,
      },
    ]),
  ).toBe('[{"x":3.4,"y":1.2,"z":8.3},{"x":3.4,"y":-2.1,"z":9.3}]');
});

describe("Should deserialize integer arrays", () => {
  expect(JSON.stringify(JSON.parse<u32[]>("[0,100,101]"))).toBe("[0,100,101]");
  expect(JSON.stringify(JSON.parse<u64[]>("[0,100,101]"))).toBe("[0,100,101]");
  expect(JSON.stringify(JSON.parse<i32[]>("[0,100,101,-100,-101]"))).toBe("[0,100,101,-100,-101]");
  expect(JSON.stringify(JSON.parse<i64[]>("[0,100,101,-100,-101]"))).toBe("[0,100,101,-100,-101]");
});

describe("Should deserialize float arrays", () => {
  expect(JSON.stringify(JSON.parse<f64[]>("[7.23,1000.0,1000.0,1.23456,1.23456,0.0,7.23]"))).toBe("[7.23,1000.0,1000.0,1.23456,1.23456,0.0,7.23]");
  expect(JSON.stringify(JSON.parse<f64[]>("[1e+21,1e+22,1e-7,1e-8,1e-9]"))).toBe("[1e+21,1e+22,1e-7,1e-8,1e-9]");
});

describe("Should deserialize boolean arrays", () => {
  expect(JSON.stringify(JSON.parse<bool[]>("[true,false]"))).toBe("[true,false]");
  expect(JSON.stringify(JSON.parse<boolean[]>("[true,false]"))).toBe("[true,false]");
});

describe("Should deserialize string arrays", () => {
  expect(JSON.stringify(JSON.parse<string[]>('["string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"]'))).toBe('["string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"]');
});

describe("Should deserialize nested integer arrays", () => {
  expect(JSON.stringify(JSON.parse<i64[][]>("[[100,101],[-100,-101],[0]]"))).toBe("[[100,101],[-100,-101],[0]]");
});

describe("Should deserialize nested float arrays", () => {
  expect(JSON.stringify(JSON.parse<f64[][]>("[[7.23],[1000.0],[1000.0],[1.23456],[1.23456],[0.0],[7.23]]"))).toBe("[[7.23],[1000.0],[1000.0],[1.23456],[1.23456],[0.0],[7.23]]");
});

describe("Should deserialize nested boolean arrays", () => {
  expect(JSON.stringify(JSON.parse<bool[][]>("[[true],[false]]"))).toBe("[[true],[false]]");
  expect(JSON.stringify(JSON.parse<boolean[][]>("[[true],[false]]"))).toBe("[[true],[false]]");
});

describe("Should deserialize object arrays", () => {
  expect(JSON.stringify(JSON.parse<Vec3[]>('[{"x":3.4,"y":1.2,"z":8.3},{"x":3.4,"y":-2.1,"z":9.3}]'))).toBe('[{"x":3.4,"y":1.2,"z":8.3},{"x":3.4,"y":-2.1,"z":9.3}]');
});

describe("Should deserialize raw arrays", () => {
  const r1 = JSON.parse<JSON.Raw[]>('[{"x":3.4,"y":1.2,"z":8.3},{"x":3.4,"y":-2.1,"z":9.3}]');
  expect(r1[0].toString()).toBe('{"x":3.4,"y":1.2,"z":8.3}');
  expect(r1[1].toString()).toBe('{"x":3.4,"y":-2.1,"z":9.3}');

  const r2 = JSON.parse<JSON.Raw[][]>('[[{"x":3.4,"y":1.2,"z":8.3},{"x":3.4,"y":-2.1,"z":9.3}],[{"x":0.1,"y":-7.3,"z":4.5}]]');
  expect(r2[0][0].toString()).toBe('{"x":3.4,"y":1.2,"z":8.3}');
  expect(r2[0][1].toString()).toBe('{"x":3.4,"y":-2.1,"z":9.3}');
  expect(r2[1][0].toString()).toBe('{"x":0.1,"y":-7.3,"z":4.5}');

  const r3 = JSON.parse<JSON.Raw[]>("[1,2,3,4,5]");
  expect(r3[0]).toBe(1);
  expect(r3[1]).toBe(2);
  expect(r3[2]).toBe(3);
  expect(r3[3]).toBe(4);
  expect(r3[4]).toBe(5);

  const r4 = JSON.parse<JSON.Raw[][]>("[[1,2,3,4,5],[6,7,8,9,10]]");
  expect(r4[0][0]).toBe(1);
  expect(r4[0][1]).toBe(2);
  expect(r4[0][2]).toBe(3);
  expect(r4[0][3]).toBe(4);
  expect(r4[0][4]).toBe(5);

  expect(r4[1][0]).toBe(6);
  expect(r4[1][1]).toBe(7);
  expect(r4[1][2]).toBe(8);
  expect(r4[1][3]).toBe(9);
  expect(r4[1][4]).toBe(10);

  const r5 = JSON.parse<JSON.Raw[]>('[{"x":3.4,"y":1.2,"z":8.3},[1,2,3,4,5],"12345",true,false,null,[[]]]');
  expect(r5[0].toString()).toBe('{"x":3.4,"y":1.2,"z":8.3}');
  expect(r5[1].toString()).toBe("[1,2,3,4,5]");
  expect(r5[2]).toBe('"12345"');
  expect(r5[3]).toBe(true);
  expect(r5[4]).toBe(false);
  expect(r5[5]).toBe(null);
  expect(r5[6].toString()).toBe("[[]]");
});


@json
class Vec3 {
  x: f64 = 0.0;
  y: f64 = 0.0;
  z: f64 = 0.0;
}
