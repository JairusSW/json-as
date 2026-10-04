import { JSON } from "..";
import { describe, expect } from "as-test";


@json class Child {
  value: i32 = 0;
}


@json class Mixed {
  n000: i32 = 0;
  n001: i32 = 0;
  n002: i32 = 0;
  n003: i32 = 0;
  n004: i32 = 0;
  n005: i32 = 0;
  n006: i32 = 0;
  n007: i32 = 0;
  n008: i32 = 0;
  n009: i32 = 0;
  n010: i32 = 0;
  n011: i32 = 0;
  s000: string = "";
  s001: string = "";
  s002: string = "";
  s003: string = "";
  s004: string = "";
  s005: string = "";
  s006: string = "";
  s007: string = "";
  s008: string = "";
  s009: string = "";
  s010: string = "";
  s011: string = "";
  a000: i32[] = [];
  a001: i32[] = [];
  a002: i32[] = [];
  a003: i32[] = [];
  a004: i32[] = [];
  a005: i32[] = [];
  a006: i32[] = [];
  a007: i32[] = [];
  a008: i32[] = [];
  a009: i32[] = [];
  a010: i32[] = [];
  a011: i32[] = [];
  o000: Child = new Child();
  o001: Child = new Child();
  o002: Child = new Child();
  o003: Child = new Child();
  o004: Child = new Child();
  o005: Child = new Child();
  o006: Child = new Child();
  o007: Child = new Child();
  o008: Child = new Child();
  o009: Child = new Child();
  o010: Child = new Child();
  o011: Child = new Child();
  b000: bool = false;
  b001: bool = false;
  b002: bool = false;
  b003: bool = false;
  b004: bool = false;
  b005: bool = false;
  b006: bool = false;
  b007: bool = false;
  b008: bool = false;
  b009: bool = false;
  b010: bool = false;
  b011: bool = false;
  z000: string | null = null;
  z001: string | null = null;
  z002: string | null = null;
  z003: string | null = null;
  z004: string | null = null;
  z005: string | null = null;
  z006: string | null = null;
  z007: string | null = null;
  z008: string | null = null;
  z009: string | null = null;
  z010: string | null = null;
  z011: string | null = null;
}
describe("Wide key dispatch preserves all value kinds and reuse", () => {
  const src =
    '{"z011":null,"z010":null,"z009":null,"z008":null,"z007":null,"z006":null,"z005":null,"z004":null,"z003":null,"z002":null,"z001":null,"z000":null,"b011":true,"b010":true,"b009":true,"b008":true,"b007":true,"b006":true,"b005":true,"b004":true,"b003":true,"b002":true,"b001":true,"b000":true,"o011":{"value":5},"o010":{"value":5},"o009":{"value":5},"o008":{"value":5},"o007":{"value":5},"o006":{"value":5},"o005":{"value":5},"o004":{"value":5},"o003":{"value":5},"o002":{"value":5},"o001":{"value":5},"o000":{"value":5},"a011":[1,2],"a010":[1,2],"a009":[1,2],"a008":[1,2],"a007":[1,2],"a006":[1,2],"a005":[1,2],"a004":[1,2],"a003":[1,2],"a002":[1,2],"a001":[1,2],"a000":[1,2],"s011":"text","s010":"text","s009":"text","s008":"text","s007":"text","s006":"text","s005":"text","s004":"text","s003":"text","s002":"text","s001":"text","s000":"text","n011":7,"n010":7,"n009":7,"n008":7,"n007":7,"n006":7,"n005":7,"n004":7,"n003":7,"n002":7,"n001":7,"n000":7}';
  const expected =
    '{"n000":7,"n001":7,"n002":7,"n003":7,"n004":7,"n005":7,"n006":7,"n007":7,"n008":7,"n009":7,"n010":7,"n011":7,"s000":"text","s001":"text","s002":"text","s003":"text","s004":"text","s005":"text","s006":"text","s007":"text","s008":"text","s009":"text","s010":"text","s011":"text","a000":[1,2],"a001":[1,2],"a002":[1,2],"a003":[1,2],"a004":[1,2],"a005":[1,2],"a006":[1,2],"a007":[1,2],"a008":[1,2],"a009":[1,2],"a010":[1,2],"a011":[1,2],"o000":{"value":5},"o001":{"value":5},"o002":{"value":5},"o003":{"value":5},"o004":{"value":5},"o005":{"value":5},"o006":{"value":5},"o007":{"value":5},"o008":{"value":5},"o009":{"value":5},"o010":{"value":5},"o011":{"value":5},"b000":true,"b001":true,"b002":true,"b003":true,"b004":true,"b005":true,"b006":true,"b007":true,"b008":true,"b009":true,"b010":true,"b011":true,"z000":null,"z001":null,"z002":null,"z003":null,"z004":null,"z005":null,"z006":null,"z007":null,"z008":null,"z009":null,"z010":null,"z011":null}';
  expect(JSON.stringify(JSON.parse<Mixed>(src))).toBe(expected);
  const out = new Mixed();
  expect(JSON.stringify(JSON.parse<Mixed>(src, out))).toBe(expected);
  expect(JSON.stringify(JSON.parse<Mixed>(src, out))).toBe(expected);
});
describe("Wide key dispatch keeps duplicate and missing member behavior", () => {
  const out = JSON.parse<Mixed>('{"n011":1,"n000":2,"n011":9}');
  expect(out.n011).toBe(9);
  expect(out.n000).toBe(2);
  expect(out.n010).toBe(0);
});


