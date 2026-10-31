import { JSON } from "..";
import { describe, expect } from "as-test";

function makeDeletionObject(): JSON.Obj {
  const obj = JSON.parse<JSON.Obj>(
    '{"drop":0,"nested":{"n":1},"drop":2,"arr":[3],"text":"kept"}',
  );
  obj.set("raw", JSON.Raw.from('{"n":4}'));
  return obj;
}

describe("Deleting duplicate keys compacts buffers and retains managed survivors", () => {
  const obj = makeDeletionObject();
  const keyBuffer = changetype<usize>(obj._kbuf);
  const positions = changetype<usize>(obj._kpos);
  const values = changetype<usize>(obj._vals);
  expect(obj.delete("drop")).toBe(true);
  expect(obj.has("drop")).toBe(false);
  expect(obj.size).toBe(4);
  expect(changetype<usize>(obj._kbuf)).toBe(keyBuffer);
  expect(changetype<usize>(obj._kpos)).toBe(positions);
  expect(changetype<usize>(obj._vals)).toBe(values);
  __collect();
  expect(JSON.stringify(obj)).toBe(
    '{"nested":{"n":1},"arr":[3],"text":"kept","raw":{"n":4}}',
  );
  expect(obj.keys().join(",")).toBe("nested,arr,text,raw");
  expect(obj.delete("missing")).toBe(false);
  expect(obj.delete("nested")).toBe(true);
  expect(obj.delete("raw")).toBe(true);
  obj.set("new", 5);
  __collect();
  expect(JSON.stringify(obj)).toBe('{"arr":[3],"text":"kept","new":5}');
  obj.clear();
  obj.set("only", "last");
  expect(obj.delete("only")).toBe(true);
  expect(JSON.stringify(obj)).toBe("{}");
});

function concatShared(): JSON.Arr {
  const left = JSON.parse<JSON.Arr>('[{"n":1},[2],"text",true,null,42]');
  return left.concat(left.slice());
}

describe("Concatenation preserves shared-source lazy slots and mutation isolation", () => {
  const out = concatShared();
  expect(out.length).toBe(12);
  expect(JSON.Value.slotIsLazy(unchecked(out._vals[0]))).toBe(true);
  expect(JSON.Value.slotIsLazy(unchecked(out._vals[6]))).toBe(true);
  __collect();
  out.getAs<JSON.Obj>(0).set("n", 9);
  expect(out.getAs<JSON.Obj>(6).getAs<f64>("n")).toBe(1.0);
  expect(JSON.stringify(out)).toBe(
    '[{"n":9},[2],"text",true,null,42,{"n":1},[2],"text",true,null,42]',
  );
});

describe("Concatenation handles independent sources, empty inputs and eager managed slots", () => {
  const a = JSON.parse<JSON.Arr>('[{"a":1}]');
  const b = JSON.parse<JSON.Arr>('[{"b":2}]');
  const out = a.concat(b);
  a.clear();
  b.clear();
  __collect();
  expect(JSON.stringify(out)).toBe('[{"a":1},{"b":2}]');
  const eager = new JSON.Arr();
  eager.push(JSON.Raw.from('{"raw":true}'));
  const mixed = eager.concat(out);
  const reversed = out.concat(eager);
  eager.clear();
  __collect();
  expect(JSON.stringify(mixed)).toBe('[{"raw":true},{"a":1},{"b":2}]');
  expect(JSON.stringify(reversed)).toBe('[{"a":1},{"b":2},{"raw":true}]');
  expect(JSON.stringify(new JSON.Arr().concat(mixed))).toBe(
    JSON.stringify(mixed),
  );
  expect(JSON.stringify(mixed.concat(new JSON.Arr()))).toBe(
    JSON.stringify(mixed),
  );
});

