/// <reference path="../index.d.ts" />

// Micro-bench surface: eager JSON.parse<Token> vs. the on-demand cursor, on a
// small 2-field object. Timing is driven from Node (see bench.run.mjs) so we
// control warmup / GC / memory pre-grow. Every export returns an i32 the JS
// side accumulates, so nothing is dead-code-eliminated.

import { JSON } from "..";
import {
  Document,
  ObjReader,
  docRootLoc,
  locGet,
  locAsI32,
  locAsString,
  locStringLength,
  locReadStringInto,
} from "./lazy";
import { strScanSIMD, strScanScalar } from "./lazy";
import { buildIndex, buildIndexOracle } from "./lazy.index";
import { REPO } from "./repo.data";
import { Repo } from "./repo.struct";

// note: docRootLoc is imported above with the other loc helpers

@json
class Token {
  uid: i32 = 0;
  token: string = "";
}

// One shared source string, built once in WASM memory — isolates parse+read
// cost from any JS<->WASM string-bridging cost.
const SRC = '{"uid":7,"token":"abcdef"}';

// --- eager: full parse into a struct, then read fields ---------------------
export function eagerBoth(): i32 {
  const t = JSON.parse<Token>(SRC);
  return t.uid + t.token.length;
}

export function eagerOne(): i32 {
  const t = JSON.parse<Token>(SRC);
  return t.uid;
}

// --- on-demand: bind a cursor, scan/decode only what's read ----------------
export function lazyBoth(): i32 {
  const r = Document.from(SRC).root;
  return r.get("uid")!.asI32() + r.get("token")!.asString().length;
}

export function lazyOne(): i32 {
  const r = Document.from(SRC).root;
  return r.get("uid")!.asI32();
}

// Just bind + classify — the O(1) "parse" cost with zero field decode.
export function lazyBind(): i32 {
  return <i32>Document.from(SRC).root.kind;
}

// --- dynamic: JSON.parse<JSON.Obj> — the existing untyped key-access API ----
// This is on-demand's real competitor: keyed access to JSON of unknown shape,
// no compile-time struct. JSON.parse<JSON.Obj> eagerly materializes the whole
// object (a JSON.Obj with a key buffer + a JSON.Value[] of all members) up
// front; reads are then map-style lookups.
export function objBoth(): i32 {
  const o = JSON.parse<JSON.Obj>(SRC);
  return o.get("uid")!.get<i32>() + o.get("token")!.get<string>().length;
}

export function objOne(): i32 {
  const o = JSON.parse<JSON.Obj>(SRC);
  return o.get("uid")!.get<i32>();
}

// --- zero-alloc loc API: same scans, no per-hop Value/Document alloc -------
export function locBoth(): i32 {
  const root = docRootLoc(SRC);
  return (
    locAsI32(locGet(root, "uid")) + locAsString(locGet(root, "token")).length
  );
}

export function locOne(): i32 {
  const root = docRootLoc(SRC);
  return locAsI32(locGet(root, "uid"));
}

// Reused scratch buffer: `locReadStringInto` __renew's it in place, so after
// the first iteration the string read allocates nothing. Same work as locBoth,
// minus the per-read string churn.
let scratch: string = "";
export function locBothReuse(): i32 {
  const root = docRootLoc(SRC);
  scratch = locReadStringInto(locGet(root, "token"), scratch);
  return locAsI32(locGet(root, "uid")) + scratch.length;
}

// --- wide object: the on-demand sweet spot (read 1 of 12 fields) ------------
// Eager must parse + allocate ALL 12 fields regardless; the cursor scans only
// to the key it wants. Reading the FIRST field is the best case (scan 1), the
// LAST is the cursor's worst case (scan all) — both still skip 11 decodes.
@json
class Wide {
  a: i32 = 0;
  b: i32 = 0;
  c: i32 = 0;
  d: i32 = 0;
  e: i32 = 0;
  f: i32 = 0;
  g: i32 = 0;
  h: i32 = 0;
  i: i32 = 0;
  j: i32 = 0;
  k: i32 = 0;
  name: string = "";
}
const WIDE =
  '{"a":1,"b":2,"c":3,"d":4,"e":5,"f":6,"g":7,"h":8,"i":9,"j":10,"k":11,"name":"target"}';

export function eagerWideFirst(): i32 {
  return JSON.parse<Wide>(WIDE).a;
}
export function eagerWideLast(): i32 {
  return JSON.parse<Wide>(WIDE).name.length;
}
export function objWideFirst(): i32 {
  return JSON.parse<JSON.Obj>(WIDE).get("a")!.get<i32>();
}
export function objWideLast(): i32 {
  return JSON.parse<JSON.Obj>(WIDE).get("name")!.get<string>().length;
}
export function locWideFirst(): i32 {
  return locAsI32(locGet(docRootLoc(WIDE), "a"));
}
export function locWideLast(): i32 {
  return locAsString(locGet(docRootLoc(WIDE), "name")).length;
}
// Same lookup, but only the length is needed — zero allocation (no string).
export function locWideLastLen(): i32 {
  return locStringLength(locGet(docRootLoc(WIDE), "name"));
}