@json class Aliased {

  @alias("aAz") field0: i32 = 0;


  @alias("aZz") field1: i32 = 0;


  @alias("aaz") field2: i32 = 0;


  @alias("azz") field3: i32 = 0;


  @alias("a\u00ffz") field4: i32 = 0;


  @alias("a\u0100z") field5: i32 = 0;


  @alias("a\u7fffz") field6: i32 = 0;


  @alias("a\u8000z") field7: i32 = 0;


  @alias("a\u9fffz") field8: i32 = 0;


  @alias("a\ue000z") field9: i32 = 0;


  @alias("a\uffffz") field10: i32 = 0;


  @alias("a\u0391z") field11: i32 = 0;
}
describe("Wide key dispatch uses unsigned UTF-16 aliases", () => {
  const out = JSON.parse<Aliased>(
    '{"a\u0391z":12,"a\uffffz":11,"a\ue000z":10,"a\u9fffz":9,"a\u8000z":8,"a\u7fffz":7,"a\u0100z":6,"a\u00ffz":5,"azz":4,"aaz":3,"aZz":2,"aAz":1}',
  );
  expect(out.field0).toBe(1);
  expect(out.field1).toBe(2);
  expect(out.field2).toBe(3);
  expect(out.field3).toBe(4);
  expect(out.field4).toBe(5);
  expect(out.field5).toBe(6);
  expect(out.field6).toBe(7);
  expect(out.field7).toBe(8);
  expect(out.field8).toBe(9);
  expect(out.field9).toBe(10);
  expect(out.field10).toBe(11);
  expect(out.field11).toBe(12);
});


