// RFC 8259 conformance — n_object (must-reject) cases from nst/JSONTestSuite.
//
// These assert json-as REJECTS malformed objects, via `expect(() => …).toThrow()`
// (try-as catches the thrown error). Two constraints make this reliable:
//
//   1. ONE @json class per file. try-as resolves `out.__DESERIALIZE_SLOW(...)`
//      by method name; with multiple @json classes in a file that name is
//      ambiguous (no type info at transform time), so the wrong class's method
//      is linked and the real throw escapes uncaught. With a single class the
//      method resolves unambiguously. (Hence this is split out from the accept
//      cases in struct.spec.ts, which use several schemas but don't need
//      toThrow.)
//   2. The reject must surface as a `throw` on a path try-as can follow
//      (json-as's struct slow-path scanner). A reject schema need not match the
//      data — any malformed object parsed as Oa_str rejects at the structure
//      level — so we parse everything as one Oa_str.
//
// Lenient cases (json-as currently ACCEPTS the malformed input) are deferred in
// struct.spec.ts's DEFERRED block — they need strict parsing, not exception
// catching.
import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class Oa_str {
  a: string = "";
}

describe("RFC8259 n_object (must reject)", () => {
  expect((): void => {
    JSON.parse<Oa_str>('{[: "x"}');
  }).toThrow(); // n_object_bracket_key
  expect((): void => {
    JSON.parse<Oa_str>('{"x", null}');
  }).toThrow(); // n_object_comma_instead_of_colon
  expect((): void => {
    JSON.parse<Oa_str>('{"x"::"b"}');
  }).toThrow(); // n_object_double_colon
  expect((): void => {
    JSON.parse<Oa_str>('{"a" b}');
  }).toThrow(); // n_object_missing_colon
  expect((): void => {
    JSON.parse<Oa_str>('{:"b"}');
  }).toThrow(); // n_object_missing_key
  expect((): void => {
    JSON.parse<Oa_str>('{"a" "b"}');
  }).toThrow(); // n_object_missing_semicolon
  expect((): void => {
    JSON.parse<Oa_str>('{"a":');
  }).toThrow(); // n_object_missing_value
  expect((): void => {
    JSON.parse<Oa_str>('{"a"');
  }).toThrow(); // n_object_no-colon
  expect((): void => {
    JSON.parse<Oa_str>('{a: "b"}');
  }).toThrow(); // n_object_unquoted_key
  expect((): void => {
    JSON.parse<Oa_str>('{"a":"a');
  }).toThrow(); // n_object_unterminated-value
  expect((): void => {
    JSON.parse<Oa_str>('{ "foo" : "bar", "a" }');
  }).toThrow(); // n_object_with_single_string
  expect((): void => {
    JSON.parse<Oa_str>('{"a":"b"}#');
  }).toThrow(); // n_object_with_trailing_garbage
  expect((): void => {
    JSON.parse<Oa_str>('["x", truth]');
  }).toThrow(); // n_object_bad_value
  expect((): void => {
    JSON.parse<Oa_str>('{"a":"b"}/**/');
  }).toThrow(); // n_object_trailing_comment
  expect((): void => {
    JSON.parse<Oa_str>('{"a":"b"}/**//');
  }).toThrow(); // n_object_trailing_comment_open
  expect((): void => {
    JSON.parse<Oa_str>('{"a":"b"}//');
  }).toThrow(); // n_object_trailing_comment_slash_open
  expect((): void => {
    JSON.parse<Oa_str>('{"a":"b"}/');
  }).toThrow(); // n_object_trailing_comment_slash_open_incomplete
  // n_object_emoji ({🇨🇭}) — DEFERRED: json-as accepts it leniently (no throw).
});
