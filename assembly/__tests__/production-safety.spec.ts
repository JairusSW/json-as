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
