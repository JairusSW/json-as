import { JSON } from "../";
import { describe, expect } from "./lib";
import { DerivedObject, Null, ObjWithStrangeKey, ObjectWithFloat, OmitIf, Player, Vec3 } from "./types";

// describe("Should serialize objects", () => {
//   expect(
//     JSON.stringify<Vec3>({
//       x: 3.4,
//       y: 1.2,
//       z: 8.3,
//     }),
//   ).toBe('{"x":3.4,"y":1.2,"z":8.3}');

//   expect(
//     JSON.stringify<Player>({
//       firstName: "Emmet",
//       lastName: "West",
//       lastActive: [8, 27, 2022],
//       age: 23,
//       pos: {
//         x: 3.4,
//         y: 1.2,
//         z: 8.3,
//       },
//       isVerified: true,
//     }),
//   ).toBe('{"firstName":"Emmet","lastName":"West","lastActive":[8,27,2022],"age":23,"pos":{"x":3.4,"y":1.2,"z":8.3},"isVerified":true}');

//   expect(JSON.stringify<ObjectWithFloat>({ f: 7.23 })).toBe('{"f":7.23}');

//   expect(JSON.stringify<ObjectWithFloat>({ f: 0.000001 })).toBe('{"f":0.000001}');

//   expect(JSON.stringify<ObjectWithFloat>({ f: 1e-7 })).toBe('{"f":1e-7}');

//   expect(JSON.stringify<ObjectWithFloat>({ f: 1e20 })).toBe('{"f":100000000000000000000.0}');

//   expect(JSON.stringify<ObjectWithFloat>({ f: 1e21 })).toBe('{"f":1e+21}');

//   expect(JSON.stringify<ObjWithStrangeKey<string>>({ data: "foo" })).toBe('{"a\\\\\\t\\"\\u0002b`c":"foo"}');
// });

// describe("Should serialize @omit'ed objects", () => {
//   expect(
//     JSON.stringify(<OmitIf>{
//       y: 1,
//     }),
//   ).toBe('{"x":1,"y":1,"z":1}');
// });
// describe("Should deserialize class inheritance", () => {
//   const jsonStr = '{"a":"1","b":"2"}';
//   const obj = JSON.parse<DerivedObject>(jsonStr);

//   expect((obj instanceof DerivedObject).toString()).toBe("true");
//   expect(obj.a).toBe("1");
//   expect(obj.b).toBe("2");
// });

// describe("Should deserialize nulls", () => {
//   expect(JSON.stringify(JSON.parse<Null>("null"))).toBe("null");
// });

// describe("Should deserialize integer arrays", () => {
//   expect(JSON.stringify(JSON.parse<u32[]>("[0,100,101]"))).toBe(JSON.stringify([0, 100, 101]));

//   expect(JSON.stringify(JSON.parse<i32[]>("[0,100,101,-100,-101]"))).toBe(JSON.stringify([0, 100, 101, -100, -101]));
// });

// describe("Should deserialize float arrays", () => {
//   expect(JSON.stringify(JSON.parse<f64[]>("[7.23,1000.0,1000.0,1.23456,1.23456,0.0,7.23]"))).toBe(JSON.stringify([7.23, 1000.0, 1000.0, 1.23456, 1.23456, 0.0, 7.23]));

//   expect(JSON.stringify(JSON.parse<f64[]>("[1e+21,1e+22,1e-7,1e-8,1e-9]"))).toBe(JSON.stringify([1e21, 1e22, 1e-7, 1e-8, 1e-9]));
// });

// describe("Should deserialize boolean arrays", () => {
//   expect(JSON.stringify(JSON.parse<boolean[]>("[true,false]"))).toBe(JSON.stringify([true, false]));
// });

// describe("Should deserialize string arrays", () => {
//   expect(JSON.stringify(JSON.parse<string[]>('["string \\"with random spa\\nces and \\nnewlines\\n\\n\\n"]'))).toBe(JSON.stringify(['string "with random spa\nces and \nnewlines\n\n\n']));
// });

// describe("Should deserialize nested integer arrays", () => {
//   expect(JSON.stringify(JSON.parse<i64[][]>("[[100,101],[-100,-101],[0]]"))).toBe(JSON.stringify([[100, 101], [-100, -101], [0]]));
// });

// describe("Should deserialize nested float arrays", () => {
//   expect(JSON.stringify(JSON.parse<f64[][]>("[[7.23],[1000.0],[1000.0],[1.23456],[1.23456],[0.0],[7.23]]"))).toBe(JSON.stringify([[7.23], [1000.0], [1000.0], [1.23456], [1.23456], [0.0], [7.23]]));
// });

// describe("Should deserialize nested boolean arrays", () => {
//   expect(JSON.stringify(JSON.parse<boolean[][]>("[[true],[false]]"))).toBe(JSON.stringify([[true], [false]]));
// });

// describe("Should deserialize object arrays", () => {
//   expect(JSON.stringify(JSON.parse<Vec3[]>('[{"x":3.4,"y":1.2,"z":8.3},{"x":3.4,"y":-2.1,"z":9.3}]'))).toBe(
//     JSON.stringify(<Vec3[]>[
//       { x: 3.4, y: 1.2, z: 8.3 },
//       { x: 3.4, y: -2.1, z: 9.3 },
//     ]),
//   );
// });

// describe("Should deserialize Objects", () => {
//   expect(JSON.stringify(JSON.parse<Vec3>('{"x":3.4,"y":1.2,"z":8.3}'))).toBe(JSON.stringify(<Vec3>{ x: 3.4, y: 1.2, z: 8.3 }));

//   expect(JSON.stringify(JSON.parse<Player>('{"firstName":"Emmet","lastName":"West","lastActive":[8,27,2022],"age":23,"pos":{"x":3.4,"y":1.2,"z":8.3},"isVerified":true}'))).toBe(
//     JSON.stringify(<Player>{
//       firstName: "Emmet",
//       lastName: "West",
//       lastActive: [8, 27, 2022],
//       age: 23,
//       pos: { x: 3.4, y: 1.2, z: 8.3 },
//       isVerified: true,
//     }),
//   );

//   expect(JSON.stringify(JSON.parse<ObjectWithFloat>('{"f":7.23}'))).toBe(JSON.stringify(<ObjectWithFloat>{ f: 7.23 }));

//   expect(JSON.stringify(JSON.parse<ObjectWithFloat>('{"f":0.000001}'))).toBe(JSON.stringify(<ObjectWithFloat>{ f: 0.000001 }));

//   expect(JSON.stringify(JSON.parse<ObjWithStrangeKey<string>>('{"a\\\\\\t\\"\\u0002b`c":"foo"}'))).toBe(JSON.stringify(<ObjWithStrangeKey<string>>{ data: "foo" }));
// });
