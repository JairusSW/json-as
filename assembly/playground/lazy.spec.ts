/// <reference path="../index.d.ts" />

// ---------------------------------------------------------------------------
// lazy ≡ eager — equivalence spec for the on-demand prototype
// ---------------------------------------------------------------------------
//
// The strongest correctness net for on-demand parsing is: reading a value via
// the lazy cursor must equal reading it via the eager `JSON.parse<T>`. This
// spec drives a matrix of scalar tokens and small documents through both and
// counts mismatches. Driven from Node (lazy.spec.run.mjs); `run()` returns the
// failure count (0 = all green) and `firstFail()` pinpoints the first miss.
//
// Scope (Phase 1): the scalar decoders we just made real — full float grammar
// (asF64), unescaping strings (asString), integers/bools — plus navigation
// (get/at/length/kind) sanity. Numbers/strings are the risk surface.

import { JSON } from "..";
import { buildIndex, buildIndexOracle, indexEq } from "./lazy.index";
import {
  Document,
  ObjReader,
  Kind,
  docRootLoc,
  locGet,
  locAt,
  locKind,
  locLength,
  locAsI64,
  locAsF64,
  locAsBool,
  locAsString,
  locStringLength,
  locStringEq,
  locReadStringInto,
} from "./lazy";

let fails: i32 = 0;
let counter: i32 = 0;
let firstFailId: i32 = -1;

// Each assertion bumps `counter`; the first failure records its id so the JS
// driver can point at exactly which check missed without string marshalling.
function check(ok: bool): void {
  const id = counter++;
  if (!ok) {
    fails++;
    if (firstFailId < 0) firstFailId = id;
  }
}

// --- scalar equivalence: lazy decode of a bare token vs eager parse ---------

function checkI64(token: string): void {
  const root = docRootLoc(token);
  check(locAsI64(root) == JSON.parse<i64>(token));
}

function checkF64(token: string): void {
  const root = docRootLoc(token);
  const lazy = locAsF64(root);
  const eager = JSON.parse<f64>(token);
  // bit-exact, but treat NaN==NaN as equal (neither side should produce NaN
  // for these inputs, but be explicit)
  check(reinterpret<u64>(lazy) == reinterpret<u64>(eager));
}

function checkBool(token: string): void {
  const root = docRootLoc(token);
  check(locAsBool(root) == JSON.parse<bool>(token));
}

// For strings the token includes the quotes; eager `JSON.parse<string>` does
// the canonical unescape we compare against.
function checkString(token: string): void {
  const root = docRootLoc(token);
  check(locAsString(root) == JSON.parse<string>(token));
}

// SIMD structural index must equal the scalar oracle for this document.
function idx(src: string): void {
  check(indexEq(buildIndex(src), buildIndexOracle(src)));
}

// --- one @json struct to compare field reads against the eager graph --------

@json
class Small {
  id: i64 = 0;
  name: string = "";
  active: bool = false;
}

