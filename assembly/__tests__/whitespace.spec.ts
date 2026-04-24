import { JSON } from "..";
import { describe, expect } from "as-test";
import { Vec3 } from "./types";


@json
class WhitespaceBox<T> {
  value!: T;
}

function expectWhitespaceMatrix<T>(single: string, array: string, object: string, singleExpected: string, arrayExpected: string, objectExpected: string): void {
  expect(JSON.stringify(JSON.parse<T>(single))).toBe(singleExpected);
  expect(JSON.stringify(JSON.parse<T[]>(array))).toBe(arrayExpected);
  expect(JSON.stringify(JSON.parse<WhitespaceBox<T>>(object))).toBe(objectExpected);
}

describe("Should deserialize primitive types with whitespace in arrays and object fields", () => {
  expectWhitespaceMatrix<string>('"line\\nbreak"', '[ "line\\nbreak" , "tab\\tvalue" ]', '{ "value" : "line\\nbreak" }', '"line\\nbreak"', '["line\\nbreak","tab\\tvalue"]', '{"value":"line\\nbreak"}');

  expectWhitespaceMatrix<i32>("-42", "[ -42 , 0 , 7 ]", '{ "value" : -42 }', "-42", "[-42,0,7]", '{"value":-42}');

  expectWhitespaceMatrix<bool>("true", "[ true , false , true ]", '{ "value" : false }', "true", "[true,false,true]", '{"value":false}');

  expectWhitespaceMatrix<f64>("-3.125", "[ 1.5 , -2.25 , 3.125 ]", '{ "value" : -3.125 }', "-3.125", "[1.5,-2.25,3.125]", '{"value":-3.125}');
});

describe("Should deserialize object-like types with aggressive whitespace", () => {
  expectWhitespaceMatrix<Vec3>('{"x":1.25,"y":-2.5,"z":3.75}', '[ { "x" : 1.25 , "y" : -2.5 , "z" : 3.75 } , { "x" : 4.5 , "y" : 5.5 , "z" : 6.5 } ]', '{ "value" : { "x" : 1.25 , "y" : -2.5 , "z" : 3.75 } }', '{"x":1.25,"y":-2.5,"z":3.75}', '[{"x":1.25,"y":-2.5,"z":3.75},{"x":4.5,"y":5.5,"z":6.5}]', '{"value":{"x":1.25,"y":-2.5,"z":3.75}}');

  expect(JSON.parse<JSON.Raw>('{"x":1,"y":[true,false]}').toString()).toBe('{"x":1,"y":[true,false]}');
  const rawArray = JSON.parse<JSON.Raw[]>('[ {"x":1} , [ true , false ] , false ]');
  expect(rawArray.length.toString()).toBe("3");
  expect(rawArray[0].toString().includes('"x":1').toString()).toBe("true");
  expect(rawArray[1].toString()).toBe("[ true , false ]");
  expect(rawArray[2].toString()).toBe("false");
  expect(JSON.parse<WhitespaceBox<JSON.Raw>>('{ "value" : { "x" : 1 , "y" : [ true , false ] } }').value.toString()).toBe('{ "x" : 1 , "y" : [ true , false ] }');

  expect(JSON.stringify(JSON.parse<Date>('"2025-02-03T21:28:40.525Z"'))).toBe('"2025-02-03T21:28:40.525Z"');

  expect(JSON.stringify(JSON.parse<Map<string, i32>>('{ "a" : 1 , "b" : 2 }'))).toBe('{"a":1,"b":2}');
  expect(JSON.stringify(JSON.parse<WhitespaceBox<Map<string, i32>>>('{ "value" : { "a" : 1 , "b" : 2 } }'))).toBe('{"value":{"a":1,"b":2}}');

  expect(JSON.stringify(JSON.parse<Set<bool>>("[ true , false , true ]"))).toBe("[true,false]");
});

describe("Should deserialize array-like types with whitespace in values and object fields", () => {
  expect(JSON.stringify(JSON.parse<i32[]>("[ 1 , 2 , 3 , 4 ]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<WhitespaceBox<i32[]>>('{ "value" : [ 1 , 2 , 3 , 4 ] }'))).toBe('{"value":[1,2,3,4]}');

  expect(JSON.stringify(JSON.parse<string[]>('[ "a" , "b" , "c" ]'))).toBe('["a","b","c"]');
  expect(JSON.stringify(JSON.parse<WhitespaceBox<string[]>>('{ "value" : [ "a" , "b" , "c" ] }'))).toBe('{"value":["a","b","c"]}');

  expect(JSON.stringify(JSON.parse<Vec3[]>('[ { "x" : 1 , "y" : 2 , "z" : 3 } , { "x" : 4 , "y" : 5 , "z" : 6 } ]'))).toBe('[{"x":1.0,"y":2.0,"z":3.0},{"x":4.0,"y":5.0,"z":6.0}]');
  expect(JSON.stringify(JSON.parse<WhitespaceBox<Vec3[]>>('{ "value" : [ { "x" : 1 , "y" : 2 , "z" : 3 } , { "x" : 4 , "y" : 5 , "z" : 6 } ] }'))).toBe('{"value":[{"x":1.0,"y":2.0,"z":3.0},{"x":4.0,"y":5.0,"z":6.0}]}');
});

describe("Should preserve escaped backslashes and quotes inside whitespace-heavy nested values", () => {
  const parsedObject = JSON.parse<Map<string, string>>('{ "msg" : "path \\\\\\\\ and quote \\\\\\"" }');
  const parsedArray = JSON.parse<string[]>('[ "path \\\\\\\\ and quote \\\\\\"" ]');
  const parsedBox = JSON.parse<WhitespaceBox<string>>('{ "value" : "path \\\\\\\\ and quote \\\\\\"" }');

  expect(parsedObject.get("msg")).toBe('path \\\\ and quote \\"');
  expect(parsedArray[0]).toBe('path \\\\ and quote \\"');
  expect(parsedBox.value).toBe('path \\\\ and quote \\"');
  expect(JSON.stringify(parsedObject)).toBe('{"msg":"path \\\\\\\\ and quote \\\\\\""}');
  expect(JSON.stringify(parsedArray)).toBe('["path \\\\\\\\ and quote \\\\\\""]');
  expect(JSON.stringify(parsedBox)).toBe('{"value":"path \\\\\\\\ and quote \\\\\\""}');
});