// --- read ALL 12 fields: O(N²) repeated-locGet vs O(N) advancing cursor -----
// This is simdjson's "scan from current position" win. Reading every field via
// locGet rescans from `{` each time (O(N²)); ObjReader advances past each found
// field (O(N)). Eager parse<Wide> is the read-all baseline.
export function eagerWideAll(): i32 {
  const w = JSON.parse<Wide>(WIDE);
  return (
    w.a +
    w.b +
    w.c +
    w.d +
    w.e +
    w.f +
    w.g +
    w.h +
    w.i +
    w.j +
    w.k +
    w.name.length
  );
}
export function locWideAllRepeated(): i32 {
  const r = docRootLoc(WIDE);
  return (
    locAsI32(locGet(r, "a")) +
    locAsI32(locGet(r, "b")) +
    locAsI32(locGet(r, "c")) +
    locAsI32(locGet(r, "d")) +
    locAsI32(locGet(r, "e")) +
    locAsI32(locGet(r, "f")) +
    locAsI32(locGet(r, "g")) +
    locAsI32(locGet(r, "h")) +
    locAsI32(locGet(r, "i")) +
    locAsI32(locGet(r, "j")) +
    locAsI32(locGet(r, "k")) +
    locStringLength(locGet(r, "name"))
  );
}
export function locWideAllCursor(): i32 {
  const r = ObjReader.of(docRootLoc(WIDE));
  return (
    locAsI32(r.find("a")) +
    locAsI32(r.find("b")) +
    locAsI32(r.find("c")) +
    locAsI32(r.find("d")) +
    locAsI32(r.find("e")) +
    locAsI32(r.find("f")) +
    locAsI32(r.find("g")) +
    locAsI32(r.find("h")) +
    locAsI32(r.find("i")) +
    locAsI32(r.find("j")) +
    locAsI32(r.find("k")) +
    locStringLength(r.find("name"))
  );
}

// --- real GitHub repo API object (~5.2 KB, ~80 fields) ----------------------
// The scaling law: eager/dynamic parse cost grows with the WHOLE document; the
// cursor's cost grows only with the path walked. `id` is the first field,
// `default_branch` the last, `owner.login` is nested.

// Typed @json struct — the FAST eager baseline (SIMD key-match, direct field
// stores). Parses the whole object into a Repo (+ nested RepoOwner) regardless
// of how many fields you read.
export function eagerRepo3(): i32 {
  const r = JSON.parse<Repo>(REPO);
  return r.name.length + r.visibility.length + r.default_branch.length;
}
export function eagerRepoFirst(): i32 {
  return JSON.parse<Repo>(REPO).id;
}
export function eagerRepoLast(): i32 {
  return JSON.parse<Repo>(REPO).default_branch.length;
}

// Dynamic JSON.Obj — the untyped competitor — materializes all ~80 fields.
export function dynRepo3(): i32 {
  const o = JSON.parse<JSON.Obj>(REPO);
  return (
    o.get("name")!.get<string>().length +
    o.get("visibility")!.get<string>().length +
    o.get("default_branch")!.get<string>().length
  );
}

// On-demand: pay only for the path walked.
export function locRepoFirst(): i32 {
  return locAsI32(locGet(docRootLoc(REPO), "id")); // first field — ~flat
}
export function locRepoLast(): i32 {
  return locStringLength(locGet(docRootLoc(REPO), "default_branch")); // scan ~5 KB
}
export function locRepoNested(): i32 {
  const root = docRootLoc(REPO);
  return locStringLength(locGet(locGet(root, "owner"), "login")); // owner.login
}
// Same 3 fields as dynRepo3, in source order, via the advancing cursor.
export function locRepo3Cursor(): i32 {
  const r = ObjReader.of(docRootLoc(REPO));
  return (
    locStringLength(r.find("name")) +
    locStringLength(r.find("visibility")) +
    locStringLength(r.find("default_branch"))
  );
}

// --- SIMD vs scalar string scanning, isolated -------------------------------
// A single long string value to skip — what SIMD structural scanning actually
// accelerates. Built once in WASM memory: a 4 KB unescaped string field.
function makeBlob(n: i32): string {
  let inner = "";
  // 32-char chunk, no quotes/backslashes
  const chunk = "abcdefghijklmnopqrstuvwxyz0123456789".slice(0, 32);
  while (inner.length < n) inner += chunk;
  return '"' + inner.slice(0, n) + '"';
}
const BLOB = makeBlob(4096); // a 4096-char quoted string value
export function blobScanSIMD(): i32 {
  return strScanSIMD(docRootLoc(BLOB));
}
export function blobScanScalar(): i32 {
  return strScanScalar(docRootLoc(BLOB));
}

// --- simdjson Stage 1: structural index build, SIMD vs scalar oracle --------
// One branchless pass over the whole 5.2 KB doc, building the full structural
// index. Throughput reported in GB/s over the (UTF-16) input.
export function idxBuildSIMD(): i32 {
  return buildIndex(REPO).length;
}
export function idxBuildScalar(): i32 {
  return buildIndexOracle(REPO).length;
}

export function collect(): void {
  __collect();
}