export function run(): i32 {
  fails = 0;
  counter = 0;
  firstFailId = -1;

  // integers: zero, positive, negative, wide
  checkI64("0");
  checkI64("7");
  checkI64("-7");
  checkI64("2147483647");
  checkI64("-2147483648");
  checkI64("9007199254740993");

  // floats: integer-valued, fraction, leading-zero frac, negative, exponent
  checkF64("0");
  checkF64("3.14159");
  checkF64("-2.5");
  checkF64("0.0001");
  checkF64("1e10");
  checkF64("1.5e-3");
  checkF64("-6.022e23");
  checkF64("3.141592653589793");

  // bools
  checkBool("true");
  checkBool("false");

  // strings: plain, then each escape class, then a surrogate pair
  checkString('"abcdef"');
  checkString('""');
  checkString('"a\\nb"'); // \n
  checkString('"a\\tb"'); // \t
  checkString('"quote: \\""'); // \"
  checkString('"back: \\\\"'); // \\
  checkString('"slash: \\/"'); // \/
  checkString('"u: \\u0041\\u00e9"'); // \uXXXX -> "Aé"
  checkString('"emoji: \\ud83d\\ude00"'); // surrogate pair -> 😀

  // --- navigation: object field reads via the cursor, vs eager graph --------
  const src = '{"id":42,"name":"Small Object","active":true,"tags":[10,20,30]}';
  const root = Document.from(src).root;
  const eager = JSON.parse<Small>(src);

  check(root.kind == Kind.Object);
  check(root.get("id")!.asI64() == eager.id);
  check(root.get("name")!.asString() == eager.name);
  check(root.get("active")!.asBool() == eager.active);
  check(root.get("missing") == null); // absent key -> null
  check(root.get("tags")!.kind == Kind.Array);
  check(root.get("tags")!.length == 3);
  check(root.get("tags")!.at(0)!.asI64() == 10);
  check(root.get("tags")!.at(2)!.asI64() == 30);
  check(root.get("tags")!.at(3) == null); // out of range -> null

  // nested skip: reading a later field must hop over earlier large-ish values
  const nested = '{"a":{"deep":[1,2,3]},"b":{"x":{"y":9}},"target":"hit"}';
  const nroot = Document.from(nested).root;
  check(nroot.get("target")!.asString() == "hit");
  check(nroot.get("b")!.get("x")!.get("y")!.asI64() == 9);

  // --- zero-alloc free-function navigation: locKind/locLength/locAt ---------
  const lroot = docRootLoc(src);
  check(locKind(lroot) == Kind.Object);
  check(locLength(lroot) == 4); // id,name,active,tags
  const tags = locGet(lroot, "tags");
  check(locKind(tags) == Kind.Array);
  check(locLength(tags) == 3);
  check(locAsI64(locAt(tags, 0)) == 10);
  check(locAsI64(locAt(tags, 2)) == 30);
  check(locAt(tags, 3) == 0); // out of range -> 0 loc
  check(locGet(lroot, "missing") == 0); // absent key -> 0 loc
  check(locLength(locGet(lroot, "name")) == 0); // scalar -> 0

  // --- escaped key: scanKeyEnd must skip `\"` so it neither ends the key early
  // nor corrupts the scan of LATER members. (locGet matches raw source key
  // bytes — the fast path — so the escaped key is matched in its raw `a\"b`
  // form; logical-key matching with unescaping is a documented follow-up.)
  const esc = '{"a\\"b":7,"plain":8}';
  const eroot = docRootLoc(esc);
  check(locAsI64(locGet(eroot, 'a\\"b')) == 7); // raw key incl. the escape run
  check(locAsI64(locGet(eroot, "plain")) == 8); // structure intact after it

  // a `\"` inside a STRING VALUE must likewise not break member skipping
  const esc2 = '{"msg":"he said \\"hi\\"","n":5}';
  const e2 = docRootLoc(esc2);
  check(locAsI64(locGet(e2, "n")) == 5);

  // --- zero-alloc string helpers: length / equality / buffer reuse ----------
  const nameLoc = locGet(lroot, "name"); // "Small Object"
  check(locStringLength(nameLoc) == "Small Object".length); // no-alloc length
  check(locStringEq(nameLoc, "Small Object")); // no-alloc match
  check(!locStringEq(nameLoc, "Small")); // length-gate rejects prefix
  check(!locStringEq(nameLoc, "small object")); // case-sensitive byte compare
  // length/eq must agree with a full decode on an ESCAPED string too
  const decoded = locAsString(locGet(e2, "msg")); // 'he said "hi"'
  check(locStringLength(locGet(e2, "msg")) == decoded.length);
  check(locStringEq(locGet(e2, "msg"), decoded));
  // buffer reuse yields the same bytes as a fresh decode, across resizes
  let buf = "";
  buf = locReadStringInto(nameLoc, buf); // 12 chars
  check(buf == "Small Object");
  buf = locReadStringInto(locGet(docRootLoc('{"k":"hit"}'), "k"), buf); // reuse + shrink to 3
  check(buf == "hit");

  // --- ObjReader: advancing cursor + wraparound (simdjson find_field_unordered)
  const oro = docRootLoc('{"a":1,"b":2,"c":3,"d":4}');
  // in-order reads (each advances the cursor — the O(N) path)
  let rd = ObjReader.of(oro);
  check(locAsI64(rd.find("a")) == 1);
  check(locAsI64(rd.find("b")) == 2);
  check(locAsI64(rd.find("c")) == 3);
  check(locAsI64(rd.find("d")) == 4);
  // out-of-order reads (forces the single wraparound each time)
  rd = ObjReader.of(oro);
  check(locAsI64(rd.find("c")) == 3);
  check(locAsI64(rd.find("a")) == 1); // wrap back to an earlier key
  check(locAsI64(rd.find("d")) == 4);
  check(locAsI64(rd.find("b")) == 2); // wrap again
  // absent key -> 0, and the reader stays usable afterward
  rd = ObjReader.of(oro);
  check(rd.find("z") == 0);
  check(locAsI64(rd.find("a")) == 1);
  // absent AFTER advancing must still scan every member exactly once
  rd = ObjReader.of(oro);
  check(locAsI64(rd.find("b")) == 2);
  check(rd.find("zz") == 0);
  check(locAsI64(rd.find("c")) == 3);
  // reset re-iterates from the top
  rd.reset();
  check(locAsI64(rd.find("a")) == 1);
  // equivalence with the eager graph, read via the advancing cursor
  const sr = ObjReader.of(docRootLoc(src));
  check(locAsI64(sr.find("id")) == eager.id);
  check(locStringEq(sr.find("name"), eager.name));
  check(locAsBool(sr.find("active")) == eager.active);

  // --- SIMD scan coverage: strings/containers longer than the 8-lane window --
  // long unescaped string value (> 16 bytes -> exercises the wide scanPlainString)
  const longStr = "abcdefghijklmnopqrstuvwxyz0123456789"; // 36 chars
  const lsDoc = '{"s":"' + longStr + '","after":1}';
  const lsRoot = docRootLoc(lsDoc);
  check(locStringLength(locGet(lsRoot, "s")) == longStr.length);
  check(locStringEq(locGet(lsRoot, "s"), longStr));
  check(locAsI64(locGet(lsRoot, "after")) == 1); // member after a long value
  // escape located PAST the first SIMD block must still fall back correctly
  const escLong = '{"s":"0123456789abcdef\\ntail","after":2}'; // backslash at lane > 8
  const elRoot = docRootLoc(escLong);
  check(
    locAsString(locGet(elRoot, "s")) ==
      JSON.parse<string>('"0123456789abcdef\\ntail"'),
  );
  check(locAsI64(locGet(elRoot, "after")) == 2);
  // large nested container to skip (SIMD nextStructural + depth), field after it
  const big =
    '{"arr":[' + "111,222,333,444,555,666,777,888,999," + '1,2,3],"tgt":42}';
  const bigRoot = docRootLoc(big);
  check(locKind(locGet(bigRoot, "arr")) == Kind.Array);
  check(locAsI64(locGet(bigRoot, "tgt")) == 42); // must skip the whole array via SIMD
  // nested object containing a brace-bearing STRING — braces in strings must not
  // move depth (nextStructural finds the quote; scanPlainString skips the body)
  const tricky = '{"o":{"note":"a{b}c[d]e","k":7},"tgt":9}';
  const tRoot = docRootLoc(tricky);
  check(locAsI64(locGet(locGet(tRoot, "o"), "k")) == 7);
  check(locAsI64(locGet(tRoot, "tgt")) == 9);

  // --- structural index (simdjson Stage 1 port) ≡ scalar oracle -------------
  // Each `idx` check builds the index two ways and asserts they're identical.
  idx('{"a":1,"b":2}');
  idx("[1,2,3,[4,5],{}]");
  idx('{"s":"a,b:c{d}e","n":7}'); // structural chars inside a string
  idx('{"e":"line\\nbreak","x":1}'); // short escape
  idx('{"q":"say \\"hi\\"","y":2}'); // escaped quotes
  idx('{"p":"back\\\\slash","z":3}'); // escaped backslash then real close quote
  idx('{"u":"\\ud83d\\ude00","w":4}'); // \u escapes
  idx("{}");
  idx("[]");
  idx('"just a string"');
  idx("42");
  // cross-window: a string that straddles the 64-char boundary, plus structural
  // chars on both sides — exercises the prevInside / prevEscaped carries
  let big2 = '{"head":"';
  for (let i = 0; i < 80; i++) big2 += "x";
  big2 += '","tail":[1,2,3]}';
  idx(big2);
  // a long run of members crossing several windows
  let many = "{";
  for (let i = 0; i < 40; i++)
    many += '"k' + i.toString() + '":' + i.toString() + ",";
  many += '"last":0}';
  idx(many);

  return fails;
}

export function firstFail(): i32 {
  return firstFailId;
}

export function total(): i32 {
  return counter;
}
