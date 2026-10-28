import { JSON } from "..";
import { describe, expect } from "as-test";

let boundsArray = new JSON.Arr();
let boundsIndex: i32 = 0;
const replacement = JSON.Value.from<i32>(99);

function expectOutOfRange(array: JSON.Arr, index: i32): void {
  boundsArray = array;
  boundsIndex = index;
  const original = JSON.stringify(array);
  const length = array.length;
  expect((): void => {
    boundsArray.getAs<f64>(boundsIndex);
  }).toThrow();
  expect((): void => {
    boundsArray.set<i32>(boundsIndex, 99);
  }).toThrow();
  expect((): void => {
    boundsArray[boundsIndex] = replacement;
  }).toThrow();
  expect(array.length).toBe(length);
  expect(JSON.stringify(array)).toBe(original);
}

describe("JSON.Arr indexing rejects negative and length indexes", () => {
  const eager = new JSON.Arr();
  eager.push<i32>(10);
  eager.push<i32>(20);
  expectOutOfRange(eager, -1);
  expectOutOfRange(eager, eager.length);
  const parsed = JSON.parse<JSON.Arr>('[10,"twenty",{"n":30}]');
  expectOutOfRange(parsed, -1);
  expectOutOfRange(parsed, parsed.length);
});

describe("JSON.Arr indexing rejects empty and cleared arrays", () => {
  expectOutOfRange(new JSON.Arr(), 0);
  expectOutOfRange(JSON.parse<JSON.Arr>("[]"), 0);
  const eager = new JSON.Arr();
  eager.push<i32>(10);
  eager.clear();
  expectOutOfRange(eager, 0);
  const parsed = JSON.parse<JSON.Arr>('[10,"twenty",{"n":30}]');
  parsed.clear();
  expectOutOfRange(parsed, 0);
});

describe("JSON.Arr indexing uses live length rather than retained capacity", () => {
  const array = JSON.parse<JSON.Arr>("[10,20,30]");
  array.length = 1;
  expectOutOfRange(array, 1);
  expect(array.getAs<f64>(0)).toBe(10.0);
  array.set<i32>(0, 11);
  expect(array.getAs<i32>(0)).toBe(11);
  array.length = 3;
  expect(array.at(1).type == JSON.Types.Null).toBe(true);
  expect(array.at(2).type == JSON.Types.Null).toBe(true);
  array.set<i32>(1, 22);
  array[2] = JSON.Value.from<i32>(33);
  expect(JSON.stringify(array)).toBe("[11,22,33]");
  expectOutOfRange(array, 3);
});

describe("JSON.Arr indexing remains valid after clear and refill", () => {
  const array = JSON.parse<JSON.Arr>('["old",2,3]');
  array.clear();
  expectOutOfRange(array, 0);
  array.push<string>("new");
  array.push<i32>(2);
  expect(array.getAs<string>(0)).toBe("new");
  array.set<string>(0, "updated");
  array[1] = JSON.Value.from<i32>(22);
  expect(array[0].get<string>()).toBe("updated");
  expect(array.at(1).get<i32>()).toBe(22);
  expect(JSON.stringify(array)).toBe('["updated",22]');
  expectOutOfRange(array, array.length);
});

describe("JSON.Arr valid indexing keeps parsed and eager values accessible", () => {
  const parsed = JSON.parse<JSON.Arr>('[10,"text",{"n":30},[40]]');
  expect(parsed.getAs<f64>(0)).toBe(10.0);
  expect(parsed.getAs<string>(1)).toBe("text");
  const nested = parsed.getAs<JSON.Obj>(2);
  expect(nested.getAs<f64>("n")).toBe(30.0);
  expect(parsed.getAs<JSON.Obj>(2) === nested).toBe(true);
  expect(parsed.getAs<JSON.Arr>(3).getAs<f64>(0)).toBe(40.0);
  parsed.set<string>(1, "changed");
  parsed[3] = JSON.Value.from<i32>(44);
  expect(JSON.stringify(parsed)).toBe('[10,"changed",{"n":30},44]');
  const eager = new JSON.Arr();
  eager.push<i32>(1);
  eager.push<string>("two");
  eager.set<i32>(0, 11);
  eager[1] = JSON.Value.from<string>("updated");
  expect(eager.getAs<i32>(0)).toBe(11);
  expect(eager.getAs<string>(1)).toBe("updated");
});
