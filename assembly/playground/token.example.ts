/// <reference path="../index.d.ts" />

// ---------------------------------------------------------------------------
// What the transform would GENERATE for a typed struct under on-demand parsing
// ---------------------------------------------------------------------------
//
// You write this:
//
//   @json
//   class Token {
//     uid: i32 = 0;
//     token: string = "";
//   }
//
//   const t = JSON.parse<Token>(src);   // today: one full pass, both fields filled
//
// Under the EAGER transform (what exists), `JSON.parse<Token>` runs
// `__DESERIALIZE_FAST`: it walks the whole object once, SIMD-matching the key
// literals (`"uid":`, `"token":`) and `store`-ing each decoded field into the
// allocated struct. Cost is paid up front, in full, every time — even if the
// caller only ever reads `.uid`.
//
// Under the ON-DEMAND transform, `JSON.parse<Token>` becomes O(1): it just
// wraps a cursor over the source slice. Each field lowers to a get accessor
// that scans for its key, decodes once, and memoizes. Read one field, pay for
// one field. This file is the hand-written shape of that generated code, using
// the public `Value` cursor from `./lazy`.

import { Document, Value, Kind } from "./lazy";

// === GENERATED ===============================================================
// The transform replaces the field *storage* with a cursor + per-field memo,
// and replaces the field *declarations* with get accessors. The author-facing
// type (`token.uid`, `token.token`) is unchanged.
class Token {
  // The object's source slice. Constructing this is the entire "parse" cost.
  private __cur: Value;

  // Per-field memo. Primitives need a companion "loaded" flag because their
  // zero value is indistinguishable from "not yet decoded"; references use the
  // null pointer itself as the sentinel.
  private __uid: i32 = 0;
  private __uid_loaded: bool = false;
  private __token: string | null = null;

  private constructor(cur: Value) {
    this.__cur = cur;
  }

  /** parse<Token> lowers to this — no scanning, just bind the cursor. */
  // @ts-ignore: decorator valid here
  @inline static __VIEW(cur: Value): Token {
    return new Token(cur);
  }

  // -- generated accessors --------------------------------------------------
  // Each is a keyed scan of the immediate object (skipping nested values),
  // decode via the matching field deserializer, then cache.

  get uid(): i32 {
    if (!this.__uid_loaded) {
      const v = this.__cur.get("uid");
      this.__uid = v ? v.asI32() : 0; // 0 = the field's declared default
      this.__uid_loaded = true;
    }
    return this.__uid;
  }

  get token(): string {
    let t = this.__token;
    if (t === null) {
      const v = this.__cur.get("token");
      t = v ? v.asString() : "";
      this.__token = t;
    }
    return t!;
  }

  // Writers would record into the memo + a mutation overlay (see lazy README).
  set uid(value: i32) {
    this.__uid = value;
    this.__uid_loaded = true;
    // TODO: mark overlay dirty so re-serialize emits `value`, not the source.
  }
  set token(value: string) {
    this.__token = value;
    // TODO: mark overlay dirty.
  }
}
// === END GENERATED ===========================================================

// ---------------------------------------------------------------------------
// Demo: the on-demand win is visible in *what gets scanned*.
// ---------------------------------------------------------------------------
export function demo(): void {
  const doc = Document.from('{"uid":7,"token":"abcdef)..big..("}');
  const root = doc.root;
  if (root.kind != Kind.Object) return;

  const t = Token.__VIEW(root);

  // Reading ONLY .uid scans up to the first key and stops. The (potentially
  // huge) token string is never copied, decoded, or even fully scanned past.
  trace("uid", 1, <f64>t.uid);

  // .uid again: pure memo hit, zero scanning.
  trace("uid cached", 1, <f64>t.uid);

  // token is only touched — and only allocated — if/when you ask.
  trace("token.len", 1, <f64>t.token.length);
}

// ---------------------------------------------------------------------------
// NOTES on the two regimes (drives the codegen choice):
//
//  - SPARSE read (1-2 of N fields): the per-field keyed scan above wins
//    decisively — you skip decoding/allocating everything you don't touch.
//
//  - DENSE read (most fields): N independent keyed scans = N linear walks of
//    the object (O(N*fields)). Here the transform should instead emit a single
//    forward "fill on first touch" pass — essentially the eager
//    __DESERIALIZE_FAST body, but deferred until the first accessor fires and
//    guarded by one `__materialized` flag. Fields are contiguous and in a known
//    order, so one pass fills them all.
//
//  A practical generator picks per-struct (or via a decorator hint) between
//  "lazy fields" and "lazy whole-struct", or emits both and flips based on a
//  cheap heuristic (field count, presence of large string/array fields).
// ---------------------------------------------------------------------------
