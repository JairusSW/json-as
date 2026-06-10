import { JSON } from "../..";
import { bench, blackbox, dumpToFile } from "../lib/bench";

// Microbench for JSON.Obj key access. Two patterns per key-count:
//   cold  - parse a fresh object then look up one key (index built on access);
//           the dynamic/proxy workload (parse, touch a few keys, discard).
//   warm  - pre-parsed object, repeatedly look up every key (index already
//           built); isolates per-lookup probe/scan cost.
// Key strings are pre-built so the hot loop allocates nothing.

function makeObjJson(n: i32): string {
  let s = "{";
  for (let i = 0; i < n; i++) {
    if (i > 0) s += ",";
    s += '"key' + i.toString() + '":' + i.toString();
  }
  return s + "}";
}

function makeKeys(n: i32): string[] {
  const a = new Array<string>(n);
  for (let i = 0; i < n; i++) a[i] = "key" + i.toString();
  return a;
}

// Long (~24-char) keys to exercise the key comparison itself (the part SIMD
// accelerates); short keys finish in the scalar tail.
function makeObjJsonLong(n: i32): string {
  let s = "{";
  for (let i = 0; i < n; i++) {
    if (i > 0) s += ",";
    s += '"a_fairly_long_field_name_' + i.toString() + '":' + i.toString();
  }
  return s + "}";
}
function makeKeysLong(n: i32): string[] {
  const a = new Array<string>(n);
  for (let i = 0; i < n; i++) a[i] = "a_fairly_long_field_name_" + i.toString();
  return a;
}
const JL4 = makeObjJsonLong(4);
const JL16 = makeObjJsonLong(16);
const KL4 = makeKeysLong(4);
const KL16 = makeKeysLong(16);
const OL4 = JSON.parse<JSON.Obj>(JL4);
const OL16 = JSON.parse<JSON.Obj>(JL16);

const J4 = makeObjJson(4);
const J8 = makeObjJson(8);
const J16 = makeObjJson(16);
const J64 = makeObjJson(64);

const K4 = makeKeys(4);
const K8 = makeKeys(8);
const K16 = makeKeys(16);
const K64 = makeKeys(64);

const O4 = JSON.parse<JSON.Obj>(J4);
const O8 = JSON.parse<JSON.Obj>(J8);
const O16 = JSON.parse<JSON.Obj>(J16);
const O64 = JSON.parse<JSON.Obj>(J64);

// --- cold: parse fresh + look up one key (index build happens here) ---
bench(
  "keyaccess cold parse+get1 4keys",
  () => {
    const o = JSON.parse<JSON.Obj>(J4);
    blackbox(o.getAs<f64>("key0"));
  },
  300_000,
);
dumpToFile("keyaccess-cold-4", "deserialize");

bench(
  "keyaccess cold parse+get1 8keys",
  () => {
    const o = JSON.parse<JSON.Obj>(J8);
    blackbox(o.getAs<f64>("key4"));
  },
  300_000,
);
dumpToFile("keyaccess-cold-8", "deserialize");

bench(
  "keyaccess cold parse+get1 16keys",
  () => {
    const o = JSON.parse<JSON.Obj>(J16);
    blackbox(o.getAs<f64>("key8"));
  },
  300_000,
);
dumpToFile("keyaccess-cold-16", "deserialize");

bench(
  "keyaccess cold parse+get1 64keys",
  () => {
    const o = JSON.parse<JSON.Obj>(J64);
    blackbox(o.getAs<f64>("key32"));
  },
  300_000,
);
dumpToFile("keyaccess-cold-64", "deserialize");

// --- warm: pre-parsed, look up every key once per op ---
bench(
  "keyaccess warm getAll 4keys",
  () => {
    let sum = 0.0;
    for (let i = 0; i < K4.length; i++) sum += O4.getAs<f64>(unchecked(K4[i]));
    blackbox(sum);
  },
  1_000_000,
);
dumpToFile("keyaccess-warm-4", "deserialize");

bench(
  "keyaccess warm getAll 8keys",
  () => {
    let sum = 0.0;
    for (let i = 0; i < K8.length; i++) sum += O8.getAs<f64>(unchecked(K8[i]));
    blackbox(sum);
  },
  1_000_000,
);
dumpToFile("keyaccess-warm-8", "deserialize");

bench(
  "keyaccess warm getAll 16keys",
  () => {
    let sum = 0.0;
    for (let i = 0; i < K16.length; i++)
      sum += O16.getAs<f64>(unchecked(K16[i]));
    blackbox(sum);
  },
  1_000_000,
);
dumpToFile("keyaccess-warm-16", "deserialize");

bench(
  "keyaccess warm getAll 64keys",
  () => {
    let sum = 0.0;
    for (let i = 0; i < K64.length; i++)
      sum += O64.getAs<f64>(unchecked(K64[i]));
    blackbox(sum);
  },
  1_000_000,
);
dumpToFile("keyaccess-warm-64", "deserialize");

// --- long-key warm lookups (compare-bound) ---
bench(
  "keyaccess warm getAll LONG 4keys",
  () => {
    let sum = 0.0;
    for (let i = 0; i < KL4.length; i++)
      sum += OL4.getAs<f64>(unchecked(KL4[i]));
    blackbox(sum);
  },
  1_000_000,
);
dumpToFile("keyaccess-warm-long-4", "deserialize");

bench(
  "keyaccess warm getAll LONG 16keys",
  () => {
    let sum = 0.0;
    for (let i = 0; i < KL16.length; i++)
      sum += OL16.getAs<f64>(unchecked(KL16[i]));
    blackbox(sum);
  },
  1_000_000,
);
dumpToFile("keyaccess-warm-long-16", "deserialize");
