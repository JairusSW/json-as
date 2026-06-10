import { JSON } from "..";
import { describe, expect } from "as-test";

// Property test for JSON.Obj's key index: drive random set/delete/lookup
// sequences against a reference Map and assert they always agree. The small key
// pool makes the object oscillate across the linear<->hash threshold
// (OBJ_LINEAR_MAX) and exercises overwrite, delete-then-readd, delete-missing,
// and index rebuilds — the regime where the fill-and-spin loop lived.

// xorshift32 — deterministic so a failure reproduces from the seed.
let RNG: u32 = 1;
function srand(seed: u32): void {
  RNG = seed != 0 ? seed : 1;
}
function rand(): u32 {
  let x = RNG;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  RNG = x;
  return x;
}

const POOL: u32 = 24; // keys k0..k23; > OBJ_LINEAR_MAX so both regimes are hit

// Runs `steps` random ops, checking each lookup live, then verifies the whole
// object equals the reference map.
function runTrial(seed: u32, steps: i32): void {
  srand(seed);
  const obj = new JSON.Obj();
  const ref = new Map<string, f64>();

  for (let s = 0; s < steps; s++) {
    const key = "k" + (rand() % POOL).toString();
    const op = rand() % 100;
    if (op < 55) {
      const val = <f64>(rand() % 10000);
      obj.set<f64>(key, val);
      ref.set(key, val);
    } else if (op < 80) {
      const had = ref.has(key);
      expect(obj.delete(key)).toBe(had); // delete agrees on found/not-found
      ref.delete(key);
    } else {
      expect(obj.has(key)).toBe(ref.has(key));
      if (ref.has(key)) expect(obj.getAs<f64>(key)).toBe(ref.get(key));
    }
    expect(obj.size).toBe(ref.size);
  }

  // Full agreement: same size, and every reference key present with its value.
  expect(obj.size).toBe(ref.size);
  const keys = ref.keys();
  for (let i = 0; i < keys.length; i++) {
    const k = unchecked(keys[i]);
    expect(obj.has(k)).toBe(true);
    expect(obj.getAs<f64>(k)).toBe(ref.get(k));
  }
  // Absent keys (beyond the pool) report missing.
  expect(obj.has("absent")).toBe(false);
  expect(obj.has("k" + POOL.toString())).toBe(false);
}

describe("ObjIndex property: seed 0x1, 400 ops", () => {
  runTrial(0x1, 400);
});
describe("ObjIndex property: seed 0xC0FFEE, 400 ops", () => {
  runTrial(0xc0ffee, 400);
});
describe("ObjIndex property: seed 0xDEADBEEF, 600 ops", () => {
  runTrial(0xdeadbeef, 600);
});
describe("ObjIndex property: seed 0x5EED, 600 ops", () => {
  runTrial(0x5eed, 600);
});

// Monotonic growth across the threshold then full drain, every key checked at
// each size — directly targets the rebuild/invalidation path.
describe("ObjIndex property: grow past threshold then drain", () => {
  const obj = new JSON.Obj();
  for (let i = 0; i < 30; i++) {
    obj.set<f64>("g" + i.toString(), <f64>i);
    expect(obj.size).toBe(i + 1);
    // every key inserted so far still resolves
    for (let j = 0; j <= i; j++) {
      expect(obj.getAs<f64>("g" + j.toString())).toBe(<f64>j);
    }
  }
  for (let i = 0; i < 30; i++) {
    expect(obj.delete("g" + i.toString())).toBe(true);
    expect(obj.size).toBe(29 - i);
    expect(obj.has("g" + i.toString())).toBe(false);
    // remaining keys still resolve
    for (let j = i + 1; j < 30; j++) {
      expect(obj.getAs<f64>("g" + j.toString())).toBe(<f64>j);
    }
  }
});

// Duplicate keys must resolve to the LAST value (JSON last-wins), and the small
// (linear-scan) and large (hash-index) paths must agree. A forward linear scan
// returned the first occurrence on small objects - inconsistent with the hash
// path and with JSON semantics.
describe("ObjIndex: duplicate keys resolve last-wins (linear and hash paths)", () => {
  const small = JSON.parse<JSON.Obj>('{"a":1,"a":2,"a":3}');
  expect(small.getAs<f64>("a")).toBe(3.0);
  const large = JSON.parse<JSON.Obj>(
    '{"k0":0,"k1":1,"k2":2,"k3":3,"k4":4,"k5":5,"k6":6,"a":1,"a":2,"a":3}',
  );
  expect(large.getAs<f64>("a")).toBe(3.0);
});
