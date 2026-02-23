import { JSON } from "..";
import { describe, expect } from "./lib";

describe("Should serialize Date", () => {
  expect(JSON.stringify<Date>(new Date(0))).toBe('"1970-01-01T00:00:00.000Z"');
  expect(JSON.stringify<Date>(new Date(1738618120525))).toBe('"2025-02-03T21:28:40.525Z"');
});

describe("Should deserialize booleans", () => {
  // const date = JSON.parse<Date>('"2025-02-03T21:28:40.525Z"');
  // console.log("Year: " + date.getUTCFullYear().toString());
  // console.log("Month: " + date.getUTCMonth().toString());
  // console.log("Day: " + date.getUTCDay().toString());
  // console.log("Hours: " + date.getUTCHours().toString());
  // console.log("Minutes: " + date.getUTCMinutes().toString());
  // console.log("Seconds: " + date.getUTCSeconds().toString());
  // console.log("Milliseconds: " + date.getUTCMilliseconds().toString());

  const date1 = JSON.parse<Date>('"1970-01-01T00:00:00.000Z"');
  expect(date1.getUTCFullYear().toString()).toBe("1970");
  expect(date1.getUTCMonth().toString()).toBe("0");
  expect(date1.getUTCDay().toString()).toBe("4");
  expect(date1.getUTCHours().toString()).toBe("0");
  expect(date1.getUTCMinutes().toString()).toBe("0");
  expect(date1.getUTCSeconds().toString()).toBe("0");
  expect(date1.getUTCMilliseconds().toString()).toBe("0");

  const date2 = JSON.parse<Date>('"2025-02-03T21:28:40.525Z"');
  expect(date2.getUTCFullYear().toString()).toBe("2025");
  expect(date2.getUTCMonth().toString()).toBe("1");
  expect(date2.getUTCDay().toString()).toBe("1");
  expect(date2.getUTCHours().toString()).toBe("21");
  expect(date2.getUTCMinutes().toString()).toBe("28");
  expect(date2.getUTCSeconds().toString()).toBe("40");
  expect(date2.getUTCMilliseconds().toString()).toBe("525");
});

describe("Additional regression coverage - primitives and arrays", () => {
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe('"regression"');
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe('["a","b","c"]');
});

describe("Should serialize and deserialize additional dates", () => {
  const leap = new Date(Date.UTC(2024, 1, 29, 12, 30, 45, 123));
  const leapJson = JSON.stringify<Date>(leap);
  expect(leapJson).toBe('"2024-02-29T12:30:45.123Z"');

  const parsed = JSON.parse<Date>(leapJson);
  expect(parsed.getUTCFullYear().toString()).toBe("2024");
  expect(parsed.getUTCMonth().toString()).toBe("1");
  expect(parsed.getUTCDate().toString()).toBe("29");
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe("[[1],[2,3],[]]");
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe('"line\\nbreak"');
});