@json class Generic<T> {
  g000: T;
  g001: T;
  g002: T;
  g003: T;
  g004: T;
  g005: T;
  g006: T;
  g007: T;
  g008: T;
  g009: T;
  g010: T;
  g011: T;
}
describe("Wide generic dispatch i32", () => {
  const out = JSON.parse<Generic<i32>>(
    '{"g011":11,"g010":11,"g009":11,"g008":11,"g007":11,"g006":11,"g005":11,"g004":11,"g003":11,"g002":11,"g001":11,"g000":11}',
  );
  expect(out.g000).toBe(11);
  expect(out.g001).toBe(11);
  expect(out.g002).toBe(11);
  expect(out.g003).toBe(11);
  expect(out.g004).toBe(11);
  expect(out.g005).toBe(11);
  expect(out.g006).toBe(11);
  expect(out.g007).toBe(11);
  expect(out.g008).toBe(11);
  expect(out.g009).toBe(11);
  expect(out.g010).toBe(11);
  expect(out.g011).toBe(11);
});
describe("Wide generic dispatch string", () => {
  const out = JSON.parse<Generic<string>>(
    '{"g011":"generic","g010":"generic","g009":"generic","g008":"generic","g007":"generic","g006":"generic","g005":"generic","g004":"generic","g003":"generic","g002":"generic","g001":"generic","g000":"generic"}',
  );
  expect(out.g000).toBe("generic");
  expect(out.g001).toBe("generic");
  expect(out.g002).toBe("generic");
  expect(out.g003).toBe("generic");
  expect(out.g004).toBe("generic");
  expect(out.g005).toBe("generic");
  expect(out.g006).toBe("generic");
  expect(out.g007).toBe("generic");
  expect(out.g008).toBe("generic");
  expect(out.g009).toBe("generic");
  expect(out.g010).toBe("generic");
  expect(out.g011).toBe("generic");
});
describe("Wide generic dispatch bool", () => {
  const out = JSON.parse<Generic<bool>>(
    '{"g011":true,"g010":true,"g009":true,"g008":true,"g007":true,"g006":true,"g005":true,"g004":true,"g003":true,"g002":true,"g001":true,"g000":true}',
  );
  expect(out.g000).toBe(true);
  expect(out.g001).toBe(true);
  expect(out.g002).toBe(true);
  expect(out.g003).toBe(true);
  expect(out.g004).toBe(true);
  expect(out.g005).toBe(true);
  expect(out.g006).toBe(true);
  expect(out.g007).toBe(true);
  expect(out.g008).toBe(true);
  expect(out.g009).toBe(true);
  expect(out.g010).toBe(true);
  expect(out.g011).toBe(true);
});


@json({ lazy: "all" }) class Lazy {
  l000: i32 = 0;
  l001: i32 = 0;
  l002: i32 = 0;
  l003: i32 = 0;
  l004: i32 = 0;
  l005: i32 = 0;
  l006: i32 = 0;
  l007: i32 = 0;
  l008: i32 = 0;
  l009: i32 = 0;
  l010: i32 = 0;
  l011: i32 = 0;
}
describe("Wide lazy dispatch retains deferred values", () => {
  const out = JSON.parse<Lazy>(
    '{"l011":12,"l010":11,"l009":10,"l008":9,"l007":8,"l006":7,"l005":6,"l004":5,"l003":4,"l002":3,"l001":2,"l000":1}',
  );
  expect(out.l000).toBe(1);
  expect(out.l001).toBe(2);
  expect(out.l002).toBe(3);
  expect(out.l003).toBe(4);
  expect(out.l004).toBe(5);
  expect(out.l005).toBe(6);
  expect(out.l006).toBe(7);
  expect(out.l007).toBe(8);
  expect(out.l008).toBe(9);
  expect(out.l009).toBe(10);
  expect(out.l010).toBe(11);
  expect(out.l011).toBe(12);
});

let unknownInput = "";
describe("Wide dispatch keeps same-length unknown-key behavior", () => {
  const inputs = [
    '{"n999":1,"n000":23}',
    '{"s999":"unknown","n000":23}',
    '{"a999":[1,2],"n000":23}',
    '{"o999":{"value":2},"n000":23}',
    '{"b999":true,"n000":23}',
    '{"b999":false,"n000":23}',
    '{"z999":null,"n000":23}',
    '{"x999":7,"n000":23}',
  ];
  for (let i = 0; i < inputs.length; i++) {
    unknownInput = inputs[i];
    if (!JSON_STRICT) {
      const expected = JSON.stringify(JSON.parse<Mixed>('{"n000":23}'));
      expect(JSON.stringify(JSON.parse<Mixed>(unknownInput))).toBe(expected);
    }
  }
});


