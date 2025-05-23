import { JSON } from "..";
import { describe, expect } from "./lib";

// describe("Should serialize integer arrays", () => {
//   expect(JSON.stringify<u32[]>([0, 100, 101])).toBe("[0,100,101]");

//   expect(JSON.stringify<u64[]>([0, 100, 101])).toBe("[0,100,101]");

//   expect(JSON.stringify<i32[]>([0, 100, 101, -100, -101])).toBe("[0,100,101,-100,-101]");

//   expect(JSON.stringify<i64[]>([0, 100, 101, -100, -101])).toBe("[0,100,101,-100,-101]");
// });

// describe("Should serialize float arrays", () => {
//   expect(JSON.stringify<f64[]>([7.23, 10e2, 10e2, 123456e-5, 123456e-5, 0.0, 7.23])).toBe("[7.23,1000.0,1000.0,1.23456,1.23456,0.0,7.23]");

//   expect(JSON.stringify<f64[]>([1e21, 1e22, 1e-7, 1e-8, 1e-9])).toBe("[1e+21,1e+22,1e-7,1e-8,1e-9]");
// });

// describe("Should serialize boolean arrays", () => {
//   expect(JSON.stringify<bool[]>([true, false])).toBe("[true,false]");

//   expect(JSON.stringify<boolean[]>([true, false])).toBe("[true,false]");
// });

// describe("Should serialize string arrays", () => {
//   expect(JSON.stringify<string[]>(['string "with random spa\nces and \nnewlines\n\n\n'])).toBe('["string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"]');
// });

// describe("Should serialize nested integer arrays", () => {
//   expect(JSON.stringify<i64[][]>([[100, 101], [-100, -101], [0]])).toBe("[[100,101],[-100,-101],[0]]");
// });

// describe("Should serialize nested float arrays", () => {
//   expect(JSON.stringify<f64[][]>([[7.23], [10e2], [10e2], [123456e-5], [123456e-5], [0.0], [7.23]])).toBe("[[7.23],[1000.0],[1000.0],[1.23456],[1.23456],[0.0],[7.23]]");
// });

// describe("Should serialize nested boolean arrays", () => {
//   expect(JSON.stringify<bool[][]>([[true], [false]])).toBe("[[true],[false]]");

//   expect(JSON.stringify<boolean[][]>([[true], [false]])).toBe("[[true],[false]]");
// });

// describe("Should serialize object arrays", () => {
//   expect(
//     JSON.stringify<Vec3[]>([
//       {
//         x: 3.4,
//         y: 1.2,
//         z: 8.3,
//       },
//       {
//         x: 3.4,
//         y: -2.1,
//         z: 9.3,
//       },
//     ]),
//   ).toBe('[{"x":3.4,"y":1.2,"z":8.3},{"x":3.4,"y":-2.1,"z":9.3}]');
// });

// describe("Should deserialize integer arrays", () => {
//   expect(JSON.stringify(JSON.parse<u32[]>("[0,100,101]"))).toBe("[0,100,101]");
//   expect(JSON.stringify(JSON.parse<u64[]>("[0,100,101]"))).toBe("[0,100,101]");
//   expect(JSON.stringify(JSON.parse<i32[]>("[0,100,101,-100,-101]"))).toBe("[0,100,101,-100,-101]");
//   expect(JSON.stringify(JSON.parse<i64[]>("[0,100,101,-100,-101]"))).toBe("[0,100,101,-100,-101]");
// });

// describe("Should deserialize float arrays", () => {
//   expect(JSON.stringify(JSON.parse<f64[]>("[7.23,1000.0,1000.0,1.23456,1.23456,0.0,7.23]"))).toBe("[7.23,1000.0,1000.0,1.23456,1.23456,0.0,7.23]");
//   expect(JSON.stringify(JSON.parse<f64[]>("[1e+21,1e+22,1e-7,1e-8,1e-9]"))).toBe("[1e+21,1e+22,1e-7,1e-8,1e-9]");
// });

// describe("Should deserialize boolean arrays", () => {
//   expect(JSON.stringify(JSON.parse<bool[]>("[true,false]"))).toBe("[true,false]");
//   expect(JSON.stringify(JSON.parse<boolean[]>("[true,false]"))).toBe("[true,false]");
// });

