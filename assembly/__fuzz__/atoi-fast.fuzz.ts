import { expect, fuzz, FuzzSeed } from "as-test";
import { atoi as atoi_OLD } from "../util/atoi";
import { atou, atoi, atouScan, atoiScan } from "../util/atoi-fast";

const KEEP: string[] = [];

/**
 * Build a UTF-16 string from `s`, keep it rooted, and pack
 * `(start << 32) | end` into a `u64`.
 *
 * @param s The source string to keep alive and address.
 * @returns A `u64` packing the start pointer in the high 32 and end in low 32.
 */
function range(s: string): u64 {
  KEEP.push(s);
  const start = changetype<usize>(s);
  const end = start + ((<usize>s.length) << 1);
  return ((<u64>start) << 32) | (<u64>end);
}

// @ts-expect-error: @inline is a valid decorator
@inline function startOf(r: u64): usize {
  return <usize>(r >> 32);
}

// @ts-expect-error: @inline is a valid decorator
@inline function endOf(r: u64): usize {
  return <usize>(r & 0xffffffff);
}

// ---------------------------------------------------------------------------
// Consume-to-end: cross-check against the scalar baseline `atoi<T>`.
// ---------------------------------------------------------------------------

fuzz("atou<u32> agrees with the scalar baseline", (n: u32): bool => {
  const r = range(n.toString());
  const fast = atou<u32>(startOf(r), endOf(r));
  const slow = atoi_OLD<u32>(startOf(r), endOf(r));
  expect(fast).toBe(slow);
  expect(fast).toBe(n);
  return fast == n;
}).generate((seed: FuzzSeed, run: (n: u32) => bool): void => {
  run(seed.u32());
});

fuzz(
  "atou<u64> agrees with the scalar baseline",
  (high: u32, low: u32): bool => {
    const n = ((<u64>high) << 32) | (<u64>low);
    const r = range(n.toString());
    const fast = atou<u64>(startOf(r), endOf(r));
    const slow = atoi_OLD<u64>(startOf(r), endOf(r));
    expect(fast).toBe(slow);
    expect(fast).toBe(n);
    return fast == n;
  },
).generate((seed: FuzzSeed, run: (high: u32, low: u32) => bool): void => {
  run(seed.u32(), seed.u32());
});

fuzz("atoi<i32> roundtrips through string form", (n: i32): bool => {
  const r = range(n.toString());
  const fast = atoi<i32>(startOf(r), endOf(r));
  expect(fast).toBe(n);
  return fast == n;
}).generate((seed: FuzzSeed, run: (n: i32) => bool): void => {
  run(<i32>seed.u32());
});

fuzz(
  "atoi<i64> roundtrips through string form",
  (high: u32, low: u32): bool => {
    const n = <i64>(((<u64>high) << 32) | (<u64>low));
    const r = range(n.toString());
    const fast = atoi<i64>(startOf(r), endOf(r));
    expect(fast).toBe(n);
    return fast == n;
  },
).generate((seed: FuzzSeed, run: (high: u32, low: u32) => bool): void => {
  run(seed.u32(), seed.u32());
});

// ---------------------------------------------------------------------------
// Scan-to-non-digit: random digit run followed by a non-digit terminator.
// ---------------------------------------------------------------------------

fuzz(
  "atouScan<u64> stops at the comma and stores the value",
  (high: u32, low: u32): bool => {
    const n = ((<u64>high) << 32) | (<u64>low);
    const digits = n.toString();
    const r = range(digits + ",");
    const slot = memory.data(8);
    const next = atouScan<u64>(startOf(r), endOf(r), slot);

    expect(load<u64>(slot)).toBe(n);
    expect(next - startOf(r)).toBe((<usize>digits.length) << 1);
    return load<u64>(slot) == n;
  },
).generate((seed: FuzzSeed, run: (high: u32, low: u32) => bool): void => {
  run(seed.u32(), seed.u32());
});

fuzz(
  "atoiScan<i32> stops at the comma and stores the value",
  (n: i32): bool => {
    const digits = n.toString();
    const r = range(digits + ",");
    const slot = memory.data(8);
    const next = atoiScan<i32>(startOf(r), endOf(r), slot);

    expect(load<i32>(slot)).toBe(n);
    expect(next - startOf(r)).toBe((<usize>digits.length) << 1);
    return load<i32>(slot) == n;
  },
).generate((seed: FuzzSeed, run: (n: i32) => bool): void => {
  run(<i32>seed.u32());
});

fuzz(
  "atoiScan<i64> stops at the comma and stores the value",
  (high: u32, low: u32): bool => {
    const n = <i64>(((<u64>high) << 32) | (<u64>low));
    const digits = n.toString();
    const r = range(digits + ",");
    const slot = memory.data(8);
    const next = atoiScan<i64>(startOf(r), endOf(r), slot);

    expect(load<i64>(slot)).toBe(n);
    expect(next - startOf(r)).toBe((<usize>digits.length) << 1);
    return load<i64>(slot) == n;
  },
).generate((seed: FuzzSeed, run: (high: u32, low: u32) => bool): void => {
  run(seed.u32(), seed.u32());
});
