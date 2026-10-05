import { JSON } from "..";
import { describe, expect } from "as-test";

let calls: string = "";
let mutate: JSON.Arr | null = null;


@json
class JoinPart {
  id: i32 = 0;
  constructor(id: i32) {
    this.id = id;
  }


  @serializer("string")
  serialize(self: JoinPart): string {
    calls += self.id.toString();
    // Keep earlier converted strings alive while a later conversion collects.
    __collect();
    if (self.id == 1 && mutate !== null) {
      mutate!.set<string>(1, "updated");
      mutate!.push<string>("not visited");
    }
    return JSON.stringify<string>("part-" + self.id.toString());
  }
}

describe("JSON.Arr.join: empty, singleton, null and separators", () => {
  expect(new JSON.Arr().join()).toBe("");
  expect(JSON.parse<JSON.Arr>('["only"]').join("unused")).toBe("only");
  expect(JSON.parse<JSON.Arr>("[null]").join()).toBe("");
  const a = JSON.parse<JSON.Arr>('[null,"",null,"x",null]');
  expect(a.join()).toBe(",,,x,");
  expect(a.join("")).toBe("x");
  expect(a.join("::")).toBe("::::::x::");
  expect(JSON.parse<JSON.Arr>("[null,null]").join("")).toBe("");
});

describe("JSON.Arr.join: strings are raw UTF-16, including lone surrogates", () => {
  const a = new JSON.Arr();
  const values = ["café", "中文", "😀", "a\u0000b", "\ud800", '"\\\n'];
  for (let i = 0; i < values.length; i++) a.push<string>(values[i]);
  expect(a.join("🟢")).toBe(values.join("🟢"));
  expect(a.join("")).toBe(values.join(""));
});

describe("JSON.Arr.join: lazy and materialized mixed/nested values", () => {
  const a = JSON.parse<JSON.Arr>(
    '["plain",null,7,-2.5,true,false,[1,"x"],{"key":"value"}]',
  );
  const expected = 'plain||7|-2.5|true|false|[1,"x"]|{"key":"value"}';
  expect(a.join("|")).toBe(expected);
  for (let i = 0; i < a.length; i++) a.at(i);
  expect(a.join("|")).toBe(expected);
  expect(JSON.stringify<string>("after join")).toBe('"after join"');
  expect(a.join("|")).toBe(expected);
});

describe("JSON.Arr.join: converts custom values once in index order", () => {
  const a = new JSON.Arr();
  a.push<JoinPart>(new JoinPart(1));
  a.push<JoinPart>(new JoinPart(2));
  a.push<JoinPart>(new JoinPart(3));
  calls = "";
  expect(a.join("|")).toBe('"part-1"|"part-2"|"part-3"');
  expect(calls).toBe("123");
  calls = "";
  expect(a.join("")).toBe('"part-1""part-2""part-3"');
  expect(calls).toBe("123");
});

describe("JSON.Arr.join: conversion sees slot mutations and snapshots length", () => {
  const a = new JSON.Arr();
  a.push<JoinPart>(new JoinPart(1));
  a.push<JoinPart>(new JoinPart(2));
  a.push<JoinPart>(new JoinPart(3));
  mutate = a;
  calls = "";
  expect(a.join("|")).toBe('"part-1"|updated|"part-3"');
  expect(calls).toBe("13");
  expect(a.length).toBe(4);
  mutate = null;
});

describe("JSON.Arr.join: large output preserves every part", () => {
  const a = new JSON.Arr();
  const parts = new Array<string>();
  for (let i = 0; i < 4096; i++) {
    const part = i.toString() + "-😀";
    a.push<string>(part);
    parts.push(part);
  }
  expect(a.join("::")).toBe(parts.join("::"));
});

describe("JSON.Arr.join: rejects oversized output before allocation", () => {
  expect((): void => {
    const a = new JSON.Arr();
    a.length = 8193;
    a.join("x".repeat(65536));
  }).toThrow();
});

let reusedElement: string = "";
let reusedSeparator: string = "";


@json
class ReusesJoinOutput {

  @serializer("string")
  serialize(self: ReusesJoinOutput): string {
    // The public output-reuse API can overwrite managed strings in place.
    JSON.stringify<string>("bb", reusedElement);
    JSON.stringify<string>("y", reusedSeparator);
    return JSON.stringify<string>("done");
  }
}

describe("JSON.Arr.join: snapshots earlier parts and separators before callbacks", () => {
  reusedElement = JSON.stringify<string>("aa");
  reusedSeparator = JSON.stringify<string>("x");
  const a = new JSON.Arr();
  a.push<string>(reusedElement);
  a.push<string>("middle");
  a.push<ReusesJoinOutput>(new ReusesJoinOutput());
  expect(a.join(reusedSeparator)).toBe('"aa""x"middle"y""done"');
});

describe("JSON.Arr.join: the second conversion can still change the first string", () => {
  reusedElement = JSON.stringify<string>("aa");
  reusedSeparator = JSON.stringify<string>("x");
  const a = new JSON.Arr();
  a.push<string>(reusedElement);
  a.push<ReusesJoinOutput>(new ReusesJoinOutput());
  a.push<string>("tail");
  expect(a.join(reusedSeparator)).toBe('"bb""y""done""y"tail');
});

describe("JSON.Arr.join: nested serializers preserve prior string snapshots", () => {
  reusedElement = JSON.stringify<string>("aa");
  reusedSeparator = JSON.stringify<string>("x");
  const nested = new JSON.Obj();
  nested.set<ReusesJoinOutput>("value", new ReusesJoinOutput());
  const a = new JSON.Arr();
  a.push<string>(reusedElement);
  a.push<string>("middle");
  a.push<JSON.Obj>(nested);
  expect(a.join(reusedSeparator)).toBe('"aa""x"middle"y"{"value":"done"}');
});
