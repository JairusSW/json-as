// RFC 8259 conformance — number cases (integer tokens) from nst/JSONTestSuite
// (test_parsing). Number tokens with NO '.', 'e' or 'E' live here; tokens with
// a fraction/exponent live in float.spec.ts.
//
// y_ = must accept, n_ = must reject, i_ = implementation-defined (behavior
// recorded inline). Run via rfc.config.json (coverage disabled).
//
// NOTE: every n_ (must-reject) integer case is DEFERRED — see the block at the
// bottom. In naive mode json-as is lenient and accepts the malformed token; in
// swar/simd the integer-array parser calls `throw new Error(...)` which try-as
// cannot intercept, so it surfaces as an uncatchable wasi_abort rather than a
// catchable throw. Either way `toThrow` can't assert on them today.
import { JSON } from "../..";
import { describe, expect } from "as-test";
import { bs } from "../../../lib/as-bs";

describe("RFC8259 y_number (integer) — must accept", () => {
  // y_number_after_space: [ 4]
  expect(JSON.parse<i64[]>("[ 4]").length).toBe(1);
  // y_number_minus_zero: [-0]
  expect(JSON.parse<i64[]>("[-0]").length).toBe(1);
  // y_number_negative_int: [-123]
  expect(JSON.parse<i64[]>("[-123]")[0]).toBe(-123);
  // y_number_negative_one: [-1]
  expect(JSON.parse<i64[]>("[-1]")[0]).toBe(-1);
  // y_number_negative_zero: [-0]
  expect(JSON.parse<i64[]>("[-0]").length).toBe(1);
  // y_number_simple_int: [123]
  expect(JSON.parse<i64[]>("[123]")[0]).toBe(123);
});

describe("RFC8259 i_number (integer) — implementation-defined", () => {
  // i_number_too_big_neg_int: json-as accepts (overflows i64 silently)
  expect(JSON.parse<i64[]>("[-123123123123123123123123123123]").length).toBe(1);
  // i_number_too_big_pos_int: json-as accepts (overflows i64 silently)
  expect(JSON.parse<i64[]>("[100000000000000000000]").length).toBe(1);
  // i_number_very_big_negative_int: json-as accepts (overflows i64 silently)
  expect(
    JSON.parse<i64[]>("[-23746237467327689427983274983242347982324632784]")
      .length,
  ).toBe(1);
});

// Keep bs imported/used so the build matches the reject-capable specs.
bs.reset();

/* DEFERRED — n_number (integer) must-reject cases.
   All are lenient-accepted in naive mode AND surface as an uncatchable
   wasi_abort (throw new Error in deserialize/swar/array/integer.ts:309) in
   swar/simd, so as-test toThrow cannot assert on them. Park here until json-as
   has recoverable parse errors.

   n_number_++.json                     [++1234]    lenient: accepted / uncatchable abort
   n_number_+1.json                     [+1]        lenient: accepted / uncatchable abort
   n_number_-01.json                    [-01]       lenient: accepted / uncatchable abort
   n_number_.-1.json                    [.-1]       lenient: accepted / uncatchable abort
   n_number_+Inf.json                   [+Inf]      lenient: accepted / uncatchable abort
   n_number_-NaN.json                   [-NaN]      lenient: accepted / uncatchable abort
   n_number_Inf.json                    [Inf]       lenient: accepted / uncatchable abort
   n_number_NaN.json                    [NaN]       lenient: accepted / uncatchable abort
   n_number_infinity.json               [Infinity]  lenient: accepted / uncatchable abort
   n_number_minus_infinity.json         [-Infinity] lenient: accepted / uncatchable abort
   n_number_expression.json             [1+2]       lenient: accepted / uncatchable abort
   n_number_hex_1_digit.json            [0x1]       lenient: accepted / uncatchable abort
   n_number_hex_2_digits.json           [0x42]      lenient: accepted / uncatchable abort
   n_number_minus_sign_with_trailing_garbage.json [-foo] lenient: accepted / uncatchable abort
   n_number_minus_space_1.json          [- 1]       lenient: accepted / uncatchable abort
   n_number_neg_int_starting_with_zero.json [-012]  lenient: accepted / uncatchable abort
   n_number_neg_with_garbage_at_end.json [-1x]      lenient: accepted / uncatchable abort
   n_number_with_leading_zero.json      [012]       lenient: accepted / uncatchable abort
   n_multidigit_number_then_00.json     123<NUL>    bare i64, lenient: accepted / uncatchable abort

   Un-transcribable raw non-UTF-8 byte inputs (cannot be written as a valid AS
   string literal):
   n_number_U+FF11_fullwidth_digit_one.json   [<U+FF11>]   raw non-UTF8 / fullwidth digit
   n_number_invalid-utf-8-in-int.json         [0<0xE5>]    raw non-UTF8 byte
   n_number_invalid-utf-8-in-bigger-int.json  [123<0xE5>]  raw non-UTF8 byte
*/
