// RFC 8259 conformance — i_ (implementation-defined) cases from nst/JSONTestSuite.
// The RFC permits either accepting or rejecting these. json-as ACCEPTS the 31
// below via the dynamic JSON.Value parser (asserted no-throw).
//
// 4 i_ cases are DEFERRED — json-as fatal-aborts (uncatchable trap), which is a
// legal "reject" outcome for impl-defined input but cannot be expressed as a
// passing test under this harness:
//   i_string_UTF-16LE_with_BOM, i_string_utf16BE_no_BOM  — raw UTF-16 byte input
//     (json-as consumes AS string input, not arbitrary byte encodings) -> trap.
//   i_structure_UTF-8_BOM_empty_object                   — leading U+FEFF BOM -> trap.
//   i_structure_500_nested_arrays                         — depth 500 -> stack overflow trap.
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("RFC8259 i_ (implementation-defined — json-as accepts)", () => {
  let c = 0;
  c = 0;
  try {
    JSON.parse<JSON.Value>("[123.456e-789]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_number_double_huge_neg_exp
  c = 0;
  try {
    JSON.parse<JSON.Value>(
      "[0.4e00669999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999969999999006]",
    );
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_number_huge_exp
  c = 0;
  try {
    JSON.parse<JSON.Value>("[-1e+9999]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_number_neg_int_huge_exp
  c = 0;
  try {
    JSON.parse<JSON.Value>("[1.5e+9999]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_number_pos_double_huge_exp
  c = 0;
  try {
    JSON.parse<JSON.Value>("[-123123e100000]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_number_real_neg_overflow
  c = 0;
  try {
    JSON.parse<JSON.Value>("[123123e100000]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_number_real_pos_overflow
  c = 0;
  try {
    JSON.parse<JSON.Value>("[123e-10000000]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_number_real_underflow
  c = 0;
  try {
    JSON.parse<JSON.Value>("[-123123123123123123123123123123]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_number_too_big_neg_int
  c = 0;
  try {
    JSON.parse<JSON.Value>("[100000000000000000000]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_number_too_big_pos_int
  c = 0;
  try {
    JSON.parse<JSON.Value>(
      "[-237462374673276894279832749832423479823246327846]",
    );
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_number_very_big_negative_int
  c = 0;
  try {
    JSON.parse<JSON.Value>('{"\\uDFAA":0}');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_object_key_lone_2nd_surrogate
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uDADA"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_1st_surrogate_but_2nd_missing
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uD888\\u1234"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_1st_valid_surrogate_2nd_invalid
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\u65e5\u0448\ufffd"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_UTF-8_invalid_sequence
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\ufffd\ufffd\ufffd"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_UTF8_surrogate_U+D800
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uD800\\n"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_incomplete_surrogate_and_escape_valid
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uDd1ea"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_incomplete_surrogate_pair
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uD800\\uD800\\n"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_incomplete_surrogates_escape_valid
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\ud800"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_invalid_lonely_surrogate
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\ud800abc"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_invalid_surrogate
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\ufffd"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_invalid_utf-8
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uDd1e\\uD834"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_inverted_surrogates_U+1D11E
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\ufffd"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_iso_latin_1
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uDFAA"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_lone_second_surrogate
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\ufffd"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_lone_utf8_continuation_byte
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\ufffd\ufffd\ufffd\ufffd"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_not_in_unicode_range
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\ufffd\ufffd"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_overlong_sequence_2_bytes
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_overlong_sequence_6_bytes
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\ufffd\ufffd\ufffd\ufffd\ufffd\ufffd"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_overlong_sequence_6_bytes_null
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\ufffd\ufffd"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_truncated-utf-8
  c = 0;
  try {
    JSON.parse<JSON.Value>('[\u0000"\u0000\ufffd\u0000"\u0000]\u0000');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // i_string_utf16LE_no_BOM
});
