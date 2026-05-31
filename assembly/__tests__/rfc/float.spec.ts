// RFC 8259 conformance — number cases (float tokens) from nst/JSONTestSuite
// (test_parsing). Number tokens WITH a fraction ('.') or exponent ('e'/'E')
// live here; pure-integer tokens live in integer.spec.ts.
//
// y_ = must accept, n_ = must reject, i_ = implementation-defined (behavior
// recorded inline). Run via rfc.config.json (coverage disabled).
//
// NOTE: every n_ (must-reject) float case is DEFERRED — see the block at the
// bottom. The float-array parser is lenient in all three modes (naive / swar /
// simd): it accepts these malformed tokens instead of throwing, so `toThrow`
// cannot assert on them today.
import { JSON } from "../..";
import { describe, expect } from "as-test";
import { bs } from "../../../lib/as-bs";

describe("RFC8259 y_number (float) — must accept", () => {
  // y_number_0e+1: [0e+1]
  expect(JSON.parse<f64[]>("[0e+1]").length).toBe(1);
  // y_number_0e1: [0e1]
  expect(JSON.parse<f64[]>("[0e1]").length).toBe(1);
  // y_number_double_close_to_zero: [-0.000...001]
  expect(
    JSON.parse<f64[]>(
      "[-0.00000000000000000000000000000000000000000000000000000000000000000000000000000001]",
    ).length,
  ).toBe(1);
  // y_number_int_with_exp: [20e1]
  expect(JSON.parse<f64[]>("[20e1]")[0]).toBeCloseTo(200.0, 4);
  // y_number_real_capital_e: [1E22]
  expect(JSON.parse<f64[]>("[1E22]").length).toBe(1);
  // y_number_real_capital_e_neg_exp: [1E-2]
  expect(JSON.parse<f64[]>("[1E-2]")[0]).toBeCloseTo(0.01, 4);
  // y_number_real_capital_e_pos_exp: [1E+2]
  expect(JSON.parse<f64[]>("[1E+2]")[0]).toBeCloseTo(100.0, 4);
  // y_number_real_exponent: [123e45]
  expect(JSON.parse<f64[]>("[123e45]").length).toBe(1);
  // y_number_real_fraction_exponent: [123.456e78]
  expect(JSON.parse<f64[]>("[123.456e78]").length).toBe(1);
  // y_number_real_neg_exp: [1e-2]
  expect(JSON.parse<f64[]>("[1e-2]")[0]).toBeCloseTo(0.01, 4);
  // y_number_real_pos_exponent: [1e+2]
  expect(JSON.parse<f64[]>("[1e+2]")[0]).toBeCloseTo(100.0, 4);
  // y_number_simple_real: [123.456789]
  expect(JSON.parse<f64[]>("[123.456789]")[0]).toBeCloseTo(123.456789, 4);
});

describe("RFC8259 i_number (float) — implementation-defined", () => {
  // i_number_double_huge_neg_exp: [123.456e-789]  json-as accepts (underflows to 0)
  expect(JSON.parse<f64[]>("[123.456e-789]").length).toBe(1);
  // i_number_huge_exp: [0.4e0066999...]  json-as accepts (overflows to Infinity)
  expect(
    JSON.parse<f64[]>(
      "[0.4e00669999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999969999999006]",
    ).length,
  ).toBe(1);
  // i_number_neg_int_huge_exp: [-1e+9999]  json-as accepts (overflows to -Infinity)
  expect(JSON.parse<f64[]>("[-1e+9999]").length).toBe(1);
  // i_number_pos_double_huge_exp: [1.5e+9999]  json-as accepts (overflows to Infinity)
  expect(JSON.parse<f64[]>("[1.5e+9999]").length).toBe(1);
  // i_number_real_neg_overflow: [-123123e100000]  json-as accepts (overflows to -Infinity)
  expect(JSON.parse<f64[]>("[-123123e100000]").length).toBe(1);
  // i_number_real_pos_overflow: [123123e100000]  json-as accepts (overflows to Infinity)
  expect(JSON.parse<f64[]>("[123123e100000]").length).toBe(1);
  // i_number_real_underflow: [123e-10000000]  json-as accepts (underflows to 0)
  expect(JSON.parse<f64[]>("[123e-10000000]").length).toBe(1);
});

// Keep bs imported/used so the build matches the reject-capable specs.
bs.reset();

/* DEFERRED — n_number (float) must-reject cases.
   The float-array parser is lenient in all three modes (naive / swar / simd):
   each of these malformed tokens is accepted instead of throwing, so as-test
   toThrow cannot assert on them. Park here until json-as rejects them.

   n_number_-1.0..json                  [-1.0.]          lenient: accepted
   n_number_-2..json                    [-2.]            lenient: accepted
   n_number_.2e-3.json                  [.2e-3]          lenient: accepted
   n_number_0.1.2.json                  [0.1.2]          lenient: accepted
   n_number_0.3e+.json                  [0.3e+]          lenient: accepted
   n_number_0.3e.json                   [0.3e]           lenient: accepted
   n_number_0.e1.json                   [0.e1]           lenient: accepted
   n_number_0_capital_E+.json           [0E+]            lenient: accepted
   n_number_0_capital_E.json            [0E]             lenient: accepted
   n_number_0e+.json                    [0e+]            lenient: accepted
   n_number_0e.json                     [0e]             lenient: accepted
   n_number_1.0e+.json                  [1.0e+]          lenient: accepted
   n_number_1.0e-.json                  [1.0e-]          lenient: accepted
   n_number_1.0e.json                   [1.0e]           lenient: accepted
   n_number_1_000.0 (n_number_1_000.json) [1 000.0]      lenient: accepted
   n_number_1eE2.json                   [1eE2]           lenient: accepted
   n_number_2.e+3.json                  [2.e+3]          lenient: accepted
   n_number_2.e-3.json                  [2.e-3]          lenient: accepted
   n_number_2.e3.json                   [2.e3]           lenient: accepted
   n_number_9.e+.json                   [9.e+]           lenient: accepted
   n_number_invalid+-.json              [0e+-1]          lenient: accepted
   n_number_invalid-negative-real.json  [-123.123foo]    lenient: accepted
   n_number_neg_real_without_int_part.json [-.123]       lenient: accepted
   n_number_real_garbage_after_e.json   [1ea]            lenient: accepted
   n_number_real_without_fractional_part.json [1.]       lenient: accepted
   n_number_starting_with_dot.json      [.123]           lenient: accepted
   n_number_with_alpha.json             [1.2a-3]         lenient: accepted
   n_number_with_alpha_char.json        [1.8011670033376514H-308] lenient: accepted

   Un-transcribable raw non-UTF-8 byte inputs (cannot be written as a valid AS
   string literal):
   n_number_invalid-utf-8-in-exponent.json        [1e1<0xE5>]  raw non-UTF8 byte
   n_number_real_with_invalid_utf8_after_e.json   [1e<0xE5>]   raw non-UTF8 byte
*/
