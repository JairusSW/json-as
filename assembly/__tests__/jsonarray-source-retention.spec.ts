import { JSON } from "..";
import { describe, expect } from "as-test";
import { getUsedMemorySize } from "as-heap-analyzer/assembly/index";

// Only the copy crosses this boundary. The original array and its large input
// string must be collectible when the copied slots do not refer to that input.
function scalarCopy(splice: bool): JSON.Arr {
  const source = JSON.parse<JSON.Arr>(
    '[1,true,null,2.5,"' + "discarded".repeat(16384) + '"]',
  );
  return splice ? source.splice(0, 4) : source.slice(0, 4);
}

function lazyCopy(splice: bool): JSON.Arr {
  const source = JSON.parse<JSON.Arr>('[0,"text",[2.0],{"key":3.0},false]');
  const result = splice ? source.splice(1, 3) : source.slice(1, 4);
  source.clear();
  return result;
}

function materializedCopy(splice: bool): JSON.Arr {
  const source = JSON.parse<JSON.Arr>('["text",{"items":[2.0,3.0]},[4.0]]');
  for (let i = 0; i < source.length; i++) source.at(i);
  const result = splice ? source.splice(0, 3) : source.slice();
  source.clear();
  return result;
}

function keepAll(value: JSON.Value, index: i32, array: JSON.Arr): bool {
  return true;
}

describe("JSON.Arr: scalar copies release unneeded source strings", () => {
  for (let splice = 0; splice <= 1; splice++) {
    const before = getUsedMemorySize();
    const result = scalarCopy(splice != 0);
    const after = getUsedMemorySize();
    // Check live heap allocations, not WebAssembly memory pages, which do not
    // shrink after collection. Leave room for small runtime/test allocations.
    expect(before != u32.MAX_VALUE).toBe(true);
    expect(after != u32.MAX_VALUE).toBe(true);
    expect(<i64>after - <i64>before).toBeLessThan(<i64>65536);
    expect(result._src.length).toBe(0);
    expect(JSON.stringify(result)).toBe("[1,true,null,2.5]");
  }
});

describe("JSON.Arr: deferred copies retain the source they still need", () => {
  for (let splice = 0; splice <= 1; splice++) {
    const result = lazyCopy(splice != 0);
    expect(result._src.length > 0).toBe(true);
    __collect();
    expect(JSON.stringify(result)).toBe('["text",[2.0],{"key":3.0}]');
    expect(result.getAs<string>(0)).toBe("text");
    expect(result.getAs<JSON.Arr>(1).getAs<f64>(0)).toBe(2.0);
    expect(result.getAs<JSON.Obj>(2).getAs<f64>("key")).toBe(3.0);
  }
});

describe("JSON.Arr: materialized children own their remaining deferred source", () => {
  for (let splice = 0; splice <= 1; splice++) {
    const result = materializedCopy(splice != 0);
    expect(result._src.length).toBe(0);
    __collect();
    expect(JSON.stringify(result)).toBe('["text",{"items":[2.0,3.0]},[4]]');
    const items = result.getAs<JSON.Obj>(1).getAs<JSON.Arr>("items");
    expect(items.getAs<f64>(1)).toBe(3.0);
    expect(result.getAs<JSON.Arr>(2).getAs<f64>(0)).toBe(4.0);
  }
});

describe("JSON.Arr: copied mixed slots keep the anchor after scalar slots", () => {
  const source = JSON.parse<JSON.Arr>('[1,"text",2,3]');
  const result = source.slice();
  expect(result._src === source._src).toBe(true);
  source.clear();
  __collect();
  expect(JSON.stringify(result)).toBe('[1,"text",2,3]');
  expect(result.getAs<string>(1)).toBe("text");
});

describe("JSON.Arr: empty ranges do not retain a source", () => {
  const source = JSON.parse<JSON.Arr>('["text"]');
  expect(source.slice(1)._src).toBe("");
  expect(source.slice(1, 0)._src).toBe("");
  expect(source.splice(0, 0)._src).toBe("");
  expect(JSON.stringify(source)).toBe('["text"]');
});

describe("JSON.Arr: materialized filter copies need no outer source anchor", () => {
  const source = JSON.parse<JSON.Arr>('[1,"text",{"items":[2.0]}]');
  const result = source.filter(keepAll);
  expect(result._src.length).toBe(0);
  source.clear();
  __collect();
  expect(JSON.stringify(result)).toBe('[1,"text",{"items":[2.0]}]');
});
