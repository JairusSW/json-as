import { JSON } from "../index";

let compactCalls: i32 = 0;
let whitespaceCalls: i32 = 0;
let manualCalls: i32 = 0;

// The test-only transform instruments generated Child readers at their entry.
export function recordTier(tier: i32): void {
  if (tier == 1) compactCalls++;
  else whitespaceCalls++;
}
export function counts(): i32 {
  return compactCalls * 100 + whitespaceCalls;
}


@json
class Child {
  n: i32 = 7;
}


@json
class Parent {
  child!: Child;
  rows!: Child[];
}


@json
class Generic<T> {

  @optional n: T = <T>7;
}


@json
class GenericParent {
  child: Generic<i32> | null = null;
}


@json
class Manual {
  n: i32 = 0;
  __DESERIALIZE_FAST<T>(start: usize, end: usize, out: T, reset: bool): usize {
    manualCalls++;
    return 0;
  }
}


@json
class ManualParent {
  child!: Manual;
}

export function compact(expectFast: bool): i32 {
  compactCalls = whitespaceCalls = 0;
  const value = JSON.parse<Parent>(
    '{"child":{"n":2},"rows":[{"n":3}]}',
    new Parent(),
  );
  assert(value.child.n == 2 && value.rows[0].n == 3);
  if (expectFast) assert(compactCalls == 2 && whitespaceCalls == 0);
  return 1;
}
export function pretty(expectFast: bool): i32 {
  compactCalls = whitespaceCalls = 0;
  const value = JSON.parse<Parent>(
    '{ "child": { "n": 2 }, "rows": [ { "n": 3 } ] }',
    new Parent(),
  );
  assert(value.child.n == 2 && value.rows[0].n == 3);
  return 1;
}
export function fallbacks(expectFast: bool): i32 {
  const generic = JSON.parse<GenericParent>(
    '{ "child": {} }',
    new GenericParent(),
  );
  assert(generic.child!.n == 7);
  manualCalls = 0;
  const manual = JSON.parse<ManualParent>(
    '{ "child": { "n": 9 } }',
    new ManualParent(),
  );
  assert(manual.child.n == 9);
  if (expectFast) assert(manualCalls == 1);
  return 1;
}

@json
class SeparatorRow {
  @alias("return srcStart;") first: i32 = 0;
  second: string = "";
}

export function separators(): i32 {
  const before = ["", " ", "\t", "\r\n  "];
  const after = ["", " ", "  ", "\t\r\n  "];
  const destination = new SeparatorRow();
  for (let i = 0; i < before.length; i++) {
    for (let j = 0; j < after.length; j++) {
      const text = '{ "return srcStart;"' + before[i] + ':' + after[j] +
        '7, "second"' + before[i] + ':' + after[j] + '"ok" }';
      const fresh = JSON.parse<SeparatorRow>(text);
      assert(fresh.first == 7 && fresh.second == "ok");
      const reused = JSON.parse<SeparatorRow>(text, destination);
      assert(reused.first == 7 && reused.second == "ok");
    }
  }
  return 1;
}
