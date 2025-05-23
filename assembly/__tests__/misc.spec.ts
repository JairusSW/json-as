// misc.spec.ts

import { JSON } from "../";
import { describe, expect } from "./lib";

@json
class Obj {
  a: string = "hello";
  b: string = "world";
  c: string = '"\t\f\u0000\u0001';
}

@json
class Vec3 {
  x: f32 = 0.0;
  y: f32 = 0.0;
  z: f32 = 0.0;
}

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

@json class Point {}

@json
class NewPoint {
  x: f64 = 0.0;
  y: f64 = 0.0;

  constructor(x: f64, y: f64) {
    this.x = x;
    this.y = y;
  }

  @serializer
  serializer(self: NewPoint): string {
    return `x=${self.x},y=${self.y}`;
  }

  @deserializer
  deserializer(data: string): NewPoint {
    const c = data.indexOf(",");
    const x = data.slice(2, c);
    const y = data.slice(c + 3);
    return new NewPoint(f64.parse(x), f64.parse(y));
  }
}

@json class InnerObj<T> { obj: T = instantiate<T>(); }
@json class ObjWithBracketString { data: string = ""; }

@json
class Foo {
  id: string = "";
  firstName: string = "";
  lastName: string = "";
}

@json
class SrvInfo {
  accessUrl: string = "https://example.com";
  cardTypes: i32[] = [1, 2, 3];
  customService: string = "Contact us at support@example.com";
  invoiceApplicationStatus: i32 = 1;
  isCertification: bool = true;
  isOnlineRecharge: bool = false;
  loginTypes: i32[] = [0, 1];
  record: string = "ICP 12345678";
  regCompanyAudit: i32 = 2;
  regCompanyPipeline: i32[] = [101, 102, 103];
  regPwdLimit: i32 = 8;
  serverTime: i64 = 1650000000000;
  srvDescription: string = "A demo service for handling customer operations.";
  srvHiddenMenu: string[] = ["admin", "beta"];
  srvHost: string = "srv.example.com";
  srvId: i32 = 999;
  srvKeywords: string[] = ["finance", "payments", "online"];
  srvLogoImgUrl: string = "https://example.com/logo.png";
  srvName: string = "ExampleService";
  srvPageId: i32 = 5;
  thirdAuthUrl: string = "https://auth.example.com";
  userCenterStyle: i32 = 1;
}

// ==== Test Cases ====

describe("Basic JSON.stringify behavior", () => {
  expect(JSON.stringify(new Obj())).toBe('{"a":"hello","b":"world","c":"\\"\\t\\f\\u0000\\u0001"}');

  const player: Player = {
    firstName: "Jairus",
    lastName: "Tanaka",
    lastActive: [2, 7, 2025],
    age: 18,
    pos: { x: 3.4, y: 1.2, z: 8.3 },
    isVerified: true,
  };

  expect(JSON.stringify(player)).toBe(
    '{"age":18,"pos":{"x":3.4,"y":1.2,"z":8.3},"first name":"Jairus","lastName":"Tanaka","lastActive":[2,7,2025],"isVerified":true}'
  );

  const raw = JSON.Raw.from('"hello world"');
  expect(JSON.stringify<JSON.Raw>(raw)).toBe('"hello world"');

  const emptyObj = new JSON.Obj();
  expect(JSON.stringify(emptyObj)).toBe("{}");

  emptyObj.set("x", 1.5);
  emptyObj.set("y", 5.4);
  emptyObj.set("z", 9.8);
  expect(JSON.stringify(emptyObj)).toBe('{"x":1.5,"y":5.4,"z":9.8}');
});

describe("Parse and stringify combinations", () => {
  const input = '{"x":3.4,"y":1.2,"z":8.3}';
  const parsed = JSON.parse<JSON.Obj>(input);
  expect(JSON.stringify(parsed)).toBe(input);

  const strange = JSON.parse<InnerObj<ObjWithBracketString>>('{"obj":{"data":"hello} world"}}');
  expect(JSON.stringify(strange)).toBe('{"obj":{"data":"hello} world"}}');

  const point = new Point();
  expect(JSON.stringify(point)).toBe('{}');
  expect(JSON.stringify(JSON.parse<Point>(JSON.stringify(point)))).toBe('{}');

  const np = new NewPoint(1.0, 2.0);
  const ser = JSON.stringify(np);
  expect(ser).toBe('x=1.0,y=2.0');
  expect(JSON.stringify(JSON.parse<NewPoint>(ser))).toBe('x=1.0,y=2.0');
});

describe("SrvInfo consistency", () => {
  const srv = new SrvInfo();
  const serialized = JSON.stringify(srv);
  const expected = '{"accessUrl":"https://example.com","cardTypes":[1,2,3],"customService":"Contact us at support@example.com","invoiceApplicationStatus":1,"isCertification":true,"isOnlineRecharge":false,"loginTypes":[0,1],"record":"ICP 12345678","regCompanyAudit":2,"regCompanyPipeline":[101,102,103],"regPwdLimit":8,"serverTime":1650000000000,"srvDescription":"A demo service for handling customer operations.","srvHiddenMenu":["admin","beta"],"srvHost":"srv.example.com","srvId":999,"srvKeywords":["finance","payments","online"],"srvLogoImgUrl":"https://example.com/logo.png","srvName":"ExampleService","srvPageId":5,"thirdAuthUrl":"https://auth.example.com","userCenterStyle":1}';

  expect(serialized).toBe(expected);
  const parsed = JSON.parse<SrvInfo>(serialized);
  expect(JSON.stringify(parsed)).toBe(expected);
});
