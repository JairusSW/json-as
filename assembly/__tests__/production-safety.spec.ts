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


@json
class ProductionSafetyKeyedCollectionStruct {
  a: string = "";
  n: f64 = 0;
  b: bool = false;
  arr: f64[] = [];
  tail: i32 = 0;
}


@json
class ProductionSafetyKeyedScalarStruct {
  a: string = "";
  b: i32 = 0;
  c: bool = false;
  d: f64 = 0.0;
  e: string = "";
  f: i32 = 0;
}


@json
class ProductionSafetyRecursiveNode {
  value: i32 = 0;
  child: ProductionSafetyRecursiveNode | null = null;
}


@json
class ProductionSafetyNarrowInteger {
  value: u8 = 7;
}

let malformedInput = "";

function expectProductionReject<T>(data: string): void {
  malformedInput = data;
  expect((): void => {
    JSON.parse<T>(malformedInput);
  }).toThrow();
}

describe("production parsing rejects incomplete source ranges", () => {
  if (JSON_STRICT) {
    expect(JSON_STRICT).toBe(true);
    // Default builds validate the complete document before dispatching to fast
    // parsers. Unsafe trusted-input behavior requires an explicit opt-out.
    expectProductionReject<JSON.Obj>('{"x":1,}');
  }

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
  expectProductionReject<string>('"xx');
});

describe("production parsing bounds recursive typed structs", () => {
  let source = "null";
  for (let i = 0; i < 257; i++) source = '{"value":1,"child":' + source + "}";

  expectProductionReject<ProductionSafetyRecursiveNode>(source);

  const healthy = JSON.parse<ProductionSafetyRecursiveNode>(
    '{"value":7,"child":null}',
  );
  expect(healthy.value).toBe(7);
  expect(healthy.child).toBeNull();
  expect(JSON.stringify(healthy)).toBe('{"value":7,"child":null}');
});

describe("typed arrays do not preallocate from whitespace span", () => {
  const source = "[0" + " ".repeat(8 << 20) + "]";
  const pagesBefore = memory.size();
  const parsed = JSON.parse<Float64Array>(source);
  const pagesAfter = memory.size();

  expect(parsed.length).toBe(1);
  expect(parsed[0]).toBe(0.0);
  expect(pagesAfter - pagesBefore <= 8).toBe(true);
});

describe("dynamic objects preserve oversized keys without corrupting slots", () => {
  const key = "a".repeat(65_536);
  const obj = JSON.parse<JSON.Obj>('{"' + key + '":1}');
  const keys = obj.keys();
  expect(keys.length).toBe(1);
  expect(keys[0]).toBe(key);
  expect(obj.has(key)).toBe(true);
  obj.set("z", 2);
  expect(JSON.stringify(obj)).toBe('{"' + key + '":1,"z":2}');
});

describe("production parsing rejects integer range overflow", () => {
  expectProductionReject<u8>("256");
  expectProductionReject<u8>("-1");
  expectProductionReject<i8>("128");
  expectProductionReject<i8>("-129");
  expectProductionReject<u64>("18446744073709551616");
  expectProductionReject<i64>("9223372036854775808");
  expectProductionReject<i64>("-9223372036854775809");
  expectProductionReject<ProductionSafetyNarrowInteger>('{"value":256}');
  expectProductionReject<u8[]>("[256]");
  expectProductionReject<u32[]>("[4294967296]");
  expectProductionReject<u32[]>("[18446744073709551616]");
  expectProductionReject<i32[]>("[2147483648]");
  expectProductionReject<i32[]>("[-2147483649]");
  expectProductionReject<Uint8Array>("[256]");

  const healthy = JSON.parse<ProductionSafetyNarrowInteger>('{"value":7}');
  expect(healthy.value).toBe(7);
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
  expectProductionReject<ProductionSafetyKeyedCollectionStruct>('{"a":"x",}');
  expectProductionReject<ProductionSafetyKeyedScalarStruct>('{"a":"x",}');
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
