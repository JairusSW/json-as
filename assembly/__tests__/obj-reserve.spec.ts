import { JSON } from "..";
import { describe, expect } from "as-test";

// Speculative parse capacity must follow a bounded estimate rather than the
// size of lazy values. These bounds deliberately allow changes to the estimate
// without baking its exact constants into the regression tests.
function backingBytes(obj: JSON.Obj): i32 {
  return obj._kbuf.length * 2 + obj._kpos.length * 4 + obj._vals.length * 8;
}

function wideSource(count: i32): string {
  let src = "{";
  for (let i = 0; i < count; i++) {
    if (i > 0) src += ",";
    src += '"entry' + i.toString() + '":' + i.toString();
  }
  return src + "}";
}

describe("JSON.Obj reserve: a large string does not inflate parse buffers", () => {
  const big = "x".repeat(131072);
  const src = '{"payload":"' + big + '"}';
  const obj = JSON.parse<JSON.Obj>(src);

  expect(obj.size).toBe(1);
  expect(backingBytes(obj) <= 32768).toBe(true);
  expect(JSON.Value.slotIsLazy(unchecked(obj._vals[0]))).toBe(true);
  expect(JSON.stringify(obj)).toBe(src);
  __collect();
  expect(obj.getAs<string>("payload")).toBe(big);
  __collect();
  expect(JSON.stringify(obj)).toBe(src);
});

describe("JSON.Obj reserve: a large deferred array keeps small object buffers", () => {
  const src = '{"items":[' + "0,".repeat(32767) + "1]}";
  const obj = JSON.parse<JSON.Obj>(src);

  expect(backingBytes(obj) <= 32768).toBe(true);
  expect(JSON.Value.slotIsLazy(unchecked(obj._vals[0]))).toBe(true);
  __collect();
  const items = obj.getAs<JSON.Arr>("items");
  expect(items.length).toBe(32768);
  expect(items.getAs<f64>(0)).toBe(0.0);
  expect(items.getAs<f64>(32767)).toBe(1.0);
  __collect();
  expect(JSON.stringify(obj)).toBe(src);
});

describe("JSON.Obj reserve: nested objects stay bounded when materialized", () => {
  const big = "n".repeat(131072);
  const src = '{"outer":{"inner":{"payload":"' + big + '"}}}';
  const obj = JSON.parse<JSON.Obj>(src);

  expect(backingBytes(obj) <= 32768).toBe(true);
  expect(JSON.Value.slotIsLazy(unchecked(obj._vals[0]))).toBe(true);
  __collect();
  const outer = obj.getAs<JSON.Obj>("outer");
  expect(backingBytes(outer) <= 32768).toBe(true);
  expect(JSON.Value.slotIsLazy(unchecked(outer._vals[0]))).toBe(true);
  __collect();
  // Exercise standalone JSON.Value materialization as well as cached getAs.
  const inner = outer.get("inner")!.get<JSON.Obj>();
  expect(backingBytes(inner) <= 32768).toBe(true);
  expect(JSON.Value.slotIsLazy(unchecked(inner._vals[0]))).toBe(true);
  __collect();
  expect(inner.getAs<string>("payload")).toBe(big);
  expect(JSON.stringify(obj)).toBe(src);
});

describe("JSON.Obj reserve: wide objects grow beyond the initial estimate", () => {
  const src = wideSource(2048);
  const obj = JSON.parse<JSON.Obj>(src);

  expect(obj.size).toBe(2048);
  expect(backingBytes(obj) > 32768).toBe(true);
  expect(obj._kused > 8192).toBe(true);
  expect(obj._kpos.length >= obj.size).toBe(true);
  expect(obj._vals.length >= obj.size).toBe(true);
  __collect();
  for (let i = 0; i < 2048; i++) {
    expect(obj.getAs<f64>("entry" + i.toString())).toBe(<f64>i);
  }
  __collect();
  expect(obj.getAs<f64>("entry2047")).toBe(2047.0);
  expect(obj.has("absent")).toBe(false);
  expect(obj.keys().length).toBe(2048);
  expect(JSON.stringify(obj)).toBe(src);
});

