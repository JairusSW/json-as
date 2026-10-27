import { JSON } from "..";
import { describe, expect, test } from "as-test";

// Callback arguments are detached wrappers, but nested references are shared.
// Mutations must be observed at the next index without extending the original
// traversal range or revisiting elements shifted to an earlier index.
enum Mutation {
  None,
  Replace,
  Truncate,
  Clear,
  Splice,
  Append,
  Refill,
  Regrow,
}

let mutation = Mutation.None;
let visited = new JSON.Arr();
let indices = new Array<i32>();

function visit(value: JSON.Value, index: i32, array: JSON.Arr): void {
  visited.push(value);
  indices.push(index);
  if (index != 0) return;
  switch (mutation) {
    case Mutation.Replace:
      array.set(0, 9.0);
      array.set(1, 8.0);
      break;
    case Mutation.Truncate:
      array.length = 2;
      break;
    case Mutation.Clear:
      array.clear();
      break;
    case Mutation.Splice:
      array.splice(0, 2);
      break;
    case Mutation.Append:
      // Force backing-buffer growth, not just a write into spare capacity.
      for (let i = 0; i < 16; i++) array.push(9.0);
      break;
    case Mutation.Refill:
      array.clear();
      array.push(9.0);
      array.push(8.0);
      array.push(7.0);
      break;
    case Mutation.Regrow:
      array.length = 1;
      array.length = 4;
      break;
  }
}

function mapVisit(value: JSON.Value, index: i32, array: JSON.Arr): JSON.Value {
  visit(value, index, array);
  return value;
}
function keepVisit(value: JSON.Value, index: i32, array: JSON.Arr): bool {
  visit(value, index, array);
  return true;
}
function rejectVisit(value: JSON.Value, index: i32, array: JSON.Arr): bool {
  visit(value, index, array);
  return false;
}
function reduceVisit(
  acc: string,
  value: JSON.Value,
  index: i32,
  array: JSON.Arr,
): string {
  visit(value, index, array);
  return acc + JSON.stringify(value) + ",";
}
function source(eager: bool): JSON.Arr {
  if (!eager) return JSON.parse<JSON.Arr>("[1,2,3,4]");
  const array = new JSON.Arr();
  for (let i = 1; i <= 4; i++) array.push(<f64>i);
  return array;
}
function expectVisits(): void {
  let values = "[1,2,3,4]";
  let positions = "0,1,2,3";
  switch (mutation) {
    case Mutation.Replace:
      values = "[1,8,3,4]";
      break;
    case Mutation.Truncate:
      values = "[1,2]";
      positions = "0,1";
      break;
    case Mutation.Clear:
      values = "[1]";
      positions = "0";
      break;
    case Mutation.Splice:
      values = "[1,4]";
      positions = "0,1";
      break;
    case Mutation.Refill:
      values = "[1,8,7]";
      positions = "0,1,2";
      break;
    case Mutation.Regrow:
      values = "[1,null,null,null]";
      break;
  }
  expect(JSON.stringify(visited)).toBe(values);
  expect(indices.join(",")).toBe(positions);
}

// All forward callbacks use the same initial-length cap and live-length bound.
function checkMutations(method: i32): void {
  for (let eager = 0; eager <= 1; eager++) {
    for (let kind = Mutation.None; kind <= Mutation.Regrow; kind++) {
      mutation = kind;
      visited = new JSON.Arr();
      indices = new Array<i32>();
      const array = source(eager != 0);
      switch (method) {
        case 0:
          array.forEach(visit);
          break;
        case 1: {
          const result = array.map(mapVisit);
          expect(result.length).toBe(4);
          const expected = visited.slice();
          expected.length = 4; // Unvisited map positions are JSON null.
          expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
          break;
        }
        case 2:
          expect(JSON.stringify(array.filter(keepVisit))).toBe(
            JSON.stringify(visited),
          );
          break;
        case 3: {
          const result = array.reduce<string>(reduceVisit, "initial:");
          let expected = "initial:";
          for (let i = 0; i < visited.length; i++)
            expected += JSON.stringify(visited.at(i)) + ",";
          expect(result).toBe(expected);
          break;
        }
        case 4:
          expect(array.every(keepVisit)).toBe(true);
          break;
        case 5:
          expect(array.some(rejectVisit)).toBe(false);
          break;
        case 6:
          expect(array.findIndex(rejectVisit)).toBe(-1);
          break;
        case 7:
          expect(array.find(rejectVisit) === null).toBe(true);
          break;
        case 8:
          expect(array.filter(rejectVisit).length).toBe(0);
          break;
      }
      expectVisits();
    }
  }
}

