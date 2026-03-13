import { JSON } from "..";
import { describe, expect } from "as-test";
import { ObjWithStrangeKey, OmitIf, Vec3 } from "./types";


@json
class AliasEnvelope {

  @alias("first name")
  firstName: string = "";


  @alias("last name")
  lastName: string = "";
}


@json
class FeaturePlayer {
  firstName: string = "";
  lastName: string = "";
  lastActive: i32[] = [];


  @omitif((self: FeaturePlayer) => self.age < 18)
  age: i32 = 0;


  @omitnull()
  pos: Vec3 | null = null;
  isVerified: bool = false;
}

describe("Should serialize and deserialize aliased keys", () => {
  const alias = new AliasEnvelope();
  alias.firstName = "Ada";
  alias.lastName = "Lovelace";

  expect(JSON.stringify(alias)).toBe('{"first name":"Ada","last name":"Lovelace"}');
  expect(JSON.stringify(JSON.parse<AliasEnvelope>('{"first name":"Ada","last name":"Lovelace"}'))).toBe('{"first name":"Ada","last name":"Lovelace"}');
});

describe("Should preserve strange aliased keys across types", () => {
  expect(JSON.stringify<ObjWithStrangeKey<string>>({ data: "value" })).toBe('{"a\\\\\\t\\"\\u0002b`c":"value"}');
  expect(JSON.stringify<ObjWithStrangeKey<i32>>({ data: 42 })).toBe('{"a\\\\\\t\\"\\u0002b`c":42}');
  expect(JSON.stringify<ObjWithStrangeKey<bool>>({ data: true })).toBe('{"a\\\\\\t\\"\\u0002b`c":true}');
});

describe("Should apply omitnull on nullable fields", () => {
  const a = new OmitIf();
  expect(JSON.stringify(a)).toBe('{"y":-1,"x":1,"z":1}');

  a.foo = "set";
  expect(JSON.stringify(a)).toBe('{"y":-1,"foo":"set","x":1,"z":1}');
});

describe("Should apply decorator combinations on imported player type", () => {
  const minor = new FeaturePlayer();
  minor.firstName = "Teen";
  minor.lastName = "User";
  minor.lastActive = [1, 2, 3];
  minor.age = 17;
  minor.pos = null;
  minor.isVerified = false;

  const adult = new FeaturePlayer();
  adult.firstName = "Adult";
  adult.lastName = "User";
  adult.lastActive = [4, 5, 6];
  adult.age = 21;
  adult.pos = new Vec3();
  (adult.pos as Vec3).x = 9.0;
  (adult.pos as Vec3).y = 8.0;
  (adult.pos as Vec3).z = 7.0;
  adult.isVerified = true;

  expect(JSON.stringify(minor)).toBe('{"firstName":"Teen","lastName":"User","lastActive":[1,2,3],"isVerified":false}');
  expect(JSON.stringify(adult)).toBe('{"age":21,"pos":{"x":9.0,"y":8.0,"z":7.0},"firstName":"Adult","lastName":"User","lastActive":[4,5,6],"isVerified":true}');
});

describe("Should deserialize decorated player payloads with omitted fields", () => {
  const parsedMinor = JSON.parse<FeaturePlayer>('{"firstName":"Teen","lastName":"User","lastActive":[1,2,3],"isVerified":false}');
  expect(parsedMinor.firstName).toBe("Teen");
  expect(parsedMinor.lastName).toBe("User");
  expect(parsedMinor.age.toString()).toBe("0");
  expect((parsedMinor.pos == null).toString()).toBe("true");
  expect(parsedMinor.isVerified.toString()).toBe("false");

  const parsedAdult = JSON.parse<FeaturePlayer>('{"firstName":"Adult","lastName":"User","lastActive":[4,5,6],"age":21,"pos":{"x":9.0,"y":8.0,"z":7.0},"isVerified":true}');
  expect(parsedAdult.age.toString()).toBe("21");
  expect((parsedAdult.pos as Vec3).x.toString()).toBe("9.0");
  expect((parsedAdult.pos as Vec3).z.toString()).toBe("7.0");
});
