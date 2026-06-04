// ---------------------------------------------------------------------------
// On-demand (lazy) JSON — PROTOTYPE / SCAFFOLD
// ---------------------------------------------------------------------------
//
// Goal: parse *nothing* up front. We pin the source text and hand out cheap
// cursors that scan into it only when a value is actually touched. Navigating
// (`.get(key)`, `.at(i)`) allocates nothing — it just walks pointers in the
// source buffer. Scalars are decoded lazily and NaN-boxed into an 8-byte word
// the first time they're read, so a second read is a single masked load.
//
// This mirrors simdjson's "On Demand" model: a forward cursor over the raw
// bytes rather than a materialized tree. Random access (`obj.get("z")`) is a
// linear scan of the current container; that's the on-demand tradeoff — you
// pay only for the path you walk, never for the whole document.
//
// STATUS: structure + accessors only. The scalar decoders and the structural
// scanner are real (so you can play with it), but number-grammar edge cases,
// string unescaping, and a mutation/overlay layer for the `set` side are
// stubbed with TODOs. We'll flesh out the actual parser later.
//
// The design borrows the NaN-box layout from the main library (see
// assembly/index.ts) so a resolved lazy scalar is bit-compatible with
// JSON.Value and can be handed off cheaply once eager materialization is wired.

import {
  BRACE_LEFT,
  BRACE_RIGHT,
  BRACKET_LEFT,
  BRACKET_RIGHT,
  COMMA,
  COLON,
  QUOTE,
  BACK_SLASH,
  CHAR_T,
  CHAR_F,
  CHAR_N,
} from "./custom/chars";
import { isSpace } from "./util/isSpace";
import { scanStringEnd } from "./util/stringScan";
import { atoi } from "./util/atoi";
import { parseFloatFast } from "./util/parsefloat-fast";
import { deserializeString } from "./deserialize/index/string";
import { JSONMode } from "./index";

// --- Packed cursor representation ------------------------------------------
//
// A lazy handle is just the slice of source it covers: `[start, end)` as two
// wasm32 pointers packed into one u64 — `(start << 32) | end`. Zero heap, pure
// value, copyable by register. The *kind* is never stored; it's recovered by
// peeking the first non-space byte, which is a single load + compare.
//
//   63                                   32 31                                0
//  +---------------------------------------+----------------------------------+
//  |              start pointer            |             end pointer          |
//  +---------------------------------------+----------------------------------+
//
// `end` points just past the value (exclusive), exactly like the rest of the
// codebase's `(srcStart, srcEnd)` convention, so these slices feed straight
// into `atoi`, `scanStringEnd`, the deserialize handlers, etc.
type Loc = u64;

// @ts-ignore: decorator valid here
@inline function locOf(start: usize, end: usize): Loc {
  return ((<u64>start) << 32) | (<u64>end);
}
// @ts-ignore: decorator valid here
@inline function locStart(loc: Loc): usize {
  return <usize>(loc >> 32);
}
// @ts-ignore: decorator valid here
@inline function locEnd(loc: Loc): usize {
  return <usize>(loc & 0xffffffff);
}

/** The structural kind of a value, decided by its first byte. */
export const enum Kind {
  Invalid = 0,
  Null = 1,
  Bool = 2,
  Number = 3,
  String = 4,
  Array = 5,
  Object = 6,
}

// @ts-ignore: decorator valid here
@inline export function skipWs(ptr: usize, end: usize): usize {
  while (ptr < end && isSpace(load<u16>(ptr))) ptr += 2;
  return ptr;
}

/**
 * Classify a value by its leading byte — O(1), no scanning.
 * Assumes `ptr` already points at the first non-space code unit.
 */
// @ts-ignore: decorator valid here
@inline function classify(ptr: usize, end: usize): Kind {
  if (ptr >= end) return Kind.Invalid;
  const c = load<u16>(ptr);
  if (c == BRACE_LEFT) return Kind.Object;
  if (c == BRACKET_LEFT) return Kind.Array;
  if (c == QUOTE) return Kind.String;
  if (c == CHAR_T || c == 0x66 /* f */) return Kind.Bool;
  if (c == CHAR_N) return Kind.Null;
  // digit, '-', or anything numeric-looking
  if (c == 0x2d || (c >= 0x30 && c <= 0x39)) return Kind.Number;
  return Kind.Invalid;
}

// --- structural scanning (scalar default; SIMD under JSON_MODE == SIMD) -----
//
// `v128` only compiles when `--enable simd` is on, so the SIMD variants live
// behind `JSON_MODE == JSONMode.SIMD` (a compile-time constant): under NAIVE/
// SWAR that branch is dead-code-eliminated before feature-checking, exactly like
// `deserialize/simd/*`. The lane splats are LOCAL to the SIMD functions so they
// also disappear when those functions are eliminated. The SIMD path loads 8 u16
// lanes/step (`i16x8.eq` + `bitmask` + `ctz`) to skip string/array filler ~8×
// faster; the scalar path steps 2 bytes. A tail handles the final < 8 lanes and
// the `ptr + 16 <= end` guard keeps every wide load inside [start, end).