@json class MixedGeneric<T> {
  z009: T;
  z001: i32[] = [];
  z002: i32[] = [];
  z003: i32[] = [];
  z004: i32[] = [];
  z005: i32[] = [];
  z006: i32[] = [];
  z007: i32[] = [];
  z008: i32[] = [];
}
describe("Wide dispatch retains an originally first generic array candidate", () => {
  const out = JSON.parse<MixedGeneric<i32[]>>(
    '{"z009":[9],"z008":[8],"z007":[7],"z006":[6],"z005":[5],"z004":[4],"z003":[3],"z002":[2],"z001":[1]}',
  );
  expect(out.z009[0]).toBe(9);
  expect(out.z001[0]).toBe(1);
  expect(out.z008[0]).toBe(8);
});


@json class DuplicateAlias<T> {

  @alias("z999") generic: T;


  @alias("z999") fallback: i32 = 0;
  z001: i32 = 0;
  z002: i32 = 0;
  z003: i32 = 0;
  z004: i32 = 0;
  z005: i32 = 0;
  z006: i32 = 0;
  z007: i32 = 0;
  z008: i32 = 0;
}
describe("Wide dispatch preserves duplicate alias order and generic guards", () => {
  const number = JSON.parse<DuplicateAlias<i32>>('{"z999":9}');
  expect(number.generic).toBe(9);
  expect(number.fallback).toBe(0);
  const fallback = JSON.parse<DuplicateAlias<string>>('{"z999":9}');
  expect(fallback.generic).toBe("");
  expect(fallback.fallback).toBe(9);
  const text = JSON.parse<DuplicateAlias<string>>('{"z999":"text"}');
  expect(text.generic).toBe("text");
  expect(text.fallback).toBe(0);
});
describe("Wide generic dispatch i32[]", () => {
  const out = JSON.parse<Generic<i32[]>>(
    '{"g011":[4,5],"g010":[4,5],"g009":[4,5],"g008":[4,5],"g007":[4,5],"g006":[4,5],"g005":[4,5],"g004":[4,5],"g003":[4,5],"g002":[4,5],"g001":[4,5],"g000":[4,5]}',
  );
  expect(out.g000[1]).toBe(5);
  expect(out.g001[1]).toBe(5);
  expect(out.g002[1]).toBe(5);
  expect(out.g003[1]).toBe(5);
  expect(out.g004[1]).toBe(5);
  expect(out.g005[1]).toBe(5);
  expect(out.g006[1]).toBe(5);
  expect(out.g007[1]).toBe(5);
  expect(out.g008[1]).toBe(5);
  expect(out.g009[1]).toBe(5);
  expect(out.g010[1]).toBe(5);
  expect(out.g011[1]).toBe(5);
});
describe("Wide generic dispatch Child", () => {
  const out = JSON.parse<Generic<Child>>(
    '{"g011":{"value":8},"g010":{"value":8},"g009":{"value":8},"g008":{"value":8},"g007":{"value":8},"g006":{"value":8},"g005":{"value":8},"g004":{"value":8},"g003":{"value":8},"g002":{"value":8},"g001":{"value":8},"g000":{"value":8}}',
  );
  expect(out.g000.value).toBe(8);
  expect(out.g001.value).toBe(8);
  expect(out.g002.value).toBe(8);
  expect(out.g003.value).toBe(8);
  expect(out.g004.value).toBe(8);
  expect(out.g005.value).toBe(8);
  expect(out.g006.value).toBe(8);
  expect(out.g007.value).toBe(8);
  expect(out.g008.value).toBe(8);
  expect(out.g009.value).toBe(8);
  expect(out.g010.value).toBe(8);
  expect(out.g011.value).toBe(8);
});
describe("Wide generic dispatch string | null", () => {
  const out = JSON.parse<Generic<string | null>>(
    '{"g011":null,"g010":null,"g009":null,"g008":null,"g007":null,"g006":null,"g005":null,"g004":null,"g003":null,"g002":null,"g001":null,"g000":null}',
  );
  expect(out.g000 === null).toBe(true);
  expect(out.g001 === null).toBe(true);
  expect(out.g002 === null).toBe(true);
  expect(out.g003 === null).toBe(true);
  expect(out.g004 === null).toBe(true);
  expect(out.g005 === null).toBe(true);
  expect(out.g006 === null).toBe(true);
  expect(out.g007 === null).toBe(true);
  expect(out.g008 === null).toBe(true);
  expect(out.g009 === null).toBe(true);
  expect(out.g010 === null).toBe(true);
  expect(out.g011 === null).toBe(true);
});


