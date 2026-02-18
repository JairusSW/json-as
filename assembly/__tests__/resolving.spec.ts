import { JSON } from "..";
import { describe, expect } from "./lib";
import { Vec3 } from "./types";


@json
class Player {

  @alias("first name")
  firstName!: string;
  lastName!: string;
  lastActive!: i32[];


  @omitif((self: Player) => self.age < 18)
  age!: i32;


  @omitnull()
  pos!: Vec3 | null;
  isVerified!: boolean;
}

const player: Player = {
  firstName: "Jairus",
  lastName: "Tanaka",
  lastActive: [3, 9, 2025],
  age: 18,
  pos: {
    x: 3.4,
    y: 1.2,
    z: 8.3,
  },
  isVerified: true,
};


@json
class Foo {
  bar: Bar = new Bar();
}


@json
class Bar {
  baz: string = "buz";
}

describe("Should resolve imported schemas", () => {
  expect(JSON.stringify(player)).toBe(
    '{"age":18,"pos":{"x":3.4,"y":1.2,"z":8.3},"first name":"Jairus","lastName":"Tanaka","lastActive":[3,9,2025],"isVerified":true}',
  );
});

describe("Should resolve local schemas", () => {
  expect(JSON.stringify(new Foo())).toBe('{"bar":{"baz":"buz"}}');
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

describe("Should deserialize resolved imported schemas", () => {
  const parsed = JSON.parse<Player>(
    '{"age":18,"pos":{"x":3.4,"y":1.2,"z":8.3},"first name":"Jairus","lastName":"Tanaka","lastActive":[3,9,2025],"isVerified":true}',
  );
  expect(parsed.age.toString()).toBe("18");
  expect(parsed.firstName).toBe("Jairus");
  expect((parsed.pos as Vec3).z.toString()).toBe("8.3");
});

describe("Should deserialize resolved local schemas", () => {
  const parsed = JSON.parse<Foo>('{"bar":{"baz":"xyz"}}');
  expect(parsed.bar.baz).toBe("xyz");
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
