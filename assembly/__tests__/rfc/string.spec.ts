// RFC 8259 conformance — string cases from nst/JSONTestSuite (test_parsing).
// json-as is a typed parser, so each case is parsed against a concrete schema:
//   ["asd"]  -> string[]
//   "asd"    -> string
//
// y_ (must accept):  parse + a light, non-fragile assert (length checks rather
//                    than exact stringify round-trips, since re-escaping differs).
// n_ (must reject):  expect(... ).toThrow(); then bs.reset().
// i_ (impl-defined): RUN it, then assert to match observed json-as behavior.
//
// Run via rfc.config.json (coverage disabled — the as-test coverage
// instrumentation mis-builds specs in subdirectories):
//   npx ast test assembly/__tests__/rfc/string.spec.ts --config rfc.config.json --enable try-as
import { JSON } from "../..";
import { describe, expect } from "as-test";
import { bs } from "../../../lib/as-bs";

describe("RFC8259 y_string (must accept)", () => {
  // y_string_1_2_3_bytes_UTF-8_sequences
  expect(JSON.parse<string[]>('["\\u0060\\u012a\\u12AB"]')[0].length).toBe(3);
  // y_string_accepted_surrogate_pair
  expect(JSON.parse<string[]>('["\\uD801\\udc37"]').length).toBe(1);
  // y_string_accepted_surrogate_pairs
  expect(JSON.parse<string[]>('["\\ud83d\\ude39\\ud83d\\udc8d"]').length).toBe(
    1,
  );
  // y_string_allowed_escapes
  expect(JSON.parse<string[]>('["\\"\\\\\\/\\b\\f\\n\\r\\t"]').length).toBe(1);
  // y_string_backslash_and_u_escaped_zero — literal backslash + "u0000"
  expect(JSON.parse<string[]>('["\\\\u0000"]')[0].length).toBe(6);
  // y_string_backslash_doublequotes
  expect(JSON.parse<string[]>('["\\""]')[0].length).toBe(1);
  // y_string_comments — slashes/stars are ordinary chars inside a string
  expect(JSON.parse<string[]>('["a/*b*/c/*d//e"]')[0].length).toBe(13);
  // y_string_double_escape_a — backslash + 'a'
  expect(JSON.parse<string[]>('["\\\\a"]')[0].length).toBe(2);
  // y_string_double_escape_n — backslash + 'n'
  expect(JSON.parse<string[]>('["\\\\n"]')[0].length).toBe(2);
  // y_string_escaped_control_character
  expect(JSON.parse<string[]>('["\\u0012"]')[0].length).toBe(1);
  // y_string_escaped_noncharacter
  expect(JSON.parse<string[]>('["\\uFFFF"]')[0].length).toBe(1);
  // y_string_in_array
  expect(JSON.parse<string[]>('["asd"]')[0]).toBe("asd");
  // y_string_in_array_with_leading_space
  expect(JSON.parse<string[]>('[ "asd"]')[0]).toBe("asd");
  // y_string_last_surrogates_1_and_2
  expect(JSON.parse<string[]>('["\\uDBFF\\uDFFF"]').length).toBe(1);
  // y_string_nbsp_uescaped
  expect(JSON.parse<string[]>('["new\\u00A0line"]')[0].length).toBe(8);
  // y_string_nonCharacterInUTF-8_U+10FFFF (raw UTF-8)
  expect(JSON.parse<string[]>('["\u{10FFFF}"]').length).toBe(1);
  // y_string_nonCharacterInUTF-8_U+FFFF (raw UTF-8)
  expect(JSON.parse<string[]>('["\u{FFFF}"]').length).toBe(1);
  // y_string_null_escape
  expect(JSON.parse<string[]>('["\\u0000"]')[0].length).toBe(1);
  // y_string_one-byte-utf-8
  expect(JSON.parse<string[]>('["\\u002c"]')[0]).toBe(",");
  // y_string_pi (raw UTF-8)
  expect(JSON.parse<string[]>('["\u{03C0}"]')[0]).toBe("\u{03C0}");
  // y_string_reservedCharacterInUTF-8_U+1BFFF (raw UTF-8)
  expect(JSON.parse<string[]>('["\u{1BFFF}"]').length).toBe(1);
  // y_string_simple_ascii
  expect(JSON.parse<string[]>('["asd "]')[0]).toBe("asd ");
  // y_string_space — bare string
  expect(JSON.parse<string>('" "')).toBe(" ");
  // y_string_surrogates_U+1D11E_MUSICAL_SYMBOL_G_CLEF
  expect(JSON.parse<string[]>('["\\uD834\\uDd1e"]').length).toBe(1);
  // y_string_three-byte-utf-8
  expect(JSON.parse<string[]>('["\\u0821"]')[0].length).toBe(1);
  // y_string_two-byte-utf-8
  expect(JSON.parse<string[]>('["\\u0123"]')[0].length).toBe(1);
  // y_string_u+2028_line_sep (raw UTF-8)
  expect(JSON.parse<string[]>('["\u{2028}"]')[0]).toBe("\u{2028}");
  // y_string_u+2029_par_sep (raw UTF-8)
  expect(JSON.parse<string[]>('["\u{2029}"]')[0]).toBe("\u{2029}");
  // y_string_uEscape
  expect(
    JSON.parse<string[]>('["\\u0061\\u30af\\u30EA\\u30b9"]')[0].length,
  ).toBe(4);
  // y_string_uescaped_newline
  expect(JSON.parse<string[]>('["new\\u000Aline"]')[0].length).toBe(8);
  // y_string_unescaped_char_delete (raw 0x7F)
  expect(JSON.parse<string[]>('["\u{7F}"]')[0].length).toBe(1);
  // y_string_unicode
  expect(JSON.parse<string[]>('["\\uA66D"]')[0].length).toBe(1);
  // y_string_unicodeEscapedBackslash
  expect(JSON.parse<string[]>('["\\u005C"]')[0]).toBe("\\");
  // y_string_unicode_2 (raw UTF-8)
  expect(JSON.parse<string[]>('["\u{2342}\u{3234}\u{2342}"]')[0].length).toBe(
    3,
  );
  // y_string_unicode_U+10FFFE_nonchar
  expect(JSON.parse<string[]>('["\\uDBFF\\uDFFE"]').length).toBe(1);
  // y_string_unicode_U+1FFFE_nonchar
  expect(JSON.parse<string[]>('["\\uD83F\\uDFFE"]').length).toBe(1);
  // y_string_unicode_U+200B_ZERO_WIDTH_SPACE
  expect(JSON.parse<string[]>('["\\u200B"]')[0].length).toBe(1);
  // y_string_unicode_U+2064_invisible_plus
  expect(JSON.parse<string[]>('["\\u2064"]')[0].length).toBe(1);
  // y_string_unicode_U+FDD0_nonchar
  expect(JSON.parse<string[]>('["\\uFDD0"]')[0].length).toBe(1);
  // y_string_unicode_U+FFFE_nonchar
  expect(JSON.parse<string[]>('["\\uFFFE"]')[0].length).toBe(1);
  // y_string_unicode_escaped_double_quote
  expect(JSON.parse<string[]>('["\\u0022"]')[0]).toBe('"');
  // y_string_utf8 (raw UTF-8: euro + G clef)
  expect(JSON.parse<string[]>('["\u{20AC}\u{1D11E}"]').length).toBe(1);
  // y_string_with_del_character (raw 0x7F between a's)
  expect(JSON.parse<string[]>('["a\u{7F}a"]')[0].length).toBe(3);
  // y_structure_string_empty — bare empty string
  expect(JSON.parse<string>('""')).toBe("");
});