/**
 * Scan a string body (from its opening quote) to the closing quote. Returns the
 * close-quote position for an UNESCAPED string, or `0` if a `\` appears first
 * (the signal to fall back to the escape-correct scanner).
 */
// @ts-ignore: decorator valid here
@inline function scanPlainString_SCALAR(start: usize, end: usize): usize {
  let p = start + 2;
  while (p < end) {
    const c = load<u16>(p);
    if (c == QUOTE) return p;
    if (c == BACK_SLASH) return 0;
    p += 2;
  }
  return p;
}

// @ts-ignore: decorator valid here
@inline function scanPlainString_SIMD(start: usize, end: usize): usize {
  const sQuote = i16x8.splat(0x22);
  const sBslash = i16x8.splat(0x5c);
  let p = start + 2;
  while (p + 16 <= end) {
    const block = load<v128>(p);
    const mask = i16x8.bitmask(
      v128.or(i16x8.eq(block, sQuote), i16x8.eq(block, sBslash)),
    );
    if (mask) {
      const hit = p + (ctz(mask) << 1);
      return load<u16>(hit) == QUOTE ? hit : 0; // quote -> close; backslash -> escaped
    }
    p += 16;
  }
  while (p < end) {
    const c = load<u16>(p);
    if (c == QUOTE) return p;
    if (c == BACK_SLASH) return 0;
    p += 2;
  }
  return p; // unterminated: content runs to `end`
}

// @ts-ignore: decorator valid here
@inline function scanPlainString(start: usize, end: usize): usize {
  if (JSON_MODE == JSONMode.SIMD) return scanPlainString_SIMD(start, end);
  return scanPlainString_SCALAR(start, end);
}

/** Position of the next structural char in {`{` `}` `[` `]` `"`}; `end` if none. */
// @ts-ignore: decorator valid here
@inline function nextStructural_SCALAR(ptr: usize, end: usize): usize {
  while (ptr < end) {
    const c = load<u16>(ptr);
    if (
      c == QUOTE ||
      c == BRACE_LEFT ||
      c == BRACE_RIGHT ||
      c == BRACKET_LEFT ||
      c == BRACKET_RIGHT
    )
      return ptr;
    ptr += 2;
  }
  return end;
}

// @ts-ignore: decorator valid here
@inline function nextStructural_SIMD(ptr: usize, end: usize): usize {
  const sQuote = i16x8.splat(0x22);
  const sLBrace = i16x8.splat(0x7b);
  const sRBrace = i16x8.splat(0x7d);
  const sLBrack = i16x8.splat(0x5b);
  const sRBrack = i16x8.splat(0x5d);
  while (ptr + 16 <= end) {
    const block = load<v128>(ptr);
    const mask = i16x8.bitmask(
      v128.or(
        v128.or(
          i16x8.eq(block, sQuote),
          v128.or(i16x8.eq(block, sLBrace), i16x8.eq(block, sRBrace)),
        ),
        v128.or(i16x8.eq(block, sLBrack), i16x8.eq(block, sRBrack)),
      ),
    );
    if (mask) return ptr + (ctz(mask) << 1);
    ptr += 16;
  }
  while (ptr < end) {
    const c = load<u16>(ptr);
    if (
      c == QUOTE ||
      c == BRACE_LEFT ||
      c == BRACE_RIGHT ||
      c == BRACKET_LEFT ||
      c == BRACKET_RIGHT
    )
      return ptr;
    ptr += 2;
  }
  return end;
}

// @ts-ignore: decorator valid here
@inline function nextStructural(ptr: usize, end: usize): usize {
  if (JSON_MODE == JSONMode.SIMD) return nextStructural_SIMD(ptr, end);
  return nextStructural_SCALAR(ptr, end);
}

/**
 * Return the position just past the value beginning at `ptr` (which must be at
 * a non-space byte). Strings respect escapes; objects/arrays track nesting via
 * SIMD structural hops. Mirrors `util/scanValueEnd`, inlined + SIMD here.
 */
