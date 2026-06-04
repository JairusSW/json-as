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
    '{"name":"r","owner":{"login":"new","id":1,"deep":null},"tags":[1,2,3]}',
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
