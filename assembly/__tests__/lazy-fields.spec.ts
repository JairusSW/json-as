import { JSON } from "..";
import { describe, expect } from "as-test";

// `JSON.Lazy<T>` fields: transparent typed access, but the value's raw slice is
// stored at parse and parsed into T on first access (a generated get accessor).

@json class Inner {
  v: i32 = 0;
}


@json class Owner {
  login: string = "";
  id: i32 = 0;
  deep!: JSON.Lazy<Inner>; // lazy field inside a lazy struct (nested)
}


@json class Repo {
  name!: JSON.Lazy<string>;
  owner!: JSON.Lazy<Owner>;
  tags!: JSON.Lazy<i32[]>;
}


@json class LazyPrimitives {
  count!: JSON.Lazy<i32>;
  enabled!: JSON.Lazy<bool>;
}


@json class NullableOwner {
  owner!: JSON.Lazy<Owner | null>;
}

// Class-level lazy modes.
@json({ lazy: "auto" })
class AutoRepo {
  id: i32 = 0; // cheap -> stays eager
  name: string = ""; // deferred
  owner!: Owner; // deferred
  tags!: i32[]; // deferred


  @eager note: string = ""; // override -> eager
}


@json({ lazy: "all" })
class AllRepo {
  id: i32 = 0; // deferred (all)
  owner!: Owner;
}

// Equivalent marker: a bare `@lazy` decorator (type stays the inner type).
@json class DecoRepo {
  name: string = "";


  @lazy owner!: Owner;


  @lazy tags!: i32[];


  @lazy count: i32 = 0;
}

const SRC =
  '{"name":"r","owner":{"login":"octo","id":7,"deep":{"v":9}},"tags":[1,2,3]}';

describe("JSON.Lazy<T> fields read like eager", () => {
  const r = JSON.parse<Repo>(SRC);
  expect(r.name).toBe("r");
  expect(r.owner.login).toBe("octo");
  expect(r.owner.id.toString()).toBe("7");
  expect(r.owner.deep.v.toString()).toBe("9"); // nested lazy
  expect(r.tags.length.toString()).toBe("3");
  expect(r.tags[1].toString()).toBe("2");
});

describe("JSON.Lazy<T> round-trips (raw passthrough when untouched)", () => {
  // never read owner/tags -> their raw slices pass straight through
  expect(JSON.stringify(JSON.parse<Repo>(SRC))).toBe(SRC);
});

describe("JSON.Lazy<T> setter updates serialization", () => {
  const r = JSON.parse<Repo>(SRC);
  const o = new Owner();
  o.login = "new";
  o.id = 1;
  r.owner = o;
  expect(JSON.stringify(r)).toBe(
    '{"name":"r","owner":{"login":"new","id":1,"deep":{"v":0}},"tags":[1,2,3]}',
  );
});

describe("JSON.Lazy<T> handles slow-path field order", () => {
  const r = JSON.parse<Repo>(
    '{"tags":[1,2,3],"owner":{"login":"octo","id":7,"deep":{"v":9}},"name":"r"}',
  );
  expect(r.name).toBe("r");
  expect(r.owner.login).toBe("octo");
  expect(r.tags[2].toString()).toBe("3");
  expect(JSON.stringify(r)).toBe(SRC);
});

describe("JSON.Lazy<T> supports primitive fields", () => {
  const r = JSON.parse<LazyPrimitives>('{"enabled":false,"count":42}');
  expect(r.count.toString()).toBe("42");
  expect(r.enabled.toString()).toBe("false");
  r.count = 7;
  r.enabled = true;
  expect(JSON.stringify(r)).toBe('{"count":7,"enabled":true}');
});

describe("JSON.Lazy<T> scans escaped strings via the shared scanner", () => {
  const r = JSON.parse<Repo>(
    '{"owner":{"login":"octo","id":7,"deep":{"v":9}},"name":"a\\\\\\"b","tags":[1,2,3]}',
  );
  expect(r.name).toBe('a\\"b');
});

describe("JSON.Lazy<T> setter clears stale raw range for null", () => {
  const r = JSON.parse<NullableOwner>(
    '{"owner":{"login":"octo","id":7,"deep":{"v":9}}}',
  );
  r.owner = null;
  expect(JSON.stringify(r)).toBe('{"owner":null}');
});

describe('@json({ lazy: "auto" }) defers heavy fields, keeps scalars eager', () => {
  const SRC =
    '{"id":1,"name":"r","owner":{"login":"octo","id":7},"tags":[1,2,3],"note":"n"}';
  const r = JSON.parse<AutoRepo>(SRC);
  expect(r.id.toString()).toBe("1"); // eager scalar
  expect(r.name).toBe("r"); // deferred string
  expect(r.owner.login).toBe("octo"); // deferred struct
  expect(r.tags[2].toString()).toBe("3"); // deferred array
  expect(r.note).toBe("n"); // @eager override
  expect(JSON.stringify(JSON.parse<AutoRepo>(SRC))).toBe(SRC); // untouched passthrough
});