// @ts-ignore: decorator valid here
@inline export function scanValueEnd(ptr: usize, end: usize): usize {
  const c = load<u16>(ptr);

  if (c == QUOTE) {
    const close = scanPlainString(ptr, end);
    if (close == 0) {
      // escaped: fall to the escape-correct scalar scanner
      const e = scanStringEnd(ptr, end);
      return e >= end ? end : e + 2;
    }
    return close >= end ? end : close + 2;
  }

  if (c == BRACE_LEFT || c == BRACKET_LEFT) {
    let depth = 1;
    ptr += 2;
    while (ptr < end) {
      ptr = nextStructural(ptr, end); // SIMD-skip filler to the next structural
      if (ptr >= end) return end;
      const code = load<u16>(ptr);
      if (code == QUOTE) {
        // skip nested string wholesale so its braces don't move `depth`
        const close = scanPlainString(ptr, end);
        const past = close != 0 ? close : scanStringEnd(ptr, end);
        if (past >= end) return end;
        ptr = past + 2;
        continue;
      }
      if (code == BRACE_LEFT || code == BRACKET_LEFT) depth++;
      else if (--depth == 0) return ptr + 2; // } or ]
      ptr += 2;
    }
    return end;
  }

  // scalar (number / true / false / null): stop at a structural terminator
  while (ptr < end) {
    const code = load<u16>(ptr);
    if (
      code == COMMA ||
      code == BRACKET_RIGHT ||
      code == BRACE_RIGHT ||
      isSpace(code)
    )
      break;
    ptr += 2;
  }
  return ptr;
}

// --- NaN-box scalar cache --------------------------------------------------
//
// Once a scalar is decoded we stash it in an 8-byte word using the same
// quiet-NaN boxing scheme as JSON.Value, so the resolved value is bit-portable
// to the eager API later and a re-read is one masked load. f64 lives raw; every
// other scalar is boxed under a quiet-NaN with a small tag.
// @ts-ignore: decorator valid here
@inline const BOX_QNAN: u64 = 0x7ffc000000000000;
// @ts-ignore: decorator valid here
@inline const BOX_TAG_SHIFT: u8 = 45;
// @ts-ignore: decorator valid here
@inline const BOX_PAYLOAD_MASK: u64 = 0x00001fffffffffff;
// @ts-ignore: decorator valid here
@inline const BOX_EMPTY: u64 = 0; // 0 is a valid f64 (+0.0); use a side flag instead

// @ts-ignore: decorator valid here
@inline function boxBool(b: bool): u64 {
  return BOX_QNAN | (((<u64>Kind.Bool) << BOX_TAG_SHIFT) | (b ? 1 : 0));
}

/**
 * A lazy cursor into a Document. Heap-light: one packed `loc` word plus a
 * cached NaN-box and a `resolved` flag. Navigation returns fresh `Value`s but
 * never copies source bytes; only scalar reads touch the text, and only once.
 *
 * Uses TS get/set accessors for the ergonomic surface (`v.kind`, `v.length`).
 */
export class Value {
  /** Packed `[start,end)` slice of source this cursor covers. */
  private loc: Loc;
  /** NaN-boxed decoded scalar, valid only when `resolved` is true. */
  private cache: u64 = BOX_EMPTY;
  private resolved: bool = false;

  constructor(loc: Loc) {
    this.loc = loc;
  }

  // @ts-ignore: decorator valid here
  @inline static at(start: usize, end: usize): Value {
    return new Value(locOf(start, skipTrailing(start, end)));
  }

  /** Internal: hand the packed slice to same-module helpers (ObjectIter). */
  // @ts-ignore: decorator valid here
  @inline _loc(): Loc {
    return this.loc;
  }

  /** Structural kind, by peeking the first byte. Cheap; no scan. */
  get kind(): Kind {
    const s = skipWs(locStart(this.loc), locEnd(this.loc));
    return classify(s, locEnd(this.loc));
  }

  get isNull(): bool {
    return this.kind == Kind.Null;
  }

  /**
   * Element/member count. This DOES scan the immediate container (one shallow
   * pass, skipping nested values via `scanValueEnd`) — that's the on-demand
   * cost of asking. Scalars/strings report 0.
   */
  get length(): i32 {
    const k = this.kind;
    if (k != Kind.Array && k != Kind.Object) return 0;
    let ptr = skipWs(locStart(this.loc), locEnd(this.loc)) + 2; // past '[' or '{'
    const end = locEnd(this.loc);
    let n = 0;
    ptr = skipWs(ptr, end);
    if (
      ptr < end &&
      (load<u16>(ptr) == BRACKET_RIGHT || load<u16>(ptr) == BRACE_RIGHT)
    )
      return 0; // empty container
    while (ptr < end) {
      if (k == Kind.Object) {
        // skip "key" :
        ptr = skipWs(ptr, end);
        ptr = scanValueEnd(ptr, end); // past the key string
        ptr = skipWs(ptr, end);
        if (ptr < end && load<u16>(ptr) == COLON) ptr += 2;
        ptr = skipWs(ptr, end);
      }
      ptr = scanValueEnd(ptr, end); // skip the value
      n++;
      ptr = skipWs(ptr, end);
      if (ptr >= end) break;
      const code = load<u16>(ptr);
      if (code == COMMA) {
        ptr += 2;
        continue;
      }
      break; // ']' or '}'
    }
    return n;
  }

  // --- scalar reads (lazy + cached) ----------------------------------------

  asBool(): bool {
    if (this.resolved) return <bool>(this.cache & 1);
    const b = locAsBool(this.loc);
    this.cache = boxBool(b);
    this.resolved = true;
    return b;
  }

