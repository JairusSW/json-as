import { JSON } from "..";
import { describe, expect } from "./lib";


@json
class StringHintCarrier {

  @stringmode("noescape")
  noEscape: string = "abcXYZ123";


  @stringraw
  raw: string = "raw_payload_123";

  plain: string = 'quoted"value';
}

describe("Should serialize fields with string hints", () => {
  const value = new StringHintCarrier();
  expect(JSON.stringify(value)).toBe(
    '{"noEscape":"abcXYZ123","raw":"raw_payload_123","plain":"quoted\\"value"}',
  );
});

describe("Should deserialize fields with string hints", () => {
  const parsed = JSON.parse<StringHintCarrier>(
    '{"noEscape":"abcXYZ123","raw":"raw_payload_123","plain":"quoted\\\\value"}',
  );
  expect(parsed.noEscape).toBe("abcXYZ123");
  expect(parsed.raw).toBe("raw_payload_123");
  expect(parsed.plain).toBe("quoted\\value");
});

describe("Should fallback noescape serialization for escapable content", () => {
  const value = new StringHintCarrier();
  value.noEscape = "line\nbreak";
  expect(JSON.stringify(value)).toBe(
    '{"noEscape":"line\\nbreak","raw":"raw_payload_123","plain":"quoted\\"value"}',
  );
});

describe("Should preserve raw/noescape payload bytes during deserialization", () => {
  const parsed = JSON.parse<StringHintCarrier>(
    '{"noEscape":"a\\\\nb","raw":"r\\\\tb","plain":"ok"}',
  );
  expect(parsed.noEscape).toBe("a\\\\nb");
  expect(parsed.raw).toBe("r\\\\tb");
  expect(parsed.plain).toBe("ok");
});