describe("JSON.Arr: forward callback mutation", () => {
  test("forEach observes shrink, shifts, replacements and the append cap", () => {
    checkMutations(0);
  });
  test("map preserves its initial length and null-fills unvisited positions", () => {
    checkMutations(1);
  });
  test("filter keeps the inspected values when source slots change", () => {
    checkMutations(2);
  });
  test("reduce visits only remaining indices within the original range", () => {
    checkMutations(3);
  });
  test("every respects live length", () => {
    checkMutations(4);
  });
  test("some respects live length", () => {
    checkMutations(5);
  });
  test("findIndex respects live length", () => {
    checkMutations(6);
  });
  test("find respects live length", () => {
    checkMutations(7);
  });
  test("filter can reject all values while the source changes", () => {
    checkMutations(8);
  });
});

function replaceCurrent(value: JSON.Value, index: i32, array: JSON.Arr): bool {
  array.set(index, false);
  return true;
}
function clearCurrent(value: JSON.Value, index: i32, array: JSON.Arr): bool {
  array.clear();
  // The inspected value must stay rooted after the source no longer owns it.
  __collect();
  return true;
}
function replaceWrapper(value: JSON.Value, index: i32, array: JSON.Arr): bool {
  value.set("replacement");
  return true;
}
function mutateChild(value: JSON.Value, index: i32, array: JSON.Arr): bool {
  value.get<JSON.Obj>().set("changed", true);
  return true;
}

describe("JSON.Arr: filter retains callback values, not the later source slots", () => {
  test("scalar, string, array and object replacements retain inspected values", () => {
    const text = '[1,"text",[2],{"key":3}]';
    for (let eager = 0; eager <= 1; eager++) {
      const array = eager
        ? JSON.Arr.from(JSON.parse<JSON.Value[]>(text))
        : JSON.parse<JSON.Arr>(text);
      const result = array.filter(replaceCurrent);
      expect(JSON.stringify(result)).toBe(text);
      expect(JSON.stringify(array)).toBe("[false,false,false,false]");
    }
  });
  test("a cleared source cannot drop the last reference to a selected child", () => {
    const array = JSON.parse<JSON.Arr>(
      '[{"items":["' + "nested".repeat(256) + '"]},0]',
    );
    const result = array.filter(clearCurrent);
    expect(result.length).toBe(1);
    expect(array.length).toBe(0);
    expect(
      result.at(0).get<JSON.Obj>().getAs<JSON.Arr>("items").getAs<string>(0),
    ).toBe("nested".repeat(256));
  });
  test("nested mutations remain shared with the source", () => {
    const array = JSON.parse<JSON.Arr>('[{"items":[2.0,3.0]}]');
    const result = array.filter(mutateChild);
    expect(result.at(0).get<JSON.Obj>() === array.at(0).get<JSON.Obj>()).toBe(
      true,
    );
    expect(JSON.stringify(result)).toBe('[{"items":[2.0,3.0],"changed":true}]');
    expect(JSON.stringify(result)).toBe(JSON.stringify(array));
  });
  test("replacing the callback wrapper affects the result but not the source", () => {
    const array = JSON.parse<JSON.Arr>('[1,{"key":3}]');
    const result = array.filter(replaceWrapper);
    expect(JSON.stringify(result)).toBe('["replacement","replacement"]');
    expect(JSON.stringify(array)).toBe('[1,{"key":3}]');
  });
});

let calls = 0;
function stopTrue(value: JSON.Value, index: i32, array: JSON.Arr): bool {
  calls++;
  array.clear();
  return true;
}
function stopFalse(value: JSON.Value, index: i32, array: JSON.Arr): bool {
  calls++;
  array.clear();
  return false;
}
describe("JSON.Arr: forward callback short-circuit and empty controls", () => {
  calls = 0;
  expect(source(false).some(stopTrue)).toBe(true);
  expect(source(false).every(stopFalse)).toBe(false);
  expect(source(false).findIndex(stopTrue)).toBe(0);
  expect(source(false).find(stopTrue)!.get<f64>()).toBe(1.0);
  expect(calls).toBe(4);
  const empty = new JSON.Arr();
  empty.forEach(visit);
  expect(empty.map(mapVisit).length).toBe(0);
  expect(empty.filter(stopTrue).length).toBe(0);
  expect(empty.reduce<string>(reduceVisit, "initial")).toBe("initial");
  expect(empty.every(stopFalse)).toBe(true);
  expect(empty.some(stopTrue)).toBe(false);
  expect(empty.findIndex(stopTrue)).toBe(-1);
  expect(empty.find(stopTrue) === null).toBe(true);
  expect(calls).toBe(4);
});