  /** Full IEEE grammar (sign/frac/exp) via the shared `parseFloatFast`. */
  asF64(): f64 {
    if (this.resolved) return reinterpret<f64>(this.cache);
    const v = locAsF64(this.loc);
    this.cache = reinterpret<u64>(v);
    this.resolved = true;
    return v;
  }

  /** Integer fast path — consumes the slice as digits via the shared `atoi`. */
  // @ts-ignore: decorator valid here
  @inline asI64(): i64 {
    return locAsI64(this.loc);
  }

  // @ts-ignore: decorator valid here
  @inline asI32(): i32 {
    return locAsI32(this.loc);
  }

  /** Real JSON unescaping via the library's mode-dispatched string handler. */
  // @ts-ignore: decorator valid here
  @inline asString(): string {
    return locAsString(this.loc);
  }

  // --- navigation (zero source copy) ---------------------------------------

  /**
   * Look up `key` in an object. Linear scan of *this* container only — nested
   * objects are skipped wholesale, never descended, so cost is proportional to
   * the keys you pass, not the document size.
   * @returns a fresh lazy cursor at the value, or null if absent.
   */
  get(key: string): Value | null {
    if (this.kind != Kind.Object) return null;
    const end = locEnd(this.loc);
    let ptr = skipWs(locStart(this.loc), end) + 2; // past '{'
    const kStart = changetype<usize>(key);
    const kLen = key.length;
    while (true) {
      ptr = skipWs(ptr, end);
      if (ptr >= end || load<u16>(ptr) != QUOTE) return null; // '}' or malformed
      const keyClose = scanStringEnd(ptr, end);
      // compare key bytes without allocating
      const matched =
        (keyClose - (ptr + 2)) >> 1 == kLen &&
        memEq(ptr + 2, kStart, (<usize>kLen) << 1);
      ptr = keyClose + 2;
      ptr = skipWs(ptr, end);
      if (ptr < end && load<u16>(ptr) == COLON) ptr += 2;
      ptr = skipWs(ptr, end);
      const vEnd = scanValueEnd(ptr, end);
      if (matched) return new Value(locOf(ptr, vEnd));
      ptr = skipWs(vEnd, end);
      if (ptr >= end || load<u16>(ptr) != COMMA) return null;
      ptr += 2;
    }
  }

  /**
   * Index into an array. Linear scan to the i-th element (on-demand: O(i),
   * not O(1) — there's no index without paying to build one).
   * @returns a fresh lazy cursor at the element, or null if out of range.
   */
  at(i: i32): Value | null {
    if (this.kind != Kind.Array || i < 0) return null;
    const end = locEnd(this.loc);
    let ptr = skipWs(locStart(this.loc), end) + 2; // past '['
    ptr = skipWs(ptr, end);
    if (ptr < end && load<u16>(ptr) == BRACKET_RIGHT) return null; // empty
    let idx = 0;
    while (ptr < end) {
      const vEnd = scanValueEnd(ptr, end);
      if (idx == i) return new Value(locOf(ptr, vEnd));
      ptr = skipWs(vEnd, end);
      if (ptr >= end || load<u16>(ptr) != COMMA) return null;
      ptr += 2;
      ptr = skipWs(ptr, end);
      idx++;
    }
    return null;
  }

  /** The raw source slice this cursor covers (no copy of structure). */
  raw(): string {
    const s = skipWs(locStart(this.loc), locEnd(this.loc));
    return stringOf(s, locEnd(this.loc));
  }

  // --- set side (mutation overlay) -----------------------------------------
  //
  // TODO: on-demand mutation. The source buffer is read-only/borrowed, so a
  // real `set` records overrides in a copy-on-write overlay (keyed by `loc`)
  // and re-serializes lazily. Stubbed for now so the accessor shape is visible.
  set(key: string, value: string): void {
    // placeholder — see overlay design note in playground/README.md
    assert(false, "lazy set() not implemented yet");
  }
}

/**
 * A pinned JSON document. Holds the source `string` so the GC keeps it alive
 * while cursors borrow raw pointers into it. The entry point hands back a
 * lazy `root` cursor; nothing is parsed until you navigate.
 */
export class Document {
  /** Kept alive so borrowed cursor pointers stay valid. */
  private src: string;

  private constructor(src: string) {
    this.src = src;
  }

  // @ts-ignore: decorator valid here
  @inline static from(text: string): Document {
    return new Document(text);
  }

  /** Lazy cursor at the document root. No scanning happens here. */
  get root(): Value {
    const start = changetype<usize>(this.src);
    const end = start + ((<usize>this.src.length) << 1);
    return Value.at(start, end);
  }
}

/**
 * Zero-allocation forward walk over an object's members. This is the primitive
 * the *dense* on-demand codegen needs: one linear pass that visits every
 * `"key": value` member in source order, so a struct can fill all its fields in
 * a single sweep instead of re-scanning per field.
 *
 * Allocates nothing per step — the current key is exposed as a raw `[keyStart,
 * keyEnd)` range (compare it with `keyEquals` to avoid materializing a string)
 * and the current value as a borrowed cursor.
 *
 * ```
 * const it = new ObjectIter(objValue);
 * while (it.next()) {
 *   if (it.keyEquals("uid")) uid = it.value().asI32();
 * }
 * ```
 */