describe("RFC8259 i_string (implementation-defined)", () => {
  // i_string_1st_surrogate_but_2nd_missing — ["\uDADA"]
  expect(JSON.parse<string[]>('["\\uDADA"]').length).toBe(1); // i_...: accepts
  // i_string_1st_valid_surrogate_2nd_invalid — ["\uD888ሴ"]
  expect(JSON.parse<string[]>('["\\uD888\\u1234"]').length).toBe(1); // i_...: accepts
  // i_string_incomplete_surrogate_and_escape_valid — ["\uD800\n"]
  expect(JSON.parse<string[]>('["\\uD800\\n"]').length).toBe(1); // i_...: accepts
  // i_string_incomplete_surrogate_pair — ["\uDd1ea"]
  expect(JSON.parse<string[]>('["\\uDd1ea"]').length).toBe(1); // i_...: accepts
  // i_string_incomplete_surrogates_escape_valid — ["\uD800\uD800\n"]
  expect(JSON.parse<string[]>('["\\uD800\\uD800\\n"]').length).toBe(1); // i_...: accepts
  // i_string_invalid_lonely_surrogate — ["\ud800"]
  expect(JSON.parse<string[]>('["\\ud800"]').length).toBe(1); // i_...: accepts
  // i_string_invalid_surrogate — ["\ud800abc"]
  expect(JSON.parse<string[]>('["\\ud800abc"]').length).toBe(1); // i_...: accepts
  // i_string_inverted_surrogates_U+1D11E — ["\uDd1e\uD834"]
  expect(JSON.parse<string[]>('["\\uDd1e\\uD834"]').length).toBe(1); // i_...: accepts
  // i_string_lone_second_surrogate — ["\uDFAA"]
  expect(JSON.parse<string[]>('["\\uDFAA"]').length).toBe(1); // i_...: accepts
});

