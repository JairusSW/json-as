import { JSON } from "../index";
const backing = new ArrayBuffer(1024);
const alphabet: u16[] = [91,93,123,125,34,92,32,9,10,13,48,49,50,58,44,0,0xffff];
const fragments = ['["\\\"[]{}",[1,2]]', '{"x":"\\\\\\\"[]","y":[{},[]]}', '[1,2,3]', '["unterminated'];
function reference(start: usize, end: usize): usize {
  if (start >= end) return 0;
  let depth = 1;
  let quoted = false;
  let ptr = start + 2;
  while (ptr < end) {
    const code = load<u16>(ptr);
    if (code == 34) {
      if (!quoted) quoted = true;
      else {
        let slash = ptr - 2;
        let escaped = false;
        while (slash > start && load<u16>(slash) == 92) {
          escaped = !escaped;
          slash -= 2;
        }
        if (!escaped) quoted = false;
      }
    } else if (!quoted) {
      const folded = code & 0xffdf;
      if (folded == 91) depth++;
      else if (folded == 93 && --depth == 0) return ptr + 2;
    }
    ptr += 2;
  }
  return 0;
}
function check(start: usize, end: usize): void {
  assert(JSON.Util.scanValueEnd<JSON.Raw>(start, end) == reference(start, end));
}
export function verify(): i32 {
  const base = changetype<usize>(backing);
  let seed: u32 = 731;
  let checks = 0;
  for (let run = 0; run < 200000; run++) {
    seed = seed * 1664525 + 1013904223;
    const len = 1 + <i32>((seed >> 16) & 255);
    const start = base + ((run & 7) << 1);
    store<u16>(start, (run & 1) ? 123 : 91);
    for (let i = 1; i < len; i++) {
      seed = seed * 1664525 + 1013904223;
      store<u16>(start + (i << 1), alphabet[<i32>(seed >> 16) % alphabet.length]);
    }
    check(start, start + (len << 1) - (run & 1));
    checks++;
  }
  // Move every quote, escaped quote and bracket across each wide-block edge.
  for (let pad = 0; pad < 96; pad++) for (let f = 0; f < fragments.length; f++) {
    const text = fragments[f];
    store<u16>(base, 91);
    for (let i = 0; i < pad; i++) store<u16>(base + 2 + (i << 1), 32);
    memory.copy(base + 2 + (pad << 1), changetype<usize>(text), text.length << 1);
    const end = base + 2 + ((pad + text.length) << 1);
    store<u16>(end, 93);
    check(base, end + 2);
    checks++;
  }
  for (let code: u32 = 0; code <= 65535; code++) for (let lane = 0; lane < 64; lane++) {
    store<u16>(base, 91);
    for (let i = 1; i < 128; i++) store<u16>(base + (i << 1), 32);
    store<u16>(base + 2 + (lane << 1), code);
    store<u16>(base + 254, 93);
    check(base, base + 256);
    checks++;
  }
  // Long odd/even escape runs can straddle several packed batches. Compare
  // both complete ranges and truncated tails without allocating test strings.
  for (let pad = 0; pad <= 128; pad++) for (let slashes = 0; slashes <= 256; slashes++) {
    let ptr = base;
    store<u16>(ptr, 91); ptr += 2;
    store<u16>(ptr, 34); ptr += 2;
    for (let i = 0; i < pad; i++) { store<u16>(ptr, 120); ptr += 2; }
    for (let i = 0; i < slashes; i++) { store<u16>(ptr, 92); ptr += 2; }
    store<u16>(ptr, 34); ptr += 2;
    store<u16>(ptr, 123); ptr += 2;
    store<u16>(ptr, 91); ptr += 2;
    store<u16>(ptr, 93); ptr += 2;
    store<u16>(ptr, 125); ptr += 2;
    store<u16>(ptr, 34); ptr += 2;
    store<u16>(ptr, 93); ptr += 2;
    check(base, ptr);
    check(base, ptr - 2);
    checks += 2;
  }
  assert(memory.grow(1) >= 0);
  const physicalEnd = <usize>memory.size() << 16;
  for (let len = 1; len <= 192; len++) for (let odd = 0; odd < 2; odd++) {
    const start = physicalEnd - (len << 1);
    for (let i = 0; i < len; i++) store<u16>(start + (i << 1), i ? 32 : 91);
    if (len > 1) store<u16>(physicalEnd - 2, 93);
    check(start, physicalEnd - odd);
    checks++;
  }
  return checks;
}