export class ObjectIter {
  private ptr: usize;
  private end: usize;
  /** Inner bytes of the current key (between the quotes). */
  keyStart: usize = 0;
  keyEnd: usize = 0;
  private valLoc: Loc = 0;

  constructor(obj: Value) {
    const loc = obj._loc();
    const start = skipWs(locStart(loc), locEnd(loc));
    this.end = locEnd(loc);
    // step past '{' if this really is an object; otherwise next() yields nothing
    this.ptr =
      start < this.end && load<u16>(start) == BRACE_LEFT ? start + 2 : this.end;
  }

  /** Advance to the next member. Returns false at the closing `}`. */
  next(): bool {
    let ptr = skipWs(this.ptr, this.end);
    const end = this.end;
    if (ptr >= end || load<u16>(ptr) != QUOTE) return false; // '}' or done
    const keyClose = scanStringEnd(ptr, end);
    this.keyStart = ptr + 2;
    this.keyEnd = keyClose;
    ptr = skipWs(keyClose + 2, end);
    if (ptr < end && load<u16>(ptr) == COLON) ptr += 2;
    ptr = skipWs(ptr, end);
    const vEnd = scanValueEnd(ptr, end);
    this.valLoc = locOf(ptr, vEnd);
    ptr = skipWs(vEnd, end);
    if (ptr < end && load<u16>(ptr) == COMMA) ptr += 2;
    this.ptr = ptr;
    return true;
  }

  /** Compare the current key to `s` without allocating. */
  keyEquals(s: string): bool {
    const len = s.length;
    if ((this.keyEnd - this.keyStart) >> 1 != <usize>len) return false;
    return memEq(this.keyStart, changetype<usize>(s), (<usize>len) << 1);
  }

  /** Borrowed cursor at the current member's value. */
  // @ts-ignore: decorator valid here
  @inline value(): Value {
    return new Value(this.valLoc);
  }
}

// ---------------------------------------------------------------------------
// Zero-allocation value-cursor API (EXPERIMENT)
// ---------------------------------------------------------------------------
//
// The `Value`/`Document` classes above allocate a heap object per navigation
// hop (root, each get/at). On a SMALL document there's nothing to skip, so that
// per-hop alloc is pure overhead and lazy loses to eager. This API does the
// exact same scanning but operates on the packed `Loc` u64 by value — zero heap
// until the final string copy. The typed-struct codegen would hold a `u64`
// field and call these, not a `Value` reference.

/** Root loc over a source string. No scanning. */
// @ts-ignore: decorator valid here
@inline export function docRootLoc(src: string): Loc {
  const start = changetype<usize>(src);
  const end = start + ((<usize>src.length) << 1);
  return locOf(start, skipTrailing(start, end));
}

/**
 * Bind a cursor over a raw `[start, end)` source slice (pointers, as the
 * deserialize entry points use), trimming trailing whitespace. This is the
 * O(1) "parse" the lazy struct codegen lowers `JSON.parse<T>` to.
 */
// @ts-ignore: decorator valid here
@inline export function lazyBind(start: usize, end: usize): Loc {
  return locOf(start, skipTrailing(start, end));
}

/** Structural kind at `loc` — O(1), peeks the first non-space byte. */
// @ts-ignore: decorator valid here
@inline export function locKind(loc: Loc): Kind {
  const end = locEnd(loc);
  return classify(skipWs(locStart(loc), end), end);
}

/**
 * Index into the array at `loc`: returns the i-th element's loc, or 0 if not an
 * array / out of range. Linear scan (O(i)) — on-demand has no free index.
 */
export function locAt(loc: Loc, i: i32): Loc {
  if (i < 0) return 0;
  const end = locEnd(loc);
  let ptr = skipWs(locStart(loc), end);
  if (ptr >= end || load<u16>(ptr) != BRACKET_LEFT) return 0;
  ptr = skipWs(ptr + 2, end);
  if (ptr < end && load<u16>(ptr) == BRACKET_RIGHT) return 0; // empty
  let idx = 0;
  while (ptr < end) {
    const vEnd = scanValueEnd(ptr, end);
    if (idx == i) return locOf(ptr, vEnd);
    ptr = skipWs(vEnd, end);
    if (ptr >= end || load<u16>(ptr) != COMMA) return 0;
    ptr = skipWs(ptr + 2, end);
    idx++;
  }
  return 0;
}

/**
 * Member/element count at `loc` (one shallow pass, skipping nested values via
 * `scanValueEnd`). Scalars/strings report 0.
 */
