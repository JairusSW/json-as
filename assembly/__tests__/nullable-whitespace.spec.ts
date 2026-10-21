import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class NullableWhitespaceData {
  value: i32 = 0;
}

function expectNullWhitespace<T>(): void {
  const whitespace = ["", " ", "\t", "\n", "\r", " \t\r\n"];
  for (let i = 0; i < whitespace.length; i++) {
    for (let j = 0; j < whitespace.length; j++) {
      const source = whitespace[i] + "null" + whitespace[j];
      expect(JSON.parse<T>(source) == null).toBe(true);
    }
  }
}

function deserializeSlice<T>(source: string): T {
  const start = changetype<usize>(source);
  return JSON.__deserialize<T>(start, start + (source.length << 1));
}

function expectNullWhitespaceSlice<T>(): void {
  const whitespace = ["", " ", "\t", "\n", "\r", " \t\r\n"];
  for (let i = 0; i < whitespace.length; i++) {
    for (let j = 0; j < whitespace.length; j++) {
      const source = whitespace[i] + "null" + whitespace[j];
      expect(deserializeSlice<T>(source) == null).toBe(true);
    }
  }
}

describe("nullable strings accept null with surrounding JSON whitespace", () => {
  expectNullWhitespace<string | null>();
});

describe("nullable structs accept null with surrounding JSON whitespace", () => {
  expectNullWhitespace<NullableWhitespaceData | null>();
});

describe("nullable boxes accept null with surrounding JSON whitespace", () => {
  expectNullWhitespace<JSON.Box<i32> | null>();
});

describe("nullable string slices accept null with surrounding JSON whitespace", () => {
  expectNullWhitespaceSlice<string | null>();
});

describe("nullable struct slices accept null with surrounding JSON whitespace", () => {
  expectNullWhitespaceSlice<NullableWhitespaceData | null>();
});

describe("nullable box slices accept null with surrounding JSON whitespace", () => {
  expectNullWhitespaceSlice<JSON.Box<i32> | null>();
});

describe("nullable roots keep quoted null and non-null values", () => {
  expect(JSON.parse<string | null>(' \t"null"\r\n')).toBe("null");
  expect(deserializeSlice<string | null>(' \t"null"')).toBe("null");
  expect(
    JSON.parse<NullableWhitespaceData | null>(' \t{"value":7}\r\n')!.value,
  ).toBe(7);
  expect(
    deserializeSlice<NullableWhitespaceData | null>(' \t{"value":7}\r\n')!
      .value,
  ).toBe(7);
  expect(JSON.parse<JSON.Box<i32> | null>(" \t7")!.value).toBe(7);
  expect(deserializeSlice<JSON.Box<i32> | null>(" \t7")!.value).toBe(7);
});

describe("nullable null does not reuse or mutate a supplied output", () => {
  const output = new NullableWhitespaceData();
  output.value = 7;
  expect(
    JSON.parse<NullableWhitespaceData | null>(" \tnull\r\n", output) == null,
  ).toBe(true);
  const source = " \tnull\r\n";
  const start = changetype<usize>(source);
  expect(
    JSON.__deserialize<NullableWhitespaceData | null>(
      start,
      start + (source.length << 1),
      changetype<usize>(output),
    ) == null,
  ).toBe(true);
  expect(output.value).toBe(7);
});

describe("null recognition leaves raw trailing bytes intact", () => {
  const values = ["null", '"null"', '{"value":7}', "7"];
  for (let i = 0; i < values.length; i++) {
    const raw = values[i] + " \t\r\n";
    const source = " \t" + raw;
    expect(JSON.parse<JSON.Raw>(source).data).toBe(raw);
    expect(deserializeSlice<JSON.Raw>(source).data).toBe(raw);
  }
  expect(JSON.parse<JSON.Raw | null>(" \tnull\r\n") == null).toBe(true);
  expect(deserializeSlice<JSON.Raw | null>(" \tnull\r\n") == null).toBe(true);
  expect(JSON.parse<JSON.Raw | null>(' \t"null"\r\n')!.data).toBe('"null"\r\n');
  expect(deserializeSlice<JSON.Raw | null>(' \t"null"\r\n')!.data).toBe(
    '"null"\r\n',
  );
});

describe("null recognition requires a complete literal and whitespace-only suffix", () => {
  // Raw slice deserialization deliberately accepts arbitrary bytes. These
  // controls ensure a null prefix never consumes non-whitespace trailing data.
  const values = ["", "n", "nu", "nul", "nullx", "null x", "null\u00a0"];
  for (let i = 0; i < values.length; i++) {
    const result = deserializeSlice<JSON.Raw | null>(values[i]);
    expect(result != null).toBe(true);
    expect(result!.data).toBe(values[i]);
  }
});