describe('@json({ lazy: "all" }) defers every field', () => {
  const SRC = '{"id":5,"owner":{"login":"a","id":2}}';
  const r = JSON.parse<AllRepo>(SRC);
  expect(r.id.toString()).toBe("5");
  expect(r.owner.login).toBe("a");
  expect(JSON.stringify(JSON.parse<AllRepo>(SRC))).toBe(SRC);
});


@json class OmitNullLazy {
  name: string = "x";


  @omitnull owner: JSON.Lazy<Owner | null> = null;
}


@json class OmitIfLazy {
  name: string = "x";


  @omitif((self: OmitIfLazy) => self.count == 0) count: JSON.Lazy<i32> = 0;
}

describe("lazy fields on a fresh (unparsed) instance return defaults", () => {
  // Regression: an unset lazy slot (lz==0) must NOT run parse<T>("null") -
  // that garbles scalars. The getter returns the type default instead.
  const d = new LazyPrimitives();
  expect(d.count.toString()).toBe("0");
  expect(d.enabled.toString()).toBe("false");
  const n = new NullableOwner();
  expect(changetype<usize>(n.owner) == 0 ? "null" : "set").toBe("null");
});

describe("@omitnull works on lazy fields (omits null without materializing)", () => {
  // @omitnull triggers the optional-field sort, so the optional field leads -
  // same ordering as a non-lazy @omitnull class.
  const set = new OmitNullLazy();
  const w = new Owner();
  w.login = "z";
  set.owner = w;
  // materialized owner re-serializes all its fields (incl. id, lazy deep=default {v:0})
  expect(JSON.stringify(set)).toBe(
    '{"owner":{"login":"z","id":0,"deep":{"v":0}},"name":"x"}',
  ); // kept
  const nul = new OmitNullLazy();
  nul.owner = null;
  expect(JSON.stringify(nul)).toBe('{"name":"x"}'); // omitted (materialized null)
  // passthrough: a raw `null` slice is omitted without ever parsing it
  expect(
    JSON.stringify(JSON.parse<OmitNullLazy>('{"name":"x","owner":null}')),
  ).toBe('{"name":"x"}');
  // passthrough: a non-null slice is kept verbatim
  expect(
    JSON.stringify(
      JSON.parse<OmitNullLazy>('{"name":"x","owner":{"login":"q"}}'),
    ),
  ).toBe('{"owner":{"login":"q"},"name":"x"}');
});

describe("@omitif works on lazy fields", () => {
  const omit = new OmitIfLazy();
  omit.count = 0;
  expect(JSON.stringify(omit)).toBe('{"name":"x"}'); // predicate true -> omit
  const keep = new OmitIfLazy();
  keep.count = 5;
  expect(JSON.stringify(keep)).toBe('{"count":5,"name":"x"}'); // kept
});

describe("@lazy decorator marks fields like JSON.Lazy<T>", () => {
  const SRC =
    '{"name":"r","owner":{"login":"octo","id":7},"tags":[1,2,3],"count":42}';
  const r = JSON.parse<DecoRepo>(SRC);
  expect(r.name).toBe("r");
  expect(r.owner.login).toBe("octo"); // @lazy reference
  expect(r.tags[2].toString()).toBe("3"); // @lazy array
  expect(r.count.toString()).toBe("42"); // @lazy primitive
  // untouched -> raw passthrough
  expect(JSON.stringify(JSON.parse<DecoRepo>(SRC))).toBe(SRC);
  // mutate -> reflected. owner/tags were read above so they're materialized;
  // owner re-serializes with its own (absent) lazy `deep` field as a default instance {v:0}.
  r.count = 99;
  expect(JSON.stringify(r)).toBe(
    '{"name":"r","owner":{"login":"octo","id":7,"deep":{"v":0}},"tags":[1,2,3],"count":99}',
  );
});

// Regression: an *absent* ref lazy field with a declared default must serialize
// that default, not crash. On the JSON.parse path __INITIALIZE seeds the slot to
// materialized (MAX) — it must also seed __x_val, else serialize hits `null as T`
// (the github_events / gsoc-2018 lazy-serialize trap).
@json({ lazy: "auto" })
class SparseLazy {
  a: string = "";
  mid: string = "default";
  count: i32 = 7;
  b: string = "";
}

describe("absent ref lazy field serializes its default (no null-cast trap)", () => {
  // "mid" and "count" are absent in the source.
  const r = JSON.parse<SparseLazy>('{"a":"x","b":"y"}');
  expect(JSON.stringify(r)).toBe('{"a":"x","mid":"default","count":7,"b":"y"}');
  // Touching a present field still works.
  expect(r.a).toBe("x");
});

