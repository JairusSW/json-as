// RFC 8259 conformance — array cases from nst/JSONTestSuite (test_parsing).
// json-as is a typed parser, so each case is parsed against a concrete schema
// matching the array's element type. y_ (must accept) cases are parsed +
// light-asserted; n_ (must reject) cases must throw.
//
// Run via rfc.config.json (coverage disabled — required, the as-test coverage
// instrumentation mis-builds specs in subdirectories):
//   npx ast test assembly/__tests__/rfc/array.spec.ts --config rfc.config.json --enable try-as
import { JSON } from "../..";
import { describe, expect } from "as-test";
import { bs } from "../../../lib/as-bs";

describe("RFC8259 y_array (must accept)", () => {
  // y_array_arraysWithSpaces — [[]   ]
  expect(JSON.parse<i64[][]>("[[]   ]").length).toBe(1);
  expect(JSON.parse<i64[][]>("[[]   ]")[0].length).toBe(0);
  // y_array_empty-string — [""]
  expect(JSON.parse<string[]>('[""]').length).toBe(1);
  // y_array_empty — []
  expect(JSON.parse<i64[]>("[]").length).toBe(0);
  // y_array_ending_with_newline — ["a"]
  expect(JSON.parse<string[]>('["a"]').length).toBe(1);
  // y_array_false — [false]
  expect(JSON.parse<bool[]>("[false]").length).toBe(1);
  // y_array_with_1_and_newline — [1\n]
  expect(JSON.parse<i64[]>("[1\n]").length).toBe(1);
  // y_array_with_leading_space — " [1]"
  expect(JSON.parse<i64[]>(" [1]").length).toBe(1);
  // y_array_with_trailing_space — "[2] "
  expect(JSON.parse<i64[]>("[2] ").length).toBe(1);
});

/* DEFERRED (not active above)
 *  -- mixed-type / nullable: no uniform typed schema (need dynamic JSON.Value) --
 *  y_array_heterogeneous.json        [null, 1, "1", {}]   — mixed-type
 *  y_array_null.json                 [null]               — nullable element
 *  y_array_with_several_null.json    [1,null,null,null,2] — mixed int+null
 *
 *  -- raw invalid UTF-8 bytes: un-transcribable into a typed string literal --
 *  n_array_a_invalid_utf8.json       [a<0xE5>]
 *  n_array_invalid_utf8.json         [<0xFF>]
 *
 *  -- all remaining n_array_* (must-reject) cases below --
 *  The typed array deserializers signal malformed input with
 *  `throw new Error("Failed to parse JSON!")`, but under the WASI runtime this
 *  surfaces as an uncatchable `abort` (process exit 1) rather than a recoverable
 *  error, so as-test's `toThrow` cannot trap it (json-as backlog #3, recoverable
 *  errors). The sibling float.spec.ts hits the same wall. Re-enable once the
 *  parser uses recoverable/catchable errors under try-as:
 *    n_array_1_true_without_comma.json        [1 true]
 *    n_array_colon_instead_of_comma.json      ["": 1]
 *    n_array_comma_after_close.json           [""],
 *    n_array_comma_and_number.json            [,1]
 *    n_array_double_comma.json                [1,,2]
 *    n_array_double_extra_comma.json          ["x",,]
 *    n_array_extra_close.json                 ["x"]]
 *    n_array_extra_comma.json                 ["",]
 *    n_array_incomplete.json                  ["x"
 *    n_array_incomplete_invalid_value.json    [x
 *    n_array_inner_array_no_comma.json        [3[4]]
 *    n_array_items_separated_by_semicolon.json [1:2]
 *    n_array_just_comma.json                  [,]
 *    n_array_just_minus.json                  [-]
 *    n_array_missing_value.json               [   , ""]
 *    n_array_newlines_unclosed.json           ["a",\n4\n,1,
 *    n_array_number_and_comma.json            [1,]
 *    n_array_number_and_several_commas.json   [1,,]
 *    n_array_spaces_vertical_tab_formfeed.json ["<VT>a"\f]
 *    n_array_star_inside.json                 [*]
 *    n_array_unclosed.json                    [""
 *    n_array_unclosed_trailing_comma.json     [1,
 *    n_array_unclosed_with_new_lines.json     [1,\n1\n,1
 *    n_array_unclosed_with_object_inside.json [{}
 */
