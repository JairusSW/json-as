import { JSON } from "..";
import { describe, expect, run } from "as-test";


@json
class Inner {
  a: string = "";
  n: i32 = 0;
}


@json
class Outer {
  id: string = "";
  count: i32 = 0;
  inner: Inner = new Inner();
  tags: string[] = [];
}

describe("parseInto reuses a target graph", () => {
  const json1 =
    '{"id":"first","count":1,"inner":{"a":"x","n":7},"tags":["p","q"]}';
  const json2 =
    '{"id":"second","count":2,"inner":{"a":"yy","n":9},"tags":["r","s"]}';

  const target = JSON.parse<Outer>(json1);
  const ret = JSON.parse<Outer>(json2, target);

  // Same object returned, fully overwritten with json2's values (all modes).
  expect(changetype<usize>(ret)).toBe(changetype<usize>(target));
  expect(target.id).toBe("second");
  expect(target.count).toBe(2);
  expect(target.inner.a).toBe("yy");
  expect(target.inner.n).toBe(9);
  expect(target.tags.length).toBe(2);
  expect(target.tags[0]).toBe("r");
  expect(target.tags[1]).toBe("s");
});

describe("stringify reuses an out string", () => {
  const o = JSON.parse<Outer>(
    '{"id":"first","count":1,"inner":{"a":"x","n":7},"tags":["p","q"]}',
  );
  const expected = JSON.stringify(o);

  // First stringify allocates the output; second reuses it in place (same
  // serialized length -> no __renew, same pointer).
  const buf = JSON.stringify(o);
  const ptrBefore = changetype<usize>(buf);
  const reused = JSON.stringify(o, buf);

  expect(reused).toBe(expected);
  expect(changetype<usize>(reused)).toBe(ptrBefore);

  // A different-length payload forces a resize but must still be correct.
  const o2 = JSON.parse<Outer>(
    '{"id":"a-much-longer-id-value","count":99,"inner":{"a":"zzzz","n":-3},"tags":["one","two","three"]}',
  );
  const expected2 = JSON.stringify(o2);
  const reused2 = JSON.stringify(o2, reused);
  expect(reused2).toBe(expected2);
});

run();
