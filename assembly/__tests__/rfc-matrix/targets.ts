import { JSON, JSONMode } from "../..";
import { expect } from "as-test";

export const ROOT_OBJECT: u32 = 1 << 0;
export const ROOT_ARRAY: u32 = 1 << 1;
export const ROOT_STRING: u32 = 1 << 2;
export const ROOT_NUMBER: u32 = 1 << 3;
export const ROOT_BOOLEAN: u32 = 1 << 4;
export const ROOT_NULL: u32 = 1 << 5;

export const ARRAY_NUMBER: u32 = 1 << 6;
export const ARRAY_STRING: u32 = 1 << 7;
export const ARRAY_BOOLEAN: u32 = 1 << 8;
export const ARRAY_OBJECT: u32 = 1 << 9;
export const NUM_I8: u32 = 1 << 10;
export const NUM_U8: u32 = 1 << 11;
export const NUM_I16: u32 = 1 << 12;
export const NUM_U16: u32 = 1 << 13;
export const NUM_I32: u32 = 1 << 14;
export const NUM_U32: u32 = 1 << 15;
export const NUM_I64: u32 = 1 << 16;
export const NUM_U64: u32 = 1 << 17;
export const STRING_DATE: u32 = 1 << 18;


@json
class RFCEagerEnvelope {
  value: JSON.Raw = JSON.Raw.from("null");
}


@json({ lazy: "all" })
class RFCLazyEnvelope {
  value: JSON.Lazy<JSON.Raw> = JSON.Raw.from("null");
}


@json
class RFCAnyCustom {
  value: JSON.Value = JSON.Value.empty();


  @deserializer("any")
  deserialize(data: string): RFCAnyCustom {
    const out = new RFCAnyCustom();
    out.value = JSON.parse<JSON.Value>(data);
    return out;
  }
}

function expectAccept<T>(data: string): void {
  JSON.parse<T>(data);
}

let rejectionData = "";

function expectReject<T>(data: string): void {
  rejectionData = data;
  expect((): void => {
    JSON.parse<T>(rejectionData);
  }).toThrow();
}

// Mirrors the public strict parser's implementation-defined UTF-16 recovery so
// a normalized fixture can be embedded in an object/array envelope without the
// envelope itself hiding the alternating code-unit pattern.
function normalizeFixture(data: string): string {
  const length = data.length;
  if (length < 4) return data;

  let byteIndex = -1;
  if (data.charCodeAt(0) == 0) byteIndex = 0;
  else if (data.charCodeAt(1) == 0) byteIndex = 1;
  else return data;

  for (let i = byteIndex; i < length; i += 2)
    if (data.charCodeAt(i) != 0) return data;

  let out = "";
  for (let i = byteIndex ^ 1; i < length; i += 2)
    out += String.fromCharCode(data.charCodeAt(i));
  return out;
}

function expectLazyEnvelope(data: string): void {
  const parsed = JSON.parse<RFCLazyEnvelope>(data);
  // Force materialization; merely constructing the lazy owner only tests its
  // slice scanner, not the target parser behind the generated getter.
  parsed.value.toString();
}

/**
 * Runs one malformed RFC fixture through every concrete JSON.parse dispatch
 * target. Strict validation must reject before target-specific parsing begins.
 */
