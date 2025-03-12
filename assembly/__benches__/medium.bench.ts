import { JSON } from "..";
import { bench } from "../custom/bench";


@json
class MediumJSON {
  public id!: i32;
  public name!: string;
  public age!: i32;
  public email!: string;
  public street!: string;
  public city!: string;
  public state!: string;
  public zip!: string;
  public tags!: string[];
}

const v1: MediumJSON = {
  id: 2,
  name: "Medium Object",
  age: 18,
  email: "me@jairus.dev",
  street: "I don't want to say my street",
  city: "I don't want to say this either",
  state: "It really depends",
  zip: "I forget what it is",
  tags: ["me", "dogs", "mountains", "bar", "foo"],
};

const v2 = `{"id":2,"name":"Medium Object","age":18,"email":"me@jairus.dev","street":"I don't want to say my street","city":"I don't want to say this either","state":"It really depends","zip":"I forget what it is","tags":["me","dogs","mountains","bar","foo"]}`;

// bench(
//   "Serialize Medium Object",
//   () => {
//     JSON.stringify(v1);
//   },
//   8_000_00,
// );

bench(
  "Deserialize Medium Object",
  () => {
    JSON.parse<MediumJSON>(v2);
  },
  8_000_00,
);
