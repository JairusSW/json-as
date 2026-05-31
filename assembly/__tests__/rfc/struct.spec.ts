// RFC 8259 conformance — object/struct cases from nst/JSONTestSuite
// (test_parsing). json-as is a typed parser, so each case is parsed against a
// concrete schema. y_/i_ (accept / impl-defined) cases are covered here; every
// remaining object case is enumerated in the DEFERRED block at the bottom
// (nothing silently omitted).
//
// Run via `npm run test:rfc` (rfc.config.json) — coverage disabled (the as-test
// coverage instrumentation mis-builds specs in subdirectories).
import { JSON } from "../..";
import { describe, expect } from "as-test";


@json
class Oasd_dfg {
  asd: string = "";
  dfg: string = "";
}


@json
class Oasd {
  asd: string = "";
}


@json
class Oa_str {
  a: string = "";
}


@json
class Oa_arr {
  a: i32[] = [];
}


@json
class OEmpty {}


@json
class OminMax {
  min: f64 = 0;
  max: f64 = 0;
}


@json
class Otitle {
  title: string = "";
}


@json
class OInnerId {
  id: string = "";
}


@json
class Ox_id {
  x: OInnerId[] = [];
  id: string = "";
}

describe("RFC8259 y_object (must accept + round-trip)", () => {
  // y_object — two string fields, whitespace after the comma
  expect(
    JSON.stringify(JSON.parse<Oasd_dfg>('{"asd":"sdf", "dfg":"fgh"}')),
  ).toBe('{"asd":"sdf","dfg":"fgh"}');
  // y_object_basic
  expect(JSON.stringify(JSON.parse<Oasd>('{"asd":"sdf"}'))).toBe(
    '{"asd":"sdf"}',
  );
  // y_object_duplicated_key — last value wins
  expect(JSON.parse<Oa_str>('{"a":"b","a":"c"}').a).toBe("c");
  // y_object_duplicated_key_and_value
  expect(JSON.parse<Oa_str>('{"a":"b","a":"b"}').a).toBe("b");
  // y_object_empty
  expect(JSON.stringify(JSON.parse<OEmpty>("{}"))).toBe("{}");
  // y_object_simple — empty array value
  expect(JSON.stringify(JSON.parse<Oa_arr>('{"a":[]}'))).toBe('{"a":[]}');
  // y_object_with_newlines
  expect(JSON.stringify(JSON.parse<Oa_str>('{\n"a": "b"\n}'))).toBe(
    '{"a":"b"}',
  );
  // y_object_empty_key — struct can't name a "" field, so Map
  expect(JSON.parse<Map<string, i32>>('{"":0}').get("")).toBe(0);
  // y_object_escaped_null_in_key
  expect(JSON.parse<Map<string, i32>>('{"foo\\u0000bar": 42}').size).toBe(1);
  // y_object_extreme_numbers
  const ex = JSON.parse<OminMax>('{ "min": -1.0e+28, "max": 1.0e+28 }');
  expect(ex.min).toBeLessThan(0.0);
  expect(ex.max).toBeGreaterThan(0.0);
  // y_object_string_unicode
  expect(
    JSON.parse<Otitle>(
      '{"title":"\\u041f\\u043e\\u043b\\u0442\\u043e\\u0440\\u0430" }',
    ).title.length,
  ).toBe(7);
  // y_object_long_strings
  const long = JSON.parse<Ox_id>(
    '{"x":[{"id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}], "id": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}',
  );
  expect(long.x.length).toBe(1);
  expect(long.id.length).toBe(40);
});

describe("RFC8259 i_object (implementation-defined — must not corrupt state)", () => {
  // i_object_key_lone_2nd_surrogate — lone low surrogate in key; json-as accepts
  expect(JSON.parse<Map<string, i32>>('{"\\uDFAA":0}').size).toBe(1);
});

// ── n_object (must reject) ──────────────────────────────────────────────────
//
// 17 of 28 are now ENABLED in struct-reject.spec.ts (the structural rejects that
// json-as throws on — caught via toThrow with the try-as cross-module fix +
// one-class-per-file). The rest stay deferred:
//
// LENIENT — json-as ACCEPTS these (no throw); needs strict parsing, not catching:
//   n_object_emoji ({🇨🇭})                       n_object_garbage_at_end ({"a":"a" 123})
//   n_object_key_with_single_quotes ({key:'v'})   n_object_non_string_key ({1:1})
//   n_object_non_string_key_but_huge_number       n_object_repeated_null_null
//   n_object_several_trailing_commas              n_object_single_quote ({'a':0})
//   n_object_trailing_comma ({"id":0,})           n_object_two_commas_in_a_row
//
// UN-TRANSCRIBABLE (raw lone UTF-8 continuation byte — needs a byte-array harness):
//   n_object_lone_continuation_byte_in_key_and_trailing_comma
// ─────────────────────────────────────────────────────────────────────────────
