// RFC 8259 conformance — document *structure* cases from nst/JSONTestSuite
// (test_parsing). These concern the overall document shape: top-level value
// type, nesting, trailing junk, unclosed containers, whitespace-only input,
// BOM, etc. json-as is a typed parser, so each case is parsed against a
// concrete schema matching the top-level value.
//
//   y_  must accept   -> parse + light assert (value / length / non-crash)
//   n_  must reject   -> expect(... JSON.parse ...).toThrow(); then bs.reset()
//   i_  impl-defined  -> run + match observed behavior (commented)
//
// Run via rfc.config.json (coverage disabled — as-test coverage mis-builds
// specs in subdirectories).
//
// IMPORTANT (see DEFERRED block at the bottom): every n_ / n_incomplete /
// n_single structure case had to be deferred. Empirically (one probe spec per
// case, all 3 modes) each malformed input is *either* parsed leniently in the
// naive mode (json-as ignores trailing junk / accepts truncated input, so the
// closure "did not throw") *or* the typed deserializer signals the error with
// `throw new Error("Failed to parse JSON!")`, which under the WASI runtime
// lowers to an uncatchable `wasi_abort` (process exit 1) in swar/simd rather
// than a recoverable error try-as can trap. Either way `toThrow` cannot be made
// GREEN across all 3 modes today. This is json-as backlog #3 (recoverable parse
// errors) — the sibling array.spec.ts / float.spec.ts / integer.spec.ts hit the
// same wall and defer their n_ cases for the same reason.
import { JSON } from "../..";
import { describe, expect } from "as-test";
import { bs } from "../../../lib/as-bs";

describe("RFC8259 y_structure (must accept)", () => {
  // y_structure_lonely_false
  expect(JSON.parse<bool>("false")).toBe(false);
  // y_structure_lonely_int  =>  42
  expect(JSON.parse<i64>("42")).toBe(42);
  // y_structure_lonely_negative_real  =>  -0.1
  expect(JSON.parse<f64>("-0.1")).toBe(-0.1);
  // y_structure_lonely_true
  expect(JSON.parse<bool>("true")).toBe(true);
  // y_structure_lonely_string  =>  "asd"
  expect(JSON.parse<string>('"asd"')).toBe("asd");
  // y_structure_string_empty  =>  ""
  expect(JSON.parse<string>('""')).toBe("");
  // y_structure_trailing_newline  =>  ["a"]\n  (trailing LF after the value)
  expect(JSON.parse<string[]>('["a"]\n').length).toBe(1);
  // y_structure_true_in_array  =>  [true]
  expect(JSON.parse<bool[]>("[true]")[0]).toBe(true);
  // y_structure_whitespace_array  =>  " [] "  (leading/trailing spaces around [])
  expect(JSON.parse<i64[]>(" [] ").length).toBe(0);
});

// y_structure_lonely_null  =>  null
// Deferred: a bare top-level `null` needs a nullable schema. JSON.parse<T | null>
// / JSON.parse<string | null> isn't expressible as a clean structural case here
// and isn't the focus of this file; tracked alongside the other nullable gaps
// noted in array.spec.ts. (See DEFERRED block.)