export function locLength(loc: Loc): i32 {
  const end = locEnd(loc);
  let ptr = skipWs(locStart(loc), end);
  if (ptr >= end) return 0;
  const open = load<u16>(ptr);
  const isObj = open == BRACE_LEFT;
  if (!isObj && open != BRACKET_LEFT) return 0;
  ptr = skipWs(ptr + 2, end);
  if (
    ptr < end &&
    (load<u16>(ptr) == BRACKET_RIGHT || load<u16>(ptr) == BRACE_RIGHT)
  )
    return 0; // empty container
  let n = 0;
  while (ptr < end) {
    if (isObj) {
      ptr = scanValueEnd(ptr, end); // past the key string
      ptr = skipWs(ptr, end);
      if (ptr < end && load<u16>(ptr) == COLON) ptr += 2;
      ptr = skipWs(ptr, end);
    }
    ptr = scanValueEnd(ptr, end); // skip the value
    n++;
    ptr = skipWs(ptr, end);
    if (ptr >= end || load<u16>(ptr) != COMMA) break;
    ptr = skipWs(ptr + 2, end);
  }
  return n;
}

/**
 * Forward-only scan to a string's closing quote, handling escapes inline
 * (`\X` and `\uXXXX` skip the escaped run) without `scanStringEnd`'s backward
 * backslash-counting walk. Used for the key scan in `locGet`, where most keys
 * are short and unescaped and we re-scan one per skipped member.
 */
// @ts-ignore: decorator valid here
@inline export function scanKeyEnd(ptr: usize, end: usize): usize {
  ptr += 2; // past the opening quote
  while (ptr < end) {
    const c = load<u16>(ptr);
    if (c == QUOTE) return ptr;
    ptr += c == BACK_SLASH ? 4 : 2; // skip an escaped code unit wholesale
  }
  return end;
}

/** `obj.get(key)` by value: returns the value's loc, or 0 if absent. */
export function locGet(loc: Loc, key: string): Loc {
  const end = locEnd(loc);
  let ptr = skipWs(locStart(loc), end);
  if (ptr >= end || load<u16>(ptr) != BRACE_LEFT) return 0;
  ptr += 2;
  const kStart = changetype<usize>(key);
  const kBytes = (<usize>key.length) << 1;
  while (true) {
    ptr = skipWs(ptr, end);
    if (ptr >= end || load<u16>(ptr) != QUOTE) return 0;
    const kBeg = ptr + 2;
    const keyClose = scanKeyEnd(ptr, end);
    // length-gate first (cheap), only then the byte compare
    const matched = keyClose - kBeg == kBytes && memEq(kBeg, kStart, kBytes);
    ptr = skipWs(keyClose + 2, end);
    if (ptr < end && load<u16>(ptr) == COLON) ptr += 2;
    ptr = skipWs(ptr, end);
    const vEnd = scanValueEnd(ptr, end);
    if (matched) return locOf(ptr, vEnd);
    // Skip to the next member. In minified input `vEnd` is already at the
    // comma, so check it before paying for a whitespace skip.
    if (vEnd < end && load<u16>(vEnd) == COMMA) {
      ptr = vEnd + 2;
      continue;
    }
    ptr = skipWs(vEnd, end);
    if (ptr >= end || load<u16>(ptr) != COMMA) return 0;
    ptr += 2;
  }
}

/**
 * Like {@link locGet} but returns the LAST matching member's value (or 0 if
 * absent). JSON with duplicate keys is last-wins in the eager deserializer
 * (later members overwrite earlier), so the lazy field fill uses this to match
 * eager semantics exactly. Scans the whole object once.
 */
export function locGetLast(loc: Loc, key: string): Loc {
  const end = locEnd(loc);
  let ptr = skipWs(locStart(loc), end);
  if (ptr >= end || load<u16>(ptr) != BRACE_LEFT) return 0;
  ptr += 2;
  const kStart = changetype<usize>(key);
  const kBytes = (<usize>key.length) << 1;
  let found: Loc = 0;
  while (true) {
    ptr = skipWs(ptr, end);
    if (ptr >= end || load<u16>(ptr) != QUOTE) return found;
    const kBeg = ptr + 2;
    const keyClose = scanKeyEnd(ptr, end);
    const matched = keyClose - kBeg == kBytes && memEq(kBeg, kStart, kBytes);
    ptr = skipWs(keyClose + 2, end);
    if (ptr < end && load<u16>(ptr) == COLON) ptr += 2;
    ptr = skipWs(ptr, end);
    const vEnd = scanValueEnd(ptr, end);
    if (matched) found = locOf(ptr, vEnd); // keep scanning — last wins
    ptr = skipWs(vEnd, end);
    if (ptr >= end || load<u16>(ptr) != COMMA) return found;
    ptr += 2;
  }
}

