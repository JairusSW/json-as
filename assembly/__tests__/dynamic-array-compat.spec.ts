import { JSON } from "..";
import { describe, expect } from "as-test";

function expectValues(values: JSON.Value[]): void {
  expect(values.length).toBe(5);
  expect(values[0].type).toBe(JSON.Types.String);
  expect(values[0].get<string>()).toBe("jailbreak");
  expect(values[1].get<f64>()).toBe(0.75);
  expect(values[2].get<bool>()).toBe(true);
  expect(values[3].type).toBe(JSON.Types.Null);
  expect(values[4].get<JSON.Obj>().getAs<f64>("n")).toBe(42.0);
}

const SOURCE = '["jailbreak",0.75,true,null,{"n":42}]';

describe("Dynamic values expose JSON.Value[] with the native array layout", () => {
  const value = JSON.parse<JSON.Value>(SOURCE);
  expectValues(value.get<JSON.Value[]>());
  expectValues(value.as<JSON.Value[]>());
  expectValues(JSON.Value.from(value.get<JSON.Arr>()).get<JSON.Value[]>());
  expectValues(JSON.Value.from(value.get<JSON.Value[]>()).get<JSON.Value[]>());
  expect(JSON.stringify(value)).toBe(SOURCE);
});

describe("Dynamic object and array typed access converts JSON.Value[]", () => {
  const obj = JSON.parse<JSON.Obj>('{"labels":' + SOURCE + "}");
  expectValues(obj.get("labels")!.get<JSON.Value[]>());
  expectValues(obj.getAs<JSON.Value[]>("labels"));
  const arr = JSON.parse<JSON.Arr>("[" + SOURCE + "]");
  expectValues(arr.at(0).get<JSON.Value[]>());
  expectValues(arr.getAs<JSON.Value[]>(0));
});

describe("Empty and nullable dynamic arrays retain their lengths and nulls", () => {
  expect(JSON.parse<JSON.Value>("[]").get<JSON.Value[]>().length).toBe(0);
  expect(
    JSON.parse<JSON.Value>("null").get<JSON.Value[] | null>() === null,
  ).toBe(true);
  const obj = JSON.parse<JSON.Obj>('{"empty":[],"none":null}');
  expect(obj.getAs<JSON.Value[]>("empty").length).toBe(0);
  expect(obj.getAs<JSON.Value[] | null>("none") === null).toBe(true);
  expect(obj.getAs<JSON.Value[] | null>("missing") === null).toBe(true);
});

// Array conversion copies the wrapper slots while preserving nested references.
describe("Converted arrays share nested objects with the dynamic container", () => {
  const value = JSON.parse<JSON.Value>(SOURCE);
  const values = value.get<JSON.Value[]>();
  values[4].get<JSON.Obj>().set("n", 7.0);
  expect(value.get<JSON.Arr>().at(4).get<JSON.Obj>().getAs<f64>("n")).toBe(7.0);
  values[0] = JSON.Value.from("changed");
  values.push(JSON.Value.from(false));
  expect(value.get<JSON.Arr>().length).toBe(5);
  expect(value.get<JSON.Arr>().at(0).get<string>()).toBe("jailbreak");
});
