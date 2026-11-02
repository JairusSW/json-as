import { JSON } from "..";
import { bs } from "../../lib/as-bs";
import { describe, expect } from "as-test";
let owner: CallbackOwner | null = null;
let exceeded = false;
let growArray = false;


@json
class ChangeLater {

  @serializer("any")
  serialize(self: ChangeLater): string {
    if (growArray) {
      owner!.numbers = new Array<i32>(4_000);
      owner!.numbers.fill(7);
    } else owner!.text = "z".repeat(4_000);
    return "0";
  }
}


@json
class ObserveCapacity {

  @serializer("any")
  serialize(self: ObserveCapacity): string {
    exceeded = bs.offset - bs.buffer > bs.bufferSize;
    return "0";
  }
}


@json
class CallbackOwner {
  change: ChangeLater = new ChangeLater();
  text!: string;
  numbers: i32[] = [];
  observe: ObserveCapacity = new ObserveCapacity();
}
describe("field writes remain within capacity after earlier callback mutations", () => {
  bs.reset();
  // Keep actual storage large so an advertised-capacity violation is observed
  // without writing outside the allocated block.
  bs.resize(32_768);
  bs.bufferSize = 1_024;
  growArray = false;
  owner = new CallbackOwner();
  owner!.text = "x";
  JSON.stringify(owner!);
  bs.resize(32_768);
  bs.reset();
  expect(exceeded).toBe(false);
});

describe("integer array writes reserve current size after callback mutations", () => {
  bs.reset();
  bs.resize(32_768);
  bs.bufferSize = 1_024;
  growArray = true;
  exceeded = false;
  owner = new CallbackOwner();
  owner!.text = "x";
  JSON.stringify(owner!);
  bs.resize(32_768);
  bs.reset();
  expect(exceeded).toBe(false);
});