export function expectRejectEveryTarget(data: string): void {
  // This PR's strict validator is intentionally scoped to the naive backend.
  if (JSON_MODE != JSONMode.NAIVE) return;

  expectReject<bool>(data);
  expectReject<i8>(data);
  expectReject<u8>(data);
  expectReject<i16>(data);
  expectReject<u16>(data);
  expectReject<i32>(data);
  expectReject<u32>(data);
  expectReject<i64>(data);
  expectReject<u64>(data);
  expectReject<f32>(data);
  expectReject<f64>(data);
  expectReject<string>(data);

  expectReject<RFCEagerEnvelope>(data);
  expectReject<RFCLazyEnvelope>(data);
  expectReject<RFCAnyCustom>(data);

  expectReject<bool[]>(data);
  expectReject<i8[]>(data);
  expectReject<u8[]>(data);
  expectReject<i16[]>(data);
  expectReject<u16[]>(data);
  expectReject<i32[]>(data);
  expectReject<u32[]>(data);
  expectReject<i64[]>(data);
  expectReject<u64[]>(data);
  expectReject<f32[]>(data);
  expectReject<f64[]>(data);
  expectReject<string[]>(data);
  expectReject<JSON.Raw[]>(data);
  expectReject<JSON.Value[]>(data);
  expectReject<RFCEagerEnvelope[]>(data);
  expectReject<RFCLazyEnvelope[]>(data);

  expectReject<StaticArray<bool>>(data);
  expectReject<StaticArray<i32>>(data);
  expectReject<StaticArray<u32>>(data);
  expectReject<StaticArray<f64>>(data);
  expectReject<StaticArray<string>>(data);
  expectReject<StaticArray<JSON.Raw>>(data);
  expectReject<StaticArray<JSON.Value>>(data);
  expectReject<StaticArray<RFCEagerEnvelope>>(data);

  expectReject<Set<bool>>(data);
  expectReject<Set<i32>>(data);
  expectReject<Set<u32>>(data);
  expectReject<Set<f64>>(data);
  expectReject<Set<string>>(data);
  expectReject<Set<JSON.Value>>(data);
  expectReject<Map<string, JSON.Raw>>(data);
  expectReject<Map<string, JSON.Value>>(data);

  expectReject<Int8Array>(data);
  expectReject<Uint8Array>(data);
  expectReject<Uint8ClampedArray>(data);
  expectReject<Int16Array>(data);
  expectReject<Uint16Array>(data);
  expectReject<Int32Array>(data);
  expectReject<Uint32Array>(data);
  expectReject<Int64Array>(data);
  expectReject<Uint64Array>(data);
  expectReject<Float32Array>(data);
  expectReject<Float64Array>(data);
  expectReject<ArrayBuffer>(data);

  expectReject<Date>(data);
  expectReject<JSON.Raw>(data);
  expectReject<JSON.Value>(data);
  expectReject<JSON.Obj>(data);
  expectReject<JSON.Arr>(data);
  expectReject<JSON.Box<i32>>(data);
  expectReject<JSON.Box<i32> | null>(data);
  expectReject<RFCEagerEnvelope | null>(data);
  expectReject<RFCLazyEnvelope | null>(data);
  expectReject<string | null>(data);
}

/** Runs a valid RFC fixture through every target compatible with its shape. */
export function expectAcceptEveryCompatibleTarget(
  data: string,
  flags: u32,
): void {
  // Universal exact-value targets.
  expectAccept<JSON.Raw>(data);
  expectAccept<JSON.Value>(data);
  expectAccept<RFCAnyCustom>(data);

  // Universal composite targets receive the exact RFC value inside the
  // smallest compatible envelope. This exercises their real element/field
  // deserializers while preserving the fixture bytes as a complete JSON value.
  const value = normalizeFixture(data);
  const objectEnvelope = '{"value":' + value + "}";
  const arrayEnvelope = "[" + value + "]";
  const structArrayEnvelope = "[" + objectEnvelope + "]";
  expectAccept<JSON.Obj>(objectEnvelope);
  expectAccept<Map<string, JSON.Raw>>(objectEnvelope);
  expectAccept<Map<string, JSON.Value>>(objectEnvelope);
  expectAccept<RFCEagerEnvelope>(objectEnvelope);
  expectLazyEnvelope(objectEnvelope);
  expectAccept<JSON.Arr>(arrayEnvelope);
  expectAccept<JSON.Raw[]>(arrayEnvelope);
  expectAccept<JSON.Value[]>(arrayEnvelope);
  expectAccept<StaticArray<JSON.Raw>>(arrayEnvelope);
  expectAccept<StaticArray<JSON.Value>>(arrayEnvelope);
  expectAccept<Set<JSON.Value>>(arrayEnvelope);
  expectAccept<RFCEagerEnvelope[]>(structArrayEnvelope);
  expectAccept<RFCLazyEnvelope[]>(structArrayEnvelope);
  expectAccept<StaticArray<RFCEagerEnvelope>>(structArrayEnvelope);
  expectAccept<Set<RFCEagerEnvelope>>(structArrayEnvelope);

  if (flags & ROOT_OBJECT) {
    expectAccept<JSON.Obj>(data);
    expectAccept<Map<string, JSON.Raw>>(data);
    expectAccept<Map<string, JSON.Value>>(data);
  }

  if (flags & ROOT_ARRAY) {
    expectAccept<JSON.Arr>(data);
    expectAccept<JSON.Raw[]>(data);
    expectAccept<JSON.Value[]>(data);
    expectAccept<StaticArray<JSON.Raw>>(data);
    expectAccept<StaticArray<JSON.Value>>(data);
    expectAccept<Set<JSON.Value>>(data);
  }

  if (flags & ROOT_STRING) {
    expectAccept<string>(data);
    expectAccept<string | null>(data);
    if (flags & STRING_DATE) expectAccept<Date>(data);
  }

  if (flags & ROOT_BOOLEAN) {
    expectAccept<bool>(data);
    expectAccept<JSON.Box<bool>>(data);
  }

  if (flags & ROOT_NUMBER) {
    expectAccept<f32>(data);
    expectAccept<f64>(data);
    expectAccept<JSON.Box<f64>>(data);
    expectCompatibleIntegers(data, flags);
  }

  if (flags & ROOT_NULL) {
    expectAccept<JSON.Box<i32> | null>(data);
    expectAccept<RFCEagerEnvelope | null>(data);
    expectAccept<RFCLazyEnvelope | null>(data);
    expectAccept<string | null>(data);
  }

  if (flags & ARRAY_NUMBER) {
    expectAccept<f32[]>(data);
    expectAccept<f64[]>(data);
    expectAccept<StaticArray<f32>>(data);
    expectAccept<StaticArray<f64>>(data);
    expectAccept<Set<f32>>(data);
    expectAccept<Set<f64>>(data);
    expectAccept<Float32Array>(data);
    expectAccept<Float64Array>(data);
    expectCompatibleIntegerArrays(data, flags);
  }

  if (flags & ARRAY_STRING) {
    expectAccept<string[]>(data);
    expectAccept<StaticArray<string>>(data);
    expectAccept<Set<string>>(data);
  }

  if (flags & ARRAY_BOOLEAN) {
    expectAccept<bool[]>(data);
    expectAccept<StaticArray<bool>>(data);
    expectAccept<Set<bool>>(data);
  }

  if (flags & ARRAY_OBJECT) {
    expectAccept<Map<string, JSON.Raw>[]>(data);
    expectAccept<Map<string, JSON.Value>[]>(data);
    expectAccept<StaticArray<Map<string, JSON.Raw>>>(data);
    expectAccept<Set<Map<string, JSON.Raw>>>(data);
  }

  // Parsing failures abort before this point; retain one explicit assertion so
  // as-test reports accepted fixtures as executed suites rather than skipped.
  expect(true).toBe(true);
}