function objectFromMap(): JSON.Obj {
  const map = new Map<string, JSON.Raw>();
  map.set("", JSON.Raw.from("null"));
  for (let i = 0; i < 128; i++)
    map.set("key" + i.toString(), JSON.Raw.from(i.toString()));
  map.set("key1", JSON.Raw.from("999"));
  map.set("x".repeat(65536), JSON.Raw.from("true"));
  return JSON.Obj.from(map);
}

describe("Map conversion preserves order, replacement values, long keys and GC roots", () => {
  const obj = objectFromMap();
  __collect();
  expect(obj.size).toBe(130);
  expect(obj.getAs<JSON.Raw>("").toString()).toBe("null");
  expect(obj.getAs<JSON.Raw>("key1").toString()).toBe("999");
  expect(obj.getAs<JSON.Raw>("key127").toString()).toBe("127");
  expect(obj.getAs<JSON.Raw>("x".repeat(65536)).toString()).toBe("true");
  const keys = obj.keys();
  expect(keys[0]).toBe("");
  expect(keys[2]).toBe("key1");
  expect(keys[128]).toBe("key127");
  expect(JSON.Obj.from(new Map<string, i32>()).size).toBe(0);
  obj.set("key1", 5);
  expect(obj.size).toBe(130);
  expect(obj.getAs<i32>("key1")).toBe(5);
});

function fillManaged(out: JSON.Arr): void {
  out.fill(JSON.Raw.from('{"filled":true}'), 1, -1);
}

describe("Fill links managed values and respects empty and negative ranges", () => {
  const arr = JSON.parse<JSON.Arr>("[0,1,2,3,4]");
  __collect();
  fillManaged(arr);
  __collect();
  expect(JSON.stringify(arr)).toBe(
    '[0,{"filled":true},{"filled":true},{"filled":true},4]',
  );
  expect(arr.getAs<JSON.Raw>(1) === arr.getAs<JSON.Raw>(3)).toBe(true);
  arr.fill("ignored", 4, 1);
  arr.fill("ignored", 5);
  expect(JSON.stringify(arr)).toBe(
    '[0,{"filled":true},{"filled":true},{"filled":true},4]',
  );
  arr.fill<i64>(i64.MIN_VALUE, -2);
  __collect();
  expect(arr.getAs<i64>(3)).toBe(i64.MIN_VALUE);
  expect(arr.getAs<i64>(4)).toBe(i64.MIN_VALUE);
  arr.fill<JSON.Raw | null>(null);
  __collect();
  expect(JSON.stringify(arr)).toBe("[null,null,null,null,null]");
  expect(new JSON.Arr().fill("empty").length).toBe(0);
});

describe("Deletion agrees with a slot-list model through repeated duplicate removals", () => {
  for (let seed = 0; seed < 12; seed++) {
    let source = "{";
    const labels = new Array<string>();
    const count = 12 + seed * 11;
    for (let i = 0; i < count; i++) {
      const key = "key" + ((i * 7 + seed) % 19).toString();
      labels.push(key);
      if (i) source += ",";
      source += '"' + key + '":{"n":' + i.toString() + "}";
    }
    source += "}";
    const obj = JSON.parse<JSON.Obj>(source);
    // Force hash lookup before mutating, including in objects with duplicates.
    expect(obj.has(labels[0])).toBe(true);
    for (let step = 0; step < 19; step++) {
      const target = "key" + ((step * 5 + seed) % 19).toString();
      let expected = "{";
      let survivors = 0;
      let found = false;
      for (let i = 0; i < labels.length; i++) {
        if (labels[i] == target) {
          labels[i] = "";
          found = true;
        }
        if (labels[i].length == 0) continue;
        if (survivors++) expected += ",";
        expected += '"' + labels[i] + '":{"n":' + i.toString() + "}";
      }
      expected += "}";
      expect(obj.delete(target)).toBe(found);
      expect(obj.has(target)).toBe(false);
      expect(obj.size).toBe(survivors);
      __collect();
      expect(JSON.stringify(obj) == expected).toBe(true);
      expect(obj.keys().length).toBe(survivors);
    }
  }
});
