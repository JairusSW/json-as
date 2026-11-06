import { JSON } from "..";
import { describe, expect } from "as-test";
import { claimStringBuffer } from "../deserialize/parseMode";

// Exercise the first lookup before a public parse establishes a scope.
const startupBuffer = "startup-owner".repeat(2);
const startupField = memory.data(2 * sizeof<usize>());
const startupClaim = claimStringBuffer(
  changetype<usize>(startupBuffer),
  startupField,
);
const startupRepeat = claimStringBuffer(
  changetype<usize>(startupBuffer),
  startupField,
);
const startupAlias = claimStringBuffer(
  changetype<usize>(startupBuffer),
  startupField + sizeof<usize>(),
);

describe("ownership lookup works before the first public parse", () => {
  expect(startupClaim).toBe(true);
  expect(startupRepeat).toBe(true);
  expect(startupAlias).toBe(false);
});


@json
class OwnershipRow {
  a0: string = "";
  a1: string = "";
  a2: string = "";
  a3: string = "";
  a4: string = "";
  a5: string = "";
  a6: string = "";
  a7: string = "";
  a8: string = "";
  a9: string = "";
  a10: string = "";
  a11: string = "";
  a12: string = "";
  a13: string = "";
}


@json
class ScopeInner {
  left: string = "";
  right: string = "";
}


@json
class ScopeVector {
  x: i32 = 1;
  y: i32 = 2;
  z: i32 = 3;
}


@json
class ScopeStringVector extends ScopeVector {
  left: string = "";
  right: string = "";
}
let activeOuterInput: string = "";


@json
class ScopeCodec {
  value: ScopeInner = new ScopeInner();


  @deserializer("object")
  decode(source: string): ScopeCodec {
    const point = JSON.parse<ScopeVector>('{"x":4,"y":5,"z":6}');
    assert(point.z == 6);
    const inner = new ScopeInner();
    inner.left = activeOuterInput;
    inner.right = source;
    const result = new ScopeCodec();
    result.value = JSON.parse<ScopeInner>(source, inner);
    return result;
  }
}


@json
class ScopeOuter {
  inner: ScopeCodec = new ScopeCodec();
  tail: string = "";
}


@json
class ScopeBase {
  value: i32 = 0;
}


@json
class ScopeOptionalChild extends ScopeBase {

  @optional label: string = "default";
}

describe("ownership remains distinct across a wide reused row", () => {
  const out = JSON.parse<OwnershipRow>(
    '{"a0":"seed-00","a1":"seed-01","a2":"seed-02","a3":"seed-03","a4":"seed-04","a5":"seed-05","a6":"seed-06","a7":"seed-07","a8":"seed-08","a9":"seed-09","a10":"seed-10","a11":"seed-11","a12":"seed-12","a13":"seed-13"}',
  );
  out.a12 = out.a0;
  out.a13 = out.a10;
  const input =
    '{"a0":"next-00","a1":"next-01","a2":"next-02","a3":"next-03","a4":"next-04","a5":"next-05","a6":"next-06","a7":"next-07","a8":"next-08","a9":"next-09","a10":"next-10","a11":"next-11","a12":"next-12","a13":"next-13"}';
  expect(JSON.stringify(JSON.parse<OwnershipRow>(input, out))).toBe(input);
  expect(JSON.stringify(JSON.parse<OwnershipRow>(input, out))).toBe(input);
});
describe("nested parses protect both the enclosing and current input", () => {
  const input =
    '{"inner":{"left":"new-left","right":"new-right"},"tail":"done"}';
  activeOuterInput = input;
  const result = JSON.parse<ScopeOuter>(input);
  expect(result.inner.value.left).toBe("new-left");
  expect(result.inner.value.right).toBe("new-right");
  expect(result.tail).toBe("done");
  expect(activeOuterInput).toBe(
    '{"inner":{"left":"new-left","right":"new-right"},"tail":"done"}',
  );
});
describe("a derived optional schema preserves its own defaults", () => {
  const result = JSON.parse<ScopeOptionalChild>('{"value":9}');
  expect(result.value).toBe(9);
  expect(result.label).toBe("default");
});

describe("ownership survives a large graph and a later small parse", () => {
  let initial = "[";
  let replacement = "[";
  for (let i = 0; i < 80; i++) {
    if (i) {
      initial += ",";
      replacement += ",";
    }
    const suffix = i.toString();
    initial +=
      '{"left":"seed-left-' + suffix + '","right":"seed-right-' + suffix + '"}';
    replacement +=
      '{"left":"next-left-' + suffix + '","right":"next-right-' + suffix + '"}';
  }
  initial += "]";
  replacement += "]";
  const out = JSON.parse<ScopeInner[]>(initial);
  out[79].left = out[0].left;
  out[79].right = out[1].right;
  expect(JSON.stringify(JSON.parse<ScopeInner[]>(replacement, out))).toBe(
    replacement,
  );
  expect(JSON.stringify(JSON.parse<ScopeInner[]>(initial, out))).toBe(initial);
  const small = new ScopeInner();
  small.left = small.right = out[0].left;
  JSON.parse<ScopeInner>('{"left":"small-left","right":"small-right"}', small);
  expect(small.left).toBe("small-left");
  expect(small.right).toBe("small-right");
});

describe("numeric readers keep fallback defaults and nullable roots", () => {
  const point = JSON.parse<ScopeVector>(' {"z":9,"x":7,"y":8} ');
  expect(point.x).toBe(7);
  expect(point.y).toBe(8);
  expect(point.z).toBe(9);
  JSON.parse<ScopeVector>('{"x":4,"y":5,"z":6}', point);
  expect(point.x).toBe(4);
  expect(point.y).toBe(5);
  expect(point.z).toBe(6);
  expect(JSON.parse<ScopeVector | null>("null") === null).toBe(true);
});
describe("numeric base metadata does not authorize string-child reuse", () => {
  const out = JSON.parse<ScopeStringVector>(
    '{"x":1,"y":2,"z":3,"left":"seed-left","right":"seed-right"}',
  );
  out.right = out.left;
  JSON.parse<ScopeStringVector>(
    '{"x":4,"y":5,"z":6,"left":"next-left","right":"next-right"}',
    out,
  );
  expect(out.left).toBe("next-left");
  expect(out.right).toBe("next-right");
  expect(out.z).toBe(6);
});

describe("repeated inputs preserve aliases and observe source overwrites", () => {
  const original = new ScopeInner();
  original.left = "seed-left";
  original.right = "seed-right";
  const source = JSON.stringify(original);
  const out = new ScopeInner();
  for (let i = 0; i < 4; i++) {
    out.right = out.left;
    __collect();
    JSON.parse<ScopeInner>(source, out);
    expect(out.left).toBe("seed-left");
    expect(out.right).toBe("seed-right");
  }
  const replacement = new ScopeInner();
  replacement.left = "next-left";
  replacement.right = "next-right";
  const overwritten = JSON.stringify(replacement, source);
  expect(changetype<usize>(overwritten) == changetype<usize>(source)).toBe(
    true,
  );
  for (let i = 0; i < 4; i++) {
    __collect();
    JSON.parse<ScopeInner>(overwritten, out);
    expect(out.left).toBe("next-left");
    expect(out.right).toBe("next-right");
  }
});

describe("repeated optional input restores defaults on every parse", () => {
  const out = new ScopeOptionalChild();
  const source = '{"value":9}';
  for (let i = 0; i < 4; i++) {
    out.value = 99;
    out.label = "stale";
    JSON.parse<ScopeOptionalChild>(source, out);
    expect(out.value).toBe(9);
    expect(out.label).toBe("default");
  }
});
