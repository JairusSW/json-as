import { JSON, JSONMode } from "..";
import { describe, expect } from "as-test";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { STRING_METADATA_MASK } from "../util/runtime";


@json
class ClassifiedStringField {
  value: string = "";
}

function stringRuntimeSize(value: string): u32 {
  return changetype<OBJECT>(changetype<usize>(value) - TOTAL_OVERHEAD).rtSize;
}

describe("SIMD clean-string classification preserves String and reuse semantics", () => {
  if (JSON_MODE != JSONMode.SIMD) return;

  const clean = "0123456789abcdef".repeat(4);
  const expected = '"' + clean + '"';
  expect(JSON.stringify(clean)).toBe(expected);
  expect(stringRuntimeSize(clean) & STRING_METADATA_MASK).toBe(
    STRING_METADATA_MASK,
  );

  // A second serialization consumes the classification. Standard String
  // operations and encoders must continue to observe the physical byte size.
  expect(JSON.stringify(clean)).toBe(expected);
  expect(clean.length).toBe(64);
  expect(String.UTF8.byteLength(clean)).toBe(64);
  expect(String.UTF16.byteLength(clean)).toBe(128);
  expect(String.UTF8.decode(String.UTF8.encode(clean))).toBe(clean);
  expect(String.UTF16.decode(String.UTF16.encode(clean))).toBe(clean);
  const concatenated = clean + "!";
  expect(concatenated.length).toBe(65);
  expect(concatenated.charCodeAt(64)).toBe(33);
  __collect();
  expect(JSON.stringify(clean)).toBe(expected);

  // A classified String remains a valid owned-output destination. Matching
  // physical sizes reuse it and clear the source classification before write.
  let output = "x".repeat(40);
  JSON.stringify(output);
  expect(stringRuntimeSize(output) & STRING_METADATA_MASK).toBe(
    STRING_METADATA_MASK,
  );
  const outputPointer = changetype<usize>(output);
  output = JSON.stringify<string>("y".repeat(38), output);
  expect(changetype<usize>(output)).toBe(outputPointer);
  expect(output).toBe('"' + "y".repeat(38) + '"');
  expect(stringRuntimeSize(output)).toBe(80);

  const holder = new ClassifiedStringField();
  holder.value = "a".repeat(32);
  expect(JSON.stringify(holder)).toBe('{"value":"' + holder.value + '"}');
  expect(stringRuntimeSize(holder.value) & STRING_METADATA_MASK).toBe(
    STRING_METADATA_MASK,
  );

  // Same-size overwrite reuses the payload and must clear the old result.
  const samePointer = changetype<usize>(holder.value);
  const escaped = "b".repeat(31) + '"';
  JSON.parse<ClassifiedStringField>(
    '{"value":"' + "b".repeat(31) + '\\""}',
    holder,
  );
  // Slow object parsing reinitializes fields; only the generated fast reader
  // promises to reuse the existing field buffer.
  const type = changetype<ClassifiedStringField>(0);
  // @ts-expect-error: transform-generated fast reader
  if (isDefined(type.__DESERIALIZE_FAST)) {
    expect(changetype<usize>(holder.value)).toBe(samePointer);
  }
  expect(stringRuntimeSize(holder.value) & STRING_METADATA_MASK).toBe(0);
  expect(holder.value).toBe(escaped);
  expect(JSON.stringify(holder)).toBe('{"value":"' + "b".repeat(31) + '\\""}');

  // A different-size overwrite exercises runtime renewal from a classified
  // String and must not copy the classification bit into the new size.
  expect(stringRuntimeSize(holder.value) & STRING_METADATA_MASK).toBe(0);
  holder.value = "c".repeat(32);
  JSON.stringify(holder);
  expect(stringRuntimeSize(holder.value) & STRING_METADATA_MASK).toBe(
    STRING_METADATA_MASK,
  );
  JSON.parse<ClassifiedStringField>(
    '{"value":"' + "d".repeat(40) + '"}',
    holder,
  );
  expect(holder.value.length).toBe(40);
  expect(stringRuntimeSize(holder.value)).toBe(80);
  expect(JSON.stringify(holder)).toBe('{"value":"' + "d".repeat(40) + '"}');
});