@json({ lazy: "all" }) class LazyMixed {
  n000: i32 = 0;
  n001: i32 = 0;
  n002: i32 = 0;
  n003: i32 = 0;
  n004: i32 = 0;
  n005: i32 = 0;
  n006: i32 = 0;
  n007: i32 = 0;
  n008: i32 = 0;
  n009: i32 = 0;
  n010: i32 = 0;
  n011: i32 = 0;
  s000: string = "";
  s001: string = "";
  s002: string = "";
  s003: string = "";
  s004: string = "";
  s005: string = "";
  s006: string = "";
  s007: string = "";
  s008: string = "";
  s009: string = "";
  s010: string = "";
  s011: string = "";
  a000: i32[] = [];
  a001: i32[] = [];
  a002: i32[] = [];
  a003: i32[] = [];
  a004: i32[] = [];
  a005: i32[] = [];
  a006: i32[] = [];
  a007: i32[] = [];
  a008: i32[] = [];
  a009: i32[] = [];
  a010: i32[] = [];
  a011: i32[] = [];
  o000: Child = new Child();
  o001: Child = new Child();
  o002: Child = new Child();
  o003: Child = new Child();
  o004: Child = new Child();
  o005: Child = new Child();
  o006: Child = new Child();
  o007: Child = new Child();
  o008: Child = new Child();
  o009: Child = new Child();
  o010: Child = new Child();
  o011: Child = new Child();
  b000: bool = false;
  b001: bool = false;
  b002: bool = false;
  b003: bool = false;
  b004: bool = false;
  b005: bool = false;
  b006: bool = false;
  b007: bool = false;
  b008: bool = false;
  b009: bool = false;
  b010: bool = false;
  b011: bool = false;
  z000: string | null = "sentinel";
  z001: string | null = "sentinel";
  z002: string | null = "sentinel";
  z003: string | null = "sentinel";
  z004: string | null = "sentinel";
  z005: string | null = "sentinel";
  z006: string | null = "sentinel";
  z007: string | null = "sentinel";
  z008: string | null = "sentinel";
  z009: string | null = "sentinel";
  z010: string | null = "sentinel";
  z011: string | null = "sentinel";
}
describe("Wide lazy dispatch retains every value kind", () => {
  const out = JSON.parse<LazyMixed>(
    '{"z011":null,"z010":null,"z009":null,"z008":null,"z007":null,"z006":null,"z005":null,"z004":null,"z003":null,"z002":null,"z001":null,"z000":null,"b011":true,"b010":true,"b009":true,"b008":true,"b007":true,"b006":true,"b005":true,"b004":true,"b003":true,"b002":true,"b001":true,"b000":true,"o011":{"value":5},"o010":{"value":5},"o009":{"value":5},"o008":{"value":5},"o007":{"value":5},"o006":{"value":5},"o005":{"value":5},"o004":{"value":5},"o003":{"value":5},"o002":{"value":5},"o001":{"value":5},"o000":{"value":5},"a011":[1,2],"a010":[1,2],"a009":[1,2],"a008":[1,2],"a007":[1,2],"a006":[1,2],"a005":[1,2],"a004":[1,2],"a003":[1,2],"a002":[1,2],"a001":[1,2],"a000":[1,2],"s011":"text","s010":"text","s009":"text","s008":"text","s007":"text","s006":"text","s005":"text","s004":"text","s003":"text","s002":"text","s001":"text","s000":"text","n011":7,"n010":7,"n009":7,"n008":7,"n007":7,"n006":7,"n005":7,"n004":7,"n003":7,"n002":7,"n001":7,"n000":7}',
  );
  expect(out.n000).toBe(7);
  expect(out.n001).toBe(7);
  expect(out.n002).toBe(7);
  expect(out.n003).toBe(7);
  expect(out.n004).toBe(7);
  expect(out.n005).toBe(7);
  expect(out.n006).toBe(7);
  expect(out.n007).toBe(7);
  expect(out.n008).toBe(7);
  expect(out.n009).toBe(7);
  expect(out.n010).toBe(7);
  expect(out.n011).toBe(7);
  expect(out.s000).toBe("text");
  expect(out.s001).toBe("text");
  expect(out.s002).toBe("text");
  expect(out.s003).toBe("text");
  expect(out.s004).toBe("text");
  expect(out.s005).toBe("text");
  expect(out.s006).toBe("text");
  expect(out.s007).toBe("text");
  expect(out.s008).toBe("text");
  expect(out.s009).toBe("text");
  expect(out.s010).toBe("text");
  expect(out.s011).toBe("text");
  expect(out.a000[1]).toBe(2);
  expect(out.a001[1]).toBe(2);
  expect(out.a002[1]).toBe(2);
  expect(out.a003[1]).toBe(2);
  expect(out.a004[1]).toBe(2);
  expect(out.a005[1]).toBe(2);
  expect(out.a006[1]).toBe(2);
  expect(out.a007[1]).toBe(2);
  expect(out.a008[1]).toBe(2);
  expect(out.a009[1]).toBe(2);
  expect(out.a010[1]).toBe(2);
  expect(out.a011[1]).toBe(2);
  expect(out.o000.value).toBe(5);
  expect(out.o001.value).toBe(5);
  expect(out.o002.value).toBe(5);
  expect(out.o003.value).toBe(5);
  expect(out.o004.value).toBe(5);
  expect(out.o005.value).toBe(5);
  expect(out.o006.value).toBe(5);
  expect(out.o007.value).toBe(5);
  expect(out.o008.value).toBe(5);
  expect(out.o009.value).toBe(5);
  expect(out.o010.value).toBe(5);
  expect(out.o011.value).toBe(5);
  expect(out.b000).toBe(true);
  expect(out.b001).toBe(true);
  expect(out.b002).toBe(true);
  expect(out.b003).toBe(true);
  expect(out.b004).toBe(true);
  expect(out.b005).toBe(true);
  expect(out.b006).toBe(true);
  expect(out.b007).toBe(true);
  expect(out.b008).toBe(true);
  expect(out.b009).toBe(true);
  expect(out.b010).toBe(true);
  expect(out.b011).toBe(true);
  expect(out.z000 === null).toBe(true);
  expect(out.z001 === null).toBe(true);
  expect(out.z002 === null).toBe(true);
  expect(out.z003 === null).toBe(true);
  expect(out.z004 === null).toBe(true);
  expect(out.z005 === null).toBe(true);
  expect(out.z006 === null).toBe(true);
  expect(out.z007 === null).toBe(true);
  expect(out.z008 === null).toBe(true);
  expect(out.z009 === null).toBe(true);
  expect(out.z010 === null).toBe(true);
  expect(out.z011 === null).toBe(true);
});

