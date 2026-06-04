/// <reference path="../index.d.ts" />

// ---------------------------------------------------------------------------
// On-demand codegen, DENSE variant — "fill on first touch"
// ---------------------------------------------------------------------------
//
// Same author-facing struct as token.example.ts:
//
//   @json
//   class Token {
//     uid: i32 = 0;
//     token: string = "";
//   }
//
// The SPARSE variant (token.example.ts) gives each field its own keyed scan.
// That's ideal when you read 1-2 of N fields, but if you read MOST fields it
// degrades to O(N * fields) — every accessor re-walks the object.
//
// The DENSE variant trades that for ONE deferred pass: parse is still O(1)
// (just bind the cursor), but the first time *any* field is read, a single
// forward sweep over the object fills *all* fields at once, guarded by one
// `__filled` flag. Subsequent reads — of any field — are pure memo hits.
//
// This is essentially the eager `__DESERIALIZE_FAST` body, but (a) deferred
// until first touch and (b) driven by the lazy `ObjectIter` so it shares the
// on-demand cursor machinery. The key dispatch here uses `keyEquals` (a length
// + byte compare); the real transform would lower it to the same packed-u64
// SWAR/SIMD key match the eager path already emits.

import { Document, Value, Kind, ObjectIter } from "./lazy";

// === GENERATED ===============================================================
class Token {
  private __cur: Value;
  private __filled: bool = false;

  // Real field storage (defaults baked in, exactly as declared).
  private __uid: i32 = 0;
  private __token: string = "";

  private constructor(cur: Value) {
    this.__cur = cur;
  }

  /** parse<Token> lowers to this — O(1), no scanning. */
  // @ts-ignore: decorator valid here
  @inline static __VIEW(cur: Value): Token {
    return new Token(cur);
  }

  /**
   * The deferred one-pass fill. Runs at most once. Walks each member exactly
   * once and dispatches to the matching field — fields not present keep their
   * declared default. Unknown keys are skipped for free (the iterator already
   * stepped over their values).
   */
  private __fill(): void {
    const it = new ObjectIter(this.__cur);
    while (it.next()) {
      // The transform orders these by the actual field set; a perfect-hash or
      // first-byte switch would replace the linear `if` chain for wide structs.
      if (it.keyEquals("uid")) {
        this.__uid = it.value().asI32();
      } else if (it.keyEquals("token")) {
        this.__token = it.value().asString();
      }
    }
    this.__filled = true;
  }

  // -- generated accessors: each just ensures the fill, then reads memo -------

  get uid(): i32 {
    if (!this.__filled) this.__fill();
    return this.__uid;
  }

  get token(): string {
    if (!this.__filled) this.__fill();
    return this.__token;
  }

  // Setters force a fill first (so untouched fields keep source values), then
  // overwrite + flag the overlay dirty for re-serialize.
  set uid(value: i32) {
    if (!this.__filled) this.__fill();
    this.__uid = value;
    // TODO: mark overlay dirty.
  }
  set token(value: string) {
    if (!this.__filled) this.__fill();
    this.__token = value;
    // TODO: mark overlay dirty.
  }
}
// === END GENERATED ===========================================================

// ---------------------------------------------------------------------------
export function demo(): void {
  const doc = Document.from('{"uid":7,"token":"abc","extra":[1,2,3]}');
  const root = doc.root;
  if (root.kind != Kind.Object) return;

  const t = Token.__VIEW(root);

  // First read triggers ONE sweep that fills both fields (and skips "extra").
  trace("uid", 1, <f64>t.uid);
  // Second read of a *different* field: pure memo hit, no rescan.
  trace("token.len", 1, <f64>t.token.length);
}

// ---------------------------------------------------------------------------
// Sparse vs. dense — same surface, opposite cost curve:
//
//   reads:        1 field        all N fields
//   sparse  :     1 short scan   N full scans   (O(N*fields))
//   dense   :     1 full scan    1 full scan    (O(fields))
//
// Neither dominates. The generator should pick per struct:
//   - few fields, or large string/array fields likely skipped → SPARSE
//   - many small fields usually read together               → DENSE
// or take a hint: @json({ lazy: "fields" | "struct" }). Both variants share
// the identical public shape, so the choice is invisible to callers and can
// even flip behind a runtime heuristic without touching user code.
// ---------------------------------------------------------------------------
