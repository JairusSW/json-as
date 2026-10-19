import { JSON } from "..";
import { describe, expect } from "as-test";

describe("Should serialize Date", () => {
  expect(JSON.stringify<Date>(new Date(0))).toBe('"1970-01-01T00:00:00.000Z"');
  expect(JSON.stringify<Date>(new Date(1738618120525))).toBe(
    '"2025-02-03T21:28:40.525Z"',
  );
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
  expect(JSON.stringify(JSON.parse<string>('"regression"'))).toBe(
    '"regression"',
  );
  expect(JSON.stringify(JSON.parse<i32>("-42"))).toBe("-42");
  expect(JSON.stringify(JSON.parse<bool>("false"))).toBe("false");
  expect(JSON.stringify(JSON.parse<f64>("3.5"))).toBe("3.5");
  expect(JSON.stringify(JSON.parse<i32[]>("[1,2,3,4]"))).toBe("[1,2,3,4]");
  expect(JSON.stringify(JSON.parse<string[]>('["a","b","c"]'))).toBe(
    '["a","b","c"]',
  );
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

describe("Should round-trip more date boundaries and whitespace", () => {
  const beforeEpoch = new Date(Date.UTC(1969, 11, 31, 23, 59, 59, 999));
  expect(JSON.stringify(beforeEpoch)).toBe('"1969-12-31T23:59:59.999Z"');

  const parsedBeforeEpoch = JSON.parse<Date>('"1969-12-31T23:59:59.999Z"');
  expect(parsedBeforeEpoch.getUTCFullYear().toString()).toBe("1969");
  expect(parsedBeforeEpoch.getUTCMonth().toString()).toBe("11");
  expect(parsedBeforeEpoch.getUTCDate().toString()).toBe("31");
  expect(parsedBeforeEpoch.getUTCMilliseconds().toString()).toBe("999");

  const millennium = JSON.parse<Date>('"2000-01-01T00:00:00.000Z"');
  expect(millennium.getUTCFullYear().toString()).toBe("2000");
  expect(millennium.getUTCMonth().toString()).toBe("0");
  expect(millennium.getUTCDate().toString()).toBe("1");
});

describe("Extended regression coverage - nested and escaped payloads", () => {
  expect(JSON.stringify(JSON.parse<i32>("0"))).toBe("0");
  expect(JSON.stringify(JSON.parse<bool>("true"))).toBe("true");
  expect(JSON.stringify(JSON.parse<f64>("-0.125"))).toBe("-0.125");
  expect(JSON.stringify(JSON.parse<i32[][]>("[[1],[2,3],[]]"))).toBe(
    "[[1],[2,3],[]]",
  );
  expect(JSON.stringify(JSON.parse<string>('"line\\nbreak"'))).toBe(
    '"line\\nbreak"',
  );
});


@json
class DateHolder {
  date: Date = new Date(0);
}

describe("Should serialize ordinary and extended years completely", () => {
  const years = [-1, 0, 9999, 10000];
  const expected = [
    '"-000001-01-01T00:00:00.000Z"',
    '"0000-01-01T00:00:00.000Z"',
    '"9999-01-01T00:00:00.000Z"',
    '"+010000-01-01T00:00:00.000Z"',
  ];
  // Start with managed output, then exercise shrinking and growing reuse.
  let out = JSON.stringify<Date>(new Date(0));
  for (let i = 0; i < years.length; i++) {
    const date = new Date(0);
    // Date.UTC treats years 0 through 99 as 1900 through 1999.
    date.setUTCFullYear(years[i]);
    const json = expected[i];
    expect(JSON.stringify<Date>(date)).toBe(json);
    out = JSON.stringify<Date>(date, out);
    expect(out).toBe(json);
    expect(out.length).toBe(json.length);

    // Same-size reuse must retain the provided output object.
    const ptr = changetype<usize>(out);
    out = JSON.stringify<Date>(date, out);
    expect(out).toBe(json);
    expect(changetype<usize>(out)).toBe(ptr);

    // Nested dates already use the full ISO string; keep these paths aligned.
    expect(JSON.stringify<Date[]>([date])).toBe("[" + json + "]");
    const holder = new DateHolder();
    holder.date = date;
    expect(JSON.stringify<DateHolder>(holder)).toBe('{"date":' + json + "}");
  }
});