describe("Wide nullable dispatch clears non-null reused slots", () => {
  const generic = new Generic<string | null>();
  generic.g000 = "sentinel";
  generic.g001 = "sentinel";
  generic.g002 = "sentinel";
  generic.g003 = "sentinel";
  generic.g004 = "sentinel";
  generic.g005 = "sentinel";
  generic.g006 = "sentinel";
  generic.g007 = "sentinel";
  generic.g008 = "sentinel";
  generic.g009 = "sentinel";
  generic.g010 = "sentinel";
  generic.g011 = "sentinel";
  const parsed = JSON.parse<Generic<string | null>>(
    '{"g011":null,"g010":null,"g009":null,"g008":null,"g007":null,"g006":null,"g005":null,"g004":null,"g003":null,"g002":null,"g001":null,"g000":null}',
    generic,
  );
  expect(parsed.g000 === null).toBe(true);
  expect(parsed.g001 === null).toBe(true);
  expect(parsed.g002 === null).toBe(true);
  expect(parsed.g003 === null).toBe(true);
  expect(parsed.g004 === null).toBe(true);
  expect(parsed.g005 === null).toBe(true);
  expect(parsed.g006 === null).toBe(true);
  expect(parsed.g007 === null).toBe(true);
  expect(parsed.g008 === null).toBe(true);
  expect(parsed.g009 === null).toBe(true);
  expect(parsed.g010 === null).toBe(true);
  expect(parsed.g011 === null).toBe(true);
  const lazy = new LazyMixed();
  lazy.z000 = "sentinel";
  lazy.z001 = "sentinel";
  lazy.z002 = "sentinel";
  lazy.z003 = "sentinel";
  lazy.z004 = "sentinel";
  lazy.z005 = "sentinel";
  lazy.z006 = "sentinel";
  lazy.z007 = "sentinel";
  lazy.z008 = "sentinel";
  lazy.z009 = "sentinel";
  lazy.z010 = "sentinel";
  lazy.z011 = "sentinel";
  const parsedLazy = JSON.parse<LazyMixed>(
    '{"z011":null,"z010":null,"z009":null,"z008":null,"z007":null,"z006":null,"z005":null,"z004":null,"z003":null,"z002":null,"z001":null,"z000":null}',
    lazy,
  );
  expect(parsedLazy.z000 === null).toBe(true);
  expect(parsedLazy.z001 === null).toBe(true);
  expect(parsedLazy.z002 === null).toBe(true);
  expect(parsedLazy.z003 === null).toBe(true);
  expect(parsedLazy.z004 === null).toBe(true);
  expect(parsedLazy.z005 === null).toBe(true);
  expect(parsedLazy.z006 === null).toBe(true);
  expect(parsedLazy.z007 === null).toBe(true);
  expect(parsedLazy.z008 === null).toBe(true);
  expect(parsedLazy.z009 === null).toBe(true);
  expect(parsedLazy.z010 === null).toBe(true);
  expect(parsedLazy.z011 === null).toBe(true);
});


