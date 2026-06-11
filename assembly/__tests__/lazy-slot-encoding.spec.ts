import { JSON } from "..";
import { describe, expect } from "as-test";

// Unit-tests the packed lazy-slot encoding (JSON.Value.lazyBits) and its
// compact <-> absolute fallback boundary, without allocating multi-MB payloads.
// Pointers are synthetic; the compact path is pure arithmetic (no deref).
const base: usize = 0x10000;
const OFF_MAX: usize = 0x7fffff; // 23-bit offset field max (~16 MB source)
const LEN_MAX: usize = 0x1fffff; // 21-bit length field max (~4 MB value)

describe("lazy slot: compact form is exact (no scan)", () => {
  const start = base + (10 << 1);
  const end = start + (100 << 1);
  const w = JSON.Value.lazyBits(base, start, end);
  expect(JSON.Value.slotIsLazy(w)).toBe(true);
  expect(JSON.Value.slotPtr(w, base)).toBe(start);
  expect(JSON.Value.slotEnd(w, base, start)).toBe(end); // short srcEnd -> proves no scan
});

describe("lazy slot: offset/length exactly at the field max stay compact", () => {
  const start = base + (OFF_MAX << 1); // offset == max (fits)
  const end = start + (10 << 1);
  const w = JSON.Value.lazyBits(base, start, end);
  expect(JSON.Value.slotPtr(w, base)).toBe(start);
  expect(JSON.Value.slotEnd(w, base, start)).toBe(end);

  const s2 = base + (10 << 1);
  const e2 = s2 + (LEN_MAX << 1); // length == max (fits)
  const w2 = JSON.Value.lazyBits(base, s2, e2);
  expect(JSON.Value.slotEnd(w2, base, s2)).toBe(e2);
});

describe("lazy slot: offset/length overflow falls back to absolute", () => {
  const so = base + ((OFF_MAX + 1) << 1); // offset > max -> absolute
  const eo = so + (10 << 1);
  const wo = JSON.Value.lazyBits(base, so, eo);
  expect(JSON.Value.slotIsLazy(wo)).toBe(true);
  expect(JSON.Value.slotPtr(wo, base)).toBe(so); // absolute stores the raw ptr

  const sl = base + (10 << 1);
  const el = sl + ((LEN_MAX + 1) << 1); // length > max -> absolute
  const wl = JSON.Value.lazyBits(base, sl, el);
  expect(JSON.Value.slotPtr(wl, base)).toBe(sl);
});
