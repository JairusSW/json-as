import { JSON } from "../..";
import { describe, expect } from "as-test";
import { Runtime } from "shared/runtime";
import {
  getUsedMemorySize,
  memoryDetail,
} from "as-heap-analyzer/assembly/index";


@json
class EmptyArrays {
  flags!: bool[];
  bytes!: u8[];
  signedBytes!: i8[];
  words!: u16[];
  signedWords!: i16[];
  ints!: i32[];
  unsigned!: u32[];
  longs!: i64[];
  unsignedLongs!: u64[];
  floats!: f32[];
  doubles!: f64[];
  names!: string[];
  nested!: i32[][];
}

const EMPTY =
  '{"flags":[],"bytes":[],"signedBytes":[],"words":[],"signedWords":[],"ints":[],"unsigned":[],"longs":[],"unsignedLongs":[],"floats":[],"doubles":[],"names":[],"nested":[]}';
const keep = new Array<EmptyArrays>();
const budget = new Array<i64[]>(128);

function independent<T>(a: T[], b: T[], x: T, y: T): bool {
  if (a === b) return false;
  a.push(x);
  b.push(y);
  return a.length == 1 && b.length == 1 && a[0] == x && b[0] == y;
}

describe("Empty parsed arrays detach independently when first grown", () => {
  const a = JSON.parse<EmptyArrays>(EMPTY);
  const b = JSON.parse<EmptyArrays>(EMPTY);
  keep.push(a);
  keep.push(b);
  expect(independent<bool>(a.flags, b.flags, true, false)).toBe(true);
  expect(independent<u8>(a.bytes, b.bytes, 255, 7)).toBe(true);
  expect(independent<i8>(a.signedBytes, b.signedBytes, -128, 7)).toBe(true);
  expect(independent<u16>(a.words, b.words, 65535, 7)).toBe(true);
  expect(independent<i16>(a.signedWords, b.signedWords, -32768, 7)).toBe(true);
  expect(independent<i32>(a.ints, b.ints, -123456, 7)).toBe(true);
  expect(independent<u32>(a.unsigned, b.unsigned, u32.MAX_VALUE, 7)).toBe(true);
  expect(independent<i64>(a.longs, b.longs, i64.MIN_VALUE, 7)).toBe(true);
  expect(
    independent<u64>(a.unsignedLongs, b.unsignedLongs, u64.MAX_VALUE, 7),
  ).toBe(true);
  expect(independent<f32>(a.floats, b.floats, 1.25, -2.5)).toBe(true);
  expect(independent<f64>(a.doubles, b.doubles, 1.25, -2.5)).toBe(true);
  expect(independent<string>(a.names, b.names, "first", "second")).toBe(true);
  expect(independent<i32[]>(a.nested, b.nested, [1], [2])).toBe(true);
  __collect();
  expect(a.names[0]).toBe("first");
  expect(b.names[0]).toBe("second");
  expect(a.nested[0][0]).toBe(1);
});

describe("Growing length exposes zeroed slots and supports field reuse", () => {
  const a = JSON.parse<EmptyArrays>(EMPTY);
  keep.push(a);
  a.ints.length = 2;
  expect(a.ints[0]).toBe(0);
  expect(a.ints[1]).toBe(0);
  const oldWords = a.words;
  const oldDoubles = a.doubles;
  const result = JSON.parse<EmptyArrays>(
    EMPTY.replace('"words":[]', '"words":[1,65535]').replace(
      '"doubles":[]',
      '"doubles":[1.25,-2.5]',
    ),
    a,
  );
  expect(result === a).toBe(true);
  // Slow object parsing reinitializes fields; buffer identity is a fast-reader
  // guarantee. Both paths must preserve the parsed values below.
  // @ts-expect-error: generated only when fast paths are enabled
  if (isDefined(a.__DESERIALIZE_FAST)) {
    expect(a.words === oldWords).toBe(true);
    expect(a.doubles === oldDoubles).toBe(true);
  }
  __collect();
  expect(a.words[1]).toBe(65535);
  expect(a.doubles[1]).toBe(-2.5);
});

describe("Retained empty arrays avoid speculative element capacity", () => {
  if (!JSON_STRICT || ASC_RUNTIME != Runtime.Incremental) return;
  const warm = JSON.parse<i64[]>("[]");
  expect(warm.length).toBe(0);
  expect(getUsedMemorySize() != u32.MAX_VALUE).toBe(true);
  const before = load<u32>(memoryDetail + idof<ArrayBuffer>() * 4);
  for (let i = 0; i < budget.length; i++) budget[i] = JSON.parse<i64[]>("[]");
  expect(getUsedMemorySize() != u32.MAX_VALUE).toBe(true);
  const after = load<u32>(memoryDetail + idof<ArrayBuffer>() * 4);
  expect(after >= before).toBe(true);
  // 128 separately owned empty buffers need less than the 8 KiB of payload
  // reserved by 128 ordinary i64 array constructors alone.
  expect(after - before < 8192).toBe(true);
});