// A no-default non-nullable string lazy field must resolve to "" when absent
// (matching eager __INITIALIZE), not crash on the getter's `null as string`.
// The symmetric absent-with-default case is covered above; this is the
// no-default half.
@json({ lazy: "auto" })
@json class Cell {
  n: i32 = 3;
}


@json({ lazy: "auto" })
class NoDefaultRefs {
  a: string = "";
  ns: string; // no-default non-nullable string -> ""
  narr: i32[]; // no-default non-nullable array  -> []
  nmap: Map<string, i32>; // no-default non-nullable map -> {}
  nst!: JSON.Lazy<Cell>; // no-default non-nullable struct -> default instance
  b: string = "";
}

describe("absent no-default non-nullable ref fields resolve to the type default (no null-cast crash)", () => {
  const r = JSON.parse<NoDefaultRefs>('{"a":"x","b":"y"}');
  expect(r.ns).toBe("");
  expect(r.narr.length).toBe(0);
  expect(r.nmap.size).toBe(0);
  expect(r.nst.n).toBe(3); // struct getter access no longer aborts
  expect(JSON.stringify(r)).toBe(
    '{"a":"x","ns":"","narr":[],"nmap":{},"nst":{"n":3},"b":"y"}',
  );
  const c = new NoDefaultRefs();
  expect(c.ns).toBe("");
  expect(c.narr.length).toBe(0);
  expect(c.nst.n).toBe(3);
});

// Regression (citm_catalog.lazy): a *present* `null` value for a lazy
// nullable-string field must materialize to null, not abort. Unlike the absent
// slot above (lz==0 -> default), here the slot holds a real range pointing at
// the `null` literal. `isString<string | null>()` is true, so `JSON.__deserialize`
// would otherwise fall into the string branch and try to parse `null` as a
// quoted string - aborting under NAIVE, silently corrupting under SWAR/SIMD.
@json({ lazy: "auto" })
class NullableStrings {
  name: string = ""; // non-null string, present
  subjectCode: string | null = null; // nullable string, present-as-null
  subtitle: string | null = null; // nullable string, present-as-null
}

describe("present `null` for a lazy nullable-string field materializes to null", () => {
  const r = JSON.parse<NullableStrings>(
    '{"name":"hello","subjectCode":null,"subtitle":null}',
  );
  // Reading the non-null string AND a nullable-null on the same struct is the
  // exact pattern that aborted (citm name + subjectCode); needs both touched.
  expect(r.name).toBe("hello");
  expect(changetype<usize>(r.subjectCode) == 0 ? "null" : "set").toBe("null");
  expect(changetype<usize>(r.subtitle) == 0 ? "null" : "set").toBe("null");
  // Untouched round-trip keeps the present nulls verbatim.
  expect(
    JSON.stringify(
      JSON.parse<NullableStrings>(
        '{"name":"hello","subjectCode":null,"subtitle":null}',
      ),
    ),
  ).toBe('{"name":"hello","subjectCode":null,"subtitle":null}');
});

describe("lazy nullable-string field keeps a present non-null value", () => {
  const r = JSON.parse<NullableStrings>(
    '{"name":"hi","subjectCode":"SC","subtitle":null}',
  );
  expect(r.name).toBe("hi");
  expect(r.subjectCode!).toBe("SC");
  expect(changetype<usize>(r.subtitle) == 0 ? "null" : "set").toBe("null");
});


@json class LazyNullableStr {
  s!: JSON.Lazy<string | null>;
}

describe("JSON.Lazy<string | null> materializes a present `null` to null", () => {
  const nul = JSON.parse<LazyNullableStr>('{"s":null}');
  expect(changetype<usize>(nul.s) == 0 ? "null" : "set").toBe("null");
  const set = JSON.parse<LazyNullableStr>('{"s":"x"}');
  expect(set.s!).toBe("x");
});

// The citm_catalog.lazy shape: a map of lazy structs, each materialized on
// `.values()`, then a non-null string and a nullable-null string read per entry.
@json({ lazy: "auto" })
class Ev {
  name: string = "";
  subjectCode: string | null = null;
}


@json({ lazy: "auto" })
class EvRoot {
  events: Map<string, Ev> = new Map<string, Ev>();
}

describe("lazy nullable-string nulls survive map-of-struct materialization", () => {
  const r = JSON.parse<EvRoot>(
    '{"events":{"1":{"name":"a","subjectCode":null},"2":{"name":"b","subjectCode":"x"}}}',
  );
  const evs = r.events.values();
  let names = "";
  let nulls = 0;
  let subjects = "";
  for (let i = 0, n = evs.length; i < n; i++) {
    const e = unchecked(evs[i]);
    names += e.name; // non-null string field
    const sc = e.subjectCode; // nullable string field
    if (sc === null) nulls++;
    else subjects += sc;
  }
  expect(names).toBe("ab");
  expect(nulls).toBe(1);
  expect(subjects).toBe("x");
});
