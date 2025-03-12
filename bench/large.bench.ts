import { bench } from "./lib/bench";

class Vec3 {
  public x!: number;
  public y!: number;
  public z!: number;
}

class LargeJSON {
  public id!: number;
  public name!: string;
  public age!: number;
  public email!: string;
  public street!: string;
  public city!: string;
  public state!: string;
  public zip!: string;
  public tags!: string[];
  public theme!: string;
  public notifications!: boolean;
  public language!: string;
  public movement!: Vec3[];
}

const v1: LargeJSON = {
  id: 2,
  name: "Medium Object",
  age: 18,
  email: "me@jairus.dev",
  street: "I don't want to say my street",
  city: "I don't want to say this either",
  state: "It really depends",
  zip: "I forget what it is",
  tags: ["me", "dogs", "mountains", "bar", "foo"],
  theme: "Hyper Term Black",
  notifications: true,
  language: "en-US",
  movement: [
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: 1, y: 2, z: 3 },
  ],
};

const v2 = `{"id":2,"name":"Medium Object","age":18,"email":"me@jairus.dev","street":"I don't want to say my street","city":"I don't want to say this either","state":"It really depends","zip":"I forget what it is","tags":["me","dogs","mountains","bar","foo"],"theme":"Hyper Term Black","notifications":true,"language":"en-US","movement":[{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3},{"x":1,"y":2,"z":3}]}`;

bench(
  "Serialize Medium Object",
  () => {
    JSON.stringify(v1);
  },
  3_000_00,
);

bench(
  "Deserialize Medium Object",
  () => {
    JSON.parse(v2);
  },
  3_000_00,
);
