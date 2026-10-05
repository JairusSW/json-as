import { JSON } from "..";
import { describe, expect } from "as-test";

function makeObject(parsed: bool): JSON.Obj {
  if (parsed) return JSON.parse<JSON.Obj>('{"child":{"x":1},"items":[1]}');
  const child = new JSON.Obj();
  child.set("x", 1.0);
  const items = new JSON.Arr();
  items.push(1.0);
  const root = new JSON.Obj();
  root.set("child", child);
  root.set("items", items);
  return root;
}

function makeArray(parsed: bool): JSON.Arr {
  if (parsed) return JSON.parse<JSON.Arr>('[{"x":1},[1]]');
  const child = new JSON.Obj();
  child.set("x", 1.0);
  const items = new JSON.Arr();
  items.push(1.0);
  const root = new JSON.Arr();
  root.push(child);
  root.push(items);
  return root;
}

function expectObjectAccess(parsed: bool, typedFirst: bool): void {
  const root = makeObject(parsed);
  if (typedFirst) {
    root.getAs<JSON.Obj>("child");
    root.getAs<JSON.Arr>("items");
  }
  const child = root.get("child")!.get<JSON.Obj>();
  const items = root.get("items")!.get<JSON.Arr>();
  expect(child === root.get("child")!.get<JSON.Obj>()).toBe(true);
  expect(items === root.get("items")!.get<JSON.Arr>()).toBe(true);
  expect(child === root.getAs<JSON.Obj>("child")).toBe(true);
  expect(items === root.getAs<JSON.Arr>("items")).toBe(true);
  child.set("x", 2.0);
  items.push(2.0);
  expect(JSON.stringify(root)).toBe('{"child":{"x":2},"items":[1,2]}');
  expect(root.getAs<JSON.Obj>("child").getAs<f64>("x")).toBe(2.0);
  expect(root.getAs<JSON.Arr>("items").length).toBe(2);
}

function expectArrayAccess(parsed: bool, typedFirst: bool): void {
  const root = makeArray(parsed);
  if (typedFirst) {
    root.getAs<JSON.Obj>(0);
    root.getAs<JSON.Arr>(1);
  }
  const child = root.at(0).get<JSON.Obj>();
  const items = root[1].get<JSON.Arr>();
  expect(child === root.at(0).get<JSON.Obj>()).toBe(true);
  expect(items === root.at(1).get<JSON.Arr>()).toBe(true);
  expect(child === root.getAs<JSON.Obj>(0)).toBe(true);
  expect(items === root.getAs<JSON.Arr>(1)).toBe(true);
  child.set("x", 2.0);
  items.push(2.0);
  expect(JSON.stringify(root)).toBe('[{"x":2},[1,2]]');
  expect(root.getAs<JSON.Obj>(0).getAs<f64>("x")).toBe(2.0);
  expect(root.getAs<JSON.Arr>(1).length).toBe(2);
}

describe("Dynamic child access shares stored references for parsed and built objects", () => {
  expectObjectAccess(true, false);
  expectObjectAccess(true, true);
  expectObjectAccess(false, false);
  expectObjectAccess(false, true);
});

describe("Dynamic child access shares stored references for parsed and built arrays", () => {
  expectArrayAccess(true, false);
  expectArrayAccess(true, true);
  expectArrayAccess(false, false);
  expectArrayAccess(false, true);
});

describe("Object values share children with dynamic and typed access", () => {
  for (let p = 0; p < 2; p++) {
    const root = makeObject(p == 0);
    const values = root.values();
    const child = values[0].get<JSON.Obj>();
    const items = values[1].get<JSON.Arr>();
    expect(child === root.values()[0].get<JSON.Obj>()).toBe(true);
    expect(items === root.values()[1].get<JSON.Arr>()).toBe(true);
    expect(child === root.get("child")!.get<JSON.Obj>()).toBe(true);
    expect(items === root.getAs<JSON.Arr>("items")).toBe(true);
    child.set("x", 3.0);
    items.push(3.0);
    expect(JSON.stringify(root)).toBe('{"child":{"x":3},"items":[1,3]}');
  }
});

describe("Dynamic access peels one level and leaves untouched slices lazy", () => {
  const source =
    '{ "child" : {"items":[{"x":1}],"keep":[1.0,2.0]}, "sibling" : [3.0,4.0] }';
  const root = JSON.parse<JSON.Obj>(source);
  expect(JSON.stringify(root)).toBe(source);
  const child = root.get("child")!.get<JSON.Obj>();
  expect(JSON.Value.slotIsLazy(root._vals[0])).toBe(false);
  expect(JSON.Value.slotIsLazy(root._vals[1])).toBe(true);
  expect(JSON.Value.slotIsLazy(child._vals[0])).toBe(true);
  expect(JSON.Value.slotIsLazy(child._vals[1])).toBe(true);
  child.get("items")!.get<JSON.Arr>().at(0).get<JSON.Obj>().set("x", 7.0);
  expect(JSON.stringify(root)).toBe(
    '{"child":{"items":[{"x":7}],"keep":[1.0,2.0]},"sibling":[3.0,4.0]}',
  );
});

