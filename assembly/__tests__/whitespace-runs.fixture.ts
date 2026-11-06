import { JSON } from "../index";
const buffer = new ArrayBuffer(512);
function reference(p: usize, e: usize): usize {
  while (p < e && JSON.Util.isSpace(load<u16>(p))) p += 2;
  return p;
}
export function verify(): i32 {
  const p = changetype<usize>(buffer);
  assert(JSON.Util.skipWhitespace(p + 2, p) == p + 2);
  let count = 0;
  for (let code: u32 = 0; code <= 65535; code++) {
    store<u16>(p, code);
    store<u16>(p + 2, 123);
    assert(JSON.Util.skipWhitespace(p, p + 4) == reference(p, p + 4));
    count++;
  }
  let seed: u32 = 12345;
  for (let run = 0; run < 6000; run++) {
    for (let i = 0; i < 256; i++) {
      seed = seed * 1664525 + 1013904223;
      const c = (seed >> 24) % 10;
      store<u16>(
        p + (i << 1),
        c < 6
          ? c == 0
            ? 32
            : 8 + c
          : c == 6
            ? 123
            : c == 7
              ? 0
              : c == 8
                ? 34
                : 0xffff,
      );
    }
    const start = p + ((run & 3) << 1);
    const end = p + (((run * 17) & 255) << 1);
    if (end >= start) {
      assert(JSON.Util.skipWhitespace(start, end) == reference(start, end));
      count++;
    }
  }
  for (let n = 0; n <= 256; n++) {
    for (let i = 0; i < n; i++) store<u16>(p + (i << 1), 32);
    for (let start = 0; start < n; start++) {
      const s = p + (start << 1),
        e = p + (n << 1);
      assert(JSON.Util.skipWhitespace(s, e) == e);
      count++;
    }
  }
  return count;
}
export function boundary(): i32 {
  const pages = memory.size();
  if (memory.grow(1) < 0) return 0;
  const end = (<usize>(pages + 1)) << 16;
  let count = 0;
  for (let odd = 0; odd < 2; odd++)
    for (let len = 0; len <= 64; len++) {
      const limit = end - odd;
      const p = end - (len << 1);
      for (let i = 0; i < len; i++) store<u16>(p + (i << 1), 32);
      assert(JSON.Util.skipWhitespace(p, limit) == reference(p, limit));
      count++;
      if (len) {
        store<u16>(end - 2, 123);
        assert(JSON.Util.skipWhitespace(p, limit) == reference(p, limit));
        count++;
      }
    }
  return count;
}

export function codeUnits(): i32 {
  const p = changetype<usize>(buffer);
  let count = 0;
  for (let code: u32 = 0; code <= 65535; code++) for (let lane = 0; lane < 8; lane++) {
    for (let i = 0; i < 9; i++) store<u16>(p + (i << 1), 32);
    store<u16>(p + 2 + (lane << 1), code);
    store<u16>(p + 18, 123);
    assert(JSON.Util.skipWhitespace(p, p + 20) == reference(p, p + 20));
    count++;
  }
  return count;
}
