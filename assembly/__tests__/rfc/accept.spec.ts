// RFC 8259 conformance — all 95 y_ (MUST-accept) cases from nst/JSONTestSuite,
// parsed via the dynamic JSON.Value type (covers every accept case uniformly
// without a hand-written schema per case). Each must parse without throwing.
import { JSON } from "../..";
import { describe, expect } from "as-test";

describe("RFC8259 y_ (must accept) — dynamic JSON.Value", () => {
  let c = 0;
  c = 0;
  try {
    JSON.parse<JSON.Value>("[[]   ]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_array_arraysWithSpaces
  c = 0;
  try {
    JSON.parse<JSON.Value>('[""]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_array_empty-string
  c = 0;
  try {
    JSON.parse<JSON.Value>("[]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_array_empty
  c = 0;
  try {
    JSON.parse<JSON.Value>('["a"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_array_ending_with_newline
  c = 0;
  try {
    JSON.parse<JSON.Value>("[false]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_array_false
  c = 0;
  try {
    JSON.parse<JSON.Value>('[null, 1, "1", {}]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_array_heterogeneous
  c = 0;
  try {
    JSON.parse<JSON.Value>("[null]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_array_null
  c = 0;
  try {
    JSON.parse<JSON.Value>("[1\u000a]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_array_with_1_and_newline
  c = 0;
  try {
    JSON.parse<JSON.Value>(" [1]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_array_with_leading_space
  c = 0;
  try {
    JSON.parse<JSON.Value>("[1,null,null,null,2]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_array_with_several_null
  c = 0;
  try {
    JSON.parse<JSON.Value>("[2] ");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_array_with_trailing_space
  c = 0;
  try {
    JSON.parse<JSON.Value>("[123e65]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number
  c = 0;
  try {
    JSON.parse<JSON.Value>("[0e+1]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_0e+1
  c = 0;
  try {
    JSON.parse<JSON.Value>("[0e1]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_0e1
  c = 0;
  try {
    JSON.parse<JSON.Value>("[ 4]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_after_space
  c = 0;
  try {
    JSON.parse<JSON.Value>(
      "[-0.000000000000000000000000000000000000000000000000000000000000000000000000000001]\u000a",
    );
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_double_close_to_zero
  c = 0;
  try {
    JSON.parse<JSON.Value>("[20e1]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_int_with_exp
  c = 0;
  try {
    JSON.parse<JSON.Value>("[-0]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_minus_zero
  c = 0;
  try {
    JSON.parse<JSON.Value>("[-123]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_negative_int
  c = 0;
  try {
    JSON.parse<JSON.Value>("[-1]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_negative_one
  c = 0;
  try {
    JSON.parse<JSON.Value>("[-0]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_negative_zero
  c = 0;
  try {
    JSON.parse<JSON.Value>("[1E22]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_real_capital_e
  c = 0;
  try {
    JSON.parse<JSON.Value>("[1E-2]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_real_capital_e_neg_exp
  c = 0;
  try {
    JSON.parse<JSON.Value>("[1E+2]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_real_capital_e_pos_exp
  c = 0;
  try {
    JSON.parse<JSON.Value>("[123e45]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_real_exponent
  c = 0;
  try {
    JSON.parse<JSON.Value>("[123.456e78]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_real_fraction_exponent
  c = 0;
  try {
    JSON.parse<JSON.Value>("[1e-2]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_real_neg_exp
  c = 0;
  try {
    JSON.parse<JSON.Value>("[1e+2]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_real_pos_exponent
  c = 0;
  try {
    JSON.parse<JSON.Value>("[123]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_simple_int
  c = 0;
  try {
    JSON.parse<JSON.Value>("[123.456789]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_number_simple_real
  c = 0;
  try {
    JSON.parse<JSON.Value>('{"asd":"sdf", "dfg":"fgh"}');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_object
  c = 0;
  try {
    JSON.parse<JSON.Value>('{"asd":"sdf"}');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_object_basic
  c = 0;
  try {
    JSON.parse<JSON.Value>('{"a":"b","a":"c"}');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_object_duplicated_key
  c = 0;
  try {
    JSON.parse<JSON.Value>('{"a":"b","a":"b"}');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_object_duplicated_key_and_value
  c = 0;
  try {
    JSON.parse<JSON.Value>("{}");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_object_empty
  c = 0;
  try {
    JSON.parse<JSON.Value>('{"":0}');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_object_empty_key
  c = 0;
  try {
    JSON.parse<JSON.Value>('{"foo\\u0000bar": 42}');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_object_escaped_null_in_key
  c = 0;
  try {
    JSON.parse<JSON.Value>('{ "min": -1.0e+28, "max": 1.0e+28 }');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_object_extreme_numbers
  c = 0;
  try {
    JSON.parse<JSON.Value>(
      '{"x":[{"id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}], "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}',
    );
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_object_long_strings
  c = 0;
  try {
    JSON.parse<JSON.Value>('{"a":[]}');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_object_simple
  c = 0;
  try {
    JSON.parse<JSON.Value>(
      '{"title":"\\u041f\\u043e\\u043b\\u0442\\u043e\\u0440\\u0430 \\u0417\\u0435\\u043c\\u043b\\u0435\\u043a\\u043e\\u043f\\u0430" }',
    );
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_object_string_unicode
  c = 0;
  try {
    JSON.parse<JSON.Value>('{\u000a"a": "b"\u000a}');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_object_with_newlines
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\u0060\\u012a\\u12AB"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_1_2_3_bytes_UTF-8_sequences
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uD801\\udc37"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_accepted_surrogate_pair
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\ud83d\\ude39\\ud83d\\udc8d"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_accepted_surrogate_pairs
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\"\\\\\\/\\b\\f\\n\\r\\t"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_allowed_escapes
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\\\u0000"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_backslash_and_u_escaped_zero
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\""]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_backslash_doublequotes
  c = 0;
  try {
    JSON.parse<JSON.Value>('["a/*b*/c/*d//e"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_comments
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\\\a"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_double_escape_a
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\\\n"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_double_escape_n
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\u0012"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_escaped_control_character
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uFFFF"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_escaped_noncharacter
  c = 0;
  try {
    JSON.parse<JSON.Value>('["asd"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_in_array
  c = 0;
  try {
    JSON.parse<JSON.Value>('[ "asd"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_in_array_with_leading_space
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uDBFF\\uDFFF"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_last_surrogates_1_and_2
  c = 0;
  try {
    JSON.parse<JSON.Value>('["new\\u00A0line"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_nbsp_uescaped
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\udbff\udfff"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_nonCharacterInUTF-8_U+10FFFF
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\uffff"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_nonCharacterInUTF-8_U+FFFF
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\u0000"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_null_escape
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\u002c"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_one-byte-utf-8
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\u03c0"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_pi
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\ud82f\udfff"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_reservedCharacterInUTF-8_U+1BFFF
  c = 0;
  try {
    JSON.parse<JSON.Value>('["asd "]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_simple_ascii
  c = 0;
  try {
    JSON.parse<JSON.Value>('" "');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_space
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uD834\\uDd1e"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_surrogates_U+1D11E_MUSICAL_SYMBOL_G_CLEF
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\u0821"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_three-byte-utf-8
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\u0123"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_two-byte-utf-8
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\u2028"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_u+2028_line_sep
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\u2029"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_u+2029_par_sep
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\u0061\\u30af\\u30EA\\u30b9"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_uEscape
  c = 0;
  try {
    JSON.parse<JSON.Value>('["new\\u000Aline"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_uescaped_newline
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\u007f"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_unescaped_char_delete
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uA66D"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_unicode
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\u005C"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_unicodeEscapedBackslash
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\u2342\u3234\u2342"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_unicode_2
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uDBFF\\uDFFE"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_unicode_U+10FFFE_nonchar
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uD83F\\uDFFE"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_unicode_U+1FFFE_nonchar
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\u200B"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_unicode_U+200B_ZERO_WIDTH_SPACE
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\u2064"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_unicode_U+2064_invisible_plus
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uFDD0"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_unicode_U+FDD0_nonchar
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\uFFFE"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_unicode_U+FFFE_nonchar
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\\u0022"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_unicode_escaped_double_quote
  c = 0;
  try {
    JSON.parse<JSON.Value>('["\u20ac\ud834\udd1e"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_utf8
  c = 0;
  try {
    JSON.parse<JSON.Value>('["a\u007fa"]');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_string_with_del_character
  c = 0;
  try {
    JSON.parse<JSON.Value>("false");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_structure_lonely_false
  c = 0;
  try {
    JSON.parse<JSON.Value>("42");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_structure_lonely_int
  c = 0;
  try {
    JSON.parse<JSON.Value>("-0.1");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_structure_lonely_negative_real
  c = 0;
  try {
    JSON.parse<JSON.Value>("null");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_structure_lonely_null
  c = 0;
  try {
    JSON.parse<JSON.Value>('"asd"');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_structure_lonely_string
  c = 0;
  try {
    JSON.parse<JSON.Value>("true");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_structure_lonely_true
  c = 0;
  try {
    JSON.parse<JSON.Value>('""');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_structure_string_empty
  c = 0;
  try {
    JSON.parse<JSON.Value>('["a"]\u000a');
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_structure_trailing_newline
  c = 0;
  try {
    JSON.parse<JSON.Value>("[true]");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_structure_true_in_array
  c = 0;
  try {
    JSON.parse<JSON.Value>(" [] ");
  } catch (e) {
    c++;
  }
  expect(c).toBe(0); // y_structure_whitespace_array
});
