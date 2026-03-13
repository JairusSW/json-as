import { JSON } from "..";
import { describe, expect } from "as-test";
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


@json
class Team {
  players: Player[] = [];
}

describe("Should resolve imported schemas", () => {
  expect(JSON.stringify(player)).toBe('{"age":18,"pos":{"x":3.4,"y":1.2,"z":8.3},"first name":"Jairus","lastName":"Tanaka","lastActive":[3,9,2025],"isVerified":true}');
});

describe("Should resolve local schemas", () => {
  expect(JSON.stringify(new Foo())).toBe('{"bar":{"baz":"buz"}}');
});

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe('"regression"');
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe('["a","b","c"]');
});

describe("Should deserialize resolved imported schemas", () => {
  const parsed = JSON.parse<Player>('{"age":18,"pos":{"x":3.4,"y":1.2,"z":8.3},"first name":"Jairus","lastName":"Tanaka","lastActive":[3,9,2025],"isVerified":true}');
  expect(parsed.age.toString()).toBe("18");
  expect(parsed.firstName).toBe("Jairus");
  expect((parsed.pos as Vec3).z.toString()).toBe("8.3");
});

describe("Should deserialize resolved local schemas", () => {
  const parsed = JSON.parse<Foo>('{"bar":{"baz":"xyz"}}');
  expect(parsed.bar.baz).toBe("xyz");
});

describe("Should resolve imported schemas inside arrays", () => {
  const parsed = JSON.parse<Team>('{"players":[{"age":18,"pos":{"x":3.4,"y":1.2,"z":8.3},"first name":"Jairus","lastName":"Tanaka","lastActive":[3,9,2025],"isVerified":true},{"age":19,"pos":null,"first name":"A","lastName":"B","lastActive":[1,2,3],"isVerified":false}]}');
  expect(parsed.players.length.toString()).toBe("2");
  expect(parsed.players[0].firstName).toBe("Jairus");
  expect(parsed.players[1].age.toString()).toBe("19");
  expect((parsed.players[1].pos == null).toString()).toBe("true");
});

describe("Should resolve local nested schemas repeatedly", () => {
  const parsed = JSON.parse<Foo>('{"bar":{"baz":"buz"}}');
  expect(parsed.bar.baz).toBe("buz");
  expect(JSON.stringify(parsed)).toBe('{"bar":{"baz":"buz"}}');
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
