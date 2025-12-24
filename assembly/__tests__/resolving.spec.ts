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
  expect(JSON.stringify(player)).toBe('{"age":18,"pos":{"x":3.4,"y":1.2,"z":8.3},"first name":"Jairus","lastName":"Tanaka","lastActive":[3,9,2025],"isVerified":true}');
});

describe("Should resolve local schemas", () => {
  expect(JSON.stringify(new Foo())).toBe('{"bar":{"baz":"buz"}}');
});
