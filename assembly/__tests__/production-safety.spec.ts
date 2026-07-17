import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class ProductionSafetyStruct {
  dynamic: JSON.Value = JSON.Value.empty();
}


@json
class ProductionSafetyMapStruct {
  lookup: Map<string, JSON.Value> = new Map<string, JSON.Value>();
}


@json({ lazy: "all" })
class ProductionSafetyLazyStruct {
  dynamic: JSON.Lazy<JSON.Obj> = new JSON.Obj();
  lookup: JSON.Lazy<Map<string, JSON.Value>> = new Map<string, JSON.Value>();
}


@json
class ProductionSafetySlowStruct {
  a: string = "";
  n: f64 = 0;
  b: bool = false;
  arr: f64[] = [];
}

let malformedInput = "";

function expectProductionReject<T>(data: string): void {
  malformedInput = data;
  expect((): void => {
    JSON.parse<T>(malformedInput);
  }).toThrow();
}

describe("production parsing rejects incomplete source ranges", () => {
  // Lazy values must never retain an absent/zero end pointer. Materializing or
  // serializing such a slice can otherwise read outside the source value.
  expectProductionReject<JSON.Value>('"unterminated');
  expectProductionReject<JSON.Value>('{"a":1');
  expectProductionReject<JSON.Value>("[1,2");
  expectProductionReject<JSON.Value[]>('[{"a":1]');

  // A nested value must not consume its owner's closing delimiter and let the
  // owner report success after merely exhausting srcEnd.
  expectProductionReject<JSON.Obj>('{"k":{"a":1}');
  expectProductionReject<JSON.Arr>("[[1]");
  expectProductionReject<ProductionSafetyStruct>('{"dynamic":{"a":1}');
  expectProductionReject<ProductionSafetyMapStruct>('{"lookup":{"k":{"a":1}}');
  expectProductionReject<ProductionSafetyLazyStruct>('{"dynamic":{"a":1}');
  expectProductionReject<ProductionSafetyLazyStruct>('{"lookup":{"k":{"a":1}}');
  expectProductionReject<Map<string, JSON.Value>>('{"k":{"a":1}');
  expectProductionReject<Map<string, JSON.Obj>>('{"k":{"a":1}');

  // Whole-value decoders perform wide loads and quote stripping, so truncated
  // roots need explicit bounds guards in ordinary production builds.
  expectProductionReject<JSON.Value>("t");
  expectProductionReject<JSON.Value>("fals");
  expectProductionReject<JSON.Value>("nul");
  expectProductionReject<bool>("t");
  expectProductionReject<string>('"');
});

describe("production parsing reports cold malformed paths at the boundary", () => {
  // These parsers already recognize the malformed token or delimiter. They
  // return a zero cursor internally so try-as sees the public JSON.parse throw,
  // rather than an unrecoverable runtime abort from inside the library.
  expectProductionReject<f64[]>("[1,,2]");
  expectProductionReject<i32[]>("[[");
  expectProductionReject<bool[]>("[true,fals]");
  expectProductionReject<string[]>('["x",,]');
  expectProductionReject<string[]>('["\\uqqqq"]');
  expectProductionReject<JSON.Value[]>("[nul]");
  expectProductionReject<ProductionSafetySlowStruct>('{"a":"x",}');
  expectProductionReject<ProductionSafetySlowStruct>('{"a":"x",,"n":1}');
  expectProductionReject<ProductionSafetySlowStruct>('{"a" "x"}');
  expectProductionReject<ProductionSafetySlowStruct[]>('[{"a":"x"}');

  // The error bit is consumed by the rejecting boundary and cannot poison a
  // later parse after the caller catches the error.
  const valid = JSON.parse<ProductionSafetySlowStruct>(
    '{"arr":[1.5],"b":true,"n":2,"a":"ok"}',
  );
  expect(valid.a).toBe("ok");
  expect(valid.n).toBe(2.0);
  expect(valid.b).toBe(true);
  expect(valid.arr[0]).toBe(1.5);
});