describe("Dynamic array callbacks mutate the same child as direct reads", () => {
  const root = JSON.parse<JSON.Arr>('[{"x":1},[1],{"keep":[2.0,3.0]}]');
  root.forEach((value: JSON.Value, index: i32): void => {
    if (index == 0) value.get<JSON.Obj>().set("x", 4.0);
    if (index == 1) value.get<JSON.Arr>().push(4.0);
  });
  expect(JSON.stringify(root)).toBe('[{"x":4},[1,4],{"keep":[2.0,3.0]}]');
});

describe("Scalar and wrapper replacement remain detached from container slots", () => {
  const obj = JSON.parse<JSON.Obj>('{"n":1,"s":"text","child":{"x":1}}');
  obj.get("n")!.set(9.0);
  obj.get("s")!.set("other");
  obj.get("child")!.set(new JSON.Obj());
  expect(JSON.stringify(obj)).toBe('{"n":1,"s":"text","child":{"x":1}}');
  expect(obj.get("missing") === null).toBe(true);
  const arr = JSON.parse<JSON.Arr>('[1,"text",{"x":1}]');
  arr.at(0).set(9.0);
  arr.at(1).set("other");
  arr.at(2).set(new JSON.Obj());
  expect(JSON.stringify(arr)).toBe('[1,"text",{"x":1}]');
});

// Only the parent crosses the helper boundary. The assertions must not keep
// child values alive while collections test the container's tracing/barrier.
function parsedGcObject(): JSON.Obj {
  return JSON.parse<JSON.Obj>(
    '{"child":{"items":["' + "g".repeat(4096) + '"]}}',
  );
}

function mutateGcObject(root: JSON.Obj): void {
  root.get("child")!.get<JSON.Obj>().get("items")!.get<JSON.Arr>().push(5.0);
}

function expectGcObject(root: JSON.Obj): void {
  const items = root
    .get("child")!
    .get<JSON.Obj>()
    .get("items")!
    .get<JSON.Arr>();
  expect(items.length).toBe(2);
  expect(items.at(0).get<string>() == "g".repeat(4096)).toBe(true);
  expect(items.getAs<f64>(1)).toBe(5.0);
}

function detachedObjectValue(): JSON.Value {
  const root = parsedGcObject();
  const value = root.get("child")!;
  JSON.parse<JSON.Obj>('{"replacement":true}', root);
  return value;
}

function detachedArrayValue(): JSON.Value {
  const root = JSON.parse<JSON.Arr>('[{"text":"' + "a".repeat(4096) + '"}]');
  const value = root.at(0);
  root.clear();
  root.push(false);
  return value;
}

function parsedGcArray(): JSON.Arr {
  return JSON.parse<JSON.Arr>(
    '[{"text":"' + "o".repeat(4096) + '"},["' + "i".repeat(4096) + '"]]',
  );
}

function mutateGcArray(root: JSON.Arr): void {
  root.at(0).get<JSON.Obj>().set("x", 6.0);
  root.at(1).get<JSON.Arr>().push(6.0);
}

function expectGcArray(root: JSON.Arr): void {
  const child = root.at(0).get<JSON.Obj>();
  const items = root.at(1).get<JSON.Arr>();
  expect(child.getAs<f64>("x")).toBe(6.0);
  expect(child.get("text")!.get<string>() == "o".repeat(4096)).toBe(true);
  expect(items.length).toBe(2);
  expect(items.at(0).get<string>() == "i".repeat(4096)).toBe(true);
  expect(items.getAs<f64>(1)).toBe(6.0);
}

describe("Array parents retain cached dynamic children through GC", () => {
  const root = parsedGcArray();
  // The minimal runtime traces explicit pins rather than local stack roots.
  __pin(changetype<usize>(root));
  __collect();
  mutateGcArray(root);
  __collect();
  expectGcArray(root);
  __collect();
  expectGcArray(root);
  expect(
    JSON.stringify(root) ==
      '[{"text":"' +
        "o".repeat(4096) +
        '","x":6},["' +
        "i".repeat(4096) +
        '",6]]',
  ).toBe(true);
  __unpin(changetype<usize>(root));
});

describe("Cached dynamic children and retained wrappers survive parent reuse and GC", () => {
  const root = parsedGcObject();
  __pin(changetype<usize>(root));
  __collect();
  mutateGcObject(root);
  __collect();
  expectGcObject(root);
  __collect();
  expectGcObject(root);
  expect(
    JSON.stringify(root) ==
      '{"child":{"items":["' + "g".repeat(4096) + '",5]}}',
  ).toBe(true);

  const fromObject = detachedObjectValue();
  const fromArray = detachedArrayValue();
  __pin(changetype<usize>(fromObject));
  __pin(changetype<usize>(fromArray));
  __collect();
  expect(
    fromObject
      .get<JSON.Obj>()
      .get("items")!
      .get<JSON.Arr>()
      .at(0)
      .get<string>() == "g".repeat(4096),
  ).toBe(true);
  expect(
    fromArray.get<JSON.Obj>().get("text")!.get<string>() == "a".repeat(4096),
  ).toBe(true);
  __unpin(changetype<usize>(fromArray));
  __unpin(changetype<usize>(fromObject));
  __unpin(changetype<usize>(root));
});