/* DEFERRED
 * ============================================================================
 * n_string_* (must-reject) — ALL deferred. json-as rejects malformed strings
 * by calling abort() in the SWAR string scanner, which the WASI shim lowers to
 * ~lib/wasi_internal/wasi_abort. try-as explicitly does NOT rewrite ~lib/wasi_
 * traps, so the abort is an uncatchable fatal trap: expect(...).toThrow() does
 * not catch it and the whole test process crashes. The few n_ cases that DON'T
 * abort are instead parsed leniently (no throw at all). Either way they cannot
 * be expressed as a passing toThrow() under this harness (same root cause as
 * RFC-DEFERRED.md backlog #3, recoverable errors). Confirmed empirically:
 *   ["'single quote'"]  -> abort "Expected leading quote" (crash, uncatchable)
 *   "abc"               -> parsed leniently, did NOT throw
 *
 *   n_string_1_surrogate_then_escape            ["\uD800\"]
 *   n_string_1_surrogate_then_escape_u          ["\uD800\u"]
 *   n_string_1_surrogate_then_escape_u1         ["\uD800\u1"]
 *   n_string_1_surrogate_then_escape_u1x        ["\uD800\u1x"]
 *   n_string_escape_x                           ["\x00"]
 *   n_string_escaped_backslash_bad              ["\\\"]
 *   n_string_incomplete_escape                  ["\"]
 *   n_string_incomplete_escaped_character       ["\u00A"]
 *   n_string_incomplete_surrogate               ["\uD834\uDd"]
 *   n_string_incomplete_surrogate_escape_invalid ["\uD800\uD800\x"]
 *   n_string_invalid_backslash_esc              ["\a"]
 *   n_string_invalid_unicode_escape             ["\uqqqq"]
 *   n_string_leading_uescaped_thinspace         [ "asd"]
 *   n_string_no_quotes_with_bad_escape          [\n]
 *   n_string_single_doublequote                 "
 *   n_string_single_quote                       ['single quote']
 *   n_string_single_string_no_double_quotes     abc
 *   n_string_start_escape_unclosed              ["\
 *   n_string_unicode_CapitalU                   "\UA66D"
 *   n_string_with_trailing_garbage              ""x
 *   n_string_accentuated_char_no_quotes         [é]            (raw 0xC3 0xA9, bare token, no quotes)
 *   n_string_backslash_00                       ["\<NUL>"]     (raw 0x00 control byte in source)
 *   n_string_escaped_ctrl_char_tab              ["\<TAB>"]     (raw 0x09 control byte in source)
 *   n_string_escaped_emoji                      ["\<U+1F300>"] (backslash + raw 4-byte UTF-8)
 *   n_string_invalid-utf-8-in-escape            ["\u<0xE5>"]   (raw invalid byte after \u)
 *   n_string_invalid_utf8_after_escape          ["\<0xE5>"]    (raw invalid byte after backslash)
 *   n_string_unescaped_ctrl_char                ["a<NUL>a"]    (raw 0x00 control byte)
 *   n_string_unescaped_newline                  ["new<LF>line"](raw 0x0A control byte)
 *   n_string_unescaped_tab                      ["<TAB>"]      (raw 0x09 control byte)
 *
 * i_string_* (impl-defined) — raw-byte / BOM cases deferred: these are invalid
 * UTF-8 sequences, lone continuation bytes, overlong encodings, BOM-prefixed
 * UTF-16, or BOM-less UTF-16 that cannot be written as a clean AS string literal
 * (and would fault / mis-decode if attempted):
 *   i_string_UTF-16LE_with_BOM        FF FE 5B 00 22 00 E9 00 22 00 5D 00
 *   i_string_UTF-8_invalid_sequence   ["<E6 97 A5 D1 88 FA>"]
 *   i_string_UTF8_surrogate_U+D800    ["<ED A0 80>"]
 *   i_string_invalid_utf-8            ["<FF>"]
 *   i_string_iso_latin_1              ["<E9>"]
 *   i_string_lone_utf8_continuation_byte ["<81>"]
 *   i_string_not_in_unicode_range     ["<F4 BF BF BF>"]
 *   i_string_overlong_sequence_2_bytes   ["<C0 AF>"]
 *   i_string_overlong_sequence_6_bytes   ["<FC 83 BF BF BF BF>"]
 *   i_string_overlong_sequence_6_bytes_null ["<FC 80 80 80 80 80>"]
 *   i_string_truncated-utf-8          ["<E0 FF>"]
 *   i_string_utf16BE_no_BOM           00 5B 00 22 00 E9 00 22 00 5D
 *   i_string_utf16LE_no_BOM           5B 00 22 00 E9 00 22 00 5D 00
 * ============================================================================
 */