function expectCompatibleIntegers(data: string, flags: u32): void {
  if (flags & NUM_I8) {
    expectAccept<i8>(data);
    expectAccept<JSON.Box<i8>>(data);
  }
  if (flags & NUM_U8) {
    expectAccept<u8>(data);
    expectAccept<JSON.Box<u8>>(data);
  }
  if (flags & NUM_I16) expectAccept<i16>(data);
  if (flags & NUM_U16) expectAccept<u16>(data);
  if (flags & NUM_I32) expectAccept<i32>(data);
  if (flags & NUM_U32) expectAccept<u32>(data);
  if (flags & NUM_I64) expectAccept<i64>(data);
  if (flags & NUM_U64) expectAccept<u64>(data);
}

function expectCompatibleIntegerArrays(data: string, flags: u32): void {
  if (flags & NUM_I8) {
    expectAccept<i8[]>(data);
    expectAccept<StaticArray<i8>>(data);
    expectAccept<Set<i8>>(data);
    expectAccept<Int8Array>(data);
  }
  if (flags & NUM_U8) {
    expectAccept<u8[]>(data);
    expectAccept<StaticArray<u8>>(data);
    expectAccept<Set<u8>>(data);
    expectAccept<Uint8Array>(data);
    expectAccept<Uint8ClampedArray>(data);
    expectAccept<ArrayBuffer>(data);
  }
  if (flags & NUM_I16) {
    expectAccept<i16[]>(data);
    expectAccept<StaticArray<i16>>(data);
    expectAccept<Set<i16>>(data);
    expectAccept<Int16Array>(data);
  }
  if (flags & NUM_U16) {
    expectAccept<u16[]>(data);
    expectAccept<StaticArray<u16>>(data);
    expectAccept<Set<u16>>(data);
    expectAccept<Uint16Array>(data);
  }
  if (flags & NUM_I32) {
    expectAccept<i32[]>(data);
    expectAccept<StaticArray<i32>>(data);
    expectAccept<Set<i32>>(data);
    expectAccept<Int32Array>(data);
  }
  if (flags & NUM_U32) {
    expectAccept<u32[]>(data);
    expectAccept<StaticArray<u32>>(data);
    expectAccept<Set<u32>>(data);
    expectAccept<Uint32Array>(data);
  }
  if (flags & NUM_I64) {
    expectAccept<i64[]>(data);
    expectAccept<StaticArray<i64>>(data);
    expectAccept<Set<i64>>(data);
    expectAccept<Int64Array>(data);
  }
  if (flags & NUM_U64) {
    expectAccept<u64[]>(data);
    expectAccept<StaticArray<u64>>(data);
    expectAccept<Set<u64>>(data);
    expectAccept<Uint64Array>(data);
  }
}