// describe("Should deserialize string arrays", () => {
//   expect(JSON.stringify(JSON.parse<string[]>('["string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"]'))).toBe('["string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"]');
// });

// describe("Should deserialize nested integer arrays", () => {
//   expect(JSON.stringify(JSON.parse<i64[][]>("[[100,101],[-100,-101],[0]]"))).toBe("[[100,101],[-100,-101],[0]]");
// });

// describe("Should deserialize nested float arrays", () => {
//   expect(JSON.stringify(JSON.parse<f64[][]>("[[7.23],[1000.0],[1000.0],[1.23456],[1.23456],[0.0],[7.23]]"))).toBe("[[7.23],[1000.0],[1000.0],[1.23456],[1.23456],[0.0],[7.23]]");
// });

// describe("Should deserialize nested boolean arrays", () => {
//   expect(JSON.stringify(JSON.parse<bool[][]>("[[true],[false]]"))).toBe("[[true],[false]]");
//   expect(JSON.stringify(JSON.parse<boolean[][]>("[[true],[false]]"))).toBe("[[true],[false]]");
// });

describe("Should deserialize object arrays", () => {
  expect(JSON.stringify(JSON.parse<Vec3[]>('[{"x":3.4,"y":1.2,"z":8.3},{"x":3.4,"y":-2.1,"z":9.3}]'))).toBe('[{"x":3.4,"y":1.2,"z":8.3},{"x":3.4,"y":-2.1,"z":9.3}]');
});


@json
class Vec3 {
  x: f64 = 0.0;
  y: f64 = 0.0;
  z: f64 = 0.0;
  __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): __JSON_T {
    let keyStart: usize = 0;
    let keyEnd: usize = 0;
    let isKey = false;
    let lastIndex: usize = 0;

    while (srcStart < srcEnd && JSON.Util.isSpace(load<u16>(srcStart))) srcStart += 2;
    while (srcEnd > srcStart && JSON.Util.isSpace(load<u16>(srcEnd - 2))) srcEnd -= 2;
    if (srcStart - srcEnd == 0) throw new Error("Input string had zero length or was all whitespace");
    if (load<u16>(srcStart) != 123) throw new Error("Expected '{' at start of object at position " + (srcEnd - srcStart).toString());
    if (load<u16>(srcEnd - 2) != 125) throw new Error("Expected '}' at end of object at position " + (srcEnd - srcStart).toString());
    srcStart += 2;

    while (srcStart < srcEnd) {
      let code = load<u16>(srcStart);
      while (JSON.Util.isSpace(code)) code = load<u16>(srcStart += 2);
      if (keyStart == 0) {
        if (code == 34 && load<u16>(srcStart - 2) !== 92) {
          if (isKey) {
            keyStart = lastIndex;
            keyEnd = srcStart;
            while (JSON.Util.isSpace((code = load<u16>((srcStart += 2))))) { }
            if (code !== 58) throw new Error("Expected ':' after key at position " + (srcEnd - srcStart).toString());
            isKey = false;
          } else {
            isKey = true;
            lastIndex = srcStart + 2;
          }
        }
        srcStart += 2;
      } else {
        if (code - 48 <= 9 || code == 45) {
          lastIndex = srcStart;
          srcStart += 2;
          while (srcStart < srcEnd) {
            const code = load<u16>(srcStart);
            if (code == 44 || code == 125 || JSON.Util.isSpace(code)) {
              switch (<u32>keyEnd - <u32>keyStart) {
                case 2: {
                  const code16 = load<u16>(keyStart);
                  if (code16 == 120) { // x
                    store<f64>(changetype<usize>(out), JSON.__deserialize<f64>(lastIndex, srcStart), offsetof<this>("x"));
                    keyStart = 0;
                    break;
                  } else if (code16 == 121) { // y
                    store<f64>(changetype<usize>(out), JSON.__deserialize<f64>(lastIndex, srcStart), offsetof<this>("y"));
                    keyStart = 0;
                    break;
                  } else if (code16 == 122) { // z
                    store<f64>(changetype<usize>(out), JSON.__deserialize<f64>(lastIndex, srcStart), offsetof<this>("z"));
                    keyStart = 0;
                    break;
                  }
                }
              }
              break;
            }
            srcStart += 2;
          }
        } else {
          srcStart += 2;
        }
      }
    }
    return out;
  }
}