/**
 * Stateful object reader — the simdjson `ondemand::object` technique.
 *
 * `locGet` rescans from `{` every call, so reading N fields is O(N²). This
 * reader keeps a cursor that ADVANCES past each found field, so reading fields
 * in source order is O(1) amortized (O(N) total). Out-of-order lookups still
 * resolve via a single WRAPAROUND: scan forward to `}`, then wrap to the object
 * start and scan up to where this search began — simdjson's
 * `find_field_unordered` (`object["x"]`) semantics. (`locGet` ≈ the always-from
 * -start variant; this ≈ the advancing one. The forward-only, never-wrap
 * `find_field` is the third, fastest-but-strict mode — not exposed here.)
 *
 * Keys are matched on raw source bytes (no unescape), exactly as simdjson does.
 * One allocation per object (the reader handle); the per-field cost is just the
 * scan — so the win amortizes over multi-field reads. The lazy-struct codegen
 * would hold this cursor's `pos` inline in the struct (zero extra allocation).
 */
export class ObjReader {
  private oStart: usize = 0; // first member start (just past '{')
  private oEnd: usize = 0; // object end (just past '}')
  private pos: usize = 0; // resume position — start of the next member to examine

  // @ts-ignore: decorator valid here
  @inline static of(objLoc: Loc): ObjReader {
    const r = new ObjReader();
    const end = locEnd(objLoc);
    let p = skipWs(locStart(objLoc), end);
    p = p < end && load<u16>(p) == BRACE_LEFT ? p + 2 : end;
    r.oStart = p;
    r.oEnd = end;
    r.pos = p;
    return r;
  }

  /** Look up `key`, advancing the cursor; wraps once for out-of-order access. */
  find(key: string): Loc {
    const end = this.oEnd;
    const kStart = changetype<usize>(key);
    const kBytes = (<usize>key.length) << 1;
    const begin = this.pos; // where this search starts (a member boundary)
    let ptr = begin;
    let wrapped = false;
    while (true) {
      ptr = skipWs(ptr, end);
      if (ptr >= end || load<u16>(ptr) != QUOTE) {
        // Hit '}'. Wrap once to the start, unless we already began there or
        // already wrapped — in which case every member has been examined.
        if (wrapped || begin == this.oStart) return 0;
        ptr = this.oStart;
        wrapped = true;
        continue;
      }
      if (wrapped && ptr >= begin) return 0; // came back to where we started
      const kBeg = ptr + 2;
      const keyClose = scanKeyEnd(ptr, end);
      const matched = keyClose - kBeg == kBytes && memEq(kBeg, kStart, kBytes);
      let q = skipWs(keyClose + 2, end);
      if (q < end && load<u16>(q) == COLON) q += 2;
      q = skipWs(q, end);
      const vEnd = scanValueEnd(q, end);
      let nxt = skipWs(vEnd, end);
      if (nxt < end && load<u16>(nxt) == COMMA) nxt += 2;
      if (matched) {
        // Resume after this member; past the last member, wrap to the start so
        // a subsequent out-of-order lookup still finds earlier keys.
        this.pos = nxt >= end ? this.oStart : nxt;
        return locOf(q, vEnd);
      }
      ptr = nxt;
    }
  }

  /** Reset the cursor to the first member (re-iterate the same object). */
  // @ts-ignore: decorator valid here
  @inline reset(): void {
    this.pos = this.oStart;
  }
}

/** Decode the bool at `loc` (`t`rue vs anything else). */
// @ts-ignore: decorator valid here
@inline export function locAsBool(loc: Loc): bool {
  return load<u16>(skipWs(locStart(loc), locEnd(loc))) == CHAR_T;
}

/**
 * Decode the number at `loc` as `T` — any integer width/signedness via `atoi`,
 * any float via `parseFloatFast`. The generic the lazy struct codegen calls.
 */
// @ts-ignore: decorator valid here
@inline export function locAsNum<T>(loc: Loc): T {
  const s = skipWs(locStart(loc), locEnd(loc));
  const e = scanValueEnd(s, locEnd(loc));
  if (isFloat<T>()) return parseFloatFast<T>(s, e);
  return atoi<T>(s, e);
}

/** Decode the integer at `loc` as a 64-bit signed value via the shared `atoi`. */
// @ts-ignore: decorator valid here
@inline export function locAsI64(loc: Loc): i64 {
  const s = skipWs(locStart(loc), locEnd(loc));
  return atoi<i64>(s, scanValueEnd(s, locEnd(loc)));
}

/** Decode the int at `loc`. */
// @ts-ignore: decorator valid here
@inline export function locAsI32(loc: Loc): i32 {
  return <i32>locAsI64(loc);
}

/**
 * Decode the number at `loc` as an f64 — full IEEE grammar (sign / fraction /
 * exponent) via the shared `parseFloatFast`. No string allocation: parses the
 * numeric byte range in place.
 */
// @ts-ignore: decorator valid here
@inline export function locAsF64(loc: Loc): f64 {
  const s = skipWs(locStart(loc), locEnd(loc));
  return parseFloatFast<f64>(s, scanValueEnd(s, locEnd(loc)));
}