@json class GenericNullable<T> {
  q000: T = changetype<T>("sentinel");
  q001: T = changetype<T>("sentinel");
  q002: T = changetype<T>("sentinel");
  q003: T = changetype<T>("sentinel");
  q004: T = changetype<T>("sentinel");
  q005: T = changetype<T>("sentinel");
  q006: T = changetype<T>("sentinel");
  q007: T = changetype<T>("sentinel");
  q008: T = changetype<T>("sentinel");
  q009: T = changetype<T>("sentinel");
  q010: T = changetype<T>("sentinel");
  q011: T = changetype<T>("sentinel");
}
describe("Wide generic null dispatch overrides declared non-null defaults", () => {
  const control = JSON.parse<GenericNullable<string | null>>("{}");
  expect(control.q000).toBe("sentinel");
  expect(control.q011).toBe("sentinel");
  const out = JSON.parse<GenericNullable<string | null>>(
    '{"q011":null,"q010":null,"q009":null,"q008":null,"q007":null,"q006":null,"q005":null,"q004":null,"q003":null,"q002":null,"q001":null,"q000":null}',
  );
  expect(out.q000 === null).toBe(true);
  expect(out.q001 === null).toBe(true);
  expect(out.q002 === null).toBe(true);
  expect(out.q003 === null).toBe(true);
  expect(out.q004 === null).toBe(true);
  expect(out.q005 === null).toBe(true);
  expect(out.q006 === null).toBe(true);
  expect(out.q007 === null).toBe(true);
  expect(out.q008 === null).toBe(true);
  expect(out.q009 === null).toBe(true);
  expect(out.q010 === null).toBe(true);
  expect(out.q011 === null).toBe(true);
});