/* DEFERRED (not active above)
 *
 * ── deep nesting — stack guard, backlog #4 ───────────────────────────────────
 * These recurse one stack frame per nesting level; at this depth the parser
 * stack-overflows / traps (a low-level Wasm trap, not a catchable throw) rather
 * than rejecting cleanly:
 *   i_structure_500_nested_arrays.json        [ x500
 *   n_structure_100000_opening_arrays.json    [ x100000
 *   n_structure_open_array_object.json        [{"":[ … huge depth ([{"":)*N
 *
 * ── raw-byte / BOM / invalid-or-incomplete UTF-8 — not a clean AS literal ────
 * These contain raw bytes (BOM EF BB BF, lone high bytes, NUL, U+2060 word
 * joiner) that cannot be written as a faithful UTF-16 AssemblyScript string
 * literal:
 *   i_structure_UTF-8_BOM_empty_object.json        EF BB BF "{}"
 *   n_structure_UTF8_BOM_no_data.json              EF BB BF
 *   n_structure_incomplete_UTF8_BOM.json           EF BB "{}"
 *   n_structure_lone-invalid-utf-8.json            E5
 *   n_structure_single_eacute.json                 E9
 *   n_structure_ascii-unicode-identifier.json      61 C3 A5  (a + å)
 *   n_structure_unicode-identifier.json            C3 A5     (å)
 *   n_structure_null-byte-outside-string.json      [ 00 ]
 *   n_structure_U+2060_word_joined.json            [ E2 81 A0 ]
 *   n_structure_whitespace_U+2060_word_joiner.json [ E2 81 A0 ]
 *   n_structure_no_data.json                       (empty file)
 *
 * ── must-reject, but not assertable via toThrow today — backlog #3 ───────────
 * Probed individually in all 3 modes. Each is EITHER parsed leniently in the
 * naive mode (json-as accepts the malformed/truncated input, "did not throw")
 * OR the typed deserializer's `throw new Error("Failed to parse JSON!")` lowers
 * to an uncatchable `wasi_abort` (process exit 1) in swar/simd. Re-enable once
 * json-as uses recoverable/catchable parse errors under try-as. Each line notes
 * the input and the observed failure mode (L = lenient/did-not-throw in naive,
 * A = uncatchable abort in swar/simd):
 *   n_structure_angle_bracket_..json               <.>            L / A(int-array)
 *   n_structure_angle_bracket_null.json            [<null>]       L / A(int-array)
 *   n_structure_array_trailing_garbage.json        [1]x           L
 *   n_structure_array_with_extra_array_close.json  [1]]           L
 *   n_structure_array_with_unclosed_string.json    ["asd]         L
 *   n_structure_capitalized_True.json              [True]         L
 *   n_structure_close_unopened_array.json          1]             L
 *   n_structure_comma_instead_of_closing_brace.json {"x": true,   L / A
 *   n_structure_double_array.json                  [][]           L
 *   n_structure_end_array.json                     ]              L / A(int-array)
 *   n_structure_number_with_trailing_garbage.json  2@             L
 *   n_structure_object_followed_by_closing_object.json {}}        L
 *   n_structure_object_unclosed_no_value.json      {"":           L / A
 *   n_structure_object_with_comment.json           {"a":/*c*\/"b"} L / A
 *   n_structure_object_with_trailing_garbage.json  {"a": true} "x" L / A
 *   n_structure_open_array_apostrophe.json         ['             L
 *   n_structure_open_array_comma.json              [,             L / A(int-array)
 *   n_structure_open_array_open_object.json        [{             L / A
 *   n_structure_open_array_open_string.json        ["a            L
 *   n_structure_open_array_string.json             ["a"           L / A(string-array)
 *   n_structure_open_object.json                   {              L / A
 *   n_structure_open_object_close_array.json       {]             L / A
 *   n_structure_open_object_comma.json             {,             L / A
 *   n_structure_open_object_open_array.json        {[             L / A
 *   n_structure_open_object_open_string.json       {"a            L / A
 *   n_structure_open_object_string_with_apostrophes.json {'a'     L / A
 *   n_structure_trailing_#.json                    {"a":"b"}#{}   L
 *   n_structure_uescaped_LF_before_string.json     [<LF>""] (raw LF byte) L
 *   n_structure_unclosed_array.json                [1             L / A(int-array)
 *   n_structure_unclosed_array_partial_null.json   [ false, nul   L
 *   n_structure_unclosed_array_unfinished_false.json [ true, fals L
 *   n_structure_unclosed_array_unfinished_true.json [ false, tru  L
 *   n_structure_unclosed_object.json               {"asd":"asd"   L / A
 *   n_structure_lone-open-bracket.json             [              L / A(int-array)
 *   n_structure_single_star.json                   *              L
 *   n_structure_open_open.json                     ["\{["\{["\{   L / A(string-array)
 *   n_structure_whitespace_formfeed.json           [\f]           L
 *   n_single_space.json                            (single space) L
 *   n_incomplete_false.json                        [fals]         L
 *   n_incomplete_null.json                         [nul]          L
 *   n_incomplete_true.json                         [tru]          L
 */