/**
 * Copy the string at `loc`, unescaping per the JSON grammar.
 *
 * Common case (no backslash) is fused into ONE forward pass: we scan for the
 * closing quote and, finding no escape, bulk-copy the inner bytes with a single
 * `memory.copy` — no second scan, no `bs` round-trip. Only when a backslash
 * appears do we fall to the library's mode-dispatched `deserializeString`
 * (which handles `\n \t \" \\ \/ \uXXXX` + surrogate pairs). Nothing is
 * allocated until the result string.
 */
// @ts-ignore: decorator valid here
@inline export function locAsString(loc: Loc): string {
  const start = skipWs(locStart(loc), locEnd(loc));
  const end = locEnd(loc);
  if (load<u16>(start) != QUOTE) return stringOf(start, end); // tolerant: bare slice
  const close = scanPlainString(start, end);
  if (close != 0) return stringOf(start + 2, close); // no escape -> one copy
  // `deserializeString` wants quote-inclusive bounds; the value loc already
  // covers the full `"..."` token (scanValueEnd lands just past the close).
  return deserializeString(start, scanValueEnd(start, end));
}

/**
 * Code-unit length of the string at `loc` WITHOUT allocating it. The common
 * (unescaped) case is a pointer subtraction — zero heap. Escaped strings are
 * rare and fall back to a decode (one alloc) to count correctly.
 *
 * Use this for length / size checks where the value itself isn't needed:
 * `locAsString(...).length` allocates the whole string just to read `.length`;
 * `locStringLength(...)` does not.
 */
// @ts-ignore: decorator valid here
@inline export function locStringLength(loc: Loc): i32 {
  const start = skipWs(locStart(loc), locEnd(loc));
  const end = locEnd(loc);
  if (load<u16>(start) != QUOTE) return <i32>((end - start) >> 1);
  const close = scanPlainString(start, end);
  if (close != 0) return <i32>((close - (start + 2)) >> 1);
  return deserializeString(start, scanValueEnd(start, end)).length;
}

/**
 * Equality of the string at `loc` to `s` WITHOUT allocating. Unescaped case is
 * a length-gate + `memEq` over the source bytes — zero heap, the right tool for
 * routing / filtering on a field value. Escaped strings decode then compare.
 */
// @ts-ignore: decorator valid here
@inline export function locStringEq(loc: Loc, s: string): bool {
  const start = skipWs(locStart(loc), locEnd(loc));
  const end = locEnd(loc);
  if (load<u16>(start) != QUOTE) return false;
  const close = scanPlainString(start, end);
  const sBytes = (<usize>s.length) << 1;
  if (close != 0) {
    const inner = start + 2;
    return (
      close - inner == sBytes && memEq(inner, changetype<usize>(s), sBytes)
    );
  }
  return deserializeString(start, scanValueEnd(start, end)) == s;
}

/**
 * Decode the string at `loc` into the caller's existing `out` buffer
 * (`__renew`d in place), avoiding a fresh allocation on every read. Mirrors the
 * library's `JSON.stringify(data, out)` / `JSON.parse(data, out)` reuse pattern
 * — for batch loops over many documents that reuse one scratch string, this
 * turns N allocations into ~1 (amortized). Escaped strings can't reuse the
 * buffer and fall back to a fresh decode.
 */
// @ts-ignore: decorator valid here
@inline export function locReadStringInto(loc: Loc, out: string): string {
  const start = skipWs(locStart(loc), locEnd(loc));
  const end = locEnd(loc);
  if (load<u16>(start) == QUOTE) {
    const close = scanPlainString(start, end);
    if (close != 0) {
      const inner = start + 2;
      const size = close - inner;
      out = changetype<string>(__renew(changetype<usize>(out), size));
      memory.copy(changetype<usize>(out), inner, size);
      return out;
    }
  }
  return locAsString(loc); // escaped / bare: fresh decode, no reuse
}

// --- small helpers ---------------------------------------------------------

/** Trim trailing whitespace so a slice's `end` is exactly past the value. */
// @ts-ignore: decorator valid here
@inline function skipTrailing(start: usize, end: usize): usize {
  while (end > start && isSpace(load<u16>(end - 2))) end -= 2;
  return end;
}

/** Copy a `[start,end)` UTF-16 range into a fresh string. */
// @ts-ignore: decorator valid here
@inline function stringOf(start: usize, end: usize): string {
  const size = end - start;
  const out = __new(size, idof<string>());
  memory.copy(out, start, size);
  return changetype<string>(out);
}

/** Byte-equality of two UTF-16 ranges of the same length `bytes`. */
// @ts-ignore: decorator valid here
@inline export function memEq(a: usize, b: usize, bytes: usize): bool {
  let i: usize = 0;
  for (; i + 8 <= bytes; i += 8)
    if (load<u64>(a + i) != load<u64>(b + i)) return false;
  for (; i < bytes; i += 2)
    if (load<u16>(a + i) != load<u16>(b + i)) return false;
  return true;
}
