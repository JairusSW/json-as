import { JSON } from "..";
import { bs } from "../../lib/as-bs";
import { describe, expect } from "as-test";

class StringSetOverrides extends Set<string> {
  get size(): i32 {
    return 0;
  }
  values(): string[] {
    return ["override"];
  }
}

class NullableStringSetOverrides extends Set<string | null> {
  get size(): i32 {
    return 0;
  }
  values(): Array<string | null> {
    return ["override"];
  }
}

let mutationTarget: Set<MutatingSetValue> | null = null;


@json
class MutatingSetValue {
  constructor(public value: i32 = 0) {}


  @serializer("any")
  serialize(self: MutatingSetValue): string {
    if (self.value == 1) {
      mutationTarget!.clear();
      mutationTarget!.add(new MutatingSetValue(99));
      JSON.stringify(new Set<string>().add('"\n'.repeat(20000)));
      __collect();
    }
    return self.value.toString();
  }
}

function makeStrings(count: i32): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < count; i++) result.add("item-" + i.toString());
  return result;
}

function makeEscaped(count: i32): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < count; i++)
    result.add('"\\\n\u0000\ud800'.repeat(100) + i.toString());
  return result;
}

describe("String Set traversal preserves live insertion order", () => {
  const values = makeStrings(128);
  for (let i = 1; i < 128; i += 4) values.delete("item-" + i.toString());
  values.delete("item-0");
  values.delete("item-127");
  values.add("item-0");
  expect(JSON.stringify(values)).toBe(JSON.stringify(values.values()));
  values.clear();
  expect(JSON.stringify(values)).toBe("[]");
  values.add("");
  expect(JSON.stringify(values)).toBe('[""]');
});

describe("String Set traversal preserves native subclass semantics", () => {
  const strings = new StringSetOverrides().add("native").add("value");
  expect(JSON.stringify(strings)).toBe('["native","value"]');
  const nullable = new NullableStringSetOverrides().add(null).add("native");
  expect(JSON.stringify(nullable)).toBe('[null,"native"]');
});

describe("Nullable string Sets preserve escaping, nulls and tombstones", () => {
  const values = new Set<string | null>();
  values.add(null).add("").add('quote"\\\n').add("\u0000\ud800\udc00\udfff");
  expect(JSON.stringify(values)).toBe(JSON.stringify(values.values()));
  values.delete(null);
  values.add(null);
  expect(JSON.stringify(values)).toBe(JSON.stringify(values.values()));
});

describe("Temporary string Sets remain rooted across collection and output growth", () => {
  bs.reset();
  bs.resize(1024);
  const expected = JSON.stringify(makeEscaped(24).values());
  for (let i = 0; i < 3; i++) {
    __collect();
    const output = JSON.stringify(makeEscaped(24));
    expect(output).toBe(expected);
    expect(JSON.stringify(new Set<string>().add("small"))).toBe('["small"]');
    __collect();
    expect(output).toBe(expected);
  }
});

describe("Custom Set elements retain a snapshot during reentrant mutation", () => {
  mutationTarget = new Set<MutatingSetValue>();
  mutationTarget!.add(new MutatingSetValue(1));
  mutationTarget!.add(new MutatingSetValue(2));
  mutationTarget!.add(new MutatingSetValue(3));
  expect(JSON.stringify(mutationTarget!)).toBe("[1,2,3]");
  expect(JSON.stringify(mutationTarget!)).toBe("[99]");
  mutationTarget = null;
});