describe("JSON.Obj reserve: long keys grow the key buffer without truncation", () => {
  // Stay within the existing u16 key-length representation while exceeding any
  // bounded initial estimate by a wide margin.
  const key = "k".repeat(32768);
  const src = '{"' + key + '":17,"tail":23}';
  const obj = JSON.parse<JSON.Obj>(src);

  expect(obj.size).toBe(2);
  expect(obj._kbuf.length > 32768).toBe(true);
  expect(obj._kpos.length <= 512).toBe(true);
  expect(obj._vals.length <= 512).toBe(true);
  __collect();
  expect(obj.getAs<f64>(key)).toBe(17.0);
  expect(obj.getAs<f64>("tail")).toBe(23.0);
  expect(obj.keys()[0]).toBe(key);
  // Disable raw passthrough so serialization reads the grown key buffer.
  obj.set<f64>("tail", 24.0);
  expect(JSON.stringify(obj)).toBe('{"' + key + '":17,"tail":24}');
});

describe("JSON.Obj reserve: reuse preserves grown buffers and drops stale entries", () => {
  const obj = JSON.parse<JSON.Obj>(wideSource(512));
  // Build the old hash index before clearing and reusing the object.
  expect(obj.getAs<f64>("entry511")).toBe(511.0);
  const keyPtr = changetype<usize>(obj._kbuf);
  const posPtr = changetype<usize>(obj._kpos);
  const valPtr = changetype<usize>(obj._vals);
  const bytes = backingBytes(obj);
  const big = "r".repeat(131072);
  const src = '{"payload":"' + big + '"}';
  const reused = JSON.parse<JSON.Obj>(src, obj);

  expect(changetype<usize>(reused)).toBe(changetype<usize>(obj));
  expect(changetype<usize>(obj._kbuf)).toBe(keyPtr);
  expect(changetype<usize>(obj._kpos)).toBe(posPtr);
  expect(changetype<usize>(obj._vals)).toBe(valPtr);
  expect(backingBytes(obj)).toBe(bytes);
  expect(obj.size).toBe(1);
  expect(obj._kused).toBe(8);
  expect(obj.has("entry0")).toBe(false);
  expect(obj.has("entry511")).toBe(false);
  __collect();
  expect(obj.getAs<string>("payload")).toBe(big);
  expect(JSON.stringify(obj)).toBe(src);

  JSON.parse<JSON.Obj>("{}", obj);
  __collect();
  expect(obj.size).toBe(0);
  expect(obj._kused).toBe(0);
  expect(obj.has("payload")).toBe(false);
  expect(backingBytes(obj)).toBe(bytes);
  expect(changetype<usize>(obj._kbuf)).toBe(keyPtr);
  expect(changetype<usize>(obj._kpos)).toBe(posPtr);
  expect(changetype<usize>(obj._vals)).toBe(valPtr);
  expect(JSON.stringify(obj)).toBe("{}");
});

describe("JSON.Obj reserve: duplicate and escaped keys survive buffer growth", () => {
  const prefix = wideSource(512);
  const src =
    prefix.slice(0, prefix.length - 1) +
    ',"entry0":999,"line\\nkey":17,"quote\\\"key":23}';
  const obj = JSON.parse<JSON.Obj>(src);

  expect(obj.size).toBe(515);
  __collect();
  expect(obj.getAs<f64>("entry0")).toBe(999.0);
  expect(obj.getAs<f64>("entry511")).toBe(511.0);
  // JSON.Obj currently stores raw key spellings, including escape sequences.
  // Preserve that behavior here; decoded key semantics are a separate concern.
  expect(obj.getAs<f64>("line\\nkey")).toBe(17.0);
  expect(obj.getAs<f64>('quote\\"key')).toBe(23.0);
  expect(JSON.stringify(obj)).toBe(src);
});
