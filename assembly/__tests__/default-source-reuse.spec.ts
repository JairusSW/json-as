import { JSON } from "..";
import { describe, expect } from "as-test";


@json
class DefaultSource {
  n: i32 = 0;
  label: string = "same";
}


@json
class LongDefaultSource {
  n: i32 = 0;
  label: string =
    "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";
}


@json
class DefaultGraph {
  child: DefaultSource = new DefaultSource();
  values: i32[] = [];
}

describe("Typed defaults recheck a reused stringify output", () => {
  const value = new DefaultSource();
  let source = JSON.stringify(value);
  const alias = source;
  expect(JSON.parse<DefaultSource>(alias).n).toBe(0);
  expect(JSON.parse<DefaultSource>(alias).label).toBe("same");

  value.n = 7;
  value.label = "next";
  source = JSON.stringify(value, source);
  expect(changetype<usize>(source)).toBe(changetype<usize>(alias));
  expect(alias).toBe('{"n":7,"label":"next"}');
  expect(JSON.parse<DefaultSource>(alias).n).toBe(7);
  expect(JSON.parse<DefaultSource>(alias).label).toBe("next");

  value.n = 0;
  value.label = "same";
  source = JSON.stringify(value, source);
  expect(changetype<usize>(source)).toBe(changetype<usize>(alias));
  expect(JSON.parse<DefaultSource>(alias).n).toBe(0);
  expect(JSON.parse<DefaultSource>(alias).label).toBe("same");
});

describe("Long typed defaults recheck a reused stringify output", () => {
  const value = new LongDefaultSource();
  const source = JSON.stringify(value);
  expect(source.length > 256).toBe(true);
  expect(JSON.parse<LongDefaultSource>(source).n).toBe(0);
  expect(JSON.parse<LongDefaultSource>(source).label).toBe(value.label);

  value.n = 9;
  const reused = JSON.stringify(value, source);
  expect(changetype<usize>(reused)).toBe(changetype<usize>(source));
  expect(JSON.parse<LongDefaultSource>(source).n).toBe(9);
  expect(JSON.parse<LongDefaultSource>(source).label).toBe(value.label);

  value.n = 0;
  JSON.stringify(value, source);
  expect(JSON.parse<LongDefaultSource>(source).n).toBe(0);
  value.label = value.label.substring(0, value.label.length - 1) + "!";
  const changedTail = JSON.stringify(value, source);
  expect(changetype<usize>(changedTail)).toBe(changetype<usize>(source));
  expect(JSON.parse<LongDefaultSource>(source).label).toBe(value.label);
});

describe("Repeated typed defaults still allocate independent graphs", () => {
  const source = JSON.stringify(new DefaultGraph());
  const first = JSON.parse<DefaultGraph>(source);
  const second = JSON.parse<DefaultGraph>(source);
  expect(changetype<usize>(first) != changetype<usize>(second)).toBe(true);
  expect(
    changetype<usize>(first.child) != changetype<usize>(second.child),
  ).toBe(true);
  expect(
    changetype<usize>(first.values) != changetype<usize>(second.values),
  ).toBe(true);
  first.child.n = 8;
  first.values.push(1);
  expect(second.child.n).toBe(0);
  expect(second.values.length).toBe(0);

  const out = new DefaultSource();
  out.n = 3;
  const result = JSON.parse<DefaultSource>(
    JSON.stringify(new DefaultSource()),
    out,
  );
  expect(changetype<usize>(result)).toBe(changetype<usize>(out));
  expect(result.n).toBe(0);
});
